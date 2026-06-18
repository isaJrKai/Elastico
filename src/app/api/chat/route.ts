import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

// ── NVIDIA NIM Configuration ──────────────────────────────────────────────────

const NVIDIA_NIM_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions'

const NVIDIA_MODELS: Record<string, string> = {
  pro: 'meta/llama-3.1-405b-instruct',
  fast: 'meta/llama-3.1-70b-instruct',
  local: '__mock__',
}

const SYSTEM_PROMPT = `You are ELASTICO AI, an elite football analytics assistant powered by NVIDIA AI. You provide professional, data-driven football analysis covering match predictions, tactical breakdowns, player performance, team form, xG analysis, and tournament scenarios. You use statistical concepts (ELO ratings, Poisson distributions, Monte Carlo simulations, Dixon-Coles models) naturally in your analysis. Be concise but thorough. Use markdown formatting. When given match context data, incorporate the specific statistics into your analysis.`

function isNvidiaApiKeyConfigured(): boolean {
  const key = process.env.NVIDIA_API_KEY
  return !!key && key !== 'nvapi-PLACEHOLDER_USER_MUST_REPLACE'
}

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

  let contextStr = `\n\n[Match Context Data]\n`
  contextStr += `Match: ${home.name} vs ${away.name}\n`
  contextStr += `Status: ${ctx.status}\n`
  if (ctx.competition) contextStr += `Competition: ${ctx.competition}\n`
  contextStr += `Score: ${ctx.homeScore}-${ctx.awayScore}\n`
  contextStr += `Home xG: ${ctx.homeXg} | Away xG: ${ctx.awayXg}\n`
  contextStr += `Home Shots: ${ctx.shotsHome} (${ctx.shotsOnTargetHome} on target) | Away Shots: ${ctx.shotsAway} (${ctx.shotsOnTargetAway} on target)\n\n`

  contextStr += `[${home.name} Stats]\n`
  contextStr += `ELO Rating: ${home.eloRating} | Record: ${home.wins}W-${home.draws}D-${home.losses}L\n`
  contextStr += `Goals For: ${home.goalsFor} | Goals Against: ${home.goalsAgainst}\n`
  contextStr += `xG/game: ${home.xgPerGame} | xGA/game: ${home.xgaPerGame}\n`
  contextStr += `Possession: ${home.possession}% | Press Intensity: ${home.pressIntensity}/100\n`
  contextStr += `Style: ${home.style}\n`

  if (homePlayers.length > 0) {
    contextStr += `Key Players: ${homePlayers.map(p => `${p.name} (${p.goals}G, ${p.assists}A)`).join(', ')}\n`
  }

  contextStr += `\n[${away.name} Stats]\n`
  contextStr += `ELO Rating: ${away.eloRating} | Record: ${away.wins}W-${away.draws}D-${away.losses}L\n`
  contextStr += `Goals For: ${away.goalsFor} | Goals Against: ${away.goalsAgainst}\n`
  contextStr += `xG/game: ${away.xgPerGame} | xGA/game: ${away.xgaPerGame}\n`
  contextStr += `Possession: ${away.possession}% | Press Intensity: ${away.pressIntensity}/100\n`
  contextStr += `Style: ${away.style}\n`

  if (awayPlayers.length > 0) {
    contextStr += `Key Players: ${awayPlayers.map(p => `${p.name} (${p.goals}G, ${p.assists}A)`).join(', ')}\n`
  }

  if (communityPreds > 0 && predDist) {
    contextStr += `\n[Community Predictions - ${communityPreds} total]\n`
    contextStr += `${home.name} win: ${predDist.home}% | Draw: ${predDist.draw}% | ${away.name} win: ${predDist.away}%\n`
  }

  if (events.length > 0) {
    const goals = events.filter((e) => e.type === 'goal')
    if (goals.length > 0) {
      contextStr += `\n[Match Goals]\n`
      for (const g of goals) {
        contextStr += `${g.minute}' ${g.playerName} (${g.team})\n`
      }
    }
  }

  return contextStr
}

