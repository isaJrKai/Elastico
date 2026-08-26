# ELASTICO — Complete Codebase State for Intelligence Orchestration Layer

> **Purpose**: This document gives ChatGPT the full current state of ELASTICO so it can design and implement the Intelligence Orchestration Layer against the real codebase.
>
> **Generated**: 2026-08-26 (with Architectural Addendum)
> **Project root**: `/home/z/my-project/`
> **Stack**: Next.js 16.1.1, React 19, Prisma (PostgreSQL/Neon), Zustand, Tailwind v4, shadcn/ui, TypeScript strict
>
> **CRITICAL: Read §19 (Architectural Addendum) FIRST.** It contains mandatory design corrections that override assumptions in earlier sections.

---

## 1. ARCHITECTURE OVERVIEW

```
External Sources (ESPN, API-Sports, football-data.org, TheOdds, Understat, StatsBomb, Newsdata.io, TheSportsDB)
       │
       ▼
Ingestion (API Routes + /api/cron/sync)
       │
       ▼
PostgreSQL (Neon) — 22 Prisma models
       │
       ▼
API Routes (52 route files, 8522 lines)
       │
       ▼
Zustand Store (single store, 523 lines)
       │
       ▼
React Components (83 files, ~20900 lines)
```

**Current AI flow (BROKEN — this is what needs fixing):**
```
User message → /api/chat → [static system prompt + screen context string + last 10 messages] → AI Gateway (LLM) → raw text response → Chat UI
```

**No data retrieval happens before the AI answers. No prediction engine is called. No news is fetched. No DB is queried. The LLM is the entire intelligence.**

---

## 2. PROJECT METRICS

| Metric | Value |
|--------|-------|
| Total files | 208 |
| Total lines | ~46,245 |
| API routes | 52 files, 8,522 lines |
| Lib files | 31 files, 11,741 lines |
| Components | 83 files, ~20,904 lines |
| Prisma models | 22 |
| AI providers | 7 (Groq, Cerebras, Gemini, OpenRouter, NVIDIA, Mistral, GitHub) |
| External data sources | 8 (ESPN, API-Sports, football-data.org, TheOdds, Understat, StatsBomb, Newsdata.io, TheSportsDB) |
| Prisma migrations | NONE (uses `prisma db push`) |
| Tests | NONE |
| Middleware (auth) | NONE |

---

## 3. CRITICAL ARCHITECTURAL GAP

### What the chat route currently does (src/app/api/chat/route.ts):

1. Receives: `{ message, matchId, stream, history, screenContext }`
2. If `/help` → returns static command table (bypasses AI)
3. If no AI provider configured → returns `generateFootballAnalysis()` (mock/template)
4. Otherwise → builds messages array:
   - `[0]` system prompt (static 89-line string)
   - `[1..N]` conversation history (last 10 messages)
   - `[N+1]` user message, optionally prefixed with `[Screen context: ...]`
5. Calls `callAiStream(messages)` or `callAi(messages)` → LLM response
6. Returns raw text

### What it does NOT do:
- **No intent detection** — doesn't classify what the user is asking
- **No entity resolution** — doesn't identify teams/players/competitions from the message
- **No fixture resolution** — "Predict Real Madrid" doesn't find the next Real Madrid match
- **No data retrieval** — doesn't query PostgreSQL for ELO, xG, form, standings, odds, news
- **No prediction engine invocation** — `calculateElo()`, `poissonProbabilities()`, `dixonColes()`, `runStochasticSimulation()`, `runFullMatchAnalysis()` are NEVER called from chat
- **No news integration** — news is fetched and displayed in news view but never reaches the AI
- **No evidence validation** — no provenance tracking, no truth classification enforcement
- **No structured output** — returns raw markdown text, not structured data
- **No audit trail** — no logging of what data was retrieved, what was missing, which provider answered

### The matchId/screenContext are nearly useless:
- `matchId` is stored in `contextMeta` but **never queried against DB**
- `screenContext` is a plain text string like `"Current screen: Match detail — Arsenal vs Liverpool"`
- Neither triggers any data retrieval — they're just injected into the prompt as text

---

## 4. PRISMA SCHEMA — ALL 22 MODELS

### Auth & Users
| Model | Key Fields | Notes |
|-------|-----------|-------|
| `User` | email, role (user/pro/admin), plan (free/pro/elite), predictionAccuracy, favoriteTeams (JSON) | Has relations to Prediction, Vote, Bookmark, Activity, Session, Notification, UserPreference |
| `Session` | userId, token, ipAddress, userAgent | JWT session tracking |

### User Content (string matchId, NO FK to Match table)
| Model | Key Fields | Notes |
|-------|-----------|-------|
| `Prediction` | matchId (string), homeTeam, awayTeam, predictedOutcome, model (elo/poisson/dixon_coles/monte_carlo/user), confidence, isCorrect | @@unique([userId, matchId]) |
| `Vote` | matchId (string), choice (home/draw/away) | @@unique([userId, matchId]) |
| `Bookmark` | matchId (string), note, competition | @@unique([userId, matchId]) |

### System
| Model | Key Fields | Notes |
|-------|-----------|-------|
| `SystemSetting` | key (unique), value, type (string/number/boolean/json) |
| `Announcement` | title, content, type, isActive, targetRole, expiresAt |
| `FeatureFlag` | name (unique), isEnabled, rollout (0-100%), targetRoles (JSON) |
| `Notification` | userId, type (goal/card/kickoff/prediction_result/system/achievement), isRead |
| `Activity` | userId, type (login/prediction/vote/bookmark/achievement/subscription_change), metadata (JSON) |
| `UserPreference` | userId (unique), favoriteTeams, favoriteLeagues, defaultLeague, theme |

