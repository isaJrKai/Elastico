# Phase 6 — Product Truth & Foundation Audit

**Project:** ELASTICO Football Prediction Platform  
**Phase:** 6A — Forensic Revalidation (View-by-View Sequential Audit)  
**Date:** 2026-08-19  
**Method:** Sequential — one view fully audited and confirmed before proceeding to the next  
**Scope:** All visible data points, UI labels, loading/empty/error states, AI attribution, visualization integrity

---

## Data Quality State Definitions

| State | Definition | Disclosure Required |
|-------|-----------|-------------------|
| REAL | Data from a verified external source or honestly computed from real inputs | Source attribution preferred |
| PROXY | Approximation of real data — plausible but not directly sourced | Must label as estimate/approximation |
| DERIVED | Real data transformed by a legitimate, disclosed computation | Method must be documented |
| MISSING | Data that should exist but doesn't — no value shown | Must show honest empty state |
| STALE | Data that was once real but has expired its freshness window | Must show timestamp and age warning |
| UNAVAILABLE | Data that cannot be obtained — honestly disclosed to user | Must explain why unavailable |
| DEMO | Fictional data clearly labeled as sample/demo content | Must have visible DEMO badge/label |
| FABRICATED | **[8th state — added this audit]** Synthetic data presented as real without disclosure. Semantically distinct from DEMO: DEMO implies the user knows it's fictional; FABRICATED means the user is led to believe it's real. This state exists because the Phase 6 data-quality contract's original 7-state schema had no category for "undisclosed fake data masquerading as real" — which is the core trust violation this audit was designed to find. | Must be eliminated or reclassified to DEMO with disclosure |

**Propagation rule:** FABRICATED propagates upward through all transformations. If *any* input to a DERIVED or PROXY computation is FABRICATED, the output inherits FABRICATED state — regardless of whether the computation itself is legitimate. Rationale: a real method applied to fake inputs produces fake outputs (garbage in, garbage out). The "highest violation" state always wins. This rule applies retroactively to all 9 views in this audit.

---

## Audit Status

| # | View | Status | Fabrications Found | Date |
|---|------|--------|-------------------|------|
| 1 | Dashboard | **COMPLETE** | 11 | 2026-08-19 |
| 2 | Live Matches | **COMPLETE** | 6 | 2026-08-20 |
| 3 | Predictions | **COMPLETE** | 20 | 2026-08-20 |
| 4 | Tactical | **COMPLETE** | 6 | 2026-08-20 |
| 5 | Player | **COMPLETE** | 0 | 2026-08-20 |
| 6 | Compare | **COMPLETE** | 13 | 2026-08-20 |
| 7 | AI Analyst | **COMPLETE** | 4 | 2026-08-20 |
| 8 | News | **COMPLETE** | 3 | 2026-08-20 |
| 9 | Settings | **COMPLETE** | 0 | 2026-08-20 |

---

## View 1: Dashboard

**Component:** `src/components/elastico/dashboard-view.tsx` (709 lines)  
**Route:** Virtual view managed by Zustand store (`currentView: 'dashboard'`), rendered via `src/app/page.tsx` line ~60 switch statement  
**Architecture:** Single monolithic component. No sub-components, no dashboard-specific hooks, no dashboard-specific data files. All 15 widget sections are inlined.

### File Inventory (files that feed Dashboard data)

| File | Lines | Role | Contains Fabrication? |
|------|-------|------|---------------------|
| `src/components/elastico/dashboard-view.tsx` | 709 | Main dashboard — all 15 widgets | **YES** (4 instances) |
| `src/store/use-elastico-store.ts` | 447 | Zustand store — types, state, fetch actions | No |
| `src/app/api/live/route.ts` | 126 | ESPN live scores → `liveMatches` | No |
| `src/app/api/matches/route.ts` | 79 | DB matches → `matches` | No (but serves seed data) |
| `src/app/api/teams/route.ts` | 44 | DB teams → `teams` | No (but serves seed data) |
| `src/app/api/news/route.ts` | 148 | ESPN → Newsdata.io → DB fallback → `news` | No (but DB fallback serves seed news) |
| `src/app/api/predictions/route.ts` | 108 | Quick Predict POST target | No (receives fabricated confidence) |
| `src/app/api/auth/me/route.ts` | 18 | User session → `user` | No |
| `src/lib/football-data.ts` | 535 | ESPN API client | No |
| `src/lib/newsdata.ts` | 122 | Newsdata.io client | No |
| `prisma/seed.ts` | 202 | Initial DB population | **YES** (hand-crafted data) |
| `prisma/schema.prisma` | 337 | DB schema | No |

---

### Widget-by-Widget Audit

#### Widget 1: Live Score Ticker (lines 156–198)

**Data source:** `liveMatches` (ESPN) with `matches` (DB) fallback (line 78–103)  
**Data chain:** `GET /api/live` → ESPN public API → `football-data.ts` → store `liveMatches`

| Data Point | State | Evidence |
|-----------|-------|----------|
| Match scores (home/away) | REAL | ESPN public API, `src/lib/football-data.ts` lines 1–535. Badge on card says "ESPN Live" (line 221) |
| Match status (live/finished) | REAL | ESPN API `status` field |
| Team abbreviations | REAL | ESPN API `abbreviation` field (line 83) |
| Team colors | PROXY | ESPN API `color` field or `#555` fallback (line 85). Colors are approximate representations |

**States implemented:** SUCCESS (normal render), EMPTY (ticker renders empty if no data — no explicit empty message, just blank)  
**States missing:** LOADING (no skeleton/spinner), ERROR (no error display)  
**AI attribution:** N/A  

---

#### Widget 2: Live Scores — All Leagues (lines 209–257)

**Data source:** `liveMatches` filtered to all (line 227)  
**Data chain:** Same as Widget 1 — ESPN

| Data Point | State | Evidence |
|-----------|-------|----------|
| Match list (home/away names, scores, status, minute) | REAL | ESPN API. Card badge says "ESPN Live" (line 221) |
| Competition names | REAL | ESPN API `competition` field (line 230) |
| Match minute (live) | REAL | ESPN API `minute` field (line 242) |

**Conditional rendering:** `{liveMatches && liveMatches.length > 0 && (...)}` (line 209) — entire card hidden if no live data. No explicit empty state message.

**States implemented:** SUCCESS (normal render), EMPTY (card hidden entirely — **silent empty**, no user-facing message)  
**States missing:** LOADING, ERROR  
**AI attribution:** N/A

---

#### Widget 3: Next Match Prediction (lines 260–357)

**Data source:** `nextMatch` (first upcoming match from DB, line 59) + user click → `POST /api/predictions`  
**Data chain:** `matches` store → `GET /api/matches` → Prisma DB → seeded via `prisma/seed.ts`

| Data Point | State | Evidence |
|-----------|-------|----------|
| Match identity (home/away team names, venue) | REAL | DB `Match` record. `homeTeam?.name` (line 278), `venue` (line 284) |
| `homeEloBefore` / `awayEloBefore` (line 279, 289) | **FABRICATED** | Shown as "ELO {value}" with no disclosure. Values originate from hand-crafted seed data (`prisma/seed.ts` lines 8–23, e.g. Argentina=1910, Brazil=1840). No ELO update mechanism exists in the codebase after seeding. Presented as current, authoritative ELO ratings. |
| `nextMatchProbs.home/draw/away` (lines 296–318) | **FABRICATED** | When `hasPrediction` is true, shows probability bars from DB. These were computed in `seed.ts` line 141–143: `homeWinProb` from a real ELO formula but with fabricated input ELO, and `drawProb = 0.26` **hardcoded for every match** regardless of teams. The bar visualization implies model confidence that was never demonstrated by any actual model. |
| Empty state message (lines 321–325) | REAL | Honestly states: "No model prediction yet for this match — check back closer to kickoff." This is a correctly handled UNAVAILABLE state. |
| `confidence: 75` in `handleQuickPredict` (line 142) | **FABRICATED** | Every Quick Predict submission sends `confidence: 75` to `POST /api/predictions` regardless of match, user, or any analysis. This is a hardcoded constant masquerading as a user-assessed or model-derived confidence value. |

**Section 8 violation:** The probability bars (lines 300–318) show `nextMatchProbs.home/draw/away` as definitive model output. When these values come from seed data where `drawProb = 0.26` is hardcoded for all matches, the visualization implies a level of model precision that doesn't exist. This directly violates the rule about never implying model confidence that wasn't demonstrated.

**States implemented:** SUCCESS (with probabilities), UNAVAILABLE (honest empty state at lines 321–325)  
**States missing:** LOADING, ERROR  
**AI attribution:** N/A

---

#### Widget 4: Prediction Accuracy Ring (lines 463–505)

**Data source:** `user` object from Zustand store → `GET /api/auth/me` → Prisma DB  

| Data Point | State | Evidence |
|-----------|-------|----------|
| `user.predictionAccuracy` (line 61, rendered line 490) | REAL | DB `User.predictionAccuracy`, computed from actual prediction results |
| `user.totalPredictions` (line 496) | REAL | DB `User.totalPredictions` |
| `user.correctPredictions` (line 500) | REAL | DB `User.correctPredictions` |

**Observation:** When `totalPredictions` is 0, the ring shows "0% Accuracy" with "Total: 0" beneath it. This is technically honest but potentially misleading — a new user might interpret "0%" as "the system is inaccurate" rather than "you haven't made predictions yet." A better empty state would distinguish "no data yet" from "0% accuracy with N predictions."

**States implemented:** SUCCESS  
**States missing:** LOADING, EMPTY (0 predictions looks like a success state with 0%), ERROR  
**AI attribution:** N/A

---

#### Widget 5: Asian Handicap Lines (lines 507–531)

**Data source:** `liveMatches` filtered to upcoming/live (line 517)  

| Data Point | State | Evidence |
|-----------|-------|----------|
| Match list (competition, home/away names) | REAL | ESPN API data |
| "Over 2.5" badge + 55% bar (lines 522–526) | **FABRICATED** | Every match shows exactly `width: '55%'` and `55%` text (line 524, 526). This is a hardcoded CSS inline style and static text, not computed from any model. The value never varies regardless of match, teams, or context. |
| Card subtitle: "From ELO + Poisson + Dixon-Coles + Stochastic models" (line 514) | **FABRICATED CLAIM** | None of these four models are invoked for this card. The 55% is a hardcoded constant. The subtitle fabricates model authority to make the number appear credible. |

**Section 8 violation:** The subtitle claims output from four named models. The 55% is hardcoded for every match. This is a direct violation of the rule about never implying model confidence that wasn't demonstrated. The card labels itself as model-derived quantitative analysis when it is a static constant.

**States implemented:** SUCCESS (renders matches), EMPTY (`.map()` on empty array renders nothing — **silent empty**)  
**States missing:** LOADING, ERROR, explicit EMPTY  
**AI attribution:** N/A (but claims model authority)

---

#### Widget 6: Model Probabilities (lines 533–566)

**Data source:** `liveMatches` filtered to upcoming (line 543), with runtime `hashCode()` computation  

| Data Point | State | Evidence |
|-----------|-------|----------|
| Card title: "Model Probabilities" (line 538) | **FABRICATED CLAIM** | No model is involved. Probabilities are generated by a deterministic string hash (see below). |
| Card subtitle: "Ensemble: ELO + Poisson + Dixon-Coles + Stochastic" (line 540) | **FABRICATED CLAIM** | Same claim as Widget 5. None of these four models are called. The subtitle is copy-pasted to create false authority. |
| `hP = 40 + Math.abs(hashCode(m.homeTeam?.name || '')) % 30` (line 544) | **FABRICATED** | `hashCode()` (lines 30–37) is a simple deterministic string hash function (Java-style `hash = ((hash << 5) - hash) + charCode`). It produces consistent but entirely meaningless numbers — there is no statistical or machine learning relationship between a team name's character codes and their win probability. The formula guarantees home probability between 40–69%, draw 15–29%, and away the remainder. These ranges look plausible but are not derived from any model. |
| `dP = 15 + Math.abs(hashCode(m.awayTeam?.name || '')) % 15` (line 545) | **FABRICATED** | Same `hashCode()` fabrication. Note: draw probability is derived from the *away* team's name hash, not the home team's — an arbitrary and meaningless choice. |
| `aP = 100 - hP - dP` (line 546) | **FABRICATED** | Residual calculation. Ensures probabilities sum to 100% but the component values are fabricated. |
| Match list (home/away names from ESPN) | REAL | ESPN API data |

**Section 8 violation:** This is the most severe fabrication on the dashboard. The card explicitly claims "Model Probabilities" and names four specific models in the subtitle, but the values are generated by hashing team name strings. This is `hashCode()` pretending to be an ensemble model. A user who sees "Ensemble: ELO + Poisson + Dixon-Coles + Stochastic" would reasonably believe these probabilities come from running those models. They do not.

**States implemented:** SUCCESS (renders 3 matches), EMPTY (`.map()` on empty array — **silent empty**)  
**States missing:** LOADING, ERROR, explicit EMPTY  
**AI attribution:** Claims model authority (4 named models). None are real.

---

#### Widget 7: ELO Rankings (lines 568–588)

**Data source:** `teams` store → `GET /api/teams` → Prisma DB → seeded via `prisma/seed.ts`

