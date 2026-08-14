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

DS-031 | Complete Nav Coverage | All 22 views mapped in sidebar. Achievements → System group. Social → Tools group. Profile maps to Settings view. | No orphaned views. Every view reachable from sidebar.

DS-032 | Active Indicator | 3px left bar in sidebar-primary color, unchanged | Works well. No change needed.

DS-033 | Keyboard Shortcuts | ⌘T now opens Tactical (was Standings). ⌘S opens Standings. | Matches new workflow grouping.

DS-034 | Command Palette Completeness | All 19 navigable views now in command palette (was 12). Grouped by workflow when no query. | Users should be able to reach any view from ⌘K.

DS-035 | Command Palette Grouping | When no search query, items grouped under Intelligence/Analysis/Leagues/Tools/System/Admin headers | Mirrors sidebar structure for spatial consistency.

DS-036 | Match Analysis in Palette | `match-detail` added to command palette under Intelligence group | Was only reachable by clicking a match. Now searchable.

DS-037 | Typed Palette Icons | Command palette icons use `React.ElementType` instead of `any` | Type safety for icon components.

DS-038 | Shell Layout Stability | Shell layout (sidebar + header + main + footer) preserved. No structural changes. | The layout works. Phase 3 scope was navigation completeness and consistency, not architecture redesign.

DS-038b | Sidebar Grid Alignment | Expanded=256px (64×4px), Collapsed=60px (15×4px), Header=56px (14×4px). All sidebar sizes from SIDEBAR token object. | Every dimension is a multiple of 4px.

DS-038c | Header Grid Alignment | Height=48px (12×4px). Action icons=18px. KBD uses monoSm pattern (10px mono). | Consistent with 4px grid and TYPE scale.

DS-038d | Footer Data Credits | Footer shows data sources: ESPN · TheSportsDB · flagcdn. Model names abbreviated (Merton J-D). | Data honesty: users see where data comes from.

DS-038e | View Title Completeness | Header viewTitles map covers all 22 views including achievements and social. | No 'ELASTICO' fallback title for any registered view.

---

## Phase 4: Dashboard Rebuild

DS-039 | No Raw `<img>` on Dashboard | All 12+ raw `<img>` tags replaced with `TeamCrest` primitive | Enforces DS-011/DS-021. Fallbacks are now automatic.

DS-040 | Chart Theme Compliance | BarChart now uses `axisProps`, `cartesianGridProps`, `tooltipContentStyle`, `chartColor()` from `chart-theme.ts` | Enforces DS-006. No more hardcoded oklch colors.

DS-041 | Data Classification on Dashboard | Quick Stats row: Live Now=REAL, Upcoming=REAL, Accuracy=DERIVED, Streak=REAL. Standings=ESPN REAL badge. | Enforces DS-010 data honesty principle.

DS-042 | No Placeholder Cards | Removed "Market Analysis" and "Prediction Models" empty cards. Every pixel earns its place. | Dashboard must be information-dense at 1366x768.

DS-043 | Single Standings Fetch | Removed duplicate standings (full table + compact list). Only compact top-5 remains in right sidebar. Full table lives in Standings view. | One ESPN API call instead of two.

DS-044 | Primitives Used | Dashboard now uses TeamCrest, StatBlock, StatusBadge, SectionHeader from primitives/ | Consistency with DS-019.

DS-045 | Match Rows Clickable | Live scores and results are buttons that navigate to Match Analysis view | Dashboard is an entry point, not a dead end.

DS-046 | Compact Ticker | Ticker uses TeamCrest sm + StatusBadge instead of raw images and inline badges | Same visual density, proper component usage.

DS-046b | Latest Results DB Fallback | Latest Results now renders DB matches as clickable rows when no ESPN finished matches exist | No dead-end "No recent results" when DB has data.

DS-046c | Goals Chart Data Class | Goals per Match chart now shows REAL or DEMO badge based on data source | Extends DS-010 to chart sections.

DS-046d | Streak Card Removed | Redundant streak card (right column) removed — data already in Quick Stats row | Reduces right-column height to fit 768px. Every pixel earns its place (DS-042).

DS-046e | Results Rows Interactive | Both ESPN and DB result rows are now clickable buttons navigating to Match Analysis | Consistent with DS-045.

---

## Phase 5: Live Matches Rebuild

DS-047 | TeamCrest in Match Cards | Replaced custom TeamLogo (raw `<img>`) with TeamCrest lg in match cards | Consistent fallback behavior across all views.

DS-048 | StatusBadge in Match Cards | Replaced getStatusConfig() with StatusBadge primitive | Single source of truth for status display.

DS-049 | Clickable Match Cards | Match card team+score area is now a button that navigates to Match Analysis | Matches view is an entry point, not a dead end.

DS-050 | ESPN Data Class | Added `REAL` data-class badge next to match count | Honors data honesty principle.

DS-051 | No Redundant Heading | Removed the h1 'Matches' title from the view — header already shows 'Live Matches' | DS-028 header minimalism.

---
