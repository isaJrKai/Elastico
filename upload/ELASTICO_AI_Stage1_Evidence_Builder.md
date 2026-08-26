# ELASTICO AI — Stage 1 Implementation: Evidence Builder
**Fixes the confirmed "Real Madrid problem" — retrieval-before-reasoning, grounded in the actual current codebase**

---

## SCOPE OF THIS PACKAGE — READ BEFORE APPLYING

This implements **only Stage 1** of the intelligence roadmap: real PostgreSQL data retrieved and injected into the LLM's context *before* it answers, replacing the current no-op.

**Confirmed bug this fixes**, found directly in the current code (`src/app/api/chat/route.ts`):
```ts
if (matchId) {
  matchContext = { matchId }
  contextMeta = { matchId }   // <-- the ID is captured, but NEVER turned into real data
}
...
const messages = [
  { role: 'system', content: SYSTEM_PROMPT },
  { role: 'user', content: message },   // <-- no evidence, ever, regardless of matchId
]
```
This is why the AI says "I don't have access to real-time data" even when the database has relevant information — because it's never given any. This package fixes exactly that, and nothing more.

**Deliberately NOT included in this pass, and why:**
- **pgvector / embeddings / semantic retrieval** — requires confirming the pgvector extension is actually enabled on the database and an embedding provider key is actually configured. Writing code against that now would be speculative. Do this in Stage 2, after Stage 1 ships and Stage 2's prerequisites are verified.
- **Multi-provider AI gateway routing (Groq/Gemini/Cerebras/OpenRouter split by task type)** — the existing `ai-gateway.ts` already handles provider selection; this pass doesn't touch it. Re-architecting provider routing is a separate, larger decision.
- **Knowledge graph, learning engine, scouting engine, simulation engine** — all later stages, all dependent on Stage 1 actually working first.

If GLM 5 is tempted to build more than what's in this file, it's worth stopping and asking why — the whole point of building in stages is that Stage 1 needs to work and be verified before Stage 2 is worth starting.

---

## FILE 1 (NEW): `src/lib/evidence-builder.ts`

This is the entire Stage 1 addition. It queries the **existing** database and schema (no new tables required for this pass) and produces a bounded, provenance-tagged text block to inject into the AI's context.

