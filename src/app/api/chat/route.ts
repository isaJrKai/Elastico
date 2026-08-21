import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { callAi, callAiStream, getProviderStatus, resolveKey } from '@/lib/ai-gateway'
import { rateLimit } from '@/lib/rate-limit'

// ── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the ELASTICO match analyst. You talk football — formations, pressing traps, xG sequences, transition patterns, set-piece routines. You reference specific competitions, current seasons, and real tactical concepts (low block, gegenpressing, rest-defence, half-spaces, inside channels).

Your models: ELO (team strength ratings), Poisson (independent goal probability), Dixon-Coles (correlated low-scoreline adjustment), and Stochastic Merton Jump-Diffusion with GARCH volatility (Monte Carlo simulation). Be precise about what each model can and cannot do. ELO and Poisson give baseline probabilities. Dixon-Coles adjusts for 0-0, 1-0, 0-1, 1-1 correlations. The stochastic engine runs 150,000 simulations with jump-diffusion for upset modeling.

Honesty rules:
- If you don't have real data for a question, say so. Never fabricate stats.
- xG values from broadcasts are often OPTA/FotMob estimates, not raw data — note this when relevant.
- Form is inherently noisy. A 5-game sample is not statistically reliable. Say so.
- Bookmaker odds typically encode more information than any single model. When in doubt, the market is the oracle.
- Never claim a prediction is "guaranteed" or give a confidence above 70% for a single match.

Keep responses tight. Use bullet points for stats. Reference specific competitions (Premier League, La Liga, etc.) and current 2025-26 season context. You're an analyst at the tactical whiteboard, not a chatbot helping with homework.`

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
    return `## Welcome to ELASTICO AI! ⚽\n\nI can help with match analysis, predictions, tactics, team stats, and player insights. Select a match to get started!`
  }

  return `## ELASTICO AI\n\nAsk me about any match for detailed analysis — predictions, tactics, form, key players. Select a match first for the best results!`
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