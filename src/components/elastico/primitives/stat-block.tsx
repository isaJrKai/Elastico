/*
 * StatBlock — Core metric display primitive for ELASTICO.
 *
 * Every number in the system must declare its data source.
 * This component enforces that discipline.
 */

'use client'

import React from 'react'
import { cn } from '@/lib/utils'

// ── Props ──────────────────────────────────────────────────────────────

export interface StatBlockProps {
  /** Metric label (e.g. "xG", "Possession") */
  label: string
  /** Primary value */
  value: string | number
  /** Secondary detail below the value */
  sublabel?: string | null
  /** Delta indicator */
  delta?: {
    direction: 'up' | 'down' | 'flat'
    value: string
  }
  /** Semantic color intent */
  intent?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'intel' | 'brand'
  /** Data classification badge */
  dataClass?: 'REAL' | 'DERIVED' | 'SIMULATION' | 'DEMO' | 'BUG'
  /** Compact mode — hides sublabel, tighter spacing */
  compact?: boolean
  className?: string
}

// ── Intent colors ──────────────────────────────────────────────────────

const INTENT_COLORS: Record<string, string> = {
  default: 'text-foreground',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  danger:  'text-red-400',
  info:    'text-blue-400',
  intel:   'text-cyan-400',
  brand:   'text-primary',
}

const DELTA_COLORS = {
  up:   'text-emerald-400',
  down: 'text-red-400',
  flat: 'text-muted-foreground',
}

// ── Component ──────────────────────────────────────────────────────────

export function StatBlock({
  label,
  value,
  sublabel,
  delta,
  intent = 'default',
  dataClass,
  compact = false,
  className,
}: StatBlockProps) {
  return (
    <div className={cn('flex flex-col', compact ? 'gap-0.5' : 'gap-1', className)}>
      {/* Label */}
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>

      {/* Value + Delta */}
      <div className="flex items-baseline gap-1.5">
        <span className={cn(
          'text-2xl font-black tabular-nums leading-none',
          INTENT_COLORS[intent],
        )}>
          {value}
        </span>
        {delta && (
          <span className={cn('text-xs font-medium tabular-nums', DELTA_COLORS[delta.direction])}>
            {delta.direction === 'up' ? '↑' : delta.direction === 'down' ? '↓' : '→'}
            {delta.value}
          </span>
        )}
      </div>

      {/* Sublabel */}
      {!compact && sublabel && (
        <span className="text-[11px] text-muted-foreground">{sublabel}</span>
      )}

      {/* Data classification badge */}
      {dataClass && (
        <span className={cn('data-class-badge', dataClass, 'self-start mt-0.5')}>
          {dataClass}
        </span>
      )}
    </div>
  )
}

export default StatBlock
