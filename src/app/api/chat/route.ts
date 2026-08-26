import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { callAi, callAiStream, getProviderStatus, resolveKey } from '@/lib/ai-gateway'
import { rateLimit } from '@/lib/rate-limit'
import { buildEvidence } from '@/lib/evidence-builder'

// ── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are ELASTICO — a football intelligence analyst, not a chatbot.

## Identity
Direct. Analytical. Calm. Professional. Confident without pretending certainty.
You sound like a very good football analyst who has access to underlying data.

## What you do
- Analyse matches, teams, players, tactics, competitions and trends
- Reference specific competitions (Premier League, La Liga, Champions League, etc.) and current 2025-26 season context
- Explain models when asked: ELO (team strength), Poisson (independent goal probability), Dixon-Coles (correlated low-scoreline adjustment), Stochastic Merton Jump-Diffusion with GARCH (Monte Carlo simulation)

## Response format

Match your depth to the question. Simple question = short answer. Complex question = structured analysis.

For analytical questions, use this structure:
## Bottom line
[one-sentence conclusion]

## Key findings
1. [finding]
2. [finding]
3. [finding]

## Evidence
[supporting data]

## My read
[your analytical interpretation — clearly labelled as interpretation]

For comparisons, use markdown tables when useful.

Always put the conclusion first. A reader should understand your answer from the first 20%.

## Text rules
- Bold: conclusions, important numbers, decisive warnings, action recommendations
- No emojis. This is a professional intelligence product.
- No "Great question!" or generic chatbot enthusiasm
- Use bullet points for stats. Short paragraphs.
- Never produce a wall of text when a few lines suffice.

## Truth classification
You must internally distinguish and signal the nature of every factual claim:

- **REAL** — directly from the provided match/data context
- **DERIVED** — calculated from available data (e.g. averages, percentages)
- **ANALYSIS** — your tactical or strategic interpretation
- **UNKNOWN** — you do not have reliable data for this

When you present a statistic that comes from the user's provided context, say so. When you are reasoning from general football knowledge, say so. Never blur the line.

## Honesty rules — non-negotiable
- If you don't have real data for a question, say: "I don't have reliable data for that." Then offer what you can do instead.
- xG values from broadcasts are often OPTA/FotMob estimates, not raw data — note this when relevant.
- Form is inherently noisy. A 5-game sample is not statistically reliable. Say so.
- Bookmaker odds typically encode more information than any single model. When in doubt, the market is the oracle.
- Never claim a prediction is "guaranteed" or give confidence above 70% for a single match.
- Never fabricate statistics. If the database context doesn't contain a number, don't invent one.
- Never present derived or inferred information as directly measured data.
- Never convert missing values into zero to make the answer look complete.

## Commands
When the user types a command (starting with /), detect the intent and respond appropriately:
- /analyze <team> — tactical and performance analysis
- /compare <team1> <team2> — head-to-head comparison
- /match <team1> vs <team2> — match preview
- /player <name> — player analysis
- /team <name> — team overview
- /form <team> [N] — recent form analysis (last N matches, default 5)
- /predict <team1> <team2> — prediction with probabilities
- /odds <team1> <team2> — betting market analysis
- /news <team/topic> — latest news context
- /help — list available commands

Commands do not replace natural language. If the user asks naturally, detect the intent.

## What you are not
- Not a search engine
- Not a stats database
- Not a chatbot helping with homework
- Not enthusiastic or corporate
- Not a replacement for the user's own judgment`

// ── Command Handler (bypasses AI for /help) ────────────────────────────────────

function handleCommand(message: string): string | null {
  const trimmed = message.trim().toLowerCase()
  if (trimmed === '/help' || trimmed === '/commands') {
    return `## Commands

| Command | Description |
|---------|-------------|
| /analyze <team> | Tactical and performance analysis |
| /compare <team1> <team2> | Head-to-head comparison |
| /match <team1> vs <team2> | Match preview |
| /player <name> | Player analysis |
| /team <name> | Team overview |
| /form <team> [N] | Recent form (last N matches) |
| /predict <team1> <team2> | Prediction with probabilities |
| /odds <team1> <team2> | Betting market analysis |
| /news <team/topic> | Latest news context |
| /help | Show this list |

You can also ask naturally — ELASTICO detects the intent.`
  }
  return null // Not a built-in command, let AI handle it
}

// ── Honest Fallback (no AI provider configured) ─────────────────────────────────────

