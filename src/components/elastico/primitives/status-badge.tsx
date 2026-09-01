/*
 * StatusBadge — Unified status indicator for matches, form, confidence, data class.
 *
 * This is the ONLY badge component for status-like information in ELASTICO.
 */

'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { MATCH_STATUS } from '@/lib/design-system'

// ── Props ──────────────────────────────────────────────────────────────

export interface StatusBadgeProps {
  variant: 'status' | 'form' | 'confidence' | 'dataclass' | 'custom'
  /** For variant=status: match status key. For variant=form: W/D/L. For variant=confidence: high/medium/low */
  value: string
  /** For variant=custom: override the display text */
  label?: string
  /** Minute display (e.g. "67'") — only for status variant */
  minute?: number | null
  className?: string
}

// ── Form colors ────────────────────────────────────────────────────────

const FORM_STYLES: Record<string, string> = {
  W: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  D: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  L: 'bg-red-500/15 text-red-400 border-red-500/30',
}

// ── Confidence styles ─────────────────────────────────────────────────

const CONFIDENCE_STYLES: Record<string, string> = {
  high:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  low:    'bg-red-500/15 text-red-400 border-red-500/30',
}

// ── Component ──────────────────────────────────────────────────────────

export function StatusBadge({ variant, value, label, minute, className }: StatusBadgeProps) {
  if (variant === 'status') {
    const cfg = MATCH_STATUS[value as keyof typeof MATCH_STATUS]
    const displayLabel = label || cfg?.label || value.toUpperCase()
    const isLive = value === 'live' || value === 'halftime'

    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 h-5 rounded-md px-1.5 text-[10px] font-bold tracking-wider border',
          cfg?.bg, cfg?.color, cfg?.border,
          className,
        )}
      >
        {isLive && cfg?.pulse && (
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full rounded-full bg-red-400 opacity-60 animate-pulse" />
            <span className="relative inline-flex size-1.5 rounded-full bg-red-500" />
          </span>
        )}
        {displayLabel}
        {minute != null && minute > 0 && (
          <span className="ml-0.5 text-[9px] opacity-70">{minute}'</span>
        )}
      </span>
    )
  }

  if (variant === 'form') {
    const cls = FORM_STYLES[value.toUpperCase()] || 'bg-muted text-muted-foreground border-border'
    return (
      <span className={cn('inline-flex items-center justify-center size-5 rounded text-[10px] font-bold border', cls, className)}>
        {label || value}
      </span>
    )
  }

  if (variant === 'confidence') {
    const cls = CONFIDENCE_STYLES[value.toLowerCase()] || 'bg-muted text-muted-foreground border-border'
    const displayLabel = label || value.charAt(0).toUpperCase() + value.slice(1)
    return (
      <span className={cn('inline-flex items-center h-5 rounded-md px-1.5 text-[10px] font-semibold border', cls, className)}>
        {displayLabel}
      </span>
    )
  }

  if (variant === 'dataclass') {
    return (
      <span className={cn('data-class-badge', value.toUpperCase(), className)}>
        {label || value}
      </span>
    )
  }

  // Custom variant
  return (
    <span className={cn('inline-flex items-center h-5 rounded-md px-1.5 text-[10px] font-semibold bg-muted text-muted-foreground border border-border', className)}>
      {label || value}
    </span>
  )
}

export default StatusBadge
