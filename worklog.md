---
Task ID: 1
Agent: Main
Task: Cycle 4.5 — Data Pipeline Verification

Work Log:
- Step 1 (Environment): Checked .env — only DATABASE_URL=file:custom.db present. Schema is PostgreSQL, .env points to dead SQLite. All API keys missing (FOOTBALL_DATA_API_KEY, THE_ODDS_API_KEY, JWT_SECRET, NEON_DATABASE_URL, DIRECT_URL). Secret leakage check: PASS — no NEXT_PUBLIC_ secrets.
- Steps 2-6, 9-10: BLOCKED — no database connection, no API keys, cannot run sync or verify data.
- Step 7 (UI Code Path): Audited match-detail-view, tactical-view, compare-view, matches/[id]/route.ts for null handling.
- Step 8 (Zero-Fabrication Audit): Full codebase search across 8 categories. 32 findings. 12 fixed.
- Step 11 (Build): 0 TypeScript errors after fixes.
- Step 12 (Final Report): Verdict = NO. Environment is the critical blocker.

Fixes Applied:
1. use-elastico-store.ts: Added homeXg/awayXg as number|null, added xgSource/xgTruthClass to Match
2. match-detail-view.tsx: 4 edits — null-safe xG display, truth class from data
3. tactical-view.tsx: 2 edits — null-safe xG StatBlocks, conditional truth classes
4. compare-view.tsx: 2 edits — removed ??50/??0/??1500 defaults, null bar handling
5. matches/[id]/route.ts: 5 edits — possession/pass/press/ELO default to null

Stage Summary:
- Verdict: NO — ELASTICO cannot be trusted for real data without fabrication
- Critical blocker: No Neon DB URL, no API keys in .env
- 12 fabrication bugs fixed, 20 remaining (lower priority / architectural)
- Re-run Cycle 4.5 after user provides: DATABASE_URL, DIRECT_URL, FOOTBALL_DATA_API_KEY, THE_ODDS_API_KEY, JWT_SECRET
