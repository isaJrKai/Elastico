/*
 * TeamCrest — The ONLY way to render a team badge in ELASTICO.
 *
 * Rules:
 *   - Never render raw <img> for team logos elsewhere
 *   - Always use this component — it handles resolution, caching, fallback
 *   - If the image fails to load, it gracefully falls back to a colored circle
 *
 * Usage:
 *   <TeamCrest code="MCI" espnLogo={team.logo} color="#6CABDD" size="md" />
 *   <TeamCrest code="ARS" tsdBadge={team.strBadge} size="lg" />
 */

'use client'

import React, { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { ASSET_SIZE, type AssetSizeKey } from '@/lib/design-system'
import { resolveCrest, handleAssetError } from '@/lib/assets'

// ── Props ──────────────────────────────────────────────────────────────

export interface TeamCrestProps {
  /** Team abbreviation — used for fallback text and cache key (e.g. "ARS") */
  code: string
  /** ESPN logo URL (highest priority) */
  espnLogo?: string | null
  /** TheSportsDB badge URL */
  tsdBadge?: string | null
  /** TheSportsDB large badge URL */
  tsdBadgeLg?: string | null
  /** Generic logo URL field */
  logo?: string | null
  /** Team primary color — used for fallback circle background */
  color?: string | null
  /** Size preset from ASSET_SIZE */
  size?: AssetSizeKey
  /** Additional CSS classes on the outer container */
  className?: string
  /** Accessible label (defaults to code) */
  alt?: string
  /** Show border ring around the crest */
  bordered?: boolean
}

// ── Component ──────────────────────────────────────────────────────────

export const TeamCrest = React.memo(function TeamCrest({
  code,
  espnLogo,
  tsdBadge,
  tsdBadgeLg,
  logo,
  color,
  size = 'md',
  className,
  alt,
  bordered = false,
}: TeamCrestProps) {
  const [errored, setErrored] = useState(false)

  const resolved = resolveCrest({ espnLogo, tsdBadge, tsdBadgeLg, logo }, code, color)
  const s = ASSET_SIZE[size]

  const handleError = useCallback(() => {
    if (!errored) {
      setErrored(true)
      const key = `${code}_${espnLogo || ''}_${tsdBadge || ''}`
      handleAssetError('crest', key)
    }
  }, [code, espnLogo, tsdBadge, errored])

  // Fallback: colored circle with team initials
  if (errored || !resolved.url) {
    return (
      <div
        className={cn(
          'shrink-0 flex items-center justify-center font-bold text-white select-none',
          s.container,
          s.radius,
          bordered && 'border-2 border-border/40',
          className,
        )}
        style={{ backgroundColor: resolved.fallbackColor }}
        aria-label={alt || code || undefined}
        role="img"
      >
        <span className={cn('leading-none', s.text)}>
          {resolved.fallbackText}
        </span>
      </div>
    )
  }

  // Image mode
  return (
    <div
      className={cn(
        'shrink-0 bg-muted/20 flex items-center justify-center overflow-hidden',
        s.container,
        s.radius,
        bordered && 'border-2 border-border/40',
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolved.url}
        alt={alt || code || undefined}
        className={cn('object-contain', s.img)}
        loading="lazy"
        onError={handleError}
        decoding="async"
      />
    </div>
  )
})

export default TeamCrest