| Data Point | State | Evidence |
|-----------|-------|----------|
| Team ELO values (line 584: `Math.round(t.eloRating)`) | **FABRICATED** | Values originate from hand-crafted seed data (`prisma/seed.ts` lines 8–23). E.g. Argentina=1910, Brazil=1840, Spain=1890. No ELO recalculation mechanism exists in the codebase. These are static seed values presented as current rankings. |
| Team names | REAL | Factual team identities |
| Team colors | PROXY | Seed `primaryColor` values — approximate visual representations |
| ELO sort order (line 577) | **FABRICATED** | Reclassified from DERIVED under propagation rule: the sort is a legitimate computation, but its input (seed ELO values) is FABRICATED, so the sorted order is also FABRICATED. A correct ranking of incorrect values is still incorrect. |

**Duplication note:** This card is a **duplicate of Widget 10 (Team Rankings ELO)**. Both display teams sorted by ELO rating from the same `teams` array. Widget 10 (left column) shows 8 teams with W/D/L columns; Widget 7 (right column) shows 5 teams with name + ELO only. The same data appears twice in the same view, violating the dashboard hierarchy principle — the user sees two "ELO ranking" cards and may assume they represent different data.

**States implemented:** SUCCESS  
**States missing:** LOADING, EMPTY, ERROR  
**AI attribution:** N/A

---

#### Widget 8: Latest Results (lines 359–383)

**Data source:** `liveMatches` filtered to `status === 'finished'` (line 369)  

| Data Point | State | Evidence |
|-----------|-------|----------|
| Finished match results (scores, team names, competition) | REAL | ESPN API data. FT badge (line 372) correctly marks finished status. |

**States implemented:** SUCCESS, EMPTY (`.map()` on empty filtered array — **silent empty**)  
**States missing:** LOADING, ERROR, explicit EMPTY  
**AI attribution:** N/A

---

#### Widget 9: xG vs Actual Goals (lines 385–414)

**Data source:** `finishedMatches` filtered to matches where `homeXg > 0 || awayXg > 0` (line 112)  

| Data Point | State | Evidence |
|-----------|-------|----------|
| `homeXg` + `awayXg` values (line 116) | REAL | DB `Match.homeXg/awayXg`. Only shown when > 0 (line 112 filter). Comment at lines 105–109 explicitly states: "We intentionally do NOT fabricate xG from final score — a previous version multiplied goals by a constant and labeled it xG, which is misleading." This is the correct approach. |
| Actual goals (line 117) | REAL | DB `Match.homeScore + awayScore` |
| Empty state message (lines 406–411) | REAL | Honestly states: "xG data unavailable for recent matches. This chart only shows real expected-goals data — it never estimates xG from the final score." |

**Positive finding:** This widget is the best-implemented data honesty example on the dashboard. It refuses to fabricate, explicitly documents why in code comments, and shows a clear empty state with explanation.

**States implemented:** SUCCESS (with chart), UNAVAILABLE (honest message at lines 406–411)  
**States missing:** LOADING, ERROR  
**AI attribution:** N/A

---

#### Widget 10: Team Rankings (ELO) (lines 416–457)

**Data source:** `teams` store → `GET /api/teams` → Prisma DB → seeded via `prisma/seed.ts`

| Data Point | State | Evidence |
|-----------|-------|----------|
| Team ELO values (line 450: `Math.round(t.eloRating)`) | **FABRICATED** | Same hand-crafted seed values as Widget 7. E.g. Argentina=1910 from `seed.ts` line 11. |
| Team W/D/L (lines 447–449) | REAL | DB `Team.wins/draws/losses`. Initialized to 0 in seed (line 125–126), updated by real match results. |
| Team names | REAL | Factual team identities |
| Team colors | PROXY | Seed `primaryColor` — approximate visual representation |
| ELO sort order (line 438) | **FABRICATED** | Reclassified from DERIVED under propagation rule: sort is legitimate but input ELO values are FABRICATED, so the sorted ranking order is also FABRICATED. |

**Duplication note:** This is a **duplicate of Widget 7 (ELO Rankings)**. See Widget 7 duplication note above. Two cards in the same view show the same ELO-sorted team list from the same data source. **Specific cards duplicated:** "Team Rankings (ELO)" (left column, lines 416–457, shows 8 teams with W/D/L) and "ELO Rankings" (right column, lines 568–588, shows 5 teams name+ELO only).

**States implemented:** SUCCESS  
**States missing:** LOADING, EMPTY, ERROR  
**AI attribution:** N/A

---

#### Widget 11: All Matches (lines 590–614)

**Data source:** `liveMatches` unfiltered (line 599)  

| Data Point | State | Evidence |
|-----------|-------|----------|
| Match list (competition, date, teams, scores, status, venue) | REAL | ESPN API data |

**States implemented:** SUCCESS, EMPTY (`.map()` on empty array — **silent empty**)  
**States missing:** LOADING, ERROR, explicit EMPTY  
**AI attribution:** N/A

---

#### Widget 12: Trending News (lines 616–637)

**Data source:** `news` store → `GET /api/news?limit=30` → ESPN → Newsdata.io → DB fallback  

| Data Point | State | Evidence |
|-----------|-------|----------|
| News titles, categories, dates (when from ESPN) | REAL | ESPN API, `src/app/api/news/route.ts` lines 56–83 |
| News titles, categories, dates (when from Newsdata.io) | REAL | Newsdata.io API, `src/app/api/news/route.ts` lines 85–107 |
| News titles, categories, dates (when from DB fallback) | **FABRICATED** | 5 hand-crafted articles in `prisma/seed.ts` lines 45–51. Titles like "Argentina confirmed as World Cup 2026 top seeds" with `source: 'FIFA.com'` — the source attribution may not correspond to a real article at that URL. The `category: 'match'` / `'transfer'` / `'tactical'` / `'injury'` labels add taxonomy credibility. These are presented identically to real ESPN/Newsdata articles with no DEMO badge. |
| Category badges (line 627) | **FABRICATED** | Hand-assigned labels for seed news articles (`prisma/seed.ts` lines 46–50). Reclassified from PROXY by propagation rule: the articles they label are FABRICATED (DASH-035), so the category labels inherit FABRICATED. A real taxonomy label on a fake article is still fake. |

**States implemented:** SUCCESS (renders up to 5 items), EMPTY (returns `[]` if no source has data — **silent empty**)  
**States missing:** LOADING, ERROR, explicit EMPTY  
**AI attribution:** N/A

---

#### Widget 13: Streak Counter (lines 639–654)

**Data source:** `user` object from store → `GET /api/auth/me` → Prisma DB  

| Data Point | State | Evidence |
|-----------|-------|----------|
| `user.predictionStreak` (line 646) | REAL | DB `User.predictionStreak` |
| `user.bestStreak` (line 650) | REAL | DB `User.bestStreak` |

**States implemented:** SUCCESS  
**States missing:** LOADING, EMPTY, ERROR  
**AI attribution:** N/A

---

#### Widget 14: Quick Actions (lines 656–682)

**Data source:** None — navigation buttons only  

| Data Point | State | Evidence |
|-----------|-------|----------|
| Navigation targets (Matches, AI Chat, Predict) | REAL | These are legitimate routes in the sidebar/store |

**States implemented:** N/A (static buttons)  
**States missing:** N/A  
**AI attribution:** N/A

---

#### Widget 15: Personalized Insight / "AI Insight" (lines 684–703)

**Data source:** None — static conditional strings  

| Data Point | State | Evidence |
|-----------|-------|----------|
| Card title: "AI Insight" (line 692) | **FABRICATED CLAIM** | The `Sparkles` icon (line 689) and "AI" label imply AI-generated personalized analysis. No AI is involved. |
| Insight text (lines 694–698) | **FABRICATED** | Three static strings selected by a simple ternary on `accuracy` threshold (>70, >50, else). No AI model, no personalization beyond the accuracy bucket, no analysis of the user's actual predictions. The text is identical for all users in the same accuracy bucket. |
| "Favorites with a 150+ ELO advantage win 72% of the time" (line 698) | **FABRICATED STATISTIC** | This specific claim ("72% of the time") is presented as authoritative data. No source is cited. No evidence in the codebase supports this number. If it came from the Phase 5 calibration data, that data showed raw market odds (LL 0.959) outperforming all ELASTICO models — not a simple ELO-threshold rule. This statistic appears invented for the insight text. |

**AI attribution violation:** This widget commits the most explicit AI trust violation on the dashboard. It uses the `Sparkles` icon (universally associated with AI features) and the label "AI Insight" for content that is entirely deterministic (three static strings behind a ternary). There is no AI provider call, no LLM invocation, no model inference. The user is told "AI Insight" when no AI is involved.

**States implemented:** SUCCESS (always renders one of three strings)  
**States missing:** LOADING, EMPTY, ERROR  
**AI attribution:** **VIOLATION** — Claims AI involvement. None exists.

---

### Dashboard Summary Statistics

**Granularity:** This table counts 34 analytical data points (a widget with 3 fabrication aspects = 1 data point with 3 aspects noted). The JSON matrix (`phase6_product_truth_matrix.json`) breaks each aspect into its own entry, yielding 44 granular entries (REAL=20, PROXY=1, DERIVED=2, FABRICATED=19, UNAVAILABLE=2). Both counts are valid; they differ in granularity. The JSON `state_counts` block reflects the 44-entry granularity.

| State | Count | Data Points |
|-------|-------|-------------|
| REAL | 15 | ESPN scores/status/competition, DB user stats (accuracy/total/correct/streak/bestStreak), DB xG values, honest empty states, navigation targets |
| PROXY | 1 | ESPN team colors (DASH-003). Note: 4 items previously listed here were reclassified — 3 were already counted under FABRICATED (seed match probabilities via DASH-008, seed news source attributions via DASH-035) and 1 was reclassified to FABRICATED by propagation rule (seed news categories, DASH-036: a real label on a fake article is still fake). |
| DERIVED | 2 | xG chart filtering (real xG > 0), accuracy ring SVG calculation |
| FABRICATED | 11 | (1) hashCode "Model Probabilities" widget 6, (2) hashCode card title/subtitle claiming ensemble, (3) Asian Handicap 55% hardcoded widget 5, (4) Asian Handicap subtitle claiming model output, (5) Quick Predict confidence: 75, (6) "AI Insight" label + static strings widget 15, (7) "72% of the time" fabricated statistic widget 15, (8) Seed team ELO values presented as current widgets 7+10, (9) ELO Rankings sort order widget 7 [reclassified from DERIVED per propagation rule], (10) Team Rankings ELO sort order widget 10 [reclassified from DERIVED per propagation rule], (11) Seed news category badges [reclassified from PROXY per propagation rule — labels on fabricated articles] |
| MISSING | 0 | — |
| STALE | 0 | — |
| UNAVAILABLE | 2 | xG honest empty message, Next Match "No model prediction" message |
| DEMO | 0 | — |
| **TOTAL** | **34** | |

---

### 4-State Compliance (LOADING / SUCCESS / EMPTY / ERROR)

| Widget | LOADING | SUCCESS | EMPTY | ERROR | Notes |
|--------|---------|---------|-------|-------|-------|
| 1. Ticker | Missing | Yes | Silent | Missing | No skeleton, no error boundary |
| 2. Live Scores | Missing | Yes | Silent (card hidden) | Missing | Conditional render hides entire card |
| 3. Next Match | Missing | Yes | Yes (honest) | Missing | Best empty state on dashboard |
| 4. Accuracy Ring | Missing | Yes | Missing (0% looks like data) | Missing | 0 predictions shows "0%" without explanation |
| 5. Asian Handicap | Missing | Yes | Silent | Missing | No loading, no error, no empty message |
| 6. Model Probabilities | Missing | Yes | Silent | Missing | Same issues as Widget 5 |
| 7. ELO Rankings | Missing | Yes | Missing | Missing | — |
| 8. Latest Results | Missing | Yes | Silent | Missing | — |
| 9. xG Chart | Missing | Yes | Yes (honest) | Missing | Best empty state on dashboard |
| 10. Team Rankings | Missing | Yes | Missing | Missing | — |
| 11. All Matches | Missing | Yes | Silent | Missing | — |
| 12. News | Missing | Yes | Silent | Missing | — |
| 13. Streak Counter | Missing | Yes | Missing | Missing | — |
| 14. Quick Actions | N/A | N/A | N/A | N/A | Static buttons |
| 15. AI Insight | Missing | Yes | Missing | Missing | Always renders one of 3 strings |

**Summary:** 0/15 widgets have all 4 states. 2/15 have an explicit EMPTY state (Widgets 3, 9). 13/15 have silent empty behavior (card hidden or blank). 0/15 have LOADING skeletons. 0/15 have ERROR states. The `isLoading` and `loadingMessage` fields exist in the Zustand store (lines 189–190) but are **not consumed** by `dashboard-view.tsx`.

---

### Duplication Issues

| Duplication | Cards | Problem |
|-------------|-------|---------|
| **ELO Rankings shown twice** | Widget 7 "ELO Rankings" (right col, lines 568–588) + Widget 10 "Team Rankings (ELO)" (left col, lines 416–457) | Same `teams` array, same ELO sort, same data source. Widget 10 shows 8 teams with W/D/L; Widget 7 shows 5 teams name+ELO. User sees two "ranking" cards and may assume different data. |
| **Probability bars shown twice** | Widget 3 "Next Match Prediction" (lines 296–318) + Widget 6 "Model Probabilities" (lines 543–564) | Both show H/D/A stacked horizontal bars. Different data sources (DB vs hashCode) but visually similar. If the same match appeared in both, the user would see two conflicting probability values. |

---

### AI Attribution Audit

