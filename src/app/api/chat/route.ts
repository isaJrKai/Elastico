import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { callAi, callAiStream, getProviderStatus, resolveKey } from '@/lib/ai-gateway'
import { rateLimit } from '@/lib/rate-limit'

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

// ── Mock Fallback ─────────────────────────────────────────────────────────────

function generateFootballAnalysis(message: string, matchContext: Record<string, unknown> | null): string {
  const msg = message.toLowerCase()

  if (matchContext) {
    const homeName = (matchContext.homeTeam as string) || 'Home Team'
    const awayName = (matchContext.awayTeam as string) || 'Away Team'

    if (msg.includes('predict') || msg.includes('outcome') || msg.includes('who') || msg.includes('win')) {
      let a = `## Match Analysis: ${homeName} vs ${awayName}\n\n`
      a += `**Note:** Detailed stats are fetched live from ESPN. For the most accurate predictions, check the match details page.\n\n`
      a += `Based on current form and available data, this looks like a competitive fixture. Check the match page for ELO ratings, xG, and community predictions.\n\n`
      a += `**Key Factors:**\n`
      a += `- Review recent form and head-to-head records\n`
      a += `- Check injury reports and squad availability\n`
      a += `- Consider home/away advantage\n\n`
      a += `**Verdict:** Use the prediction tool on the match page for a detailed statistical prediction!`
      return a
    }

    if (msg.includes('tactic') || msg.includes('strategy') || msg.includes('style')) {
      let a = `## Tactical Preview\n\n`
      a += `**${homeName}** vs **${awayName}\n\n`
      a += `Detailed tactical data is available on the team and match pages. Check for playing style, possession stats, press intensity, and key player matchups.\n\n`
      a += `For the best tactical analysis, visit the match detail page where live ESPN data provides up-to-date statistics.\n`
      return a
    }

    return `## ${homeName} vs ${awayName}\n\nDetailed match data is now fetched live from ESPN. Check the match page for the latest stats, or ask me about predictions, tactics, or form for analysis guidance!`
  }

  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    return `## ELASTICO\n\nAsk me about any match for detailed analysis — predictions, tactics, form, key players. Select a match first for the best results.`
  }

  return `## ELASTICO\n\nAsk me about any match for detailed analysis — predictions, tactics, form, key players. Select a match first for the best results!`
}

// ── Check if any AI provider is configured ───────────────────────────────────

function hasAnyAiProvider(): boolean {
  const keys = ['GOOGLE_AI_API_KEY', 'GROQ_API_KEY', 'MISTRAL_API_KEY', 'NVIDIA_API_KEY', 'CEREBRAS_API_KEY', 'GITHUB_TOKEN', 'OPENROUTER_API_KEY']
  return keys.some(k => {
    const v = resolveKey(k)
    return !!v && v.length > 5
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

    const { message, matchId, stream: wantStream } = await req.json()

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

    // Build context meta if matchId provided (no DB queries — just note the ID)
    let contextMeta: Record<string, unknown> | null = null
    let matchContext: Record<string, unknown> | null = null
    if (matchId) {
      matchContext = { matchId }
      contextMeta = { matchId }
    }

    // ── No AI provider configured — use mock ───────────────────────────────
    if (!hasAnyAiProvider()) {
      const response = generateFootballAnalysis(message, matchContext)
      return NextResponse.json({
        response,
        model: 'mock-fallback',
        provider: 'none',
        context: contextMeta,
      })
    }

    // ── AI Call ────────────────────────────────────────────────────────────
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: message },
    ]

    // Streaming
    if (wantStream) {
      const result = await callAiStream(messages, { temperature: 0.7 })
      if (!result) {
        const response = generateFootballAnalysis(message, matchContext)
        return NextResponse.json({ response, model: 'mock-fallback', provider: 'none', context: contextMeta })
      }

      const header = JSON.stringify({ type: 'header', model: result.model, provider: result.provider, context: contextMeta }) + '\n'
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
      const response = generateFootballAnalysis(message, matchContext)
      return NextResponse.json({ response, model: 'mock-fallback', provider: 'none', context: contextMeta })
    }

    return NextResponse.json({
      response: result.text,
      model: result.model,
      provider: result.provider,
      latencyMs: result.latencyMs,
      tokensUsed: result.tokensUsed,
      context: contextMeta,
    })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}