import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { callAi, callAiStream, getProviderStatus } from '@/lib/ai-gateway'

// ── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are ELASTICO AI, an elite football analytics assistant. You provide professional, data-driven football analysis covering match predictions, tactical breakdowns, player performance, team form, xG analysis, and tournament scenarios. You use statistical concepts (ELO ratings, Poisson distributions, Monte Carlo simulations, Dixon-Coles models) naturally in your analysis. Be concise but thorough. Use markdown formatting. When given match context data, incorporate the specific statistics into your analysis.`

// ── Match Context Gathering ───────────────────────────────────────────────────

async function gatherMatchContext(matchId: string) {
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: {
        select: {
          name: true, code: true, eloRating: true, wins: true, draws: true, losses: true,
          goalsFor: true, goalsAgainst: true, xgPerGame: true, xgaPerGame: true,
          possession: true, passAccuracy: true, pressIntensity: true, style: true,
          players: { where: { position: { in: ['FWD', 'MID'] } }, take: 5, orderBy: { goals: 'desc' } },
        },
      },
      awayTeam: {
        select: {
          name: true, code: true, eloRating: true, wins: true, draws: true, losses: true,
          goalsFor: true, goalsAgainst: true, xgPerGame: true, xgaPerGame: true,
          possession: true, passAccuracy: true, pressIntensity: true, style: true,
          players: { where: { position: { in: ['FWD', 'MID'] } }, take: 5, orderBy: { goals: 'desc' } },
        },
      },
      events: { orderBy: { minute: 'asc' } },
      predictions: {
        take: 50,
        include: { user: { select: { predictionAccuracy: true, totalPredictions: true } } },
      },
      _count: { select: { predictions: true, votes: true } },
    },
  })

  if (!match) return null

  const predDist = { home: 0, draw: 0, away: 0 }
  for (const p of match.predictions) {
    if (p.predictedOutcome in predDist) {
      predDist[p.predictedOutcome as keyof typeof predDist]++
    }
  }
  const totalPreds = match._count.predictions || 0

  return {
    ...match,
    predictionDistribution: totalPreds > 0 ? {
      home: Math.round((predDist.home / totalPreds) * 100),
      draw: Math.round((predDist.draw / totalPreds) * 100),
      away: Math.round((predDist.away / totalPreds) * 100),
    } : { home: 33, draw: 34, away: 33 },
    communityPredictions: totalPreds,
    communityVotes: match._count.votes,
  }
}

function formatMatchContextForLLM(ctx: Record<string, unknown>): string {
  const home = ctx.homeTeam as Record<string, unknown> | undefined
  const away = ctx.awayTeam as Record<string, unknown> | undefined
  if (!home || !away) return ''

  const homePlayers = (home.players as Array<Record<string, unknown>>) || []
  const awayPlayers = (away.players as Array<Record<string, unknown>>) || []
  const events = (ctx.events as Array<Record<string, unknown>>) || []
  const predDist = ctx.predictionDistribution as Record<string, number>
  const communityPreds = ctx.communityPredictions as number

  let s = `\n\n[Match Context Data]\n`
  s += `Match: ${home.name} vs ${away.name}\n`
  s += `Status: ${ctx.status}\n`
  if (ctx.competition) s += `Competition: ${ctx.competition}\n`
  s += `Score: ${ctx.homeScore}-${ctx.awayScore}\n`
  s += `Home xG: ${ctx.homeXg} | Away xG: ${ctx.awayXg}\n`
  s += `Home Shots: ${ctx.shotsHome} (${ctx.shotsOnTargetHome} on target) | Away Shots: ${ctx.shotsAway} (${ctx.shotsOnTargetAway} on target)\n\n`

  s += `[${home.name} Stats]\n`
  s += `ELO Rating: ${home.eloRating} | Record: ${home.wins}W-${home.draws}D-${home.losses}L\n`
  s += `Goals For: ${home.goalsFor} | Goals Against: ${home.goalsAgainst}\n`
  s += `xG/game: ${home.xgPerGame} | xGA/game: ${home.xgaPerGame}\n`
  s += `Possession: ${home.possession}% | Press Intensity: ${home.pressIntensity}/100\n`
  s += `Style: ${home.style}\n`
  if (homePlayers.length > 0) {
    s += `Key Players: ${homePlayers.map(p => `${p.name} (${p.goals}G, ${p.assists}A)`).join(', ')}\n`
  }

  s += `\n[${away.name} Stats]\n`
  s += `ELO Rating: ${away.eloRating} | Record: ${away.wins}W-${away.draws}D-${away.losses}L\n`
  s += `Goals For: ${away.goalsFor} | Goals Against: ${away.goalsAgainst}\n`
  s += `xG/game: ${away.xgPerGame} | xGA/game: ${away.xgaPerGame}\n`
  s += `Possession: ${away.possession}% | Press Intensity: ${away.pressIntensity}/100\n`
  s += `Style: ${away.style}\n`
  if (awayPlayers.length > 0) {
    s += `Key Players: ${awayPlayers.map(p => `${p.name} (${p.goals}G, ${p.assists}A)`).join(', ')}\n`
  }

  if (communityPreds > 0 && predDist) {
    s += `\n[Community Predictions - ${communityPreds} total]\n`
    s += `${home.name} win: ${predDist.home}% | Draw: ${predDist.draw}% | ${away.name} win: ${predDist.away}%\n`
  }

  if (events.length > 0) {
    const goals = events.filter((e: Record<string, unknown>) => e.type === 'goal')
    if (goals.length > 0) {
      s += `\n[Match Goals]\n`
      for (const g of goals) s += `${g.minute}' ${g.playerName} (${g.team})\n`
    }
  }

  return s
}

