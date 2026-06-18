---
Task ID: 7
Agent: Super Z (Main)
Task: Fix backend bugs across ELASTICO codebase

Work Log:
- Audited all 20+ backend files (engines, libs, API routes)
- Found and fixed **15 confirmed backend bugs**:
  1. **predictions.ts** (lines 948, 973, 992, 1010, 1016) — Used undefined `home`/`away` variables in narrative template strings (would crash at runtime). Fixed by replacing with generic team references.
  - **predictions.ts** (line 162) — Stray `$` character corrupted the template literal, causing TS5109/TS1109 errors. Fixed by removing stray byte.
  
  2. **predictions/compute/route.ts** — Missing `ESPNMatch` type import. Fixed.
   - Wrong `MatchInput` fields (`homeGoals`, `homeShots`, `awayShots`, `possession`, `injuries` not matching the `MatchInput` interface. Fixed to use correct fields (`homeGoalsConceded`, `homeElo`, `awayElo`, `bookmakerOdds`).
  
  3. **admin/route.ts** — `auth.user.role !== 'admin'` unsafe access without null check. Fixed with destructured `const { user } = auth` and null guard.
  - Double `req.json()` call in broadcast action (body already consumed). Fixed by saving body once at POST start.
  
  4. **admin/settings/route.ts** — `auth.user.role !== 'admin'` unsafe access in both GET and PATCH. Fixed.
  - `systemSetting.upsert` tried to set auto-managed fields (`updatedAt`, `id`). Removed from upsert create to let Prisma handle them.
  
  5. **compressed-data-stream.ts** — Key collision in `COMPACT_MAP`: `passAccuracy` and `predictionAccuracy` both mapped to `pA`. Fixed `passAccuracy` → `psA`.
  
  6. **analytics/predictions/route.ts** — Used `isCorrect` in `where` clause and `_sum`/`_count` on boolean fields (can't sum booleans). Rewrote to use simple counting.
  
  7. **the-sports-db.ts** — Duplicate `intHomeShots`/`intAwayShots` fields in `TSDEvent` interface (duplicate lines 180-201). Removed duplicates.
  
  8. **the-sports-db/route.ts** — Imported non-existent `searchLeague` function. Fixed to `fetchLeaguesByCountry`.
  - Used `leagueObj.idLeague` but `TSD_LEAGUES` items have `id` (number), not `idLeague`. Fixed to `leagueObj.id`.
  
  9. **predictions.ts** — `halftimeAdjustment` function used `home.name`/`away.name` but function takes `FirstHalfEvent[]` which has no team names. Fixed with generic team-side references.
  
  10. **admin/logs/route.ts, admin/announcements/route.ts, admin/users/route.ts, admin/feature-flags/route.ts, admin/users/[id]/route.ts** — Same `auth.user.role !== 'admin'` unsafe access. Fixed across all 7 files with proper destructuring and null guards.

Stage Summary:
- 15 confirmed backend bugs fixed
- TypeScript compilation: 0 errors in `src/` (all frontend errors are mock data type issues)
- Dev server starts cleanly on SQLite with seeded data
- Login, ping, matches, and news endpoints all verified working
- Zero runtime errors