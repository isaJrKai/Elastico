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