// ── Mock Fallback ─────────────────────────────────────────────────────────────

function generateFootballAnalysis(message: string, matchContext: Record<string, unknown> | null): string {
  const msg = message.toLowerCase()

  if (matchContext) {
    const home = matchContext.homeTeam as Record<string, unknown>
    const away = matchContext.awayTeam as Record<string, unknown>
    const homeName = home?.name as string || 'Home Team'
    const awayName = away?.name as string || 'Away Team'
    const homeElo = (home?.eloRating as number) || 1500
    const awayElo = (away?.eloRating as number) || 1500
    const eloDiff = homeElo - awayElo
    const homeXg = (home?.xgPerGame as number) || 1.2
    const awayXg = (away?.xgPerGame as number) || 1.2
    const homeStyle = (home?.style as string) || 'balanced'
    const awayStyle = (away?.style as string) || 'balanced'

    if (msg.includes('predict') || msg.includes('outcome') || msg.includes('who') || msg.includes('win')) {
      const expectedHome = 1 / (1 + Math.pow(10, -eloDiff / 400))
      const homeProb = Math.round(expectedHome * 100)
      const drawProb = Math.round((1 - expectedHome) * 0.3 * 100)
      const awayProb = 100 - homeProb - drawProb
      let a = `## Match Analysis: ${homeName} vs ${awayName}\n\n`
      a += `**ELO Ratings:** ${homeName} (${homeElo}) vs ${awayName} (${awayElo})\n`
      a += `**ELO-Based Probabilities:** Home ${homeProb}% | Draw ${drawProb}% | Away ${awayProb}%\n\n`
      a += `**Key Factors:**\n`
      a += `- ${homeName} xG/game: ${homeXg} | Style: ${homeStyle}\n`
      a += `- ${awayName} xG/game: ${awayXg} | Style: ${awayStyle}\n`
      if (Math.abs(eloDiff) > 100) {
        const fav = eloDiff > 0 ? homeName : awayName
        a += `\n**Verdict:** ${fav} has a significant ELO advantage (${Math.abs(Math.round(eloDiff))} points). Based on current form and statistical models, ${fav} is the likely winner, though football always has room for upsets.`
      } else {
        a += `\n**Verdict:** Closely matched contest (ELO diff: ${Math.round(eloDiff)}). A draw or narrow win for either side is the most probable outcome.`
      }
      return a
    }

    if (msg.includes('tactic') || msg.includes('strategy') || msg.includes('style')) {
      let a = `## Tactical Preview\n\n`
      a += `**${homeName}** plays **${homeStyle}** with ${home?.possession}% possession and ${home?.pressIntensity}/100 press intensity.\n\n`
      a += `**${awayName}** adopts **${awayStyle}** with ${away?.possession}% possession and ${away?.pressIntensity}/100 pressing.\n\n`
      return a
    }

    return `## ${homeName} vs ${awayName}\n\nELO: ${homeName} (${homeElo}) vs ${awayName} (${awayElo}). Form: ${homeName} ${homeXg} xG/game | ${awayName} ${awayXg} xG/game. Ask about predictions, tactics, or form for deeper analysis!`
  }

  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    return `## Welcome to ELASTICO AI! ⚽\n\nI can help with match analysis, predictions, tactics, team stats, and player insights. Select a match to get started!`
  }

  return `## ELASTICO AI\n\nAsk me about any match for detailed analysis — predictions, tactics, form, key players. Select a match first for the best results!`
}

// ── Check if any AI provider is configured ───────────────────────────────────

// Import resolveKey from ai-gateway to check both env vars and embedded keys
function resolveKey(envKey: string): string {
  const envVal = process.env[envKey]
  if (envVal && envVal.length > 5) return envVal
  const embedded: Record<string, string> = {
    GOOGLE_AI_API_KEY: 'AQ.Ab8RN6Imu8y_NzgY_2MMu8EoHw6fhAlLQ-VBn2rzcGfz-ehO9A',
    GROQ_API_KEY: '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',
  }
  return embedded[envKey] || ''
}

function hasAnyAiProvider(): boolean {
  const keys = ['GOOGLE_AI_API_KEY', 'GROQ_API_KEY', 'MISTRAL_API_KEY', 'NVIDIA_API_KEY', 'CEREBRAS_API_KEY', 'GITHUB_TOKEN', 'OPENROUTER_API_KEY']
  return keys.some(k => {
    const v = resolveKey(k)
    return !!v && v.length > 5
  })
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({ providers: getProviderStatus() })
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth

    const { message, matchId, stream: wantStream } = await req.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Gather match context if matchId provided
    let matchContext: Record<string, unknown> | null = null
    let matchContextStr = ''
    if (matchId) {
      matchContext = await gatherMatchContext(matchId)
      if (matchContext) matchContextStr = formatMatchContextForLLM(matchContext)
    }

    const contextMeta = matchContext ? {
      matchId,
      homeTeam: (matchContext.homeTeam as Record<string, unknown>)?.name,
      awayTeam: (matchContext.awayTeam as Record<string, unknown>)?.name,
    } : null

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
      { role: 'user' as const, content: message + matchContextStr },
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