```typescript
import { db } from '@/lib/db'

// ── Types ──────────────────────────────────────────────────────────────────

export interface EvidenceSection {
  label: string
  truthClass: 'REAL' | 'DERIVED' | 'MISSING'
  content: string
}

export interface EvidencePackage {
  sections: EvidenceSection[]
  formatted: string       // ready to inject into the system/context message
  charCount: number
}

const MAX_EVIDENCE_CHARS = 6000 // keep the evidence package bounded and cheap

// ── Team lookup ────────────────────────────────────────────────────────────

/**
 * Attempts to find a real Team row matching a name fragment.
 * This is a plain SQL `contains` match against the existing Team table —
 * not fuzzy matching, not an embedding lookup. Good enough for Stage 1;
 * revisit if false negatives on team-name variants become a real problem.
 */
async function findTeamByName(nameFragment: string) {
  if (!nameFragment || nameFragment.length < 3) return null
  return db.team.findFirst({
    where: { name: { contains: nameFragment, mode: 'insensitive' } },
  })
}

// ── Evidence sections ──────────────────────────────────────────────────────

async function buildTeamFormSection(team: Awaited<ReturnType<typeof findTeamByName>>): Promise<EvidenceSection> {
  if (!team) {
    return { label: 'TEAM FORM', truthClass: 'MISSING', content: 'No matching team record found in the database.' }
  }
  const played = team.wins + team.draws + team.losses
  if (played === 0) {
    return {
      label: 'TEAM FORM',
      truthClass: 'MISSING',
      content: `${team.name}: ELO ${team.eloRating.toFixed(0)} (default/no match history recorded). No W/D/L record available.`,
    }
  }
  return {
    label: 'TEAM FORM',
    truthClass: 'REAL',
    content: `${team.name}: ELO ${team.eloRating.toFixed(0)} · Record ${team.wins}W-${team.draws}D-${team.losses}L · Goals ${team.goalsFor} for / ${team.goalsAgainst} against (source: ${team.source}, synced ${team.lastSyncedAt.toISOString().slice(0, 10)})`,
  }
}

async function buildNewsSection(teamName: string): Promise<EvidenceSection> {
  const articles = await db.newsArticle.findMany({
    where: {
      OR: [
        { title: { contains: teamName, mode: 'insensitive' } },
        { summary: { contains: teamName, mode: 'insensitive' } },
      ],
    },
    orderBy: { publishedAt: 'desc' },
    take: 3,
  })

  if (articles.length === 0) {
    return { label: 'RECENT NEWS', truthClass: 'MISSING', content: `No recent news articles found mentioning ${teamName}.` }
  }

  const lines = articles.map(a => {
    const age = a.publishedAt ? `${Math.round((Date.now() - a.publishedAt.getTime()) / 3_600_000)}h ago` : 'undated'
    const summary = (a.summary || a.title).slice(0, 180)
    return `- [${age}, ${a.sourceName}] ${summary}`
  })

  return { label: 'RECENT NEWS', truthClass: 'REAL', content: lines.join('\n') }
}

async function buildMatchSection(matchId: string): Promise<EvidenceSection> {
  const match = await db.match.findFirst({
    where: { OR: [{ id: matchId }, { sourceId: matchId }] },
    include: { homeTeam: true, awayTeam: true },
  })

  if (!match) {
    return { label: 'MATCH', truthClass: 'MISSING', content: `No match record found for id ${matchId}.` }
  }

  const status = match.status || 'scheduled'
  const score = (match.homeScore != null && match.awayScore != null)
    ? `${match.homeScore}-${match.awayScore}`
    : 'not started'

  return {
    label: 'MATCH',
    truthClass: 'REAL',
    content: `${match.homeTeam?.name ?? 'Home'} vs ${match.awayTeam?.name ?? 'Away'} · ${match.competition ?? 'Unknown competition'} · Status: ${status} · Score: ${score} · Kickoff: ${match.kickoff?.toISOString() ?? 'unknown'}`,
  }
}

async function buildExistingPredictionSection(matchId: string): Promise<EvidenceSection> {
  const prediction = await db.prediction.findFirst({
    where: { matchId },
    orderBy: { createdAt: 'desc' },
  })

  if (!prediction) {
    return { label: 'EXISTING PREDICTION', truthClass: 'MISSING', content: 'No prediction has been computed for this match yet.' }
  }

  return {
    label: 'EXISTING PREDICTION',
    truthClass: 'DERIVED',
    content: `Home ${(prediction.homeWinProb * 100).toFixed(0)}% · Draw ${(prediction.drawProb * 100).toFixed(0)}% · Away ${(prediction.awayWinProb * 100).toFixed(0)}% (model: ${prediction.model ?? 'unspecified'}, computed ${prediction.createdAt.toISOString().slice(0, 10)})`,
  }
}

// ── Main entry point ───────────────────────────────────────────────────────

/**
 * Builds a bounded, provenance-tagged evidence package for a chat request.
 *
 * This is Stage 1 only: direct PostgreSQL lookups, no embeddings, no
 * semantic search. It is intentionally simple and intentionally honest —
 * every section is tagged REAL, DERIVED, or MISSING, and MISSING sections
 * are included explicitly rather than silently omitted, so the LLM (and
 * the user) can see what evidence does and doesn't exist.
 */
export async function buildEvidence(params: {
  message: string
  matchId?: string | null
}): Promise<EvidencePackage> {
  const sections: EvidenceSection[] = []

  if (params.matchId) {
    const matchSection = await buildMatchSection(params.matchId)
    sections.push(matchSection)

    // Pull team names out of the match section content if we found one,
    // so we can also fetch form + news for both sides.
    const match = await db.match.findFirst({
      where: { OR: [{ id: params.matchId }, { sourceId: params.matchId }] },
      include: { homeTeam: true, awayTeam: true },
    })

    if (match?.homeTeam) {
      sections.push(await buildTeamFormSection(match.homeTeam))
      sections.push({ ...(await buildNewsSection(match.homeTeam.name)), label: `RECENT NEWS — ${match.homeTeam.name}` })
    }
    if (match?.awayTeam) {
      sections.push(await buildTeamFormSection(match.awayTeam))
      sections.push({ ...(await buildNewsSection(match.awayTeam.name)), label: `RECENT NEWS — ${match.awayTeam.name}` })
    }

    sections.push(await buildExistingPredictionSection(params.matchId))
  } else {
    // No matchId — fall back to a lightweight heuristic: try to find a
    // team name mentioned in the message text itself. This is a plain
    // substring match against known team names, not NLP entity extraction.
    // It will miss plenty of real mentions — that's an acceptable Stage 1
    // limitation, not a fabrication risk, because it fails toward MISSING
    // rather than toward a wrong guess.
    const words = params.message.split(/\s+/).filter(w => w.length > 3)
    let matchedTeam = null
    for (const word of words) {
      matchedTeam = await findTeamByName(word)
      if (matchedTeam) break
    }

    if (matchedTeam) {
      sections.push(await buildTeamFormSection(matchedTeam))
      sections.push(await buildNewsSection(matchedTeam.name))
    } else {
      sections.push({
        label: 'CONTEXT',
        truthClass: 'MISSING',
        content: 'No specific team or match was identified in this message. Answering from general football knowledge only — no live ELASTICO data was retrieved.',
      })
    }
  }

  // ── Format, bounded to MAX_EVIDENCE_CHARS ─────────────────────────────
  let formatted = sections
    .map(s => `### ${s.label} [${s.truthClass}]\n${s.content}`)
    .join('\n\n')

  if (formatted.length > MAX_EVIDENCE_CHARS) {
    formatted = formatted.slice(0, MAX_EVIDENCE_CHARS) + '\n\n[evidence truncated for length]'
  }

  return { sections, formatted, charCount: formatted.length }
}
```

---

## FILE 2 (MODIFIED): `src/app/api/chat/route.ts`

Minimal, targeted diff — only the context-building and message-assembly logic changes. Everything else (auth, rate limiting, streaming, mock fallback) stays exactly as-is.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { callAi, callAiStream, getProviderStatus, resolveKey } from '@/lib/ai-gateway'
import { rateLimit } from '@/lib/rate-limit'
import { buildEvidence } from '@/lib/evidence-builder'   // ← NEW IMPORT

// ── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the ELASTICO match analyst. You talk football — formations, pressing traps, xG sequences, transition patterns, set-piece routines. You reference specific competitions, current seasons, and real tactical concepts (low block, gegenpressing, rest-defence, half-spaces, inside channels).

Your models: ELO (team strength ratings), Poisson (independent goal probability), Dixon-Coles (correlated low-scoreline adjustment), and Stochastic Merton Jump-Diffusion with GARCH volatility (Monte Carlo simulation). Be precise about what each model can and cannot do.

Honesty rules:
- You will be given an EVIDENCE block before the user's question, with each section tagged REAL, DERIVED, or MISSING. Ground your answer in that evidence.
- If a section is tagged MISSING, say so explicitly — do not fill the gap with plausible-sounding invented facts.
- Never state a specific statistic (form, ELO, injury, news item) unless it appears in the EVIDENCE block. General football knowledge and tactical reasoning are fine without a citation; specific current facts about specific teams are not.
- Bookmaker odds typically encode more information than any single model. When in doubt, the market is the oracle.
- Never claim a prediction is "guaranteed" or give a confidence above 70% for a single match.

Keep responses tight. Use bullet points for stats. You're an analyst at the tactical whiteboard, not a chatbot helping with homework.`

