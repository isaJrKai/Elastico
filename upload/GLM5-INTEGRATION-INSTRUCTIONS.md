# Elastico — frontend ↔ intelligence integration instructions for GLM 5

## Read this first

Do not rebuild Elastico's internals. There is already a substantial, real
analytical engine underneath this app. Your job is to **connect the UI
honestly to what already exists** — not redesign the math, and not fabricate
new visuals that outrun what the data actually supports.

Everything below was verified directly against the code in this repo — file
by file, function by function — not inferred from file names. Where a claim
is "confirmed," it means the reviewer opened the file and read the actual
logic.

---

## 1. What's real (confirmed by reading the code, not just file names)

| File | Lines | What it actually does |
|---|---|---|
| `src/lib/voronoi-engine.ts` | 299 | Real polygon clipping + area math (`polygonArea`, `clipPolygonToRect`) feeding `computeSpatialDominance` |
| `src/lib/elite-math-engine.ts` | 605 | Real shot geometry: `shotAngle`, `shotDistance`, `calculateXG`, `xGOnTarget`, `passInterceptionCDA`, `passCompletionProbability`, `expectedAssist`, kinetic/velocity functions |
| `src/lib/xt-engine.ts` | 291 | Expected threat engine |
| `src/lib/advanced-analytics-engine.ts` | 2,009 | Largest analytical file — tactical/game-state analysis |
| `src/lib/prediction-engine.ts` | 806 | Real stochastic simulation — confirmed genuine Box-Muller transform (lines 141–142) and Poisson-process sampling (line 154) for Monte Carlo-style match simulation |
| `src/lib/understat.ts` | — | **Real external data source.** Scrapes understat.com for genuine per-shot `xG`, `npxG`, `xGA`, `xGChain`, `xGBuildup`, PPDA for the top 5 European leagues. This already exists and is not being used by the dashboard (see §2). |

Counts, verified directly: 155 files under `src/`, 51 API routes under
`src/app/api/`, 26 view components under `src/components/elastico/`.

**Treat this as the engine room. Do not throw it away because the UI
doesn't show it well yet.**

---

## 2. Confirmed fabricated-data instances — fix these specifically

These are not hypothetical. Each was read in the actual file.

### 2.1 `dashboard-view.tsx` line 108 — fake xG
```ts
xg: Math.max(0.3, (m.homeScore + m.awayScore) * 0.9).toFixed(1)
```
This feeds a chart literally labeled **"xG vs Actual Goals"** (line 381).
It is not xG. It's the final score multiplied by a constant. Meanwhile
`src/lib/understat.ts` already knows how to fetch real per-match xG for
the top 5 leagues, and `elite-math-engine.ts` has a real `calculateXG()`
that computes it from shot angle/distance when shot-level data is
available.

**Fix, in priority order:**
1. If the match is in a league Understat covers, fetch real xG from
   `src/lib/understat.ts` and use it.
2. If shot-location data is available from another source, compute it with
   `calculateXG()` from `elite-math-engine.ts`.
3. If neither is available, **do not fabricate a number.** Show `—` with a
   short reason ("xG data unavailable for this league/match") instead of a
   value that looks computed.

Never let a chart display a number under a real metric's name unless it
was produced by that metric's real computation.

### 2.2 `dashboard-view.tsx` lines 66–70 — fake win probability fallback
```ts
if (!nextMatch) return { home: 40, draw: 28, away: 32 }
```
Rendered identically to real model output (same progress-bar UI, no visual
distinction). A user cannot tell this apart from an actual prediction.

