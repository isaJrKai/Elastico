# ELASTICO Worklog

---
Task ID: 1
Agent: Main
Task: Cycle 4 — Build ELASTICO's first reliable analytical data pipeline

Work Log:
- AUDIT: Found .env was overwritten with only local SQLite path. Restored all keys.
- AUDIT: Understat route had broken `fetchPlayerStats` call (function never imported). Replaced with `team-xg` action.
- AUDIT: Understat sync read `ut.xG`, `ut.xGA` from team-level data, but new Understat API does NOT return these. Rewrote to use `computeTeamXgFromMatches` (match-level accumulation). Rate-limited to 3 teams/league/sync.
- BUILD: Added CanonicalTeam + SourceIdentity models to Prisma schema. Single ELASTICO identity per real-world team. Multiple source-specific Team rows map to one CanonicalTeam.
- BUILD: Added truthClass (REAL/DERIVED/PROXY/MISSING/STALE/UNAVAILABLE/DEMO/DEAD) and dataFreshness (FRESH/CURRENT/SEASON/STALE) to TeamAnalytic model.
- BUILD: Added homeXgSource, awayXgSource, homeXgTruthClass, awayXgTruthClass to Match model.
- CREATE: `/src/lib/canonical-entity.ts` — service for building canonical entities from existing Team rows, linking Understat identities, classifying freshness.
- UPDATE: Sync cron now runs `buildCanonicalEntities()` after API-Sports sync (step 2.5), before Understat enrichment.
- UPDATE: Understat sync now tags truthClass='REAL' and dataFreshness on all TeamAnalytic upserts, and links to canonical team.
- FIX: Teams API now includes xgPerGame, xgaPerGame, xgTruthClass, xgSource, xgFreshness, xgSyncedAt from TeamAnalytic.
- FIX: Match detail API now fetches TeamAnalytic for both home/away teams, passes provenance through to response. ESPN fallback correctly labels xG as MISSING (null) instead of 0.
- FIX: Tactical view StatBlock labels changed from hardcoded 'DERIVED' to dynamic truthClass from data.
- FIX: Compare view handles null xG values (shows '--' instead of 0), displays REAL/MISSING/proxy badges.
- FIX: StatBlock dataClass union type expanded to include MISSING, PROXY, STALE, UNAVAILABLE.
- AUDIT: No `shots_on_target * 0.1` proxy xG pattern found in codebase. The only xG sources are: (1) Understat match-level (REAL), (2) TeamAnalytic from sync (REAL when from Understat), (3) Prediction engine input (user-provided or MISSING). No silent proxy calculation exists.
- BUILD: 0 errors, 50 API routes, all passing.

Stage Summary:
- Canonical Entity Model: LIVE (CanonicalTeam + SourceIdentity tables)
- Real xG pipeline: Understat → computeTeamXgFromMatches → validate (non-negative) → entity resolve → persist with truthClass=REAL + dataFreshness
- Provenance: Every xG value now carries source, truthClass, freshness through API to UI
- Proxy xG audit: CLEAN — no shots_on_target*0.1 pattern found
- UI: Match Detail, Compare, Tactical views all show honest data classification (REAL/MISSING badges)