| Widget | Claims AI/Model? | Actually Uses AI/Model? | Violation? |
|--------|-----------------|----------------------|----------|
| Widget 5 (Asian Handicap) | Yes — subtitle names 4 models | No — hardcoded 55% | **YES** |
| Widget 6 (Model Probabilities) | Yes — title + subtitle name 4 models | No — `hashCode()` | **YES** (most severe) |
| Widget 15 (AI Insight) | Yes — "AI" label + Sparkles icon | No — static ternary strings | **YES** |
| Widget 3 (Next Match) | Implicit — shows probability bars from DB | Partial — DB probs from seed ELO formula + hardcoded 0.26 draw | **Partial** — no model claim in UI, but bars imply model output |

---

### Section 8 Compliance (Model Confidence)

**Rule:** Never imply model confidence that wasn't demonstrated.

| Violation | Location | Detail |
|-----------|----------|--------|
| Asian Handicap 55% | `dashboard-view.tsx:524` | `style={{ width: '55%' }}` — hardcoded for every match. Card subtitle claims 4-model output. No model ran. |
| Model Probabilities hashCode | `dashboard-view.tsx:544-546` | `hashCode()` produces deterministic but meaningless numbers. Card claims "Ensemble" output. |
| Seed drawProb = 0.26 | `prisma/seed.ts:142` | Hardcoded for all 10 seeded matches. Shown in Widget 3 probability bars when `hasPrediction` is true. |
| "72% of the time" | `dashboard-view.tsx:698` | Fabricated statistic in AI Insight. No source, no evidence in codebase. |
| Quick Predict confidence: 75 | `dashboard-view.tsx:142` | Hardcoded constant sent as if it were a meaningful confidence value. |

---

### Positive Findings (What's Done Right)

1. **xG Chart honesty** (Widget 9, lines 105–109, 406–411): The code comment explicitly rejects fabricating xG from scores. The empty state is clear and honest. This is the gold standard for how every widget should handle missing data.
2. **Next Match empty state** (Widget 3, lines 321–325): "No model prediction yet for this match — check back closer to kickoff" is a perfect UNAVAILABLE state.
3. **ESPN data pipeline** (Widgets 1, 2, 8, 11): Live scores from ESPN are real and correctly attributed ("ESPN Live" badge). The API client in `football-data.ts` is well-structured.
4. **News priority chain** (Widget 12, `api/news/route.ts`): ESPN → Newsdata.io → DB fallback is a reasonable cascade. When external sources work, data is real.
5. **No mock data file imports**: The dashboard doesn't import from any dedicated mock/fake data file. Fabrications are inline, making them easier to spot and fix.

---

### Recommendations (for Phase 6B+ — not executed now)

These are recorded for the restoration phase. No code changes in this audit phase.

1. **Eliminate Widget 6 entirely** or replace with real model output. The `hashCode()` fabrication pretending to be an ensemble is the single worst trust violation on the dashboard.
2. **Eliminate Widget 5** or replace with real model output. The hardcoded 55% with false model claims is the second worst.
3. **Remove or re-label Widget 15.** Either connect to a real AI provider or rename to "Tips" without the Sparkles icon.
4. **Remove fabricated model claims** from card subtitles ("Ensemble: ELO + Poisson + Dixon-Coles + Stochastic").
5. **Resolve ELO duplication** — keep one ranking card, remove the other, or differentiate them (e.g. one for DB teams, one for ESPN live league tables).
6. **Add LOADING skeletons** for at minimum the 4 most visible widgets (Ticker, Live Scores, xG Chart, Team Rankings).
7. **Add ERROR states** — at minimum a generic "Failed to load data. Tap to retry." for API-fed widgets.
8. **Fix seed ELO values** — either add a real ELO update mechanism or label the rankings as "Seed ELO (not yet updated)".
9. **Fix seed news** — add a `isSeed: true` flag and show a DEMO badge on seed-sourced news articles.
10. **Fix seed match probabilities** — remove the hardcoded `drawProb = 0.26` or mark matches with seed-derived probabilities as estimates.

---

## Backend & Prediction Engine Audit

**Scope:** FastAPI backend at `/home/z/my-project/football-prediction-mega/` (18,176 lines Python across 38 files). Covers API endpoints, prediction engines, ML models, training pipeline, and data services.

**Files audited:** All `.py` files in `config/`, `src/`, `scripts/`, `tests/`. All JSON files in `saved_models/`. All data files in `data/`.

---

### B1. xG Features Are Fabricated (CRITICAL)

The XGBoost model (`xgboost_v1.json`, 1.5 MB) includes 3 xG features in its 50-feature schema: `xg_for_home`, `xg_for_away`, `xg_diff`. The model's own metadata (`saved_models/xgboost_v1_metadata.json`, line 335) states:

> `"xg_note": "PROXY: shots_on_target x 0.1. Not real expected goals. football-data.co.uk does not provide xG."`

The fabrication occurs in `scripts/phase2_data_foundation.py`:

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| `xg_for_home` = mean(recent_SOT) × 0.1 | **FABRICATED** | `scripts/phase2_data_foundation.py` | 363 | Comment on line 360: `# xG proxy: recent SOT * 0.1`. No xG source exists in football-data.co.uk CSVs. The multiplier 0.1 is not calibrated. |
| `xg_for_away` = mean(recent_SOT) × 0.1 | **FABRICATED** | `scripts/phase2_data_foundation.py` | 381 | Same fabrication method as home. |
| `xg_diff` = xg_for_home − xg_for_away | **FABRICATED** | `scripts/phase2_data_foundation.py` | 392 | Propagation rule: derived from fabricated inputs. |
| `xg_note` in model metadata | REAL | `saved_models/xgboost_v1_metadata.json` | 335 | Honestly discloses the proxy. But the frontend (Dashboard Widget 9) does not surface this disclosure. |
| Feature schema labels `xg_for_home` as "Home team expected goals (xG) per match" | **FABRICATED CLAIM** | `src/ml/features.py` | 88 | Schema describes it as real xG. It is not. |

**Propagation impact:** The trained XGBoost model was trained with fabricated xG features. Any inference using this model produces predictions influenced by fake xG. The model's feature importance (`xgboost_v1_metadata.json` lines 286–288) shows xG features have importance ~2.5 — roughly average among the 50 features, so they do influence predictions.

---

### B2. LSTM Model Self-Rated as FAILED — Still in Ensemble

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| LSTM model classification | REAL | `saved_models/lstm_v1_metadata.json` | 274 | `"classification": "D. FAILED"` |
| LSTM recommendation | REAL | `saved_models/lstm_v1_metadata.json` | 284 | `"Do NOT include LSTM in the final ensemble."` |
| LSTM test accuracy | REAL | `saved_models/lstm_v1_metadata.json` | 269 | ECE: 0.30 (vs XGB 0.048). Log-loss: 3.48 (vs XGB 0.995). |
| LSTM ensemble weight (default) | **FABRICATED** | `config/settings.py` | 40 | `ensemble_weight_lstm: float = 0.15` — despite explicit recommendation to exclude |
| LSTM ensemble weight (EnsembleConfig) | **FABRICATED** | `src/engines/ensemble.py` | 60 | `"lstm": 0.15` — duplicates settings.py default |

The LSTM model has 15% weight in the default ensemble. Its own metadata says it should not be included. The ensemble silently degrades predictions by mixing in a failed model.

---

### B3. Ensemble Weights Are Fabricated

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Ensemble weights (6-model) | **FABRICATED** | `src/engines/ensemble.py` | 54–61 | `elo: 0.15, poisson: 0.15, dixon_coles: 0.15, stochastic: 0.20, xgboost: 0.20, lstm: 0.15`. Not calibrated from validation performance. |
| Ensemble weights (config duplicate) | **FABRICATED** | `config/settings.py` | 35–40 | Same values, duplicated. No calibration source cited. |
| Confidence thresholds (0.55, 0.42) | **FABRICATED** | `src/engines/ensemble.py` | 566–570 | Hardcoded thresholds with no calibration evidence. |
| ELO signal thresholds (150, -150, 80) | **FABRICATED** | `src/engines/ensemble.py` | 602–607 | Hardcoded. |
| xG signal multiplier (1.3) | **FABRICATED** | `src/engines/ensemble.py` | 611–614 | Hardcoded. |
| ELO even match threshold (30) | **FABRICATED** | `src/engines/ensemble.py` | 640 | Hardcoded. |
| Draw risk threshold (0.32) | **FABRICATED** | `src/engines/ensemble.py` | 648 | Hardcoded. |
| Home advantage constant (+65) | **FABRICATED** | `src/engines/ensemble.py` | 707 | `home_elo + 65.0` — hardcoded. Same value in `config/settings.py` line 24. |
| Fallback probabilities (1/3 each) | **FABRICATED** | `src/engines/ensemble.py` | 466 | When prediction fails, returns `1/3, 1/3, 1/3` as if it were a real estimate. No "unavailable" signal. |
| Fallback probabilities (empty weights) | **FABRICATED** | `src/engines/ensemble.py` | 536 | Second fallback path, same 1/3 uniform. |

---

### B4. Stochastic Engine Parameters Are Fabricated

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| GARCH ω (omega) = 0.02 | **FABRICATED** | `src/engines/stochastic.py` | 38 | Default parameter. `calibrate_garch()` exists but is not called in the main prediction path. |
| GARCH α (alpha) = 0.12 | **FABRICATED** | `src/engines/stochastic.py` | 39 | Same — not calibrated in production. |
| GARCH β (beta) = 0.85 | **FABRICATED** | `src/engines/stochastic.py` | 40 | Same. |
| Jump intensity λ = 0.1 | **FABRICATED** | `src/engines/stochastic.py` | 64 | `JumpDiffusionParams.jump_intensity`. |
| Jump mean μ_J = 0.0 | **FABRICATED** | `src/engines/stochastic.py` | 65 | `JumpDiffusionParams.jump_mean`. |
| Jump std σ_J = 0.3 | **FABRICATED** | `src/engines/stochastic.py` | 66 | `JumpDiffusionParams.jump_std`. |
| Home-away correlation = 0.15 | **FABRICATED** | `src/engines/stochastic.py` | 77–78 | Hardcoded. |
| League average goals = 1.3 | **FABRICATED** | `src/engines/stochastic.py` | 286 | Hardcoded. |
| GARCH fallback (var*0.05, 0.10, 0.85, 0.80) | **FABRICATED** | `src/engines/stochastic.py` | 187–191 | Used when calibration fails. |
| Jump fallback (0.05, 0.0, 0.2) | **FABRICATED** | `src/engines/stochastic.py` | 234–238 | Used when <2 jumps found. |
| ELO factor mapping formula | **FABRICATED** | `src/engines/stochastic.py` | 304–305 | `0.8 + 0.4 * ...` — arbitrary mapping. |
| Volatility normalization (/2.0 * 100) | **FABRICATED** | `src/engines/stochastic.py` | 402–403 | Arbitrary scaling. |
| Confidence thresholds (0.55, 0.42) | **FABRICATED** | `src/engines/stochastic.py` | 409–414 | Same as ensemble — duplicated. |

---

### B5. Market Signal Parameters Are Fabricated

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Steam threshold "strong" = 0.12 | **FABRICATED** | `src/engines/market_signals.py` | 59 | Hardcoded. No citation. |
| Steam threshold "moderate" = 0.06 | **FABRICATED** | `src/engines/market_signals.py` | 60 | Hardcoded. |
| Steam threshold "weak" = 0.03 | **FABRICATED** | `src/engines/market_signals.py` | 61 | Hardcoded. |
| RLM odds drift threshold = 0.04 | **FABRICATED** | `src/engines/market_signals.py` | 69 | Hardcoded. |
| Sharp probability shift = 0.05 | **FABRICATED** | `src/engines/market_signals.py` | 72 | Hardcoded. |
| Sharp odds velocity = 0.08 | **FABRICATED** | `src/engines/market_signals.py` | 73 | Hardcoded. |
| Covariance base variance = 0.25 | **FABRICATED** | `src/engines/market_signals.py` | 156 | Hardcoded. |
| Same-match correlation = −0.20 | **FABRICATED** | `src/engines/market_signals.py` | 170 | Hardcoded. |
| Cross-match correlation = 0.02 | **FABRICATED** | `src/engines/market_signals.py` | 178 | Hardcoded. |
| Marginal risk multipliers (1.2, 0.95) | **FABRICATED** | `src/engines/market_signals.py` | 314–315 | Hardcoded. |
| Kelly base variance = 0.25 | **FABRICATED** | `src/engines/kelly.py` | 156 | Hardcoded diagonal of covariance matrix. |

---

### B6. Hardcoded Database Credentials

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| `database_url` with embedded password | **FABRICATED** (security) | `config/settings.py` | 15 | `postgresql://neondb_owner:npg_8zPlbIK5NwaR@ep-late-sunset-...`. Should be in `.env` only. The class has `Config.env_file = ".env"` but the default value in the field definition means it works even without `.env`. |

---

### B7. Placeholder Endpoints Returning Fabricated Data