### Canonical Entity System (Cycle 4)
| Model | Key Fields | Notes |
|-------|-----------|-------|
| `CanonicalTeam` | displayName, shortCode, leagueCode, country, logo, eloRating | @@unique([displayName, leagueCode]). Has SourceIdentity[] and TeamAnalytic[] |
| `SourceIdentity` | canonicalTeamId, source (espn/api-sports/football-data.org/understat), externalId, externalName, confidence (EXACT/ALIAS/NORMALIZED/UNRESOLVED) | @@unique([source, externalId]) |

### Data Warehouse
| Model | Key Fields | Notes |
|-------|-----------|-------|
| `Team` | name, code, logo, leagueCode, eloRating, wins/draws/losses, goalsFor/Against, source, sourceId | Has homeMatches, awayMatches, players, analytics. @@unique([source, sourceId]) |
| `Player` | name, position, age, nationality, teamId, goals, assists, yellowCards, redCards, rating, season | @@unique([source, sourceId]) |
| `Match` | homeTeamId, awayTeamId, competition, status, homeScore/awayScore, homeXg/awayXg (with truthClass), possession, shots, corners, source | Has events. @@unique([source, sourceId]) |
| `MatchEvent` | matchId, minute, type, detail, team, playerName, playerPhoto, assistName |
| `StandingEntry` | teamName, competitionCode, season, rank, played, wins/draws/losses, goalsFor/Against, form, homeRecord | @@unique([competitionCode, season, teamName]) |
| `TeamAnalytic` | canonicalTeamId or teamId, source, season, leagueCode, truthClass, xgPerGame, xgaPerGame, npxG, ppda, deep, dataFreshness | Cross-source analytics with truth classification |
| `SyncLog` | source, action, status, recordsProcessed/Created/Updated, durationMs |
| `OddsSnapshot` | externalId, source, sportKey, homeTeam, awayTeam, commenceTime, homeWinOdds/drawOdds/awayWinOdds, spreads, totals, rawData (JSON blob) | Historical odds warehouse |
| `NewsArticle` | externalId (unique), title, summary, content, sourceName, sourceUrl, category, sentiment, isBreaking, publishedAt | Newsdata.io cache |

---

## 5. AI GATEWAY (src/lib/ai-gateway.ts — 431 lines)

### Provider Priority Order:
1. **Groq** — `llama-3.3-70b-versatile`, 4096 max tokens
2. **Cerebras** — `llama-4-scout-17b-16e-instruct`, 4096 max tokens
3. **Google Gemini** — `gemini-2.5-flash`, 4096 max tokens
4. **OpenRouter** — `google/gemma-4-26b-a4b-it:free`, 2048 max tokens
5. **NVIDIA** — `meta/llama-3.1-70b-instruct`, 4096 max tokens
6. **Mistral** — `mistral-small-latest`, 4096 max tokens
7. **GitHub Models** — `openai/gpt-4o-mini`, 4096 max tokens

### Key Exports:
```typescript
function resolveKey(envKey: string): string  // Get API key from env
function callAi(messages: AiMessage[], options?): Promise<AiResult>  // Non-streaming
function callAiStream(messages: AiMessage[], options?): Promise<{stream, provider, model} | null>  // Streaming
function getProviderStatus(): Array<{name, model, configured, coolingDown, source}>  // Status check
```

### AiMessage type:
```typescript
interface AiMessage { role: 'system' | 'user' | 'assistant'; content: string }
```

### AiResult type:
```typescript
interface AiResult { text: string; provider: string; model: string; latencyMs: number; tokensUsed?: { prompt: number; completion: number } }
```

### Important constraints:
- **Input length cap**: 10,000 characters total — if exceeded, returns empty response
- **Timeout**: 10 seconds per provider
- **Cooldown**: 429 → 120s, 403/401 → 300s, timeout → 30s
- **No tool calling / function calling** — gateway only supports plain text messages
- **No structured output / JSON mode** — always returns raw text

---

## 6. CHAT ROUTE (src/app/api/chat/route.ts — 297 lines)

### Current System Prompt (89 lines):
- Identity: "ELASTICO — a football intelligence analyst, not a chatbot"
- Response format: Bottom line → Key findings → Evidence → My read
- Truth classification: REAL / DERIVED / ANALYSIS / UNKNOWN
- Honesty rules: no fabrication, no missing→zero, no invented stats
- Commands listed: /analyze, /compare, /match, /player, /team, /form, /predict, /odds, /news, /help
- **Only `/help` is actually implemented** — all other commands are just prompt instructions for the LLM

### Current Request Flow:
```typescript
POST body: { message: string, matchId?: string, stream?: boolean, history?: Array<{role, content}>, screenContext?: string }
```

1. Rate limit: 10 req/min per IP
2. Auth check via `authenticateRequest(req)`
3. `/help` command → static response, bypass AI
4. Build messages: [SYSTEM_PROMPT, ...history, userMessageWithContext]
5. If `stream: true` → `callAiStream()` → SSE-like text stream
6. If `stream: false` → `callAi()` → JSON response
7. Fallback to `generateFootballAnalysis()` if AI fails