**Fix:** When there is no real prediction, the UI must communicate that
explicitly — an empty/placeholder state ("No prediction yet for the next
match"), not numbers that render exactly like real ones. If you keep a
visual placeholder for layout reasons, it must look visually distinct
(e.g. grayed out, dashed, clearly labeled "—") from a populated
prediction, not just numerically different.

### 2.3 `Math.random()` audit — 48 call sites, two very different categories
Confirmed two genuinely different situations under the same pattern:

- **Legitimate** — `prediction-engine.ts` (Box-Muller transform, Poisson
  sampling) and similar core simulation files: this is correct Monte Carlo
  technique. Leave it alone.
- **Needs individual review** — the same `Math.random()` pattern appears in
  UI view components: `matches-view.tsx`, `player-view.tsx`,
  `compare-view.tsx`, `admin-view.tsx`, `leaderboard-view.tsx`,
  `export-view.tsx`, `system-monitor-view.tsx`, `sidebar.tsx`. Some of
  these may be legitimate (e.g. randomized IDs, jitter for animation
  timing) — others may be fabricating displayed stats the same way §2.1
  and §2.2 do.

**Task:** Go through each of these 8 files. For every `Math.random()` call,
classify it as (a) UI mechanics (fine — animation delay, key generation,
non-data-bearing), or (b) a value that ends up rendered as if it were a
real stat/metric/prediction (not fine — must be replaced with real data or
an honest empty state, same rule as §2.1/§2.2). Document which is which in
`worklog.md` as you go, file by file — don't batch-fix without recording
what you found in each one.

### 2.4 General rule going forward
Before wiring any number to the UI, ask: **could a user reasonably believe
this came from the analytical engine, when it didn't?** If yes, either
connect it to the real engine/data source, or make the "we don't have this
yet" state visually unmistakable. A confident-looking placeholder is worse
than an honest gap — it's exactly what makes an app look "AI-generated" in
the bad sense: impressive-looking numbers with nothing real behind them.

---

## 3. Application architecture — do not restructure this

Confirmed: this is a single-shell application, not conventional multi-page
Next.js routing.
```
src/app/page.tsx
  → src/store/use-elastico-store.ts (Zustand)
  → currentView state
  → switch(currentView) renders one of the 26 views in src/components/elastico/
```
This is a deliberate, reasonable pattern for a dense analytical app — it is
**not** a bug and should not be "fixed" by converting it into
`/dashboard`, `/matches/[id]`, etc. Preserve the shell and the Zustand
store. If you have a genuine reason to add real URL routes for
deep-linking (e.g. sharing a specific match), propose it separately —
don't do it as a side effect of a styling pass.

---

## 4. Engine → UI wiring map

Use this to know where each engine's output belongs. If a screen claims to
show one of these and isn't actually calling the corresponding function,
that's a wiring gap to close, not a design problem to paper over.

```
elite-math-engine.ts: calculateXG, shotAngle, shotDistance
  → match-detail-view.tsx shot map / xG chart
  → player-view.tsx shooting analysis

xt-engine.ts
  → player-view.tsx progressive actions
  → pitch visualization / player ranking

voronoi-engine.ts: computeSpatialDominance
  → tactical-view.tsx spatial dominance / pitch visualization

prediction-engine.ts (Monte Carlo) + kelly route
  (src/app/api/prediction-engine/simulate, .../kelly)
  → predictions-view.tsx / prediction-engine-view.tsx
  → model consensus, probability timeline

understat.ts (real xG/npxG/xGA/xGChain)
  → should feed match-detail-view.tsx and dashboard-view.tsx
    wherever "xG" is currently shown — see §2.1
```

For each arrow above: confirm the UI component actually imports and calls
the named function/route. If it doesn't — and instead has local fallback
math or a hardcoded value performing the same visual role — that's the gap
to close.

---

## 5. Design direction

A separate visual redesign (reference screens already provided) defines
the look. Your job in this pass is **not** to design new screens — it's to
make sure that whatever the new visual design shows as "the model's
reasoning" (e.g. probability timelines, "why did the model move" event
lists, shot maps) is backed by a real, traceable call into one of the
engines in §1, not a plausible-looking placeholder. If the new design
calls for a visualization that has no real engine behind it yet (e.g. an
explainability timeline breaking down *why* a prediction moved over time),
flag it explicitly rather than faking it — that becomes a real follow-up
task, not something to fabricate to match the mockup.

---

## 6. New findings from the second review pass (Aug 2026) — verified

### 7.1 `player-view.tsx` — mock player roster presented as real
Lines 76–80 hardcode 5 real, named players (Mbappé, Haaland, Vinícius Jr,
De Bruyne, Bellingham) with invented stats under a `// ── Mock Data ──`
comment. Lines 100, 114–119 generate ratings and radar attributes
(Pace/Shooting/Passing/Defending/Physical/Dribbling) with `Math.random()` —
these render in the same radar-chart UI a real player's real stats would.

**Fix:** Pull from the real `Player`/`Prediction` data already in the
schema and API. If a specific attribute genuinely has no real data source
yet (e.g. FIFA-style radar attributes were never a real metric this app
computes), don't invent one — omit that chart/section for players without
real data, rather than filling it with random numbers under a real player's
name.

### 7.2 `tactical-view.tsx` — hardcoded fake shot map, when a real one already exists elsewhere
Lines 87–94 hardcode shot coordinates and xG values under real player names
(Haaland, De Bruyne, Vinícius Jr, Bellingham, Mbappé, Rodri, Salah, Modrić) —
fabricated data attributed to real people.

**This is not a "we don't have the data" situation — it's a wiring gap.**
`src/lib/statsbomb.ts` already has a complete, real shot-data pipeline:
`extractShots()`, `aggregateTeamXG()`, and — notably —
`normalizeShotForMap()`, a function that appears to exist specifically to
prepare real shot coordinates for exactly this kind of pitch visualization.
None of it is imported by `tactical-view.tsx`. StatsBomb's open data covers
completed major tournaments (World Cup, Euros, Champions League, etc.), not
live/current-season matches — so real shot maps are possible for
StatsBomb-covered matches now, and should show an honest "not available for
this match" state otherwise. Do not hardcode fallback coordinates under real
players' names in either case.

### 7.3 Confirmed: `MatchEvent` has no spatial fields
```
model MatchEvent {
  minute, type, team, playerId, playerName, description
}
```
No x/y coordinates. This model cannot produce real heatmaps on its own.
Real spatial data must come from `statsbomb.ts` (historical, tournament
matches only) — there is currently no live-match spatial data source. Be
explicit about this distinction in any empty/unavailable state you show:
"not available for this match" (could exist elsewhere) reads differently
than a system with no spatial capability at all, which isn't true here.

### 7.4 Scope correction from the first pass
Earlier guidance said to convert views into conventional Next.js routes
where "genuinely necessary." Restate more strongly: **do not** restructure
the single-shell `page.tsx` → Zustand `currentView` → `switch` architecture
into per-route pages as part of this pass. Map each new reference screen
to its corresponding existing view in `src/components/elastico/` and work
within that structure. Routing changes are a separate, deliberate decision
— not a side effect of a visual or data-honesty pass.

## 7. Definition of done

Same verification commands as the previous handoff — run these, don't just
claim things work:
```
npm ci
npx prisma generate
npx tsc --noEmit
npx eslint src/
npm run build
```
Plus, specific to this pass: for every fabricated-data instance you touch
(§2), the fix must be verifiable by reading the code — a real function
call to a real engine/data source, or an honest empty state. Log each one
in `worklog.md` with the file, line, what was fake, and what it now does.
