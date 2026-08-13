/**
 * ELASTICO — Recharts Unified Theme
 *
 * All Recharts charts MUST use these props for visual consistency.
 * Import and spread into <XAxis>, <YAxis>, <CartesianGrid>, <Tooltip>, <Legend>.
 */

export const axisProps = {
  tick: { fill: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'var(--font-mono), ui-monospace, monospace' },
  axisLine: { stroke: 'rgba(255,255,255,0.06)' },
  tickLine: false,
} as const

export const cartesianGridProps = {
  stroke: 'rgba(255,255,255,0.04)',
  strokeDasharray: '3 3',
  vertical: false,
} as const

export const tooltipContentStyle = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  fontSize: '12px',
  color: 'var(--foreground)',
  boxShadow: 'var(--depth-1)',
}

export const tooltipLabelStyle = {
  color: 'var(--muted-foreground)',
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
}

export const tooltipWrapperStyle = {
  backgroundColor: 'transparent',
  border: 'none',
}

export const legendProps = {
  wrapperStyle: { fontSize: '11px', color: 'var(--muted-foreground)' },
  iconType: 'circle' as const,
  iconSize: 8,
}

const PALETTE = [
  '#4ADE80', '#60A5FA', '#FBBF24', '#8B5CF6', '#EF4444', '#06B6D4', '#F97316', '#EC4899',
]

/** Get a color from the chart palette by index (wraps around) */
export function chartColor(index: number): string {
  return PALETTE[index % PALETTE.length]
}
