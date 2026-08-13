# ELASTICO DESIGN STATE

> Living document. Every design decision is recorded here.
> Format: DS-XXX | Component/Area | Decision | Rationale

---

## Phase 1: Design System Foundation

DS-001 | Tokens | Single source of truth in `src/lib/design-system.ts` | Avoids magic numbers scattered across 26 views.

DS-002 | Typography | 10-level scale (display → monoSm) using Tailwind utility strings | Consistent hierarchy; tabular-nums for all data.

DS-003 | Spacing | 4px base with 7 named presets (xs→2xl) | Aligns with 4px grid; no arbitrary gap values.

DS-004 | Surfaces | 4-level hierarchy (base → sunken) | Every background has a designated layer.

DS-005 | Asset Sizes | 8 size presets (xs=16px → 3xl=64px) with container/img/radius/text tokens | Crests, headshots, and flags share the same size scale.

DS-006 | Chart Theme | Unified Recharts theme in `src/lib/chart-theme.ts` | No chart looks different from another.

DS-007 | Color Palette | 8 chart colors cycling | Enough for multi-series charts without repetition.

DS-008 | Match Status | 5 states (live/halftime/finished/upcoming/postponed) with color+bg+border+pulse | Every status badge in the app uses the same mapping.

DS-009 | Form Colors | W=emerald, D=amber, L=red | Universal football form convention.

DS-010 | Data Classification | 5 badges: REAL/DERIVED/SIMULATION/DEMO/BUG | Enforces data honesty principle.

---

## Phase 2: Asset System

DS-011 | Asset Resolution | Central `resolveCrest/resolveHeadshot/resolveFlag/resolveLeagueBadge` in `src/lib/assets.ts` | No raw `<img>` for football assets. All go through primitives.

DS-012 | Crest Priority | ESPN logo > TheSportsDB badge > TheSportsDB large badge > generic logo > color circle fallback | ESPN PNGs are most reliable (transparent, correctly sized).

DS-013 | Headshot Priority | TheSportsDB cutout > TheSportsDB thumb > generic URL > position-colored initials circle | Cutouts have transparent backgrounds — best visual.

DS-014 | Flag Source | flagcdn.com (free, no key, ISO 3166-1 alpha-2) | Covers all FIFA nations. 60+ nationality string → ISO code mappings.

DS-015 | League Badges | Hardcoded ESPN URLs for 10 major competitions | ESPN badge URLs are stable and publicly accessible.

DS-016 | Asset Caching | In-memory TTL cache (10min crests/headshots, 1hr flags) | Avoids re-resolving URLs on every render. No external cache needed.

DS-017 | Fallback Design | Crest → colored circle with team code. Headshot → position-colored circle with initials. Flag → ISO code text badge. | Fallbacks are visually consistent and informative, not broken.

DS-018 | Position Colors | GK=amber, DEF=blue, MID=emerald, FWD=red, unknown=slate | Quick visual identification in player lists.

DS-019 | Primitives | 8 components in `src/components/elastico/primitives/` | TeamCrest, PlayerHeadshot, FlagIcon, LeagueBadge, StatBlock, StatusBadge, DataState, SectionHeader.

DS-020 | Image Loading | All images use `loading="lazy"` + `decoding="async"` | Performance baseline for asset-heavy screens.

DS-021 | No Raw `<img>` Rule | Views must use TeamCrest/PlayerHeadshot/FlagIcon primitives | Enforced by convention. Lint rule to be added in Phase 17.

---

## Phase 3: Shell/Navigation Redesign

DS-022 | Workflow Groups | Sidebar organized by football workflow: Intelligence / Analysis / Leagues / Tools / System | User thinks "I need to analyze a match" not "I need the tactical tool".

DS-023 | Intelligence Group | Dashboard, Live Matches, Match Analysis — the core match-day workflow | These 3 views are the primary daily use case.

DS-024 | Analysis Group | Tactical, Players, Compare, Predictions, Pred. Engine — deep-dive tools | Secondary workflow: detailed analysis after initial intelligence.

DS-025 | Leagues Group | Standings, Leaderboard — competition context | Separated from intelligence because it's reference, not action.

DS-026 | Tools Group | AI Chat, News, Export — utilities | Not core workflow, but frequently needed.

DS-027 | System Group | Settings, Notifications, Subscription, Admin, System Monitor | App management. Admin-only items filtered by user role.

DS-028 | Header Minimalism | Removed zoom controls and plan badge from header. Kept: title, live indicator, search, notifications, theme, user menu. | Header should be a thin context bar, not a control panel. Zoom moved to Settings.

DS-029 | "Match Analysis" Label | `match-detail` view now called "Match Analysis" in header and sidebar | Descriptive, not generic. Tells the user what they'll find.

DS-030 | "Standings" Label | `tournament` view now called "Standings" everywhere | Matches user expectation. "Tournament" was misleading for league tables.

DS-031 | Removed Nav Items | Achievements and Social removed from sidebar (marked "Soon", no existence justification) | Rule: each component must justify its existence. Can return when built.

DS-032 | Active Indicator | 3px left bar in sidebar-primary color, unchanged | Works well. No change needed.

DS-033 | Keyboard Shortcuts | ⌘T now opens Tactical (was Standings). ⌘S opens Standings. | Matches new workflow grouping.