function honestNoAiResponse(message: string, matchContext: Record<string, unknown> | null): string {
  // Built-in commands still work without AI
  const cmd = handleCommand(message)
  if (cmd) return cmd

  const lines = [
    '## ELASTICO — No AI Provider Configured',
    '',
    'AI-powered analysis requires at least one configured provider. Currently **no LLM API keys are set**.',
    '',
    '**Available providers** (set any one in environment variables):',
    '| Provider | Env Variable | Status |',
    '|----------|-------------|--------|',
    '| Groq | `GROQ_API_KEY` | Not configured |',
    '| Cerebras | `CEREBRAS_API_KEY` | Not configured |',
    '| Google Gemini | `GOOGLE_AI_API_KEY` | Not configured |',
    '| OpenRouter | `OPENROUTER_API_KEY` | Not configured |',
    '| NVIDIA NIM | `NVIDIA_API_KEY` | Not configured |',
    '| Mistral | `MISTRAL_API_KEY` | Not configured |',
    '| GitHub Models | `GITHUB_TOKEN` | Not configured |',
    '',
    'Once a key is set, ELASTICO will use it automatically with failover across all configured providers.',
    '',
    '**What still works without AI:**',
    '- `/help` — list all commands',
    '- Match data from ESPN (live scores, standings, results)',
    '- Prediction engine (ELO, Poisson, Dixon-Coles models)',
    '- Community votes and leaderboards',
  ]

  if (matchContext) {
    lines.push('', '**This match context was detected** but cannot be analyzed without an AI provider. Set a key to enable match intelligence.')
  }

  return lines.join('\n')
}

// ── Check if any AI provider is configured ───────────────────────────────────

function hasAnyAiProvider(): boolean {
  const keys = ['GOOGLE_AI_API_KEY', 'GROQ_API_KEY', 'MISTRAL_API_KEY', 'NVIDIA_API_KEY', 'CEREBRAS_API_KEY', 'GITHUB_TOKEN', 'OPENROUTER_API_KEY']
  return keys.some(k => {
    const v = resolveKey(k)
    return !!v && v.length > 0
  })
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req)
  if (auth instanceof Response) return auth
  return NextResponse.json({ providers: getProviderStatus() })
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { allowed } = rateLimit(`chat:${ip}`, 10, 60_000)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth

    const { message, matchId, stream: wantStream, history, screenContext } = await req.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Built-in commands (bypass AI entirely)
    const commandResponse = handleCommand(message)
    if (commandResponse) {
      return NextResponse.json({
        response: commandResponse,
        model: 'command',
        provider: 'system',
        context: null,
      })
    }

    // Build context meta if matchId provided
    let contextMeta: Record<string, unknown> | null = null
    let matchContext: Record<string, unknown> | null = null
    if (matchId) {
      matchContext = { matchId }
      contextMeta = { matchId }
    }

    // ── No AI provider configured — use mock ───────────────────────────────
    if (!hasAnyAiProvider()) {
      const response = honestNoAiResponse(message, matchContext)
      return NextResponse.json({
        response,
        model: 'no-provider',
        provider: 'none',
        context: contextMeta,
        aiStatus: 'no_provider_configured',
      })
    }

    // ── Stage 1: Build real evidence BEFORE calling the LLM ─────────────
    const evidence = await buildEvidence({ message, matchId: matchId ?? null })

    // ── AI Call ────────────────────────────────────────────────────────────
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
    ]

    // Inject evidence block as a system message so the LLM sees real data
    if (evidence.charCount > 0) {
      messages.push({
        role: 'system',
        content: `EVIDENCE (retrieved from ELASTICO database, ${new Date().toISOString()}):\n\n${evidence.formatted}`,
      })
    }

    // Inject screen context if provided
    let userContent = message
    if (screenContext && typeof screenContext === 'string') {
      userContent = `[Screen context: ${screenContext}]\n\n${message}`
    }

    // Add conversation history (multi-turn memory)
    if (Array.isArray(history) && history.length > 0) {
      for (const msg of history) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content })
        }
      }
    }

    // Add the current user message
    messages.push({ role: 'user', content: userContent })

    // Streaming
    if (wantStream) {
      const result = await callAiStream(messages, { temperature: 0.7 })
      if (!result) {
        const response = honestNoAiResponse(message, matchContext)
        return NextResponse.json({ response, model: 'no-provider', provider: 'none', context: contextMeta, aiStatus: 'stream_failed_all_providers' })
      }

      const header = JSON.stringify({
        type: 'header',
        model: result.model,
        provider: result.provider,
        context: contextMeta,
        evidenceSections: evidence.sections.map(s => ({ label: s.label, truthClass: s.truthClass })),
      }) + '\n'
      const headerStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(header))
          const reader = result.stream.getReader()
          function read() {
            reader.read().then(({ done, value }) => {
              if (done) { controller.enqueue(new TextEncoder().encode('\n')); controller.close(); return }
              controller.enqueue(value)
              read()
            }).catch((err) => { console.error('Stream read error:', err); controller.error(err) })
          }
          read()
        },
      })

      return new Response(headerStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'X-Model': result.model,
          'X-Provider': result.provider,
        },
      })
    }

    // Non-streaming
    const result = await callAi(messages, { temperature: 0.7 })
    if (!result.text) {
      const response = honestNoAiResponse(message, matchContext)
      return NextResponse.json({ response, model: 'no-provider', provider: 'failed', context: contextMeta, aiStatus: 'all_providers_failed' })
    }

    return NextResponse.json({
      response: result.text,
      model: result.model,
      provider: result.provider,
      latencyMs: result.latencyMs,
      tokensUsed: result.tokensUsed,
      context: contextMeta,
      evidenceSections: evidence.sections.map(s => ({ label: s.label, truthClass: s.truthClass })),
    })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}