### What the chat route DOES NOT receive from client:
- No userId (auth only validates token, doesn't pass user data to AI)
- No selected team ID
- No competition/league context
- No structured match data (just a string matchId that is never used for DB queries)

---

## 7. CHAT UI (src/components/elastico/chat-view.tsx — 666 lines)

### State:
- `selectedModel`: 'pro' | 'fast' (currently both map to same gateway call — no actual difference)
- `selectedMatchId`: string from dropdown (sends to backend as `matchId`)
- `isMockMode`: true if no AI provider configured
- `chatMessages`: stored in Zustand, cleared on logout

### What it sends to /api/chat:
```typescript
{
  message: trimmed,
  model: selectedModel,        // 'pro' or 'fast' — UNUSED by backend
  stream: true,
  history: recentHistory,     // last 10 messages
  screenContext: string,      // e.g. "Current screen: Match detail — Arsenal vs Liverpool"
  matchId: selectedMatchId,   // if user manually selected a match
  context: string,            // e.g. "Arsenal vs Liverpool" — UNUSED by backend
}
```

### Screen context detection (auto):
- If `currentView === 'match-detail'` → injects match names from Zustand store
- If `currentView === 'players'` → "Current screen: Players view"
- If `currentView === 'tactical'` → "Current screen: Tactical analysis view"
- If `currentView === 'predictions'` → "Current screen: Predictions view"

### Markdown rendering:
- Custom `parseMarkdown()` function — handles ##, **, -, numbered lists, paragraphs
- No table rendering, no code blocks, no links

---

## 8. ZUSTAND STORE (src/store/use-elastico-store.ts — 523 lines)

### Types defined in store (not in separate types/ directory):
```typescript
type View = 'login' | 'dashboard' | 'matches' | 'match-detail' | 'predictions' | ...
interface User { id, email, name, displayName, avatarUrl, role, plan, predictionAccuracy, ... }
interface Match { id, homeTeamId, awayTeamId, competition, status, homeScore, awayScore, homeXg, awayXg, homeTeam?: Team, awayTeam?: Team, events?: MatchEvent[], ... }
interface Team { id, name, code, primaryColor, eloRating, form, wins, draws, losses, goalsFor, goalsAgainst, xgPerGame, xgaPerGame, xgTruthClass, xgSource, xgFreshness, ... }
interface Player { id, name, number, position, goals, assists, yellowCards, redCards, rating, ... }
interface ChatMessage { id, role: 'user' | 'assistant', content, timestamp }
interface NewsItem { id, title, summary, content, source, category, isBreaking, sentiment, publishedAt, ... }
```

### Store state relevant to Intelligence Layer:
- `matches: Match[]` — all loaded matches (from ESPN live fetch)
- `teams: Team[]` — all loaded teams
- `news: NewsItem[]` — loaded news articles
- `chatMessages: ChatMessage[]` — conversation history
- `currentView: View` — which page user is on
- `selectedMatchId: string | null` — currently selected match
- `user: User | null` — authenticated user with preferences
- `token: string | null` — JWT token

### Data fetching actions:
- `fetchMatches()` → GET /api/matches → ESPN live scores
- `fetchTeams()` → GET /api/teams → from DB or ESPN
- `fetchNews()` → GET /api/news?limit=30 → from DB (NewsArticle cache)
- `fetchLiveScores(league?)` → GET /api/live → ESPN

---

## 9. PREDICTION ENGINES (TWO SEPARATE FILES)

### 9a. src/lib/predictions.ts (1,324 lines) — Pure Math Models

Exported functions:
```typescript
calculateElo(homeElo, awayElo, K?, homeAdvantage?): EloResult
// Returns: homeProb, drawProb, awayProb, expectedHomeGoals, expectedAwayGoals, homeEloNew, awayEloNew

poissonProbabilities(homeExpectedGoals, awayExpectedGoals, maxGoals?): PoissonResult
// Returns: matrix[][], homeWinProb, drawProb, awayWinProb, overProb, underProb, bttsProb, mostLikelyScore

dixonColes(homeLambda, awayLambda, rho?, maxGoals?): DixonColesResult
// Returns: matrix[][], homeWinProb, drawProb, awayWinProb (with tau adjustment for low scorelines)

monteCarloSimulation(homeExpectedGoals, awayExpectedGoals, simulations?): MonteCarloResult
// Returns: simulations[], stats: { homeWinPct, drawPct, awayWinPct, avgHomeGoals, avgAwayGoals, goalDistribution, scoreDistribution }

wilsonConfidenceInterval(successes, total, z?): WilsonInterval
calculateXg(shots: Shot[]): XgResult
calculateForm(results: string[]): FormResult  // ['W','D','L','W','W'] → formRating, momentum, trend
teamComparison(home: TeamData, away: TeamData): TeamComparisonResult
halftimeAdjustment(events: FirstHalfEvent[], homeXg, awayXg): HalftimeAdjustmentResult
generateTacticalInsight(matchData: MatchStats): string
calculateMatchMomentum(events: MatchEvent[]): MomentumPoint[]
weatherImpact(weather: string, pitch: string): WeatherImpactResult
```

Key input types:
```typescript
interface TeamData { name, elo, form: string[], attackStrength, defenseStrength, avgGoalsScored, avgGoalsConceded, style? }
interface MatchStats { homePossession, awayPossession, homeShots, awayShots, homeShotsOnTarget, awayShotsOnTarget, ... }
```

### 9b. src/lib/prediction-engine.ts (812 lines) — Advanced Stochastic Engine

Exported functions:
```typescript
calibrateGARCH(residuals: number[]): number  // GARCH volatility from historical residuals
extractJumpDiffusionParams(residuals: number[]): JumpDiffusionParams  // Jump frequency/intensity/volatility
applyInjuryAdjustments(input: MatchInput, injuries: InjuryAdjustment[]): MatchInput
runStochasticSimulation(input: MatchInput, config?): StochasticMatchResult
// Returns: matchProbabilities, totalsMarket, exoticScorelines, expectedMeans, asianHandicap, bothTeamsToScore, confidence, volatilityIndex

calculateKelly(modelProb, odds, bankroll, fraction?): KellyResult
calculatePortfolioAllocation(bets, bankroll): PortfolioAllocation
analyzeMarketSignals(openingOdds, currentOdds, matchId, homeTeam, awayTeam): MarketSignal
adjustForLuck(actualGoals, xG): { luckAdjustedGoals, luckIndex, classification }
runFullMatchAnalysis(input: MatchInput, bankroll?, openingOdds?, config?): FullMatchAnalysis
// Complete pipeline: luck adjust → simulate → kelly → portfolio → market signals → recommendation
```

Key input type:
```typescript
interface MatchInput {
  homeTeam: string; awayTeam: string; homeTeamId?: string; awayTeamId?: string
  homeElo: number; awayElo: number
  homeXg: number; awayXg: number
  homeGoals: number; awayGoals: number
  homeTeamForm: string[]; awayTeamForm: string[]  // e.g. ['W','D','L','W','W']
  homeAttackStrength: number; awayAttackStrength: number
  homeDefenseStrength: number; awayDefenseStrength: number
  homeAvgGoalsScored: number; awayAvgGoalsScored: number
  homeAvgGoalsConceded: number; awayAvgGoalsConceded: number
  bookmakerOdds?: { home: number; draw: number; away: number }
  injuries?: InjuryAdjustment[]
  avgGoalsPerGame?: number
}
```

**CRITICAL: Neither prediction file is imported or called from anywhere in the chat pipeline.**

---

## 10. ENTITY RESOLUTION

### src/lib/entity-resolution.ts (348 lines)
- Resolves Understat team names to DB teams
- 4-level confidence: EXACT → ALIAS → NORMALIZED → UNRESOLVED
- Manual alias table for ~100 teams across 5 leagues
- `resolveUnderstatTeam(db, understatTeamId, name, leagueCode, season)` → `ResolvedTeam`
- `resolveUnderstatTeams(db, teams, leagueCode, season)` → batch version

### src/lib/canonical-entity.ts (306 lines)
- Builds CanonicalTeam + SourceIdentity mappings
- Source priority: api-sports > football-data.org > espn > understat
- `buildCanonicalEntities(db)` — groups Teams by normalized name + league, creates canonical
- `findCanonicalId(db, source, externalId)` — reverse lookup
- `linkUnderstatToCanonical(db, dbTeamId, understatId, name, confidence, method)`
- `classifyFreshness(syncedAt)` — FRESH (<24h) / CURRENT (<7d) / SEASON (<90d) / STALE (>90d)

### How to resolve a team name from chat to a DB team:
```typescript
// Option 1: Direct name search on CanonicalTeam
const canonical = await db.canonicalTeam.findFirst({
  where: { displayName: { equals: teamName, mode: 'insensitive' } },
  include: { identities: true, analytics: { orderBy: { syncedAt: 'desc' }, take: 1 } }
})

// Option 2: Via SourceIdentity for a specific source
const identity = await db.sourceIdentity.findFirst({
  where: { source: 'espn', externalName: { contains: teamName, mode: 'insensitive' } },
  include: { canonicalTeam: { include: { identities: true, analytics: true } } }
})

// Option 3: Via Team table (source-specific)
const team = await db.team.findFirst({
  where: { name: { contains: teamName, mode: 'insensitive' } },
  include: { analytics: true }
})
```

---

## 11. DATA SOURCES & THEIR LIB FILES

### ESPN (src/lib/football-data.ts — 534 lines)
- **No API key needed** — public APIs
- 20 leagues supported (PL, LIGA, SA, BL, L1, MLS, UCL, UEL, WC, CA, etc.)
- Functions: `fetchAllLiveScores()`, `fetchLeagueScores(code)`, `fetchDateScores(date, code?)`, `fetchStandings(code)`, `fetchTeams(code)`, `fetchTeamRoster(league, teamId)`, `fetchInjuries(league, teamId?)`, `fetchMatchSummary(league, eventId)`, `fetchMatchOdds(league, eventId)`, `fetchWinProbability(league, eventId)`, `fetchPlayByPlay(league, eventId)`, `fetchLeagueNews(league)`, `fetchLeagueLeaders(league)`
- `fetchAllLiveScores()` hits **20 ESPN endpoints in parallel** — this is the performance bottleneck
- Has Next.js `revalidate` cache (60-3600s depending on endpoint)

### Football-Data.org (src/lib/football-data-org.ts — 287 lines)
- **API key required**: `FOOTBALL_DATA_API_KEY`
- 7 competitions: PL, PD, SA, BL1, FL1, CL, EL
- Functions: `fetchStandings(code)`, `fetchMatches(code)`, `fetchTodaysMatches()`, `fetchScorers(code)`, `fetchCompetitions()`, `fetchMatchesWithOdds(code)`, `normalizeFDMatch(match)`
- Data persisted to DB: StandingEntry, Match, Team, OddsSnapshot

### Understat (src/lib/understat.ts — 403 lines)
- **No API key** — scraped from understat.com
- 5 leagues: PL, LIGA, SA, BL, L1
- Functions: `fetchTeamStats(league, season)` → xG/xGA/PPDA/deep per team
- Data persisted to: TeamAnalytic (with truth classification)

### TheOdds API (src/lib/the-odds-api.ts — 169 lines)
- **API key required**: `THE_ODDS_API_KEY`
- Functions: `fetchOdds(sportKey?)` → bookmaker odds
- Data persisted to: OddsSnapshot

### API-Sports (src/lib/api-sports.ts — 362 lines)
- **API key required**: `API_SPORTS_KEY`
- Functions: `fetchFixtures(leagueId?)`, `fetchTeamInfo(teamId)`, `fetchH2H(team1, team2)`, `fetchInjuries(teamId)`, `fetchOdds(fixtureId)`

### Newsdata.io (src/lib/newsdata.ts — 122 lines)
- **API key required**: `NEWSDATA_API_KEY`
- Functions: `fetchFootballNews(query?, page?, limit?)`, `fetchFootballNewsByTopic(topic, limit?)`
- Topics: transfers, injuries, match-report, premier-league, champions-league, general
- Data persisted to: NewsArticle

### StatsBomb (src/lib/statsbomb.ts — 378 lines)
- **No API key** — open data from GitHub
- Functions: competitions, matches, events, shots, xg, passes
- Historical data only (2022 World Cup, etc.)

### TheSportsDB (src/lib/the-sports-db.ts — 490 lines)
- **API key required**: `THE_SPORTS_DB_KEY` (free patron key = 123)
- Team badges, player info, league tables, past results

---

## 12. KEY API ROUTES RELEVANT TO INTELLIGENCE LAYER

### Match Detail: GET /api/matches/[id] (319 lines)
- **30-second in-memory cache** (Map with TTL, max 200 entries)
- Resolution chain: DB by ID → DB by externalId → football-data.org (fd: prefix) → ESPN live
- Enriches DB matches with TeamAnalytic (xG data) from canonical or legacy lookup
- Returns: `{ match: {...}, source: 'database' | 'football-data.org (live)' | 'espn' }`
- **Performance problem**: `fetchAllLiveScores()` in the ESPN fallback hits 20 ESPN endpoints

### Predictions: POST /api/predictions/compute (135 lines)
- Receives: matchId, model (elo/poisson/dixon_coles/monte_carlo), homeGoals, awayGoals, homeXg, awayXg
- Calls the appropriate prediction model from `src/lib/predictions.ts`
- Saves result to Prediction table
- **Not connected to chat at all**

### Prediction Engine: POST /api/prediction-engine/simulate (128 lines)
- Receives: MatchInput (full stochastic input)
- Calls `runFullMatchAnalysis()` from `src/lib/prediction-engine.ts`
- Returns: full stochastic simulation with Kelly, portfolio, market signals
- **Not connected to chat at all**

### News: GET /api/news (302 lines)
- Checks DB (NewsArticle) first, refreshes from Newsdata.io if stale
- Returns cached news with filtering by query/team/competition
- **Not connected to chat at all**

### Teams: GET /api/teams (222 lines)
- Returns teams from DB, enriched with analytics (xG, PPDA, deep)
- Joins CanonicalTeam + SourceIdentity for cross-source data
- **Not connected to chat entity resolution**

### Standings: GET /api/standings (117 lines)
- Returns from DB (StandingEntry), refreshes from football-data.org if stale
- **Not connected to chat**

### Odds: GET /api/odds (345 lines)
- Returns from DB (OddsSnapshot), refreshes from TheOdds API if stale
- Filters by sportKey, team
- **Not connected to chat**

### Matches list: GET /api/matches (151 lines)
- Calls `fetchAllLiveScores()` (ESPN, 20 parallel requests)
- **This is the main data loading call on app start**

---

## 13. DATA AVAILABLE IN POSTGRESQL THAT THE AI SHOULD BE USING

### For a team query ("Analyze Arsenal"):
- `Team` — name, elo, W/D/L, goals, venue, league
- `CanonicalTeam` — unified identity, ELO
- `SourceIdentity` — cross-source IDs
- `TeamAnalytic` — xG, xGA, npxG, PPDA, deep (with truthClass, dataFreshness)
- `StandingEntry` — league position, points, form, home/away record
- `Player` — squad players with stats
- `NewsArticle` — recent news (filtered by team name in title/content)
- `Match` — recent matches (home or away)
- `OddsSnapshot` — market odds

### For a prediction query ("Predict Real Madrid vs Barcelona"):
- Everything above for both teams
- `Match` — the specific fixture if in DB
- Prediction models: `calculateElo()`, `poissonProbabilities()`, `dixonColes()`, `runStochasticSimulation()`
- `OddsSnapshot` — real market odds → Kelly criterion

### For a match analysis query ("Why did Arsenal lose?"):
- `Match` — score, xG (with truthClass), possession, shots, corners
- `MatchEvent` — goals, cards, substitutions with minute
- `TeamAnalytic` — both teams' season analytics

---

## 14. WHAT NEEDS TO BE BUILT: INTELLIGENCE ORCHESTRATION LAYER

### The layer sits between `/api/chat` and the AI Gateway:

```
User message
     ↓
/api/chat (current route — WILL BE MODIFIED)
     ↓
╔════════════════════════════════════╗
║  INTELLIGENCE ORCHESTRATION LAYER  ║  ← NEW CODE
║                                    ║
║  1. Intent Engine                  ║
║  2. Entity Resolver                ║
║  3. Context Engine                 ║
║  4. Retrieval Planner              ║
║  5. Evidence Validator             ║
║  6. Analytics Engine Caller        ║
║  7. Reasoning Context Builder      ║
║  8. Response Controller            ║
╚════════════════════════════════════╝
     ↓
AI Gateway (existing — unchanged)
     ↓
LLM Provider (Groq/Cerebras/Gemini/...)
     ↓
Response (possibly structured)
     ↓
Chat UI (existing — may need updates)
```

### Suggested file structure for the new layer:
```
src/lib/intelligence/
  types.ts              — All interfaces for the layer
  intent-engine.ts      — Classify user intent
  entity-resolver.ts   — Resolve team/player/competition names to DB entities
  context-engine.ts    — Gather screen context, user preferences, conversation state
  retrieval-planner.ts — Determine what data is needed per intent
  data-retriever.ts     — Execute PostgreSQL queries and API calls
  evidence-validator.ts — Tag each data point with truthClass, freshness, source
  analytics-caller.ts  — Invoke prediction models with retrieved data
  context-builder.ts   — Assemble the final prompt with all evidence
  response-controller.ts — Parse/validate LLM output, enforce rules
  index.ts              — Main orchestration function
```

### Key design constraints:
1. **All DB queries happen server-side** in `/api/chat/route.ts` — never in the browser
2. **The AI gateway only receives text messages** — no tool calling, no function calling
3. **The 10,000 character input limit** on the AI gateway means the reasoning context must be concise
4. **Prediction engines are pure functions** — they need data inputs assembled from DB queries
5. **Entity resolution must handle** aliases ("Real" → "Real Madrid", "Barca" → "FC Barcelona")
6. **The canonical entity system exists** but may not have data for all teams — need fallback to direct Team query
7. **NewsArticle has no team ID** — entity extraction from news titles/content is needed
8. **No Prisma migrations** — use `prisma db push` for schema changes
9. **No tests exist** — the layer should be testable but tests can come later

---

## 15. EXISTING CODE THAT SHOULD NOT CHANGE

- `src/lib/ai-gateway.ts` — provider routing works well, don't modify
- `src/lib/predictions.ts` — pure math models, stable
- `src/lib/prediction-engine.ts` — stochastic engine, stable
- `src/lib/football-data.ts` — ESPN integration, stable
- `src/lib/canonical-entity.ts` — entity system, stable
- `src/lib/entity-resolution.ts` — Understat resolution, stable
- `prisma/schema.prisma` — may need new models (AiChatLog, etc.) but existing models should not change

## 16. CODE THAT WILL NEED MODIFICATION

- `src/app/api/chat/route.ts` — main integration point, will import and call the intelligence layer
- `src/components/elastico/chat-view.tsx` — may need updates for structured responses, loading states, new metadata
- `src/store/use-elastico-store.ts` — may need new state for intelligence metadata, structured responses

---

## 17. ENVIRONMENT VARIABLES (relevant to AI)

Already configured in production (Vercel):
- `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `GOOGLE_AI_API_KEY`, `OPENROUTER_API_KEY`, `NVIDIA_API_KEY`

Available but may not be configured:
- `MISTRAL_API_KEY`, `GITHUB_TOKEN`

Data APIs:
- `API_SPORTS_KEY`, `THE_ODDS_API_KEY`, `FOOTBALL_DATA_API_KEY`, `NEWSDATA_API_KEY`, `THE_SPORTS_DB_KEY`

---

## 18. KNOWN PERFORMANCE ISSUES (from earlier audit)

1. **`fetchAllLiveScores()`** hits 20 ESPN endpoints in parallel — no caching between calls
2. **Match detail for non-DB matches** triggers `fetchAllLiveScores()` as fallback
3. **football-data.org fallback** in match detail fetches 7 competitions in parallel
4. **StatsBomb JSON** downloaded twice in match-detail-view.tsx
5. **50 players fetched** in match detail but never displayed
6. **Zero caching** on most data fetches (only match detail has 30s cache)
7. **News has no entity extraction** — can't filter by team ID

---

## 19. ARCHITECTURAL ADDENDUM — MANDATORY DESIGN CORRECTIONS

> **THIS SECTION OVERRIDES ANY CONFLICTING ASSUMPTIONS IN SECTIONS 1-18.**
> Read this section first. It was written after the codebase audit and contains critical architectural decisions from the product owner.

### 19.1 The LLM Is NOT the Intelligence

**The most important principle:**

> ELASTICO should become a **football intelligence system with an AI reasoning interface**.
> The LLM is the reasoning/interface layer. PostgreSQL + analytics models + retrieval + prediction models + current news + historical outcomes form the actual knowledge and evidence system.

**What this means concretely:**
- The system IS intelligent. The LLM REASONS OVER that intelligence.
- No prediction number should come from the LLM's parametric knowledge. Ever.
- No current-affairs claim should reach the AI without provenance.
- No model should be called "intelligent" merely because it has a large number of parameters.

### 19.2 Do NOT Build a Neural Network

> Do not try to make ELASTICO intelligent by embedding a neural network into the app. That is almost certainly the wrong abstraction.

What you actually want is **multiple specialized intelligence models** (deterministic and statistical), orchestrated by a retrieval and evidence system, with the LLM explaining the output.

The system should have specialized engines:
- **Prediction Engine** — ELO, Poisson, Dixon-Coles, Monte Carlo, Stochastic (these already exist in `src/lib/predictions.ts` and `src/lib/prediction-engine.ts`)
- **Tactical Engine** — event data → possession sequences → pressing → xT → team style
- **Player Intelligence** — events → role detection → performance metrics → trend detection → similar player retrieval
- **News Intelligence** — articles → entity extraction → team/player linking → event classification → importance scoring

### 19.3 The Sacred Data Flow

This is the absolute architectural law:

```
External Source → PostgreSQL → Intelligence Layer → AI → UI
```

Never:
- External Source → AI directly
- AI → number without PostgreSQL trace
- News article → AI context without entity extraction
- User prediction → AI without prediction engine computation

Specifically for every data type:

```
Football API → PostgreSQL → Analytics Engine → TeamAnalytic → AI context → answer

NewsData API → NewsArticle (PostgreSQL) → [future: embedding → pgvector → retrieval] → AI context → answer

Odds API → OddsSnapshot (PostgreSQL) → historical odds analysis → prediction engine → AI context → answer

Match events → MatchEvent (PostgreSQL) → tactical analysis → AI context → answer
```

### 19.4 News Must Become Structured Events

Current state: `NewsArticle` is a flat cache — title, summary, content, sentiment.

Required state: News should be transformed into **structured football events** that the prediction engine and AI can actually consume.

Example — this news article:
> "Mbappé missed training today."

Must become:
```typescript
{
  type: "PLAYER_AVAILABILITY",
  player: "Mbappé",
  team: "Real Madrid",
  status: "QUESTIONABLE",
  source: "NewsData",
  publishedAt: "...",
  confidence: 0.91,
  impact: "HIGH"
}
```

This is the difference between:
- **AI that reads news** (current)
- **AI that incorporates news into football reasoning** (required)

**Implementation note:** For Stage 1, entity extraction from news titles/content can use simple string matching against team/player names in the DB. LLM-based extraction can come later.

### 19.5 Granular Provenance System

The current truth classification (REAL/DERIVED/ANALYSIS/UNKNOWN) is too coarse. Every piece of intelligence should carry:

```typescript
{
  value: any,
  truthClass: "REAL" | "DERIVED" | "MODELLED" | "RETRIEVED" | "ANALYSIS" | "ESTIMATED" | "STALE" | "UNKNOWN",
  source: string,        // "Understat", "API-Sports", "ESPN", "Prediction Engine", "NewsData"
  sourceUrl: string?,   // link to original data
  timestamp: Date,      // when was this data point created/fetched
  confidence: number,   // 0-1
  method: string,       // "measured", "calculated:poisson", "estimated:proxy", "reported:news"
  freshness: "FRESH" | "CURRENT" | "SEASON" | "STALE",
}
```

The AI must be able to say:
> "This xG is directly sourced from Understat, synced 2 hours ago."

vs:

> "This tactical assessment is an inference from event data."

vs:

> "This injury report comes from a news article published 3 hours ago, not yet confirmed."

### 19.6 Evidence Before Reasoning — The Required Data Contract

Before ELASTICO is allowed to produce any analytical response, it must:

1. **Classify intent** — what kind of question is this?
2. **Resolve entities** — which teams/players/competitions are mentioned?
3. **Determine required evidence** — what data is needed to answer?
4. **Retrieve from PostgreSQL** — get the actual data with provenance
5. **Call analytical models** — run prediction engines with real inputs
6. **Validate evidence completeness** — what's missing?
7. **Build reasoning context** — assemble evidence into a concise prompt
8. **Call LLM** — let it reason OVER the evidence
9. **Validate output** — ensure no fabricated numbers, every stat has provenance
10. **Return** — structured response with metadata

For a prediction query, the required data contract might look like:
```typescript
interface PredictionContext {
  fixture: { homeTeam, awayTeam, competition, kickoff, venue, homeOrAway }
  homeTeam: { elo, xg, xga, form, injuries, news, recentResults, homeRecord }
  awayTeam: { elo, xg, xga, form, injuries, news, recentResults, awayRecord }
  modelOutputs: { elo: EloResult, poisson: PoissonResult, dixonColes: DixonColesResult, monteCarlo: MonteCarloResult }
  currentEvents: Array<{ type, player, team, status, impact, source, confidence }>
  odds: { home, draw, away, source, timestamp } | null
  dataQuality: { available: string[], missing: string[], stale: string[] }
}
```

Then:
```
if required_data_missing:
    don't fabricate
    explain what is missing
    if partial data exists, reason over what IS available
```

### 19.7 The Target Architecture (North Star)

```
                 EXTERNAL WORLD
                       │
       ┌───────────────┼────────────────┐
       │               │                │
 Football APIs       News             Odds
       │               │                │
       └───────────────┼────────────────┘
                       ↓
                 INGESTION LAYER
               (existing cron/routes)
                       ↓
                 POSTGRESQL
                       │
          ┌────────────┼────────────┐
          │            │            │
       Structured   Analytics    Embeddings
       Data         Data         (future:
          │            │          pgvector)
          │            │
          └────────────┼────────────┘
                       ↓
              INTELLIGENCE ENGINE
                       │
        ┌──────────────┼───────────────┐
        │              │               │
    Prediction      Tactical        Scouting
      Engine         Engine       Intelligence
        │              │               │
        └──────────────┼───────────────┘
                       ↓
                EVIDENCE BUILDER
                       ↓
                 LLM GATEWAY
            (existing ai-gateway.ts)
                       ↓
              TRUTH / SAFETY LAYER
                       ↓
                  ELASTICO AI
                       ↓
                       UI
```

### 19.8 Build in Stages — Do NOT Build Everything at Once

The implementation must follow this staged approach:

| Stage | What | Depends On |
|-------|------|------------|
| **1** | **Reliable structured data retrieval** — Intent engine, entity resolver, DB queries, evidence assembly. The AI gets REAL data from PostgreSQL before answering. | Existing Prisma models, existing prediction functions |
| **2** | **Analytics engine integration** — Connect prediction models (ELO, Poisson, Dixon-Coles, Monte Carlo) to the intelligence layer. `/predict` produces numbers from actual model runs. | Stage 1 |
| **3** | **Prediction models in chat** — Full prediction pipeline: retrieve data → run models → present structured output with model consensus table. | Stages 1-2 |
| **4** | **News intelligence** — Entity extraction from NewsArticle, structured event creation, news context in predictions. | Stage 1 |
| **5** | **Embeddings + pgvector** — Semantic search over news, match reports, historical analysis. Requires pgvector extension on Neon. | Stage 4 |
| **6** | **Reranking** — Determine which retrieved evidence actually matters for the current query. | Stage 5 |
| **7** | **Evidence-aware LLM** — LLM receives structured evidence package, must reason over it, cannot fabricate. Output validation. | Stages 1-6 |
| **8** | **Outcome tracking** — Store predictions vs actual results. Model versioning. Feature audit trail. | Stage 3 |
| **9** | **Model evaluation** — Which models are calibrated? Which features matter? Systematic over/underestimation by team? | Stage 8 |
| **10** | **Model improvement** — Ensemble weighting, feature selection, recalibration based on outcomes. | Stage 9 |
| **11** | **Autonomous intelligence** — Self-learning, proactive insights, alert generation. | Stages 1-10 |

**For this implementation, focus on STAGES 1-3.** Stages 4+ are future work that the architecture should support but not implement yet.

### 19.9 Future Model Ensemble Architecture

The system should eventually support weighted model ensembles:

```
                 MATCH
                   ↓
        ┌─────────────────────┐
        │ Prediction Ensemble  │
        └─────────────────────┘

        ELO Model       23%
        xG Model        31%
        Form Model      14%
        Tactical Model  12%
        Player Model     9%
        Market/Odds      6%
        News Model       5%
                   ↓
            Ensemble Output
                   ↓
            LLM explains WHY
```

But this is NOT the starting point. Start with structured retrieval + existing models.

### 19.10 Referenced GitHub Repositories (For Audit, Not Blind Installation)

These were identified as potentially useful reference implementations. **Audit before using** — check license, data licensing, maintenance, methodology, compatibility.

| Repo | What It Offers | Relevance |
|------|---------------|-----------|
| `github.com/carrba/football-data-xg` | End-to-end XGBoost xG pipeline from StatsBomb data | xG model training patterns |
| `github.com/Lephim/football-intelligence-copilot` | Separates: ingestion → analytics → training → visualization → API. Treats LLM as layer ON TOP of analytics. | Architecture reference |
| `github.com/ronniepiku/MatchMind` | Prediction, tactical analysis, scouting, executive reporting, analytical queries | Feature scope reference |
| `github.com/ML-KULeuven/soccer_xg` | xG with Opta, Wyscout, StatsBomb event streams | xG methodology |
| `github.com/itzmore-mph/football-analytics-dashboard` | XGBoost xG, NetworkX passing networks, Streamlit dashboard | Visualization patterns |
| `github.com/PriorLabs/tabpfn-football-predictions` | TabPFN for football match prediction | Alternative prediction approach |
| `github.com/vishnu8406/football-analytics` | Football analytics | General reference |
| `github.com/pgvector/pgvector` | Vector similarity search for Postgres | Stage 5 dependency |

**DO NOT install these as dependencies.** Study their architecture and methodology.

### 19.11 North Star Design References

Visual design references from the ChatGPT conversation:
- **Behance FUI**: https://www.behance.net/gallery/119098909/FUI-Functional-User-Interfaces — Functional UI design patterns
- **SportsInsight472**: https://www.sportsinsight472.com/sports_dashboard.png — Sports analytics dashboard mockup
- **Caiq.ai**: https://caiq.ai/assets/dashboard-mockup-De03kwQY.png — AI dashboard mockup
- **Dribbble UI references** (3 shots): football analytics dashboard patterns

### 19.12 The 10,000 Character Constraint Is Real

The AI gateway (`ai-gateway.ts`) has a hard input limit: if total message content exceeds 10,000 characters, it returns an empty response.

This means the evidence package sent to the LLM MUST be concise. Strategies:
- Summarize retrieved data into key metrics only
- Use tables instead of prose
- Omit raw data — only include derived/analyzed values
- The intelligence layer does the heavy lifting; the LLM gets a brief but complete evidence summary

### 19.13 No Tool Calling / Function Calling

The AI gateway only supports plain text messages. There is no OpenAI-style tool calling or function calling. The intelligence layer must execute all retrieval and computation BEFORE calling the LLM.

This is actually correct for the architecture — the system retrieves and computes, then hands the LLM a complete evidence package to reason over.

### 19.14 Prediction Outcome Learning (Future)

Eventually ELASTICO should learn from its own predictions:

```typescript
interface PredictionOutcome {
  predictionId: string
  predicted: { homeWin: number, draw: number, awayWin: number }
  actual: { homeGoals: number, awayGoals: number, result: 'home' | 'draw' | 'away' }
  modelVersion: string
  featuresUsed: string[]
  newsAvailableAtPredictionTime: string[]
  dataQuality: { available: string[], missing: string[] }
  provider: string
  timestamp: Date
}
```

Questions the evaluation engine should answer:
- Which models are consistently calibrated?
- Which features actually matter?
- When does news improve predictions?
- When does ELO become misleading?
- Which teams are systematically over/underestimated?

This is NOT training the LLM. This is the SYSTEM learning from outcomes.

### 19.15 Prisma Schema Changes Needed

The intelligence layer will likely require new models. Since the project uses `prisma db push` (no migrations), new models can be added directly to the schema.

Potential new models (not definitive — design as you build):

```prisma
// AI Chat logging
model AiChatLog {
  id          String   @id @default(cuid())
  userId      String?
  sessionId   String?
  intent      String   // PREDICTION, MATCH_ANALYSIS, TEAM_ANALYSIS, etc.
  entities    String   // JSON: resolved team/player IDs
  dataRetrieved String  // JSON: what was retrieved, what was missing
  provider    String   // which AI provider answered
  model       String   // which model
  latencyMs   Int
  tokensUsed  Int?
  createdAt   DateTime @default(now())
}

// Structured news events (extracted from NewsArticle)
model FootballEvent {
  id            String   @id @default(cuid())
  type          String   // PLAYER_AVAILABILITY, TRANSFER, MANAGER_CHANGE, TACTICAL, SUSPENSION
  teamId        String?  // resolved team
  playerId      String?  // resolved player (free text if not in DB)
  playerName    String
  teamName      String
  status        String   // CONFIRMED, QUESTIONABLE, DOUBTFUL, RUMOUR
  impact        String   // HIGH, MEDIUM, LOW
  confidence    Float    @default(0)
  sourceArticleId String?  // FK to NewsArticle
  source        String
  publishedAt   DateTime?
  extractedAt   DateTime @default(now())
}

// Prediction tracking for outcome evaluation
model PredictionRecord {
  id            String   @id @default(cuid())
  matchId       String
  homeTeam      String
  awayTeam      String
  predicted     String   // JSON: { homeWin, draw, awayWin }
  actual        String?  // JSON: { homeGoals, awayGoals, result }
  modelsUsed    String   // JSON: ["elo", "poisson", "dixon_coles"]
  featuresUsed  String   // JSON: ["elo", "xg", "form", "injuries"]
  dataQuality   String   // JSON: { available: [...], missing: [...] }
  provider      String   // which AI provider
  isCorrect     Boolean?
  createdAt     DateTime @default(now())
  resolvedAt    DateTime?
}

// News embeddings (for pgvector — Stage 5)
// model NewsEmbedding {
//   id          String   @id @default(cuid())
//   articleId   String
//   embedding   Unsupported("vector(1536)")
//   createdAt   DateTime @default(now())
// }
```

### 19.16 The Hard Invariant

> **The LLM is never the source of truth for ELASTICO data.**

If the user asks "Predict Real Madrid":
- The LLM does NOT decide "Real Madrid probably have a higher ELO."
- The system retrieves Real Madrid's actual ELO from PostgreSQL
- The system runs prediction models with actual data
- The LLM receives the results and EXPLAINS them

This applies to every data type: stats, news, odds, form, injuries, everything.

---

## END OF DOCUMENT
