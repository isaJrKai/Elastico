# ELASTICO — Page Mapping Table

## Visual Reference → Existing Architecture

| Reference Panel | Concept | Existing View Component | Data Source | Action |
|---|---|---|---|---|
| 01 — Dashboard | Command Center | `dashboard-view.tsx` | Zustand store (matches, teams, news, live) + APIs | Redesign |
| 02 — Live Match | Real-Time Match Workspace | `match-detail-view.tsx` | ESPN live API + DB | Redesign |
| 03 — Player Profile | Player Intelligence Dossier | `player-view.tsx` | /api/players | Redesign |
| 04 — Match Analysis | Post-Match Deep Dive | `match-detail-view.tsx` | DB + prediction engine | Enhance |
| 05 — Player Comparison | Head-to-Head Analysis | `compare-view.tsx` | Zustand store (teams) | Redesign |
| 06 — Predictions | Forecast Engine | `predictions-view.tsx` | /api/predictions + prediction-engine | Redesign |
| 07 — AI Assistant | Conversational Intelligence | `chat-view.tsx` | AI Gateway (7 providers) | Redesign |
| 08 — Analytics | Aggregate Metrics | (no dedicated page — predictions + admin) | /api/* aggregate | Create |
| 09 — Settings | Configuration | `settings-view.tsx` | Local state + /api/* | Improve |

## Visual Design Language (from reference)

- Background: #000000 to #0f172a (deep charcoal)
- Cards: Elevated dark surfaces (#1a1f2e) with 1px borders
- Primary accent: #00e676 (neon green)
- Typography: Inter/system-ui, 11-12px tracking labels, 16-18px body
- Display numbers: 48-56px bold monospaced
- Spacing: 8px base unit, 24px card gutters, 16px internal padding
- Color semantics: Green=positive, Red=negative, Blue=neutral, Yellow/Amber=caution
- No glassmorphism abuse
- No decorative emojis
- Strong information hierarchy

## Design Principles

1. ONE football intelligence environment, not 9 disconnected dashboards
2. Truth before beauty — real data only
3. Spatial, architectural composition (Zaha Hadid thinking)
4. Responsive at 320-1920px
5. Zero unintentional overflow
