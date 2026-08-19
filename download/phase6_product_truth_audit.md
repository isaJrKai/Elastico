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
| 1 | Dashboard | **COMPLETE** | 10 | 2026-08-19 |
| 2 | Live Match | PENDING | — | — |
| 3 | Predictions | PENDING | — | — |
| 4 | Tactical | PENDING | — | — |
| 5 | Player | PENDING | — | — |
| 6 | Compare | PENDING | — | — |
| 7 | AI Analyst | PENDING | — | — |
| 8 | News | PENDING | — | — |
| 9 | Settings | PENDING | — | — |

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
| Category badges (line 627) | PROXY | Derived from `n.category`. When news is from seed, the categories are hand-assigned labels, not from any external taxonomy. |

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

| State | Count | Data Points |
|-------|-------|-------------|
| REAL | 15 | ESPN scores/status/competition, DB user stats (accuracy/total/correct/streak/bestStreak), DB xG values, honest empty states, navigation targets |
| PROXY | 5 | ESPN team colors, seed match probabilities (ELO-derived from fabricated inputs), seed team colors, seed news categories, seed news source attributions |
| DERIVED | 2 | xG chart filtering (real xG > 0), accuracy ring SVG calculation |
| FABRICATED | 10 | (1) hashCode "Model Probabilities" widget 6, (2) hashCode card title/subtitle claiming ensemble, (3) Asian Handicap 55% hardcoded widget 5, (4) Asian Handicap subtitle claiming model output, (5) Quick Predict confidence: 75, (6) "AI Insight" label + static strings widget 15, (7) "72% of the time" fabricated statistic widget 15, (8) Seed team ELO values presented as current widgets 7+10, (9) ELO Rankings sort order widget 7 [reclassified from DERIVED per propagation rule], (10) Team Rankings ELO sort order widget 10 [reclassified from DERIVED per propagation rule] |
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

*End of Dashboard audit. Awaiting user confirmation before proceeding to View 2: Live Match.*