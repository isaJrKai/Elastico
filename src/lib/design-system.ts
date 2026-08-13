/**
 * ELASTICO Design System Tokens
 *
 * Two-layer architecture:
 *   Layer 1 — shadcn CSS variables (background, foreground, primary, etc.)
 *   Layer 2 — ELASTICO domain tokens (surface, state, el-text, etc.)
 *
 * This file is the single source of truth for all non-CSS-variable tokens.
 * CSS variables live in globals.css / tailwind.config.ts.
 */

// ── Typography Scale ──────────────────────────────────────────────────────

export const TYPE = {
  display:  'text-4xl font-black tracking-tighter leading-none',     // 36px hero
  h1:       'text-2xl font-bold tracking-tight',                     // 24px section title
  h2:       'text-lg font-semibold tracking-tight',                  // 18px subsection
  h3:       'text-base font-semibold',                               // 16px card title
  body:     'text-sm',                                               // 14px default
  bodySm:   'text-xs',                                               // 12px compact
  caption:  'text-[11px]',                                           // 11px labels
  micro:    'text-[10px]',                                           // 10px tiny data
  mono:     'font-mono tabular-nums',                                // numeric alignment
  monoSm:   'text-[11px] font-mono tabular-nums',                   // small mono
} as const

// ── Spacing (4px base) ───────────────────────────────────────────────────

export const SPACE = {
  xs:  'gap-1',     // 4px
  sm:  'gap-2',     // 8px
  md:  'gap-3',     // 12px
  lg:  'gap-4',     // 16px
  xl:  'gap-6',     // 24px
  '2xl':'gap-8',    // 32px
} as const

// ── Surface hierarchy ────────────────────────────────────────────────────

export const SURFACE = {
  base:    'bg-background',
  raised:  'bg-card',
  overlay: 'bg-card/80 backdrop-blur-sm',
  sunken:  'bg-muted/50',
} as const

// ── Asset Sizes ──────────────────────────────────────────────────────────

export const ASSET_SIZE = {
  /** 16px — inline table rows, dense lists */
  xs: { container: 'size-4',  img: 'size-3',  radius: 'rounded-sm',  text: 'text-[8px]' },
  /** 20px — compact match rows, ticker */
  sm: { container: 'size-5',  img: 'size-4',  radius: 'rounded',    text: 'text-[9px]' },
  /** 24px — standard match cards, form indicators */
  md: { container: 'size-6',  img: 'size-5',  radius: 'rounded-md', text: 'text-[10px]' },
  /** 32px — match detail, list items with names */
  lg: { container: 'size-8',  img: 'size-6',  radius: 'rounded-lg', text: 'text-xs' },
  /** 40px — player list items, team selectors */
  xl: { container: 'size-10', img: 'size-8',  radius: 'rounded-xl', text: 'text-sm' },
  /** 48px — featured player cards, hero sections */
  '2xl':{ container: 'size-12', img: 'size-10', radius: 'rounded-xl', text: 'text-sm' },
  /** 64px — large hero, profile headers */
  '3xl':{ container: 'size-16', img: 'size-14', radius: 'rounded-2xl', text: 'text-base' },
} as const

export type AssetSizeKey = keyof typeof ASSET_SIZE

// ── Chart Colors ─────────────────────────────────────────────────────────

export const CHART_COLORS = [
  '#4ADE80',  // emerald
  '#60A5FA',  // blue
  '#FBBF24',  // amber
  '#8B5CF6',  // violet
  '#EF4444',  // red
  '#06B6D4',  // cyan
  '#F97316',  // orange
  '#EC4899',  // pink
] as const

// ── Match Status Colors ──────────────────────────────────────────────────

export const MATCH_STATUS = {
  live:      { label: 'LIVE',     color: 'text-red-400',       bg: 'bg-red-500/15',     border: 'border-red-500/30',     pulse: true },
  halftime:  { label: 'HT',       color: 'text-yellow-400',   bg: 'bg-yellow-500/15',  border: 'border-yellow-500/30',  pulse: false },
  finished:  { label: 'FT',       color: 'text-muted-foreground', bg: 'bg-muted',       border: 'border-border',       pulse: false },
  upcoming:  { label: 'Upcoming', color: 'text-primary',      bg: 'bg-primary/15',    border: 'border-primary/30',    pulse: false },
  postponed: { label: 'PPD',      color: 'text-orange-400',   bg: 'bg-orange-500/15',  border: 'border-orange-500/30',  pulse: false },
} as const

// ── Form Colors ──────────────────────────────────────────────────────────

export const FORM_COLORS = {
  W: 'text-emerald-400',
  D: 'text-amber-400',
  L: 'text-red-400',
} as const

// ── Recharts Defaults ────────────────────────────────────────────────────

export const RECHARTS_DEFAULTS = {
  fontSize: 11,
  fontFamily: 'var(--font-mono), ui-monospace, monospace',
}