| Endpoint | File | Line | Returns | State |
|----------|------|------|---------|-------|
| `GET /api/stats/team/{team_id}` | `src/api/routes/stats.py` | 84–88 | Raises `NotImplementedError` | MISSING |
| `GET /api/stats/headtohead` | `src/api/routes/stats.py` | 91–102 | All zeros: `total_matches=0, home_wins=0, draws=0, away_wins=0, avg_home_goals=0.0, avg_away_goals=0.0, recent_results=[]` | **FABRICATED** (zeros presented as a valid response, not as "unavailable") |
| `GET /api/stats/form/{team_id}` | `src/api/routes/stats.py` | 105–113 | All zeros: `last_5=[], goals_scored_per_game=0.0, goals_conceded_per_game=0.0, clean_sheets_pct=0.0, btts_pct=0.0, over_25_pct=0.0` | **FABRICATED** |
| `GET /api/stats/brier` | `src/api/routes/stats.py` | 116–130 | All zeros: `total_predictions=0, brier_score=None, brier_skill_score=None, bins=[]` | **FABRICATED** |
| `GET /api/admin/calibration` | `src/api/routes/admin.py` | 127–148 | All zeros: `total_evaluated=0, brier_score=0.0, log_loss=0.0, accuracy=0.0, reliability_bins=[]` | **FABRICATED** |
| `POST /api/admin/backtest` | `src/api/routes/admin.py` | 151–179 | All zeros: `total_predictions=0, correct=0, accuracy=0.0, brier_score=0.0, log_loss=0.0, roi=None, confidence_breakdown={high/medium/low: all zeros}` | **FABRICATED** |
| `GET /api/admin/models` | `src/api/routes/admin.py` | 182–193 | Static hardcoded list of 5 model names. Does not check `saved_models/` directory. | **FABRICATED** |
| `GET /api/admin/system/health` | `src/api/routes/admin.py` | 196–208 | `"database": "connected"` (line 201, comment: `# Would check actual connection`), `"data_freshness": {"matches": "unknown", "odds": "unknown", "elo_ratings": "initial"}` (lines 203–206) | **FABRICATED** — claims "connected" without checking; claims "initial" for ELO freshness. || `GET /api/admin/system/health` | `src/api/routes/admin.py` | 196–208 | `"database": "connected"` (line 201, comment: `# Would check actual connection`), `"data_freshness": {"matches": "unknown", "odds": "unknown", "elo_ratings": "initial"}` (lines 203–206) | **FABRICATED** — claims "connected" without checking; claims "initial" for ELO freshness. |

---

## Frontend View Audits (Views 2–9)

### V2. Live Matches (matches-view.tsx)

**File:** `src/components/elastico/matches-view.tsx` (505 lines)

#### Widget 1: Match Card — Match Data

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Match list (scores, teams, status, date, competition, venue) | REAL | `matches-view.tsx` | 346–359 | Fetched from `/api/football-data?action=matches&competition=PL&status=...` → football-data.org API |
| Team names | REAL | `matches-view.tsx` | 140, 158 | `match.homeTeam?.name`, `match.awayTeam?.name` from API response |
| Team abbreviations (code) | REAL | `matches-view.tsx` | 137, 160 | `match.homeTeam?.code` from API response |
| Competition badge | REAL | `matches-view.tsx` | 290 | `match.competition` from API response |
| Status badge (LIVE/HT/FT/PPD/Upcoming) | REAL | `matches-view.tsx` | 46–54, 109–117 | Derived from `match.status`, honestly mapped |
| Team colors (primaryColor) | PROXY | `matches-view.tsx` | 137, 160 | `match.homeTeam?.primaryColor || '#555'` — from football-data.org (approximate) |
| xG comparison bars (homeXg, awayXg) | **FABRICATED** | `matches-view.tsx` | 167–176 | football-data.org does not provide xG. When shown, values come from seed data merged into match objects. No real xG source for PL matches from this API. |
| Probability bars (homeWinProb, drawProb, awayWinProb) | **FABRICATED** | `matches-view.tsx` | 179–191 | For seed matches: propagated from fabricated ELO. For football-data.org matches: likely undefined (hidden by conditional on line 179), but if present, source is unverified. |
| Quick Predict confidence | **FABRICATED** | `matches-view.tsx` | 81 | `confidence: 70` — hardcoded for every prediction submission |
| Expanded stats (possession, shots, corners, fouls) | **FABRICATED** | `matches-view.tsx` | 258–282 | football-data.org PL endpoint does not return these stats. If shown as non-zero, source is unknown. If shown as zero, presented as real stats. |
| Attendance "35,421 attendance" | **FABRICATED** | `matches-view.tsx` | 217 | Hardcoded string shown for ALL finished matches regardless of actual attendance |
| ELO diff display | **FABRICATED** | `matches-view.tsx` | 88, 220 | `match.homeEloBefore ?? 0` — football-data.org doesn't provide ELO. Values are 0 or from seed. |
| Weather/temperature | UNAVAILABLE | `matches-view.tsx` | 201–210 | Conditional render (`match.weather &&`). football-data.org doesn't provide weather. Correctly hidden when unavailable. |

#### Widget 2: Group Quick-Buttons

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Group filter buttons (A–H) | **DEAD UI** | `matches-view.tsx` | 41, 437–446 | GROUPS constant lists A–H for tournament football. Data source is Premier League (competition=PL) which has no groups. Buttons never match any data. |

#### Widget 3: Stage Filter

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Stage filter dropdown | **DEAD UI** | `matches-view.tsx` | 41, 406–414 | STAGES constant lists tournament stages (Group Stage, Round of 16, etc.). PL data doesn't use these stages. Dropdown is always empty (availableStages filtered on line 385 finds no matches). |

#### Widget 4: Sort by ELO / xG

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Sort by ELO diff | **BROKEN** | `matches-view.tsx` | 377 | `Math.abs((b.homeEloBefore ?? 0) - (b.awayEloBefore ?? 0))` — football-data.org matches have no ELO, so all sort to 0. Produces meaningless ordering. |
| Sort by xG total | **BROKEN** | `matches-view.tsx` | 378 | `(b.homeXg + b.awayXg)` — football-data.org matches have no xG, so all sort to 0. |

#### Widget 5: Bookmark Button

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Bookmark toggle | **DEAD UI** | `matches-view.tsx` | 122–129 | Local `useState(false)` only. No DB persistence. No API call. Button appears functional but does nothing permanent. |

#### Widget 6: "All" Tab Status Mapping

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| "All" tab fetches only FINISHED | **MISLEADING** | `matches-view.tsx` | 344 | `activeTab === 'all' ? statusParam = 'FINISHED'` — user expects "All" to show all statuses, but it only fetches finished matches. |

**States implemented:** LOADING (MatchCardSkeleton, line 302), SUCCESS, EMPTY (honest message, lines 474–484)
**States missing:** ERROR (console.error only, line 362; no user-facing error state)
**AI attribution:** N/A

### V3. Predictions (predictions-view.tsx)

**File:** `src/components/elastico/predictions-view.tsx` (434 lines)

#### Widget 1: Accuracy Stats Cards

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Accuracy % | REAL | `predictions-view.tsx` | 113, 233 | `user?.predictionAccuracy ?? 0` from Zustand store → `/api/auth/me` → Prisma DB User record |
| Total Predictions count | REAL | `predictions-view.tsx` | 116, 234 | `user?.totalPredictions ?? 0` from Zustand store → Prisma DB |
| Current Streak | REAL | `predictions-view.tsx` | 114, 235 | `user?.predictionStreak ?? 0` from Zustand store → Prisma DB |
| Best Streak | REAL | `predictions-view.tsx` | 115, 236 | `user?.bestStreak ?? 0` from Zustand store → Prisma DB |
| correctPredictions (declared) | MISSING (dead variable) | `predictions-view.tsx` | 117 | Declared as `user?.correctPredictions ?? 0` but never referenced in any JSX. Variable is computed but discarded — no card or label renders it. |

