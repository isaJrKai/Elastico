/*
 * LeagueBadge — Renders a competition/league badge.
 *
 * Uses hardcoded ESPN league badge URLs for major competitions.
 * Falls back to a text badge with the league code.
 *
 * Usage:
 *   <LeagueBadge code="PL" name="Premier League" size="sm" />
 *   <LeagueBadge code="UCL" size="md" showLabel />
 */

'use client'

import React, { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { resolveLeagueBadge } from '@/lib/assets'

// ── Props ──────────────────────────────────────────────────────────────

export interface LeagueBadgeProps {
  /** League code (e.g. "PL", "UCL") */
  code?: string | null
  /** League full name */
  name?: string
  /** Image height in pixels */
  size?: 16 | 20 | 24 | 32
  /** Show the league name next to the badge */
  showLabel?: boolean
  /** Additional CSS classes */
  className?: string
}

// ── Size map ───────────────────────────────────────────────────────────

const SIZE_CLASS: Record<number, string> = {
  16: 'h-4',
  20: 'h-5',
  24: 'h-6',
  32: 'h-8',
}

// ── Component ──────────────────────────────────────────────────────────

export const LeagueBadge = React.memo(function LeagueBadge({
  code,
  name,
  size = 20,
  showLabel = false,
  className,
}: LeagueBadgeProps) {
  const [errored, setErrored] = useState(false)

  const resolved = resolveLeagueBadge(code, name)
  const h = SIZE_CLASS[size] || 'h-5'

  const handleError = useCallback(() => {
    if (!errored) setErrored(true)
  }, [errored])

  // Fallback: text badge with league code
  if (errored || !resolved.url) {
    return (
      <span className={cn('inline-flex items-center gap-1.5', className)}>
        <span
          className={cn(
            'shrink-0 inline-flex items-center justify-center rounded bg-muted/60 text-[9px] font-bold text-muted-foreground uppercase tracking-wider px-1.5',
            h,
          )}
          aria-label={resolved.label}
          role="img"
        >
          {resolved.label.slice(0, 3)}
        </span>
        {showLabel && resolved.label && (
          <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">{resolved.label}</span>
        )}
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolved.url}
        alt={resolved.label}
        className={cn('shrink-0 object-contain', h, 'w-auto')}
        loading="lazy"
        onError={handleError}
        decoding="async"
      />
      {showLabel && resolved.label && (
        <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">{resolved.label}</span>
      )}
    </span>
  )
})

export default LeagueBadge