// ── NVIDIA NIM Streaming Call ─────────────────────────────────────────────────

async function streamNvidiaResponse(
  userMessage: string,
  model: string,
  matchContextStr: string,
): Promise<ReadableStream<Uint8Array>> {
  const fullMessage = userMessage + matchContextStr

  const response = await fetch(NVIDIA_NIM_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: fullMessage },
      ],
      temperature: 0.7,
      max_tokens: 2048,
      stream: true,
    }),
  })

  if (!response.ok) {
    const errBody = await response.text()
    console.error(`NVIDIA NIM error ${response.status}: ${errBody}`)
    throw new Error(`NVIDIA API error: ${response.status}`)
  }

  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  const transformStream = new TransformStream<Uint8Array, Uint8Array>({
    async transform(chunk, controller) {
      const text = decoder.decode(chunk, { stream: true })
      const lines = text.split('\n')

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const data = trimmed.slice(6)
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            controller.enqueue(encoder.encode(content))
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    },
  })

  if (!response.body) {
    throw new Error('No response body received from NVIDIA API')
  }

  return response.body.pipeThrough(transformStream)
}

// ── NVIDIA NIM Non-Streaming Call ─────────────────────────────────────────────

async function fetchNvidiaResponse(
  userMessage: string,
  model: string,
  matchContextStr: string,
): Promise<string> {
  const fullMessage = userMessage + matchContextStr

  const response = await fetch(NVIDIA_NIM_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: fullMessage },
      ],
      temperature: 0.7,
      max_tokens: 2048,
      stream: false,
    }),
  })

  if (!response.ok) {
    const errBody = await response.text()
    console.error(`NVIDIA NIM error ${response.status}: ${errBody}`)
    throw new Error(`NVIDIA API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || 'No response generated.'
}

// ── Mock Fallback ─────────────────────────────────────────────────────────────

function generateFootballAnalysis(message: string, matchContext: Record<string, unknown> | null): string {
  const msg = message.toLowerCase()

  if (matchContext) {
    const home = matchContext.homeTeam as Record<string, unknown>
    const away = matchContext.awayTeam as Record<string, unknown>
    const match = matchContext as Record<string, unknown>

    const homeName = home?.name as string || 'Home Team'
    const awayName = away?.name as string || 'Away Team'
    const homeElo = (home?.eloRating as number) || 1500
    const awayElo = (away?.eloRating as number) || 1500
    const eloDiff = homeElo - awayElo
    const homeXg = (home?.xgPerGame as number) || 1.2
    const awayXg = (away?.xgPerGame as number) || 1.2
    const homeStyle = (home?.style as string) || 'balanced'
    const awayStyle = (away?.style as string) || 'balanced'
    const homeWins = (home?.wins as number) || 0
    const homeDraws = (home?.draws as number) || 0
    const homeLosses = (home?.losses as number) || 0
    const awayWins = (away?.wins as number) || 0
    const awayDraws = (away?.draws as number) || 0
    const awayLosses = (away?.losses as number) || 0
    const homePlayers = (home?.players as Array<Record<string, unknown>>) || []
    const awayPlayers = (away?.players as Array<Record<string, unknown>>) || []
    const predDist = (match.predictionDistribution as Record<string, number>) || { home: 33, draw: 34, away: 33 }
    const communityPreds = (match.communityPredictions as number) || 0
    const events = (match.events as Array<Record<string, unknown>>) || []

    const expectedHome = 1 / (1 + Math.pow(10, -eloDiff / 400))
    const homeProb = Math.round(expectedHome * 100)
    const drawProb = Math.round((1 - expectedHome) * 0.3 * 100)
    const awayProb = 100 - homeProb - drawProb

    if (msg.includes('predict') || msg.includes('outcome') || msg.includes('who') || msg.includes('win')) {
      let analysis = `## Match Analysis: ${homeName} vs ${awayName}\n\n`
      analysis += `**ELO Ratings:** ${homeName} (${homeElo}) vs ${awayName} (${awayElo})\n`
      analysis += `**ELO-Based Probabilities:** Home ${homeProb}% | Draw ${drawProb}% | Away ${awayProb}%\n\n`
      if (communityPreds > 0) {
        analysis += `**Community Predictions (${communityPreds} total):** Home ${predDist.home}% | Draw ${predDist.draw}% | Away ${predDist.away}%\n\n`
      }
      analysis += `**Key Factors:**\n`
      analysis += `- ${homeName} xG/game: ${homeXg} | Style: ${homeStyle}\n`
      analysis += `- ${awayName} xG/game: ${awayXg} | Style: ${awayStyle}\n`
      if (Math.abs(eloDiff) > 100) {
        const favorite = eloDiff > 0 ? homeName : awayName
        analysis += `\n**Verdict:** ${favorite} has a significant ELO advantage (${Math.abs(Math.round(eloDiff))} points). `
        analysis += `Based on current form and statistical models, ${favorite} is the likely winner, `
        analysis += `though football always has room for upsets.`
      } else {
        analysis += `\n**Verdict:** This is a closely matched contest (ELO diff: ${Math.round(eloDiff)}). `
        analysis += `A draw or narrow win for either side is the most probable outcome. `
        analysis += `The tactical battle between ${homeStyle} ${homeName} and ${awayStyle} ${awayName} will be decisive.`
      }
      if (homePlayers.length > 0) {
        analysis += `\n\n**Key Players to Watch:**\n`
        analysis += `- ${homePlayers[0].name} (${homeName}) - ${homePlayers[0].goals} goals\n`
        if (awayPlayers.length > 0) {
          analysis += `- ${awayPlayers[0].name} (${awayName}) - ${awayPlayers[0].goals} goals\n`
        }
      }
      return analysis
    }

    if (msg.includes('form') || msg.includes('record') || msg.includes('stats') || msg.includes('performance')) {
      let analysis = `## Form Guide\n\n`
      analysis += `**${homeName}:** ${homeWins}W ${homeDraws}D ${homeLosses}L | GF: ${home?.goalsFor} GA: ${home?.goalsAgainst}\n`
      analysis += `**${awayName}:** ${awayWins}W ${awayDraws}D ${awayLosses}L | GF: ${away?.goalsFor} GA: ${away?.goalsAgainst}\n\n`
      analysis += `**Expected Goals:**\n`
      analysis += `- ${homeName}: ${homeXg} xG/game, ${home?.xgaPerGame} xGA/game\n`
      analysis += `- ${awayName}: ${awayXg} xG/game, ${away?.xgaPerGame} xGA/game\n\n`
      analysis += `**Possession:** ${homeName} ${home?.possession}% | ${awayName} ${away?.possession}%\n`
      analysis += `**Press Intensity:** ${homeName} ${home?.pressIntensity}/100 | ${awayName} ${away?.pressIntensity}/100\n`
      if (events.length > 0) {
        const goals = events.filter((e) => e.type === 'goal')
        if (goals.length > 0) {
          analysis += `\n**Match Goals (${goals.length}):**\n`
          for (const g of goals) analysis += `- ${g.minute}' ${g.playerName} (${g.team})\n`
        }
      }
      return analysis
    }

    if (msg.includes('tactic') || msg.includes('strategy') || msg.includes('style') || msg.includes('approach')) {
      let analysis = `## Tactical Preview\n\n`
      analysis += `**${homeName}** plays a **${homeStyle}** style with ${home?.possession}% average possession `
      analysis += `and ${home?.pressIntensity}/100 press intensity. Their xG output of ${homeXg}/game `
      analysis += `suggests ${homeXg > 1.5 ? 'a potent attacking threat' : 'they create moderate chances'}.\n\n`
      analysis += `**${awayName}** adopts a **${awayStyle}** approach with ${away?.possession}% possession `
      analysis += `and ${away?.pressIntensity}/100 pressing. At ${awayXg} xG/game, `
      analysis += `${awayXg > 1.5 ? 'they are an attacking force to be reckoned with' : 'they tend to be more conservative in front of goal'}.\n\n`
      const homePressure = (home?.pressIntensity as number) || 50
      const awayPressure = (away?.pressIntensity as number) || 50
      if (homePressure > 65 && awayPressure > 65) {
        analysis += `**Tactical Battle:** Both teams press intensely (both >65/100), which should create a high-tempo game with turnover opportunities in midfield.`
      } else if (homePressure < 40) {
        analysis += `**Tactical Battle:** ${homeName}'s low press suggests they'll sit deep and look to counter. ${awayName} could dominate possession but must be wary of the counter-attack.`
      } else {
        analysis += `**Tactical Battle:** The styles contrast well - expect a balanced game where midfield control and set pieces could be decisive.`
      }
      return analysis
    }

    let analysis = `## ${homeName} vs ${awayName} - Quick Analysis\n\n`
    analysis += `This matchup features ${homeName} (ELO: ${homeElo}) against ${awayName} (ELO: ${awayElo}).\n\n`
    analysis += `**${homeName}** has a record of ${homeWins}W-${homeDraws}D-${homeLosses}L with ${homeXg} xG/game and a ${homeStyle} style of play.\n`
    analysis += `**${awayName}** stands at ${awayWins}W-${awayDraws}D-${awayLosses}L with ${awayXg} xG/game and prefers a ${awayStyle} approach.\n\n`
    if (communityPreds > 0) {
      analysis += `**Community Prediction:** ${predDist.home}% back ${homeName}, ${predDist.away}% favor ${awayName}, with ${predDist.draw}% expecting a draw.\n\n`
    }
    analysis += `Ask me about predictions, tactics, form, or key players for deeper analysis!`
    return analysis
  }

  // General football analysis without match context
  if (msg.includes('elo') || msg.includes('rating') || msg.includes('rank')) {
    return `## ELO Rating System\n\nELASTICO uses the ELO rating system to measure team strength. Here's how it works:\n\n`
      + `- **Base Rating:** All teams start at 1500\n`
      + `- **K-Factor:** 32 (standard for football)\n`
      + `- **Updates:** After every match result\n`
      + `- **Expected Score:** Calculated as 1/(1+10^((Rb-Ra)/400))\n\n`
      + `Teams gain points for winning against higher-rated opponents and lose more for losing to lower-rated ones. `
      + `The system self-corrects over time and is more accurate than simple win-loss records.`
  }

  if (msg.includes('predict') || msg.includes('model') || msg.includes('algorithm')) {
    return `## Prediction Models\n\nELASTICO offers multiple prediction models:\n\n`
      + `1. **ELO-Based:** Uses team strength ratings to calculate win probabilities\n`
      + `2. **Poisson Distribution:** Models goal scoring as a Poisson process\n`
      + `3. **Dixon-Coles:** An enhancement of Poisson that accounts for low-scoring corrections\n`
      + `4. **Monte Carlo:** Runs thousands of simulated matches for probability distributions\n`
      + `5. **User Predictions:** Community-driven predictions with accuracy tracking\n\n`
      + `Select a specific match to get model predictions!`
  }

  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    return `## Welcome to ELASTICO AI Assistant! ⚽\n\nI can help you with:\n`
      + `- **Match Analysis** - Select a match and ask about predictions, tactics, or form\n`
      + `- **Team Stats** - ELO ratings, xG, possession, and performance metrics\n`
      + `- **Player Insights** - Key players, goal scorers, and performance data\n`
      + `- **Prediction Models** - How our algorithms work\n\n`
      + `Try selecting a match from the matches page, then ask me anything about it!`
  }

  return `## ELASTICO AI Assistant\n\nI can provide detailed football analysis when you select a match. `
    + `Try navigating to a match and asking me about:\n`
    + `- Match predictions and outcomes\n`
    + `- Team form and statistics\n`
    + `- Tactical analysis\n`
    + `- Key players to watch\n\n`
    + `You can also ask general questions about ELO ratings or prediction models!`
}