#### Widget 2: Leaderboard Position Card

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Leaderboard rank (#N) | REAL | `predictions-view.tsx` | 85–90, 252 | Fetched from `/api/leaderboard` → DB, then `entries.findIndex(e => e.id === user?.id)` to locate user. Conditionally rendered when `leaderboardPos > 0` (line 248). |
| "of {totalPredictions} predictors" label | **MISLEADING** | `predictions-view.tsx` | 253 | `totalPredictions` is the USER's own prediction count (line 116), NOT the total number of leaderboard entries. Label reads "of X predictors" but X is the user's personal prediction total, not the predictor pool size. |
| Card hidden when unranked | REAL | `predictions-view.tsx` | 248 | `{leaderboardPos > 0 && (...)}` — card correctly hidden when user has no rank. No placeholder or CTA shown. |

#### Widget 3: Quick Predict Panel

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Upcoming match list | REAL (if synced) / **FABRICATED** (if seed) | `predictions-view.tsx` | 64, 98 | `matches` from Zustand store → `/api/matches` → Prisma DB. If admin ran `/api/sync`, matches are real ESPN data. Otherwise, DB contains seed data with fictional matchups. |
| Team names and codes | REAL (if synced) / **FABRICATED** (if seed) | `predictions-view.tsx` | 280, 292 | `m.homeTeam?.name`, `m.awayTeam?.name` from store match objects. Provenance depends on sync state. |
| Team color dots (primaryColor) | REAL (if synced) / **FABRICATED** (if seed) | `predictions-view.tsx` | 279, 293 | `m.homeTeam?.primaryColor ?? '#555'` — from DB team record. Synced teams use ESPN colors; seed teams use fabricated colors. |
| Match list truncated to 4 | MISSING (data truncation) | `predictions-view.tsx` | 274 | `upcomingMatches.slice(0, 4)` — only first 4 upcoming matches shown. No pagination or "show more" control. Additional matches are invisible. |
| Quick Predict confidence | **FABRICATED** | `predictions-view.tsx` | 155 | `confidence: 70` — hardcoded integer for every Quick Predict submission, regardless of match or outcome. |
| Quick Predict xG fallbacks | **FABRICATED** | `predictions-view.tsx` | 151–152 | When `match.homeXg > 0` is false (true for all DB-stored upcoming matches where xG defaults to 0), invents goal counts from user's choice: `(choice === 'home' ? 2 : choice === 'draw' ? 1 : 0)`. Goals are derived from the prediction itself, not from any model — circular. |
| Quick Predict xG source (when >0) | **FABRICATED** (propagated) | `predictions-view.tsx` | 151 | `match.homeXg` comes from store matches → DB. xG values on DB matches are never populated by sync (only scores/status/date are synced per `sync/route.ts` lines 76–86). Non-zero xG values originate from seed data only. |
| Existing prediction detection | REAL | `predictions-view.tsx` | 275 | `activePredictions.find(p => p.matchId === m.id)` — correctly checks DB predictions. Buttons disabled for already-predicted matches (line 286). |

#### Widget 4: Mega Predict All

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| API proxy call to /api/mega-predict | REAL (infrastructure) | `predictions-view.tsx` | 170–186 | POST to `/api/mega-predict` → `mega-predict/route.ts` → proxies to `${MEGA_PREDICT_API_URL}/api/predictions/predict` (line 86 of route). Real network call if env var is set. |
| Backend availability | UNAVAILABLE (by default) | `mega-predict/route.ts` | 4, 71–75 | `MEGA_PREDICT_API_URL = process.env.MEGA_PREDICT_API_URL || ''`. If empty, POST returns 503 with honest message. The toast (predictions-view.tsx line 213) falls back to "Backend unavailable — configure MEGA_PREDICT_API_URL". |
| Batch limited to 4 matches | MISSING (data truncation) | `predictions-view.tsx` | 162 | `.slice(0, 4)` — only first 4 unpredicted upcoming matches are processed. No user control over batch size. |
| Fallback xG values (1.4, 1.1) | **FABRICATED** | `predictions-view.tsx` | 168–169 | `m.homeXg > 0 ? m.homeXg : 1.4` — arbitrary defaults. Used when match xG is 0 (all DB upcoming matches). Presented as model input features. |
| Fallback ELO values (1600, 1500) | **FABRICATED** | `predictions-view.tsx` | 176–177 | `m.homeTeam?.eloRating || 1600` — arbitrary defaults. Seed team ELO values are also fabricated (per V2 audit). If ELO exists in seed, it's fabricated; if missing, the fallback is fabricated. |
| Fallback odds (2.1, 3.4, 3.5) | **FABRICATED** | `predictions-view.tsx` | 182–184 | `m.oddsHome || 2.1` — arbitrary defaults. No odds API is called. DB matches from sync have no odds field populated. |
| Conceded multipliers (×0.9) | **FABRICATED** | `predictions-view.tsx` | 180–181 | `home_avg_conceded: awayXg * 0.9` — arbitrary 0.9 multiplier with no statistical basis. Both the xG input and the multiplier are fabricated. |
| Prediction outcome from ensemble response | DERIVED (from potentially fabricated inputs) | `predictions-view.tsx` | 191–192 | `ensemble.home_win >= ensemble.away_win && ...` — legitimate argmax selection from ensemble probabilities. However, inputs (xG, ELO, odds) sent to the ensemble are mostly fabricated, so the output is tainted by propagation. |
| Confidence from ensemble response | DERIVED (from potentially fabricated inputs) | `predictions-view.tsx` | 193 | `Math.round(Math.max(ensemble.home_win, ensemble.draw, ensemble.away_win) * 100)` — legitimate computation. Same propagation caveat as outcome. |
| Stored model name "mega-ensemble" | REAL | `predictions-view.tsx` | 203 | `model: 'mega-ensemble'` stored in DB prediction record via POST to `/api/predictions`. |
| Toast "Used 6-model super-ensemble" | **FABRICATED CLAIM** | `predictions-view.tsx` | 213 | Hardcoded static string. (1) The backend's own GET endpoint (`mega-predict/route.ts` lines 45–53) hardcodes a list of **7** models, not 6 — internal contradiction. (2) The actual model count used by the backend's `/api/predictions/predict` endpoint is unverified by the frontend — the toast assumes a specific model configuration that may not match reality. |
| Individual match failure handling | **SILENT FAILURE** | `predictions-view.tsx` | 209 | `catch { /* skip failed match */ }` — if a single match's mega-predict call fails, it is silently skipped. The final toast shows "X/4 predicted" but gives no detail on which matches failed or why. |
| Mega Predict loading indicator | REAL | `predictions-view.tsx` | 69, 268 | `megaBatchLoading` state shows `<Loader2 className="size-3 animate-spin" />` and disables the button. Honest loading state. |

#### Widget 5: Model Comparison Card

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| MOCK_MODEL_COMPARISON data (probabilities) | **FABRICATED** | `predictions-view.tsx` | 40–45 | Hardcoded array: ELO (H45/D26/A29), Poisson (42/28/30), Dixon-Coles (47/25/28), Monte Carlo (44/27/29). Variable named "MOCK" but no DEMO disclosure in UI. |
| MOCK_MODEL_COMPARISON accuracy values | **FABRICATED** | `predictions-view.tsx` | 41–44 | Accuracy: ELO 68%, Poisson 65%, Dixon-Coles 72%, Monte Carlo 70%. These are static numbers unrelated to any actual prediction results. |
| Probability bars (H/D/A %) | **FABRICATED** | `predictions-view.tsx` | 379–381 | `<div ... style={{ width: \`${m.home}%\` }} />` rendered directly from MOCK values. Presented as if from live model outputs. |
| Percentage labels under bars | **FABRICATED** | `predictions-view.tsx` | 383–384 | `<span>H {m.home}%</span>` etc. — same MOCK data rendered as text. |
| Accuracy badges per model | **FABRICATED** | `predictions-view.tsx` | 376 | `{m.accuracy}% acc` badge rendered from MOCK data. |
| Contradiction with Accuracy by Model chart | **MISLEADING** | `predictions-view.tsx` | 372 vs. 392 | Widget 5 shows fixed MOCK accuracy (ELO 68%, Dixon-Coles 72%). Widget 8 (Accuracy by Model chart, lines 392–409) computes real accuracy from DB predictions. Both are visible simultaneously — showing different, contradictory accuracy numbers for the same models. |

#### Widget 6: Prediction Activity Heatmap

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| MOCK_CALENDAR heatmap data (56 cells) | **FABRICATED** | `predictions-view.tsx` | 47–56 | Hardcoded `Record<string, number>` mapping `'row-col'` → fake prediction counts (values 0–4). 56 fabricated data points. Variable named "MOCK" but no DEMO disclosure in UI. |
| Heatmap cell tooltip ("X predictions") | **FABRICATED** | `predictions-view.tsx` | 421 | `title={\`${count} predictions\`}` displays fabricated MOCK_CALENDAR values on hover. |
| Heatmap cell color intensity | **FABRICATED** (propagated) | `predictions-view.tsx` | 420 | Color class derived from fabricated count: 0→muted, 1→primary/20, 2-3→primary/40, 4+→primary/70. |
| Day-of-week column headers | REAL | `predictions-view.tsx` | 57, 416 | `['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']` — static UI labels, not data. |
| Legend ("Less" / "More") | REAL | `predictions-view.tsx` | 424–427 | Static legend with fixed color swatches — UI chrome, not data. |

#### Widget 7: Prediction History Table

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Prediction records (match, outcome, score, result) | REAL | `predictions-view.tsx` | 79–82 | Fetched from `/api/predictions` → Prisma DB `prediction.findMany` with match join (up to 100 records). |
| Model column values | REAL | `predictions-view.tsx` | 349 | `<Badge>{p.model}</Badge>` — from DB `prediction.model` field. Values: 'user' (Quick Predict), 'mega-ensemble' (Mega Predict), or other model names from external sources. |
| Confidence column for Quick Predict rows | **FABRICATED** | `predictions-view.tsx` | 155, 350 | Quick Predict stores `confidence: 70` for every prediction. All rows with `model: 'user'` show identical 70% regardless of match difficulty. |
| Confidence column for Mega Predict rows | DERIVED | `predictions-view.tsx` | 193, 350 | Confidence computed as `Math.round(Math.max(probabilities) * 100)` from ensemble response. Legitimate derivation, though inputs may be fabricated. |
| Model filter dropdown — missing 'user' option | **BROKEN** | `predictions-view.tsx` | 311–316 | Filter lists: ELO, Poisson, Dixon-Coles, Monte Carlo, Mega Ensemble. But Quick Predict predictions have `model: 'user'` (not in list). Selecting any specific model filter hides all 'user' predictions with no way to view them alone. |
| Result filter (correct/incorrect) | REAL | `predictions-view.tsx` | 319–326 | Correctly filters `p.isCorrect === true` or `false`. Functional. |
| Sort by date/confidence/model | REAL | `predictions-view.tsx` | 107–109 | Legitimate sort on real DB fields. |
| Empty state message | REAL | `predictions-view.tsx` | 331–332 | `{filteredPast.length === 0 && <p>No predictions found</p>}` — honest empty state. |

#### Widget 8: Accuracy by Model Chart

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| accuracyByModel computation | DERIVED | `predictions-view.tsx` | 119–129 | Groups `pastPredictions` by `p.model`, computes `Math.round((correct / total) * 100)`. Legitimate computation from real DB records. |
| Chart bars (Recharts BarChart) | DERIVED | `predictions-view.tsx` | 396–405 | Renders accuracyByModel data. Conditional: only shown when `accuracyByModel.length > 0` (line 392). |
| Chart not shown when empty | REAL | `predictions-view.tsx` | 392 | `{accuracyByModel.length > 0 && (...)}` — correctly hidden when no past predictions exist. No stale/fake chart shown. |

#### Widget 9: Export CSV

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| CSV data (date, match, prediction, score, confidence, model, result, points) | DERIVED | `predictions-view.tsx` | 131–142 | Transforms `filteredPast` (real DB predictions) into CSV rows via `generateCSV`. Data provenance is real. |
| Export toast count ("X predictions exported") | REAL | `predictions-view.tsx` | 143 | `${data.length}` reflects actual count of exported rows. |
| Export includes fabricated confidence | **FABRICATED** (propagated) | `predictions-view.tsx` | 137 | `Confidence: \`${p.confidence}%\`` — Quick Predict rows will always show 70%. Fabricated values propagate into the exported CSV. |

**States implemented:** LOADING (skeleton, line 216), SUCCESS, EMPTY ("No predictions found", line 332; "No new matches to predict" toast, line 163)
**States missing:** ERROR — fetchPredictions silently swallows all errors (`catch { /* silent */ }`, line 92). User sees stale/empty data with no failure indication. Leaderboard fetch failure also silently handled (leaderboardPos stays 0, card hidden). Individual Mega Predict failures silently skipped (line 209).
**AI attribution:** N/A

---

### V4. Tactical (tactical-view.tsx)

**File:** `src/components/elastico/tactical-view.tsx` (529 lines)

#### Widget 1: Formation Display

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Formation templates (4-3-3, 4-4-2, etc.) | REAL | `tactical-view.tsx` | 31–88 | UI scaffolding — positional coordinates. File comment (lines 27–29) honestly states: "These are positional templates... not match-specific data." |
| Formation selector | REAL | `tactical-view.tsx` | 214–222 | Selects from FORMATIONS constant. UI control, not data. |

#### Widget 2: Tactical Comparison

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Possession (homeTeam.possession \\|\| 55, away \\|\| 45) | **FABRICATED** | `tactical-view.tsx` | 268 | Fallback 55/45 when team data missing. Shown without disclosure. |
| Press Intensity (\\|\| 72, \\|\| 58) | **FABRICATED** | `tactical-view.tsx` | 269 | Same — fabricated defaults |
| Pass Accuracy (\\|\| 87, \\|\| 82) | **FABRICATED** | `tactical-view.tsx` | 270 | Same — fabricated defaults |
| xG per Game (\\|\| 1.5, \\|\| 1.1) | **FABRICATED** | `tactical-view.tsx` | 271 | Same — fabricated defaults |
| ELO Rating (divided by 20 for display) | DERIVED | `tactical-view.tsx` | 272 | `Math.min(homeTeam?.eloRating || 1600, 2000) / 20` — from team ELO. For seed teams: FABRICATED by propagation. |
| Style Score (home: 78, away: 65) | **FABRICATED** | `tactical-view.tsx` | 273 | Entirely hardcoded for every match. No data source. |

#### Widget 3: Pressing Heatmap

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Pressing intensity heatmap | UNAVAILABLE | `tactical-view.tsx` | 300–316 | Honest empty state: "Pressing intensity data is not available for this match." Explains what data would be needed. |

#### Widget 4: Pass Network

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Pass network | UNAVAILABLE | `tactical-view.tsx` | 318–334 | Honest empty state: "Pass network data is not available." Explains data requirement. |

#### Widget 5: xG Timeline

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| xG timeline (when StatsBomb match selected) | REAL | `tactical-view.tsx` | 345–372 | Computed from StatsBomb shot data — cumulative xG per minute from actual shots |
| xG timeline (no match selected) | UNAVAILABLE | `tactical-view.tsx` | 373–379 | Honest empty state: "xG timeline data is not available for this match." |

#### Widget 6: Shot Map

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Shot locations (StatsBomb match) | REAL | `tactical-view.tsx` | 384–449 | Real shot x/y coordinates, outcomes, xG values from StatsBomb open data |
| Shot map (no match selected) | UNAVAILABLE | `tactical-view.tsx` | 438–445 | Honest empty state: "Select a StatsBomb match above to view real shot locations." |
| StatsBomb competitions/matches | REAL | `tactical-view.tsx` | 89–103 | Fetched from `/api/statsbomb?action=matches&competition=...` → StatsBomb open data API |

#### Widget 7: Detailed Tactical Comparison

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Match stats (possession, shots, corners, fouls) | DERIVED* | `tactical-view.tsx` | 456–462 | From match object. For football-data.org: may be 0/undefined. For seed: from seed data. *When 0s shown for football-data.org matches that don't provide these: **FABRICATED** (zeros as real stats). |
| xG (StatsBomb) | REAL | `tactical-view.tsx` | 462 | `parseFloat(sbShotMeta.homeXg)` — from StatsBomb when available |

#### Widgets 8–18: Empty Tabs

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Set Pieces, Substitutions, Momentum, Zone Control, Build-up, Defensive, Aerial, Counter, Def Line, Wide Play, Transition | UNAVAILABLE | `tactical-view.tsx` | 480–508 | All show honest empty states explaining what data would be needed. Each has a specific explanation. |

#### Widget 19: Tactical AI Insight

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| AI Insight content | REMOVED | `tactical-view.tsx` | 510–526 | Honest removal. Line 522: "The previous content was fabricated tactical analysis presented as if from an AI model. This has been removed." **Gold standard** for handling removed fabrication. |

**States implemented:** LOADING (sbLoading, line 108), SUCCESS, EMPTY (multiple honest states), ERROR (sbError display, line 411)
**States missing:** None — best 4-state compliance of any view.
**AI attribution:** ✅ Former fabrication honestly removed and documented.

---

### V5. Player (player-view.tsx)

**File:** `src/components/elastico/player-view.tsx` (860 lines)

#### Data Honesty Note (lines 65–71)

The file contains an explicit comment: "FIFA-style radar attributes (Pace/Shooting/Passing/Defending/Physical/Dribbling) and per-match form ratings are NOT computed by ELASTICO's engine and have no real data source. These sections show honest empty states instead of fabricating plausible-looking numbers."

#### Widget 1: Player Grid

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Player list | REAL | `player-view.tsx` | 90–123 | Fetched from `/api/players` → Prisma DB |
| Player name, position, team, rating, goals, assists | REAL | `player-view.tsx` | 105–113 | From API response → DB |
| Team name, code, color | REAL/PROXY | `player-view.tsx` | 107–109 | From player's team relation. Color is PROXY. |
| Search, position filter, team filter, sort | REAL | `player-view.tsx` | 126–134 | Client-side filtering of real data |

#### Widget 2: Radar Charts Tab

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| FIFA-style radar attributes | UNAVAILABLE | `player-view.tsx` | 452–470 | Honest empty state: "FIFA-style attribute radars (Pace, Shooting, Passing, Defending, Physical, Dribbling) are not a metric ELASTICO computes." |

#### Widget 3: Player Comparison Radar

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Comparison radar | UNAVAILABLE | `player-view.tsx` | 552 | "FIFA-style radar attributes are not available — ELASTICO does not compute them." Uses real recorded stats (goals, assists, rating, appearances) for non-radar comparison. |

#### Widget 4: Form Ratings

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Per-match form ratings | UNAVAILABLE | `player-view.tsx` | 792 | "Per-match form ratings are not available." |

#### Widget 5: Radar Placeholder

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Radar placeholder text | UNAVAILABLE | `player-view.tsx` | 847 | "FIFA-style attribute radar is not available — ELASTICO does not compute these attributes." |

**States implemented:** LOADING (isLoading + skeleton), SUCCESS, EMPTY (empty players array), ERROR (silent catch but empty state shows)
**AI attribution:** N/A

**Overall:** This view is the **gold standard** for data honesty. It explicitly refuses to fabricate and documents why. No fabrication instances found.

---

### V6. Compare (compare-view.tsx)

**File:** `src/components/elastico/compare-view.tsx` (526 lines)

#### Widget 1: Team Selectors

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Team list | REAL | `compare-view.tsx` | 51 | From store teams → DB |

#### Widget 2: Recent Form

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Home form badges | **FABRICATED** | `compare-view.tsx` | 97 | `homeTeam?.form ? JSON.parse(homeTeam.form) : ['W', 'D', 'W', 'L', 'W']` — hardcoded fake form when team.form is null |
| Away form badges | **FABRICATED** | `compare-view.tsx` | 98 | `['L', 'W', 'D', 'W', 'L']` — hardcoded fake form |

#### Widget 3: Win Probability

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| ELO-based probabilities | **FABRICATED** | `compare-view.tsx` | 43–46, 78–81 | Draw probability: `(1 - eA) * 0.3` is an arbitrary formula, not calibrated. Input ELO is from seed (FABRICATED). Output inherits FABRICATED by propagation. |

#### Widget 4: Full Stat Comparison

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| ELO, xG, xGA, possession, pass accuracy, press intensity, goals, wins, draws, losses, GD, avg goals | DERIVED* | `compare-view.tsx` | 110–131 | From team store object. For seed teams: FABRICATED by propagation. *The three entries below are always FABRICATED: |
| "Shots per Game" (12.4, 10.8) | **FABRICATED** | `compare-view.tsx` | 127 | Hardcoded for every team comparison |
| "Corners per Game" (6.2, 5.5) | **FABRICATED** | `compare-view.tsx` | 128 | Hardcoded |
| "Fouls per Game" (11.3, 13.1) | **FABRICATED** | `compare-view.tsx` | 129 | Hardcoded |

#### Widget 5: ELO Rating History

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| 12-month ELO history chart | **FABRICATED** | `compare-view.tsx` | 84–94 | `Math.sin(i / 3) * 30 + ((i * 7 % 10) - 5) * 2` — synthetic sine/cosine curve with noise, not real historical ELO data |

#### Widget 6: Scoring Trends

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| 6-match scoring trends chart | **FABRICATED** | `compare-view.tsx` | 101–107 | Hardcoded arrays: `[1, 2, 0, 3, 1, 2]`, `[0, 1, 1, 0, 2, 1]`, etc. Not from any real data source. |

#### Widget 7: Head-to-Head Record

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| H2H match results (5 matches) | **FABRICATED** | `compare-view.tsx` | 59–67 | Comment on line 58 says "Head-to-head mock data". Hardcoded: `{ date: '2025-11', homeGoals: 2, awayGoals: 1, result: 'H' }`, etc. Presented in UI (lines 384–394) without any DEMO disclosure. |
| H2H record (3W, 1D, 1A) | **FABRICATED** | `compare-view.tsx` | 70–75 | Computed from fake H2H data. Shown as large numbers (lines 371–382) without disclosure. |

#### Widget 8: Tactical Edge

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Tactical edge indicators | DERIVED* | `compare-view.tsx` | 140–149 | Derived from team xgPerGame, possession, pressIntensity, passAccuracy. *For seed teams: FABRICATED by propagation. |

#### Widget 9: Squad Depth

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Squad depth by position | **FABRICATED** | `compare-view.tsx` | 134–137 | `Math.floor(Math.random() * 2)` — **random numbers on every render**. Values change each time component re-renders. Presented as structured squad data. |

#### Widget 10: Key Player Matchups

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Player matchup labels | **FABRICATED** | `compare-view.tsx` | 454–468 | `${homeTeam.name} Best Striker`, `${homeTeam.name} Playmaker`, `${homeTeam.name} Key Defender` — team name + generic role, not real player names. Presented in a matchup card format that implies real player analysis. |

#### Widget 11: Style Matchup

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| "Wing Play vs Center" (both "Mixed") | **FABRICATED** | `compare-view.tsx` | 484 | Hardcoded 'Mixed' for every team. Other style labels (lines 481–483) are DERIVED from team data thresholds. |

#### Widget 12: Comparison Summary

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Summary text | **FABRICATED CLAIM** | `compare-view.tsx` | 503–519 | Template-generated text using `Brain` icon (implies AI). References fabricated H2H record (line 515: `h2hRecord.home > h2hRecord.away`). Not AI-generated. |

**States implemented:** SUCCESS, EMPTY (no team selected, lines 209–215)
**States missing:** LOADING, ERROR
**AI attribution:** **VIOLATION** — Brain icon + "Comparison Summary" implies AI analysis. Content is template strings with fabricated inputs.
### V7. AI Analyst / Chat (chat-view.tsx)

**File:** `src/components/elastico/chat-view.tsx` (612 lines)

#### Widget 1: AI Provider Badge

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| "Powered by Multi-Provider AI Gateway" badge | **FABRICATED CLAIM** | `chat-view.tsx` | 381 | Shown always. When no AI provider is configured, the backend returns `model: 'mock-fallback'` (`src/app/api/chat/route.ts` line 219) but the UI never checks this flag. The badge is false when mock is active. |

#### Widget 2: Model Selector

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| "ELASTICO Pro (Best Quality)" label | REAL | `chat-view.tsx` | 36 | Label for NVIDIA/proxy provider. When provider configured: real. |
| "ELASTICO Fast (Low Latency)" label | REAL | `chat-view.tsx` | 37 | Label for faster provider. |
| "ELASTICO Local (Offline Mode)" label | **MISLEADING** | `chat-view.tsx` | 38 | Implies a local model exists. The "local" mode sends to `/api/chat` with `model: 'local'`. If no provider handles it, falls through to `generateFootballAnalysis()` — a hardcoded template, not a local model. |

#### Widget 3: Chat Messages

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| User messages | REAL | `chat-view.tsx` | 183–191 | Stored in Zustand, displayed as sent |
| AI responses (when provider configured) | REAL | `chat-view.tsx` | 234–263 | Actual LLM response via streaming or JSON |
| AI responses (no provider configured) | **FABRICATED** | `chat-view.tsx` | 268–271 | Falls through to `generateFootballAnalysis()` in `src/app/api/chat/route.ts` lines 120–171. Returns hardcoded template strings. The UI displays these identically to real AI responses. The `model: 'mock-fallback'` flag in the response is never checked by the UI. |

#### Widget 4: Mock Response Content

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Match prediction template ("Verdict: X has a significant ELO advantage") | **FABRICATED** | `src/app/api/chat/route.ts` | 136–153 | Hardcoded template using ELO formula. `drawProb = (1 - expectedHome) * 0.3` is arbitrary. Presented with markdown formatting and `**Verdict:**` label that implies analytical depth. |
| Tactical template ("plays X style with Y% possession") | **FABRICATED** | `src/app/api/chat/route.ts` | 156–161 | Uses team.style and team.possession from store (which are fabricated for seed teams). |
| Default fallback ("Ask me about any match...") | **FABRICATED** | `src/app/api/chat/route.ts` | 166–170 | Generic response for non-match queries. |

#### Widget 5: Empty State

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Welcome screen with suggestions | REAL | `chat-view.tsx` | 459–493 | Static UI scaffolding. The suggested prompts are navigation aids. |
| "Using {activeModel.label}" | REAL | `chat-view.tsx` | 474–476 | Shows selected model label. Accurate. |

**States implemented:** LOADING (bouncing dots, line 536–541), SUCCESS, EMPTY (welcome screen, lines 459–493), ERROR (toast on failure, line 275–278)
**AI attribution:** **VIOLATION** — When mock-fallback is active, the UI shows the same AI branding (Bot icon, "ELASTICO AI Assistant", Sparkles icon, "Powered by Multi-Provider AI Gateway" badge) as when a real LLM is responding. The user cannot distinguish between real AI output and template strings.

---

### V8. News (news-view.tsx)

**File:** `src/components/elastico/news-view.tsx` (594 lines)

#### Widget 1: News Feed

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| News items (ESPN source) | REAL | `news-view.tsx` | 135–164 | Fetched from `/api/news` → ESPN API cascade |
| News items (Newsdata.io source) | REAL | `news-view.tsx` | 135–164 | Second source in cascade |
| News items (DB/seed fallback) | **FABRICATED** | `news-view.tsx` | 135–164 | 5 hand-crafted articles in `prisma/seed.ts` lines 45–51. Titles like "Argentina confirmed as World Cup 2026 top seeds" with `source: 'FIFA.com'`. |
| Category badges | DERIVED* | `news-view.tsx` | 334–344 | From `item.category`. For seed news: **FABRICATED by propagation** (categories were hand-assigned). |
| Sentiment indicators | DERIVED | `news-view.tsx` | 357–366 | From `item.sentiment`. Falls back to 'neutral'. Neither ESPN nor Newsdata.io provides sentiment — always 'neutral' for real news. |

#### Widget 2: News Detail Modal

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Related Teams ("Team A", "Team B") | **FABRICATED** | `news-view.tsx` | 532–548 | Hardcoded `['Team A', 'Team B']` (line 538). Shown for every news article that has content. Not real related teams. |
| Reaction buttons (Like, Fire, Think) | **DEAD UI** | `news-view.tsx` | 551–586 | Visual buttons with counts. No click handler persists any reaction. Buttons appear interactive but do nothing. |
| Reaction counts | **FABRICATED** | `news-view.tsx` | 318, 560–583 | Parsed from `item.reactions` JSON. ESPN/Newsdata.io don't provide reactions. For seed news: likely 0 or undefined. If any non-zero value appears, it's fabricated. |

#### Widget 3: Filters and Search

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Category filter | REAL | `news-view.tsx` | 258–273 | Sends to API as query parameter |
| Search | REAL | `news-view.tsx` | 247–255 | Debounced search sent to API |
| Pagination / Load More | REAL | `news-view.tsx` | 425–446 | API-driven pagination |

**States implemented:** LOADING (skeleton, lines 278–299), SUCCESS, EMPTY (honest message, lines 300–312)
**States missing:** ERROR (silent catch, lines 157, 179, 199; shows empty state on error, no error message)
**AI attribution:** N/A

---

### V9. Settings (settings-view.tsx)

**File:** `src/components/elastico/settings-view.tsx` (1343 lines)

#### Widget 1: AI Status Check

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| AI connection status badge | REAL | `settings-view.tsx` | 163–187 | Sends `__status_check__` to `/api/chat`. Checks if response model is 'pro' (connected) or 'mock-fallback' (disconnected). Accurately detects provider status. |

#### Widget 2: Model Descriptions

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| "6-model ensemble prediction backend (FastAPI)" | **FABRICATED CLAIM** | `settings-view.tsx` | (settings page) | The live endpoint (`/api/predictions/predict`) uses 3 models. The 6-model SuperEnsemble exists in a separate uncalled endpoint. |

#### Widget 3: User Preferences

| Data Point | State | File | Line | Evidence |
|-----------|-------|------|------|----------|
| Display name, bio, favorite teams | REAL | `settings-view.tsx` | (profile section) | User preferences stored in Prisma DB |
| Theme toggle | REAL | `settings-view.tsx` | (appearance section) | next-themes integration |
| Navigation preferences | REAL | `settings-view.tsx` | (navigation section) | UI preferences |

**States implemented:** LOADING (AI status check), SUCCESS, ERROR (status: 'disconnected')
**States missing:** N/A
**AI attribution:** N/A

**Overall:** Settings view is mostly honest. Only fabrication is the model count claim in the backend description text.---

## Backend Data Flow Mapping

### Flow 1: Live Match Scores

| Stage | Detail | File | Line | Issue |
|-------|--------|------|------|-------|
| **SOURCE** | football-data.org API (Premier League) | `src/app/api/football-data/route.ts` | — | Requires API key. PL only — single competition. |
| **INGESTION** | Next.js API route proxies to football-data.org | `src/app/api/football-data/route.ts` | — | — |
| **DATABASE** | Matches stored/updated in Prisma DB | `src/app/api/football-data/route.ts` | — | football-data.org matches may be upserted into DB |
| **API** | `GET /api/football-data?action=matches&competition=PL&status=...` | `src/app/api/football-data/route.ts` | — | — |
| **MODEL** | None | — | — | — |
| **UI** | `matches-view.tsx` — MatchCard | `matches-view.tsx` | 346 | xG, ELO, stats, attendance fabricated for this data |

### Flow 2: Team Data

| Stage | Detail | File | Line | Issue |
|-------|--------|------|------|-------|
| **SOURCE** | Prisma seed (`prisma/seed.ts`) | `prisma/seed.ts` | 8–23 | ELO values hand-crafted. xgPerGame, possession, pressIntensity, passAccuracy, style — all fabricated defaults. |
| **INGESTION** | `npx prisma db seed` | `prisma/seed.ts` | — | One-time seed, no update mechanism |
| **DATABASE** | `Team` table in Prisma | `prisma/schema.prisma` | — | Teams from 5 leagues, 126 teams in backend, ~20 in frontend seed |
| **API** | `GET /api/teams` | `src/app/api/teams/route.ts` | — | — |
| **MODEL** | None | — | — | — |
| **UI** | Store `teams` array used by Dashboard, Compare, Tactical, Matches | Multiple views | — | Team stats (xgPerGame, possession, etc.) are FABRICATED from seed |

### Flow 3: Player Data

| Stage | Detail | File | Line | Issue |
|-------|--------|------|------|-------|
| **SOURCE** | Prisma seed (`prisma/seed.ts`) | `prisma/seed.ts` | — | Players seeded with basic data |
| **INGESTION** | Seed | `prisma/seed.ts` | — | — |
| **DATABASE** | `Player` table | `prisma/schema.prisma` | — | — |
| **API** | `GET /api/players` | `src/app/api/players/route.ts` | — | — |
| **MODEL** | None | — | — | — |
| **UI** | `player-view.tsx` | `player-view.tsx` | 90–123 | Honestly handles missing radar/form data. Gold standard. |

### Flow 4: News

| Stage | Detail | File | Line | Issue |
|-------|--------|------|------|-------|
| **SOURCE** | ESPN API → Newsdata.io → DB seed fallback | `src/app/api/news/route.ts` | 56–107 | ESPN is primary. Newsdata.io secondary. Seed news is fabricated with false source attribution. |
| **INGESTION** | Next.js API route with cascade | `src/app/api/news/route.ts` | 56–107 | — |
| **DATABASE** | `NewsItem` table | `prisma/schema.prisma` | — | Seed articles stored in DB |
| **API** | `GET /api/news?page=&limit=&category=&search=` | `src/app/api/news/route.ts` | — | — |
| **MODEL** | None | — | — | — |
| **UI** | `news-view.tsx` | `news-view.tsx` | 135–164 | Seed news shown identically to real. Related Teams hardcoded as "Team A, Team B". |

### Flow 5: ELO Ratings

| Stage | Detail | File | Line | Issue |
|-------|--------|------|------|-------|
| **SOURCE** | Hand-crafted in seed | `prisma/seed.ts` | 8–23 | Not from any ELO calculation. Values like 1750, 1600, 1850 assigned manually. |
| **INGESTION** | Seed only | — | — | **No live ELO update mechanism.** ELO never changes after seed. |
| **DATABASE** | `Team.eloRating` | `prisma/schema.prisma` | — | Static since seed |
| **API** | Part of `/api/teams` response | — | — | — |
| **MODEL** | Used as input to ELO probability formula | `compare-view.tsx:43-45`, `ensemble.py:compute_elo_prob` | — | FABRICATED input produces FABRICATED probabilities |
| **UI** | Dashboard (ELO Rankings, Team Rankings), Compare (Win Probability, ELO History), Tactical (ELO stat bar) | Multiple views | — | Shown as real current ratings. Never updated. |

### Flow 6: xG Data

| Stage | Detail | File | Line | Issue |
|-------|--------|------|------|-------|
| **SOURCE** | Fabricated: `mean(recent_SOT) * 0.1` | `scripts/phase2_data_foundation.py` | 363, 381 | Multiplier 0.1 not calibrated. Used only in training, not available for live matches. |
| **INGESTION** | Phase 2 data pipeline (training only) | `scripts/phase2_data_foundation.py` | — | Not connected to live data pipeline |
| **DATABASE** | Not stored as a live data point | — | — | Match records have homeXg/awayXg fields but they're from seed, not real xG |
| **API** | No dedicated xG endpoint | — | — | — |
| **MODEL** | XGBoost trained with fabricated xG features | `scripts/phase2_data_foundation.py` | — | Model influence: xG features have importance ~2.5 (average among 50 features) |
| **UI** | Dashboard xG chart (honest empty), Matches xG bars (fabricated for football-data.org matches), Tactical xG timeline (REAL from StatsBomb when available) | Multiple views | — | StatsBomb xG is the only real xG source, limited to historical tournament matches. |

### Flow 7: Predictions (User-Made)

| Stage | Detail | File | Line | Issue |
|-------|--------|------|------|-------|
| **SOURCE** | User input via Quick Predict or Mega Predict | `matches-view.tsx:76-84`, `predictions-view.tsx:146-157, 160-214` | — | — |
| **INGESTION** | POST to `/api/predictions` | `src/app/api/predictions/route.ts` | — | Stores in DB |
| **DATABASE** | `Prediction` table | `prisma/schema.prisma` | — | — |
| **API** | `GET /api/predictions`, `POST /api/predictions` | `src/app/api/predictions/route.ts` | — | — |
| **MODEL** | None for storage. Mega Predict sends to FastAPI. | — | — | — |
| **UI** | `predictions-view.tsx` prediction history table | `predictions-view.tsx` | 330–363 | Accurate display of DB records. Model comparison card uses MOCK data. |

### Flow 8: AI Chat

| Stage | Detail | File | Line | Issue |
|-------|--------|------|------|-------|
| **SOURCE** | Multi-provider AI gateway (Google AI, Groq, Mistral, NVIDIA, Cerebras, OpenRouter, GitHub) | `src/app/api/chat/route.ts` | 175–181 | When no provider configured: falls back to `generateFootballAnalysis()` templates |
| **INGESTION** | Next.js API route | `src/app/api/chat/route.ts` | 189–284 | Mock fallback at lines 214–222, 235, 268 |
| **DATABASE** | In-memory Zustand store only | `src/store/use-elastico-store.ts` | — | Chat history lost on page refresh |
| **API** | `POST /api/chat`, `GET /api/chat` | `src/app/api/chat/route.ts` | — | — |
| **MODEL** | Real LLM when configured. Hardcoded templates when not. | `src/app/api/chat/route.ts` | 120–171 | Mock responses use fabricated ELO draw formula `(1-eA)*0.3` and fabricated style/possession data |
| **UI** | `chat-view.tsx` | `chat-view.tsx` | 364–612 | Never discloses mock-fallback to user. AI branding always shown. |

### Flow 9: FastAPI Prediction Backend

| Stage | Detail | File | Line | Issue |
|-------|--------|------|------|-------|
| **SOURCE** | Request parameters from frontend (ELO, avg goals, odds) | `src/api/routes/predictions.py` | 297–341 | Frontend sends fabricated fallbacks when real data missing (predictions-view.tsx:168-184) |
| **INGESTION** | FastAPI `/api/predictions/predict` | `src/api/routes/predictions.py` | 297–341 | Uses 3-model ensemble (ELO+Poisson+Dixon-Coles) + optional market |
| **DATABASE** | Prediction history endpoint returns empty | `src/api/routes/predictions.py` | 356–359 | `return {"predictions": [], "total": 0}` — placeholder |
| **API** | `POST /api/predictions/predict` (live), `POST /api/predictions/super-ensemble` (unused) | `src/api/routes/predictions.py`, `src/api/app.py` | 297, 108 | Frontend calls `/api/predictions/predict` via mega-predict proxy. Super-ensemble never called by frontend. |
| **MODEL** | ELO, Poisson, Dixon-Coles (live). XGBoost, Stochastic, LSTM (SuperEnsemble only, unused). | `src/api/routes/predictions.py:219-255`, `src/engines/ensemble.py` | — | All ensemble weights fabricated (B3). xG features in XGBoost fabricated (B1). |
| **UI** | `predictions-view.tsx` Mega Predict, `prediction-engine-view.tsx` | — | — | — |### Flow 10: StatsBomb Data (Real Subsystem)

| Stage | Detail | File | Line | Issue |
|-------|--------|------|------|-------|
| **SOURCE** | StatsBomb Open Data (free, no API key) | `src/app/api/statsbomb/route.ts` | — | Covers historical tournaments (World Cup, Euros, UCL, etc.) |
| **INGESTION** | Next.js API proxy | `src/app/api/statsbomb/route.ts` | — | — |
| **DATABASE** | Not stored (fetched on demand) | — | — | — |
| **API** | `GET /api/statsbomb?action=matches&competition=...&season=...`, `?action=shots&match=...` | `src/app/api/statsbomb/route.ts` | — | — |
| **MODEL** | xG computed from shot data on client | `tactical-view.tsx` | 349–354 | Cumulative sum of shot xG values. REAL computation from real data. |
| **UI** | `tactical-view.tsx` — Shot Map and xG Timeline | `tactical-view.tsx` | 384–449 | Only real xG source in the system. Limited to StatsBomb-covered matches. |

---

## ELASTICO TRUTH MAP

### A. VERIFIED REAL

| # | Data Point | Location | Evidence |
|---|-----------|----------|----------|
| A1 | Match scores, teams, status, date, competition (PL) | `matches-view.tsx:346-359` | football-data.org API |
| A2 | Team names, abbreviations | `matches-view.tsx:140,158,137,160` | football-data.org API |
| A3 | ESPN news articles | `news-view.tsx:135-164 → api/news/route.ts:56-83` | ESPN API |
| A4 | Newsdata.io news articles | `news-view.tsx:135-164 → api/news/route.ts:85-107` | Newsdata.io API |
| A5 | User predictions (stored) | `predictions-view.tsx:79-82` | Prisma DB |
| A6 | User stats (accuracy, streak) | `predictions-view.tsx:113-117` | Prisma DB |
| A7 | Leaderboard | `predictions-view.tsx:85-91` | Prisma DB |
| A8 | Player list (names, positions, stats) | `player-view.tsx:90-123` | Prisma DB via `/api/players` |
| A9 | StatsBomb shot locations and xG | `tactical-view.tsx:384-449 → api/statsbomb/route.ts` | StatsBomb open data |
| A10 | StatsBomb xG timeline | `tactical-view.tsx:345-372` | Cumulative xG from real shot data |
| A11 | Formation templates (UI scaffolding) | `tactical-view.tsx:31-88` | Honestly disclosed as templates |
| A12 | User profile/preferences | `settings-view.tsx` | Prisma DB |
| A13 | AI provider connection status | `settings-view.tsx:163-187` | Detected via status check |
| A14 | AI chat responses (when provider configured) | `chat-view.tsx:234-263 → api/chat/route.ts:225-263` | Real LLM via streaming |
| A15 | Dashboard ESPN live scores | `dashboard-view.tsx` | ESPN API (Widgets 1, 2, 8, 11) |
| A16 | Dashboard user stats (accuracy, streak) | `dashboard-view.tsx` | Prisma DB (Widget 13) |
| A17 | Dashboard xG empty state | `dashboard-view.tsx:105-109,406-411` | Honestly empty, no fabrication |
| A18 | Dashboard "No model prediction yet" message | `dashboard-view.tsx:321-325` | Honest UNAVAILABLE state |
| A19 | Tactical empty states (10 tabs) | `tactical-view.tsx:480-508` | All honest with explanations |
| A20 | Tactical AI Insight (removed) | `tactical-view.tsx:510-526` | Honestly removed with explanation |
| A21 | Player radar/form empty states | `player-view.tsx:452-470,552,792,847` | All honest with explanations |
| A22 | xG proxy disclosure in model metadata | `saved_models/xgboost_v1_metadata.json:335` | Honestly disclosed | A23 | Match detail view (exists, not audited) | `match-detail-view.tsx` | — |

### B. FABRICATED / MOCK

| # | Data Point | Location | Severity | Correct Behavior | Blocker | Fix |
|---|-----------|----------|----------|----------------|---------|-----|
| B1 | hashCode "Model Probabilities" widget | `dashboard-view.tsx:544-546` | CRITICAL | Remove widget or connect to real model | None | Remove |
| B2 | Dashboard Asian Handicap 55% | `dashboard-view.tsx:524` | CRITICAL | Remove or connect to real model | None | Remove |
| B3 | Dashboard "AI Insight" (static ternary) | `dashboard-view.tsx:684-698` | CRITICAL | Remove AI branding or connect to real AI | None | Remove/relabel |
| B4 | Dashboard "72% of the time" statistic | `dashboard-view.tsx:698` | CRITICAL | Remove fabricated statistic | None | Remove |
| B5 | Dashboard Quick Predict confidence:75 | `dashboard-view.tsx:142` | HIGH | Remove hardcoded confidence or show "not set" | None | Remove |
| B6 | Seed team ELO values | `prisma/seed.ts:8-23` | HIGH | Add real ELO update mechanism or label as "Seed ELO" | ELO update pipeline | Label as seed + add update mechanism |
| B7 | Seed match probabilities (drawProb=0.26) | `prisma/seed.ts:142` | HIGH | Compute from real data or remove | None | Remove hardcoded drawProb |
| B8 | Seed news articles (5 articles) | `prisma/seed.ts:45-51` | HIGH | Add `isSeed: true` flag + DEMO badge | None | Add flag + badge |
| B9 | xG features in XGBoost (SOT×0.1) | `scripts/phase2_data_foundation.py:363,381,392` | HIGH | Remove xG features from model or source real xG | Real xG source (Tier 1 roadmap) | Retrain model without fabricated xG |
| B10 | Ensemble weights (6-model) | `src/engines/ensemble.py:54-61`, `config/settings.py:35-40` | HIGH | Calibrate from validation data or remove | Validation data | Calibrate or remove |
| B11 | Stochastic engine parameters (GARCH, jump diffusion, etc.) | `src/engines/stochastic.py:38-414` | HIGH | Calibrate from data or disclose as uncalibrated | Historical data | Calibrate or add disclosure |
| B12 | Market signal parameters | `src/engines/market_signals.py:59-315`, `src/engines/kelly.py:156` | HIGH | Calibrate or cite sources | Market data | Calibrate or add disclosure |
| B13 | Confidence thresholds (0.55, 0.42) | `src/engines/ensemble.py:566-570` | MEDIUM | Calibrate or remove | None | Calibrate |
| B14 | Home advantage constant (+65) | `src/engines/ensemble.py:707`, `config/settings.py:24` | MEDIUM | Calibrate from data | Match data | Calibrate |
| B15 | Fallback 1/3 uniform probabilities | `src/engines/ensemble.py:466,536` | MEDIUM | Return UNAVAILABLE signal instead | None | Return null/error |
| B16 | Matches view attendance "35,421" | `matches-view.tsx:217` | HIGH | Remove or fetch real attendance | Attendance API | Remove or fetch |
| B17 | Matches view xG bars | `matches-view.tsx:167-176` | HIGH | Remove (no xG source for football-data.org) | None | Remove |
| B18 | Matches view expanded stats (possession, shots, etc.) | `matches-view.tsx:258-282` | HIGH | Remove or verify football-data.org provides these | API check | Remove if not in API |
| B19 | Matches view Quick Predict confidence:70 | `matches-view.tsx:81` | HIGH | Remove or let user set | None | Remove |
| B20 | Predictions MOCK_MODEL_COMPARISON | `predictions-view.tsx:40-45` | CRITICAL | Remove or replace with real model evaluation | Model evaluation data | Remove |
| B21 | Predictions MOCK_CALENDAR heatmap | `predictions-view.tsx:47-56` | CRITICAL | Remove or compute from real prediction timestamps | None | Compute from real data |
| B22 | Predictions Mega Predict fallback values | `predictions-view.tsx:168-184` | HIGH | Don't predict when data is missing | None | Skip matches with missing data |
| B23 | Predictions "Used 6-model super-ensemble" toast | `predictions-view.tsx:213` | HIGH | Correct to "3-model ensemble" | None | Fix text |
| B24 | Predictions "of X predictors" label | `predictions-view.tsx:253` | MEDIUM | Fix to show actual predictor count | None | Fix label |
| B25 | Tactical comparison fallback defaults | `tactical-view.tsx:268-273` | HIGH | Don't show bars when team data is missing | None | Add null check |
| B26 | Tactical Style Score (78, 65) | `tactical-view.tsx:273` | HIGH | Remove entirely | None | Remove |
| B27 | Compare H2H mock data | `compare-view.tsx:59-67` | CRITICAL | Fetch real H2H from DB or API, or show UNAVAILABLE | H2H data source | Replace with real or remove |
| B28 | Compare ELO history (sine curve) | `compare-view.tsx:84-94` | CRITICAL | Remove or fetch real history | ELO history tracking | Remove |
| B29 | Compare scoring trends (hardcoded arrays) | `compare-view.tsx:101-107` | CRITICAL | Remove or compute from real match data | Match data | Remove |
| B30 | Compare hardcoded stats (shots/corners/fouls per game) | `compare-view.tsx:127-129` | HIGH | Remove or source from real data | None | Remove |
| B31 | Compare squad depth (Math.random) | `compare-view.tsx:134-137` | CRITICAL | Remove entirely | None | Remove |
| B32 | Compare Key Player Matchups ("TeamName Best Striker") | `compare-view.tsx:454-468` | HIGH | Remove or connect to real player data | Player data | Remove |
| B33 | Compare "Wing Play vs Center" (hardcoded "Mixed") | `compare-view.tsx:484` | MEDIUM | Remove or derive from real data | None | Remove |
| B34 | Compare Summary (Brain icon, template text) | `compare-view.tsx:503-519` | HIGH | Remove Brain icon, fix or remove H2H reference | None | Remove/relabel |
| B35 | Chat mock-fallback responses | `src/app/api/chat/route.ts:120-171` | HIGH | Disclose mock to user in UI | None | Add disclosure badge |
| B36 | Chat AI badge when mock active | `chat-view.tsx:381` | HIGH | Show "Offline" badge when mock-fallback | None | Check model flag |
| B37 | Chat "ELASTICO Local (Offline Mode)" label | `chat-view.tsx:38` | MEDIUM | Rename to "Template Mode" or remove | None | Rename |
| B38 | News "Related Teams" (Team A, Team B) | `news-view.tsx:538` | HIGH | Remove or extract real teams from content | NLP parsing | Remove |
| B39 | News reaction buttons (dead UI) | `news-view.tsx:551-586` | MEDIUM | Remove or implement | None | Remove |
| B40 | Backend placeholder endpoints (all-zeros) | `src/api/routes/stats.py`, `src/api/routes/admin.py` | HIGH | Return UNAVAILABLE or implement | Various | Return 404/501 |
| B41 | Backend health check (fake "connected") | `src/api/routes/admin.py:196-208` | HIGH | Actually check DB connection | None | Implement check |
| B42 | Compare form fallbacks (WDLW, LWDLW) | `compare-view.tsx:97-98` | HIGH | Show UNAVAILABLE when team.form is null | None | Add null check |
| B43 | Compare draw probability formula | `compare-view.tsx:45` | MEDIUM | Use calibrated draw model or disclose approximation | None | Disclose or use real formula |
| B44 | Team store fabricated fields (xgPerGame, possession, etc.) | `prisma/seed.ts` → `use-elastico-store.ts` | HIGH | Source from real data or mark as "unavailable" | Real data source | Remove from seed or update |
| B45 | Settings "6-model" description | `settings-view.tsx` | MEDIUM | Change to "3-model ensemble + advanced models" | None | Fix text |

### C. STALE / TIME-SENSITIVE RISK

| # | Data Point | Location | Risk | Correct Behavior |
|---|-----------|----------|------|----------------|
| C1 | ELO ratings (never updated) | `prisma/seed.ts:8-23` | HIGH | Ratings are static since seed. Any match result does not update them. Shown as current. | Add ELO update after match results, or show "Last updated: seed (never)" |
| C2 | Team aggregate stats (goalsFor, wins, etc.) | `prisma/seed.ts` | HIGH | Seed values never updated. New match results don't change team stats. | Update after each matchday |
| C3 | News (no auto-refresh) | `news-view.tsx` | MEDIUM | User must manually refresh. No live update. | Add polling for ESPN live feed |
| C4 | Live matches (no auto-refresh) | `matches-view.tsx:371` | HIGH | Comment: "No auto-refresh — user can manually refresh". Live scores go stale. | Add 30-60s polling for IN_PLAY status |
| C5 | Player stats | `prisma/seed.ts` | MEDIUM | Seed player data never updated. Goals/assists/appearances are static. | Update from match event data |

### D. BROKEN / DISCONNECTED

| # | Data Point | Location | Issue | Fix |
|---|-----------|----------|-------|-----|
| D1 | Matches "All" tab → FINISHED only | `matches-view.tsx:344` | Maps 'all' to 'FINISHED'. User expects all statuses. | Fetch all statuses or remove 'all' tab |
| D2 | Matches Group filter (A–H) | `matches-view.tsx:41,437-446` | PL data has no groups. Buttons never work. | Remove for PL, or enable tournament data source |
| D3 | Matches Stage filter | `matches-view.tsx:41,406-414` | PL data has no stages. Dropdown always empty. | Remove for PL, or enable tournament data source |
| D4 | Matches Sort by ELO diff | `matches-view.tsx:377` | football-data.org matches have no ELO. All sort to 0. | Remove ELO sort option or add ELO to matches |
| D5 | Matches Sort by xG total | `matches-view.tsx:378` | football-data.org matches have no xG. All sort to 0. | Remove xG sort option |
| D6 | Matches Bookmark button | `matches-view.tsx:122-129` | Local state only. No persistence. Appears functional. | Remove or add DB persistence |
| D7 | Chat history (in-memory only) | `chat-view.tsx` → `use-elastico-store.ts` | Lost on page refresh. No DB storage. | Persist to DB |
| D8 | SuperEnsemble endpoint (uncalled) | `src/api/app.py:108` | 6-model endpoint exists but frontend calls 3-model `/api/predictions/predict` instead. | Connect frontend or remove dead endpoint |
| D9 | StatsBomb data not linked to team data | `tactical-view.tsx` | StatsBomb matches are separate from the main team/match system. Can't select Premier League matches for shot analysis. | Add StatsBomb data for PL or show only available |
| D10 | Prediction history placeholder | `src/api/routes/predictions.py:356-359` | Returns empty array regardless of DB content. | Query actual DB predictions |

### E. PLACEHOLDER

| # | Data Point | Location | Issue | Fix |
|---|-----------|----------|-------|-----|
| E1 | Backend /api/stats/team/{team_id} | `src/api/routes/stats.py:84-88` | Raises NotImplementedError | Implement or return 404 |
| E2 | Backend /api/stats/headtohead | `src/api/routes/stats.py:91-102` | Returns all zeros | Implement or return UNAVAILABLE |
| E3 | Backend /api/stats/form/{team_id} | `src/api/routes/stats.py:105-113` | Returns all zeros | Implement or return UNAVAILABLE |
| E4 | Backend /api/stats/brier | `src/api/routes/stats.py:116-130` | Returns all zeros | Implement or return UNAVAILABLE |
| E5 | Backend /api/admin/calibration | `src/api/routes/admin.py:127-148` | Returns all zeros | Implement or return UNAVAILABLE |
| E6 | Backend /api/admin/backtest | `src/api/routes/admin.py:151-179` | Returns all zeros | Implement or return UNAVAILABLE |
| E7 | Backend /api/admin/models | `src/api/routes/admin.py:182-193` | Static list, doesn't check saved_models/ | Scan directory |

### F. SECURITY ISSUES

| # | Issue | Location | Severity | Fix |
|---|-------|----------|----------|-----|
| F1 | Database credentials in code AND git history | `config/settings.py:15` | CRITICAL | 1. Rotate Neon DB password immediately. 2. Remove default value. 3. Use `.env` only. 4. `git filter-branch` to purge from history. |
| F2 | Chat mock fallback doesn't validate message | `src/app/api/chat/route.ts:214-222` | LOW | No injection risk (templates ignore input for most paths) but the ELO path uses matchContext data. |

### G. DATA-SOURCE ISSUES

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| G1 | football-data.org is PL-only | `matches-view.tsx:346` | Only Premier League matches available. No multi-league coverage. | Add more competitions or use ESPN for broader coverage |
| G2 | No real xG source for PL matches | System-wide | Dashboard and Matches views can't show real xG. StatsBomb only covers historical tournaments. | Integrate Opta/understat/dataforecast xG (Tier 1 roadmap) |
| G3 | No real attendance source | `matches-view.tsx:217` | Hardcoded "35,421" shown for all matches | Remove or find attendance API |
| G4 | No real possession/shots/corners API for live PL | `matches-view.tsx:258-282` | football-data.org PL endpoint may not return these | Verify API capabilities, remove if unavailable |
| G5 | Seed news with false source attribution | `prisma/seed.ts:45-51` | "source: 'FIFA.com'" may not correspond to a real article | Add `isSeed: true` flag |
| G6 | No H2H data pipeline | `compare-view.tsx:59-67` | Fake H2H data shown | Build H2H query from DB match history |
| G7 | No player images | System-wide | Player view has no photos, no image pipeline | Design asset strategy per directive §11 |
| G8 | No team crests | System-wide | Team colors from ESPN are approximate. No actual crest images. | Fetch crests from football-data.org or trusted CDN |

### H. MODEL / INTELLIGENCE ISSUES

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| H1 | XGBoost trained with fabricated xG features | `scripts/phase2_data_foundation.py:363,381` | Model predictions influenced by fake features. Importance ~2.5/50. | Retrain model excluding xG features (or with real xG) |
| H2 | LSTM FAILED but weight still in config | `config/settings.py:40`, `saved_models/lstm_v1_metadata.json:274` | Not live (dead code path), but confusing. Code cleanup needed. | Remove LSTM from config, add comment about failure |
| H3 | All ensemble weights uncalibrated | `src/engines/ensemble.py:54-61` | No evidence these weights produce optimal ensemble. | Calibrate from cross-validation |
| H4 | All stochastic parameters uncalibrated | `src/engines/stochastic.py:38-66` | GARCH, jump diffusion parameters are defaults. | Run calibration pipeline or disclose |
| H5 | Market signal parameters uncited | `src/engines/market_signals.py:59-315` | No calibration evidence or academic citation. | Calibrate from historical odds movement data |
| H6 | Raw market odds outperform all models | Phase 5 finding | LL 0.959 vs all ELASTICO models. More models not the solution. | Per directive §23: prefer fewer trustworthy sources |
| H7 | No model agreement/disagreement metric | System-wide | Directive §7 requires showing when models disagree. | Compute pairwise model disagreement |
| H8 | No calibration feedback loop | System-wide | Brier score, reliability diagrams are placeholders (E1-E7). | Implement calibration tracking |
| H9 | Confidence thresholds (0.55, 0.42) duplicated | `ensemble.py:566-570`, `stochastic.py:409-414` | Same values in two files, neither calibrated. | Single source of truth + calibration |
| H10 | No uncertainty quantification | System-wide | Directive §7 requires "How confident are we?" | Implement proper uncertainty estimates |

### I. UX / INTERACTION ISSUES

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| I1 | 0/15 dashboard widgets have all 4 states | `dashboard-view.tsx` | LOADING missing on all 15. ERROR missing on all 15. | Add LOADING skeletons + ERROR states |
| I2 | Matches view has no ERROR state | `matches-view.tsx:362` | console.error only. User sees nothing on failure. | Add error toast/banner |
| I3 | Predictions view has no ERROR state | `predictions-view.tsx:92` | Silent catch `/* silent */` | Add error display |
| I4 | News view has no ERROR state | `news-view.tsx:157,179,199` | Silent catches show empty state | Add error message |
| I5 | Compare view has no LOADING or ERROR state | `compare-view.tsx` | No feedback when team data loads or fails | Add loading/error states |
| I6 | Random squad depth on every re-render | `compare-view.tsx:134-137` | Values change each render. Visually jarring and meaningless. | Remove |
| I7 | Bookmark button appears functional but isn't | `matches-view.tsx:122-129` | Violates directive §12 (no dead buttons) | Remove or implement persistence |
| I8 | Reaction buttons appear interactive but aren't | `news-view.tsx:551-586` | Violates directive §12 | Remove |
| I9 | Group/Stage filters never work for PL data | `matches-view.tsx:41,406-446` | Violates directive §12 (no dead UI elements) | Remove for PL |
| I10 | 18 tabs in Tactical view, only 3 have data | `tactical-view.tsx:185-205` | 15 tabs are empty states. Violates directive §17 #12 (AI-generated app test). | Reduce to 3-4 tabs with data, move others behind "More" |