// ── Mock Fallback (unchanged) ─────────────────────────────────────────────────

function generateFootballAnalysis(message: string, matchContext: Record<string, unknown> | null): string {
  // ... unchanged from current implementation ...
  const msg = message.toLowerCase()
  if (matchContext) {
    const homeName = (matchContext.homeTeam as string) || 'Home Team'
    const awayName = (matchContext.awayTeam as string) || 'Away Team'
    return `## ${homeName} vs ${awayName}\n\nDetailed match data is now fetched live from ESPN. Check the match page for the latest stats, or ask me about predictions, tactics, or form for analysis guidance!`
  }
  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    return `## Welcome to ELASTICO AI! ⚽\n\nI can help with match analysis, predictions, tactics, team stats, and player insights. Select a match to get started!`
  }
  return `## ELASTICO AI\n\nAsk me about any match for detailed analysis — predictions, tactics, form, key players. Select a match first for the best results!`
}

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

    const contextMeta = matchId ? { matchId } : null
    const matchContext = matchId ? { matchId } : null

    if (!hasAnyAiProvider()) {
      const response = generateFootballAnalysis(message, matchContext)
      return NextResponse.json({ response, model: 'mock-fallback', provider: 'none', context: contextMeta })
    }

    // ── NEW: Build real evidence BEFORE calling the LLM ───────────────────
    const evidence = await buildEvidence({ message, matchId: matchId ?? null })

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'system' as const, content: `EVIDENCE (retrieved from ELASTICO's database, ${new Date().toISOString()}):\n\n${evidence.formatted}` },
      { role: 'user' as const, content: message },
    ]

    // Streaming
    if (wantStream) {
      const result = await callAiStream(messages, { temperature: 0.7 })
      if (!result) {
        const response = generateFootballAnalysis(message, matchContext)
        return NextResponse.json({ response, model: 'mock-fallback', provider: 'none', context: contextMeta })
      }

      const header = JSON.stringify({
        type: 'header',
        model: result.model,
        provider: result.provider,
        context: contextMeta,
        evidenceSections: evidence.sections.map(s => ({ label: s.label, truthClass: s.truthClass })), // ← surfaced for UI/debugging
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
      evidenceSections: evidence.sections.map(s => ({ label: s.label, truthClass: s.truthClass })), // ← surfaced, not hidden
    })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

---

## VERIFICATION REQUIRED BEFORE MARKING THIS COMPLETE

This is real code but it has **not been run against the live database** from this environment (no DB connectivity here). Before considering Stage 1 done, GLM 5 must:

1. Confirm `db.match`, `db.prediction`, `db.newsArticle` field names in this exact code match the **current** `prisma/schema.prisma` — the audit found schema drift before (e.g., 22 vs 17 models reported at different times), so don't assume the field names above (`homeScore`, `kickoff`, `homeWinProb`, etc.) are exactly right without checking against the live schema first.
2. Run `tsc --noEmit` and fix any type mismatches against the actual generated Prisma client.
3. Manually test: ask the chat "predict Real Madrid vs Barcelona" for a match that exists in the DB, and confirm the evidence block actually appears in the outbound LLM request (log it) and that MISSING sections show up honestly for data that isn't there — not silently, not fabricated.
4. Confirm the `MAX_EVIDENCE_CHARS` bound is actually being respected in practice, not just in the truncation logic.

**Do not extend this to Stage 2 (embeddings/pgvector) until Stage 1 has passed the verification above with real evidence (commit hash, test output) — not a description of having tested it.**
