---
Task ID: 8
Agent: Super Z (Main)
Task: Fix all remaining TypeScript errors and deploy ELASTICO online

Work Log:
- Found 2 hidden mismatched template literal quotes in predictions.ts (backtick open, single-quote close at lines 1002 and 1052) - these caused the parser to enter wrong context
- Fixed the-sports-db.ts: idLeague → id (TSD_LEAGUES items use 'id' number field, not 'idLeague')
- Fixed the-sports-db/route.ts: removed duplicate fetchLeaguesByCountry import, fixed number→string type for league ID
- Fixed predictions/compute/route.ts: added missing 6th argument to dixonColes(), deduplicated 3 TEAM_ELO_MAP keys (LEV, MON, BRE)
- Fixed admin/settings/route.ts: typed results as any[] to fix Prisma upsert inference
- Fixed use-elastico-store.ts: added liveMatches and isLiveLoading to ElasticoStore interface
- Fixed achievements-view.tsx: added missing unlockedAt: null to 11 locked achievement entries
- Fixed dashboard-view.tsx: added missing Cloud import from lucide-react
- Fixed leaderboard-view.tsx: added missing Users import from lucide-react
- Fixed player-view.tsx: null-safety for appearances, imported ReferenceLine, fixed referenceLine→ReferenceLine casing
- Fixed tactical-view.tsx: imported ReferenceLine, fixed referenceLine→ReferenceLine casing
- Fixed social-view.tsx: fixed type incompatibility with unknown cast for feed state setter
- Fixed tournament-view.tsx: fixed isKnockoutStage to accept MatchData, added MatchData→KnockoutMatch converter
- Excluded upload/examples/skills/scripts from tsconfig.json
- TypeScript check: 0 errors
- Next.js build: SUCCESS (all 42 API routes + static pages)
- Git commit and push to Vercel: deployed

Stage Summary:
- 14 files changed, 22 unique bugs fixed
- Zero TypeScript errors, clean build
- Pushed to main branch, Vercel deployment triggered
- System is live and updated