// ── POST Handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth

    const { message, matchId, model: modelKey, stream: wantStream } = await req.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const resolvedModel = NVIDIA_MODELS[modelKey as keyof typeof NVIDIA_MODELS] || NVIDIA_MODELS.pro
    const isMock = resolvedModel === '__mock__'

    // Gather match context if matchId provided
    let matchContext: Record<string, unknown> | null = null
    let matchContextStr = ''
    if (matchId) {
      matchContext = await gatherMatchContext(matchId)
      if (matchContext) {
        matchContextStr = formatMatchContextForLLM(matchContext)
      }
    }

    // ── Mock / Offline Mode ─────────────────────────────────────────────────
    if (isMock || !isNvidiaApiKeyConfigured()) {
      const response = generateFootballAnalysis(message, matchContext)
      return NextResponse.json({
        response,
        model: isMock ? 'local' : 'mock-fallback',
        context: matchContext ? { matchId, homeTeam: (matchContext.homeTeam as Record<string, unknown>)?.name, awayTeam: (matchContext.awayTeam as Record<string, unknown>)?.name } : null,
      })
    }

    // ── Streaming Response ─────────────────────────────────────────────────
    if (wantStream) {
      try {
        const nvidiaStream = await streamNvidiaResponse(message, resolvedModel, matchContextStr)
        const contextMeta = matchContext ? { matchId, homeTeam: (matchContext.homeTeam as Record<string, unknown>)?.name, awayTeam: (matchContext.awayTeam as Record<string, unknown>)?.name } : null

        // Prepend a JSON header line so the client knows metadata
        const header = JSON.stringify({
          type: 'header',
          model: modelKey || 'pro',
          context: contextMeta,
        }) + '\n'

        const headerStream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(header))
            // Pipe the NVIDIA stream
            const reader = nvidiaStream.getReader()
            function read() {
              reader.read().then(({ done, value }) => {
                if (done) {
                  controller.enqueue(new TextEncoder().encode('\n')) // signal end
                  controller.close()
                  return
                }
                controller.enqueue(value)
                read()
              }).catch((err) => {
                console.error('Stream read error:', err)
                controller.error(err)
              })
            }
            read()
          },
        })

        return new Response(headerStream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'X-Model': modelKey || 'pro',
          },
        })
      } catch (streamErr) {
        // Fallback to non-streaming mock on error
        console.error('Streaming error, falling back to mock:', streamErr)
        const response = generateFootballAnalysis(message, matchContext)
        return NextResponse.json({
          response,
          model: 'mock-fallback',
          context: matchContext ? { matchId, homeTeam: (matchContext.homeTeam as Record<string, unknown>)?.name, awayTeam: (matchContext.awayTeam as Record<string, unknown>)?.name } : null,
        })
      }
    }

    // ── Non-Streaming Response ─────────────────────────────────────────────
    try {
      const response = await fetchNvidiaResponse(message, resolvedModel, matchContextStr)
      return NextResponse.json({
        response,
        model: modelKey || 'pro',
        context: matchContext ? { matchId, homeTeam: (matchContext.homeTeam as Record<string, unknown>)?.name, awayTeam: (matchContext.awayTeam as Record<string, unknown>)?.name } : null,
      })
    } catch (nvidiaErr) {
      // Fallback to mock on NVIDIA API failure
      console.error('NVIDIA API error, falling back to mock:', nvidiaErr)
      const response = generateFootballAnalysis(message, matchContext)
      return NextResponse.json({
        response,
        model: 'mock-fallback',
        context: matchContext ? { matchId, homeTeam: (matchContext.homeTeam as Record<string, unknown>)?.name, awayTeam: (matchContext.awayTeam as Record<string, unknown>)?.name } : null,
      })
    }
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}