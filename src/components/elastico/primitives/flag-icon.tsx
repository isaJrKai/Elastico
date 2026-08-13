/*
 * FlagIcon — Renders a country flag from a nationality string.
 *
 * Uses flagcdn.com (free, no key needed).
 * Falls back to a 2-letter ISO code badge if flag unavailable.
 *
 * Usage:
 *   <FlagIcon nationality="Brazil" size="sm" />
 *   <FlagIcon nationality="English" size="xs" showLabel />
 */

'use client'

import React, { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { resolveFlag, handleAssetError } from '@/lib/assets'

// ── Props ──────────────────────────────────────────────────────────────

export interface FlagIconProps {
  /** Nationality string (e.g. "English", "Brazil", "FR") */
  nationality?: string | null
  /** Image width in pixels */
  size?: 16 | 20 | 24 | 32
  /** Show the nationality text label next to the flag */
  showLabel?: boolean
  /** Additional CSS classes */
  className?: string
}

// ── Size map ───────────────────────────────────────────────────────────

const SIZE_CLASS: Record<number, string> = {
  16: 'h-3',
  20: 'h-4',
  24: 'h-5',
  32: 'h-6',
}

// ── Component ──────────────────────────────────────────────────────────

export const FlagIcon = React.memo(function FlagIcon({
  nationality,
  size = 20,
  showLabel = false,
  className,
}: FlagIconProps) {
  const [errored, setErrored] = useState(false)

  const resolved = resolveFlag(nationality)
  const key = `flag_${(nationality || '').toLowerCase()}`

  const handleError = useCallback(() => {
    if (!errored) {
      setErrored(true)
      handleAssetError('flag', key)
    }
  }, [key, errored])

  const h = SIZE_CLASS[size] || 'h-4'

  if (errored || !resolved.url) {
    // Fallback: ISO code badge
    if (resolved.isoCode) {
      return (
        <span className={cn('inline-flex items-center gap-1', className)}>
          <span
            className={cn(
              'shrink-0 inline-flex items-center justify-center rounded-[2px] bg-muted/60 text-[9px] font-bold text-muted-foreground uppercase px-1',
              h,
            )}
            aria-label={resolved.label}
            role="img"
          >
            {resolved.isoCode.replace('gb-', '').slice(0, 2)}
          </span>
          {showLabel && resolved.label && (
            <span className="text-[11px] text-muted-foreground">{resolved.label}</span>
          )}
        </span>
      )
    }
    // No data at all
    return null
  }

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolved.url}
        alt={resolved.label}
        className={cn('shrink-0 rounded-[2px] object-cover', h, 'w-auto')}
        style={{ width: `${Math.round(size * 1.5)}px` }}
        loading="lazy"
        onError={handleError}
        decoding="async"
      />
      {showLabel && resolved.label && (
        <span className="text-[11px] text-muted-foreground">{resolved.label}</span>
      )}
    </span>
  )
})

export default FlagIcon
