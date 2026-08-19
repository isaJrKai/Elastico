# Phase 6 — Product Truth Audit

**Method**: Sequential forensic audit, one view at a time.  
**Date**: 2026-08-19  
**Quality states used**: REAL / PROXY / DERIVED / MISSING / STALE / UNAVAILABLE / DEMO / FABRICATED

---

## View 1 of 9: DASHBOARD

**File**: `src/components/elastico/dashboard-view.tsx` (709 lines)

### Summary

| Metric | Count |
|--------|-------|
| Total data points audited | 33 |
| REAL | 15 |
| DERIVED | 3 |
| STALE | 5 |
| FABRICATED | 8 |
| MISSING | 1 |
| UNAVAILABLE | 1 |
| Loading states implemented | **0 of 13** |
| Empty states (good) | 3 of 13 |
| Empty states (partial/broken) | 10 of 13 |
| Error states implemented | **0 of 13** |
| Data duplication instances | 2 |

### Fabrication Inventory

| ID | Card | What | How | Severity |
|----|------|------|-----|----------|
| D12 | Next Match Prediction | Confidence = 75 on every submission | Hardcoded `confidence: 75` at line 143 | LOW (hidden from user) |
| D16 | Asian Handicap Lines | Subtitle claims "ELO + Poisson + Dixon-Coles + Stochastic" | Hardcoded text at line 458-459 | HIGH (false model claims) |
| D17 | Asian Handicap Lines | Over 2.5 = 55% for every match | Hardcoded `style={{ width: '55%' }}` at line 477 | **HIGH** (deceptive financial data) |
| D19 | Model Probabilities | Subtitle claims "Ensemble: ELO + Poisson + Dixon-Coles + Stochastic" | Hardcoded text at line 497 | HIGH (false ensemble claims) |
| D20 | Model Probabilities | H/D/A percentages | `hashCode(teamName)` at lines 501-503 | **HIGH** (deterministic hash, not models) |
| D26 | Team Rankings | W/D/L records for unplayed tournament | Seed data at setup/route.ts lines 318-348 | HIGH (fabricated match records) |
| D34 | AI Insight | 3 static tips branded as "AI" | Hardcoded if/else at lines 615-626 | MED (misleading AI branding) |
| D35 | AI Insight | ELASTICO AI / Sparkles icon | Static branding at lines 610-612 | MED (false AI attribution) |
| D38 | Footer (page.tsx) | "Powered by Merton Jump-Diffusion, GARCH, NVIDIA AI" | Hardcoded text at page.tsx:306 | MED (false model claims) |

### Honest Implementations (Gold Standard)

| ID | Card | What | Why It Is Good |
|----|------|------|----------------|
| D24 | xG vs Actual Goals | Empty state: "xG data unavailable for recent matches. This chart only shows real expected-goals data — it never estimates xG from the final score." | Explicit refusal to fabricate. Clear user communication. |
| D10 | Next Match Prediction | When no prediction exists, shows: "No model prediction yet for this match — check back closer to kickoff." | Honest unavailable state. |
| D9 | Next Match Prediction | Venue shows "TBD" when null | Honest missing state. |

### Data Duplication

1. **ESPN live matches appear in 6 cards**: Ticker, Live Scores, Latest Results, Asian Handicap Lines, Model Probabilities, All Matches. Same data, different visual treatments.
2. **Team ELO rankings appear in 2 cards**: "Team Rankings (ELO)" (table, 8 teams) and "ELO Rankings" (compact, 5 teams). Same DB source, same sort.

### Stale Data

All DB-sourced data on the dashboard comes from **seed data** in `setup/route.ts`:
- 16 national teams with hand-picked ELO, xgPerGame, possession, etc. for WC 2026
- 10 WC 2026 group stage matches
- 5 hardcoded news articles about WC 2026

This data is created once during `/api/setup` and never refreshed. The ELO rankings, team records, match probabilities, and news are all frozen at seed time.

### Missing States

**Loading**: Zero loading states across all 13 cards. On first render, all cards appear empty then populate asynchronously. No skeletons, no spinners, no loading text.

**Error**: Zero error states. If ESPN API fails, the ticker silently falls back to DB seed data. If DB is empty, cards show empty headers. No user-facing error messages.

### Visualization Integrity

The LIVE indicator (pinging red dot at line 158-161) renders unconditionally — it pulses even when zero live matches exist. The ticker scroll animation runs regardless of whether `tickerItems` is empty (it duplicates the array `[...tickerItems, ...tickerItems]` so empty × 2 = still empty, but the animation CSS still runs).

### AI Content Attribution

The "AI Insight" card (D34-D35) uses the Sparkles icon and "AI" label but contains 3 hardcoded strings selected by accuracy threshold. No LLM call is made. The card includes an unsourced statistical claim: "favorites with a 150+ ELO advantage win 72% of the time." There is no disclosure that this is not from an AI model and no source attribution for the claim.

---

*Remaining views to audit: Live Match (2/9), Predictions (3/9), Tactical (4/9), Player (5/9), Compare (6/9), AI Analyst (7/9), News (8/9), Settings (9/9)*
