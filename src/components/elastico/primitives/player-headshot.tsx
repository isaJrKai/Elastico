/*
 * PlayerHeadshot — The ONLY way to render a player image in ELASTICO.
 *
 * Rules:
 *   - Never render raw <img> for player photos elsewhere
 *   - Falls back to an initials circle with position-based color
 *
 * Usage:
 *   <PlayerHeadshot name="De Bruyne" tsdCutout={player.strCutout} position="MID" size="lg" />
 */

'use client'

import React, { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { ASSET_SIZE, type AssetSizeKey } from '@/lib/design-system'
import { resolveHeadshot, handleAssetError } from '@/lib/assets'

// ── Position → Color mapping for fallback circles ─────────────────────

const POSITION_COLORS: Record<string, string> = {
  GK:  '#F59E0B', // amber — goalkeeper
  DEF: '#3B82F6', // blue — defenders
  MID: '#10B981', // emerald — midfielders
  FWD: '#EF4444', // red — forwards
}

function getPositionColor(position?: string | null): string {
  if (!position) return '#64748B' // slate — unknown
  const upper = position.toUpperCase()
  if (upper.includes('GK') || upper === 'GOALKEEPER') return POSITION_COLORS.GK
  if (upper.includes('DEF') || upper === 'DEFENDER' || ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(upper)) return POSITION_COLORS.DEF
  if (upper.includes('MID') || upper === 'MIDFIELDER' || ['CM', 'CDM', 'CAM', 'LM', 'RM', 'AM'].includes(upper)) return POSITION_COLORS.MID
  if (upper.includes('FWD') || upper === 'FORWARD' || ['ST', 'CF', 'LW', 'RW'].includes(upper)) return POSITION_COLORS.FWD
  return '#64748B'
}

// ── Props ──────────────────────────────────────────────────────────────

export interface PlayerHeadshotProps {
  /** Player full name — used for initials fallback and cache key */
  name: string
  /** TheSportsDB cutout URL (transparent background) */
  tsdCutout?: string | null
  /** TheSportsDB thumb URL */
  tsdThumb?: string | null
  /** Generic headshot URL */
  headshotUrl?: string | null
  /** Player position — determines fallback circle color */
  position?: string | null
  /** Size preset from ASSET_SIZE */
  size?: AssetSizeKey
  /** Additional CSS classes on the outer container */
  className?: string
  /** Accessible label */
  alt?: string
  /** Show border ring */
  bordered?: boolean
}

// ── Component ──────────────────────────────────────────────────────────

export const PlayerHeadshot = React.memo(function PlayerHeadshot({
  name,
  tsdCutout,
  tsdThumb,
  headshotUrl,
  position,
  size = 'lg',
  className,
  alt,
  bordered = false,
}: PlayerHeadshotProps) {
  const [errored, setErrored] = useState(false)

  const resolved = resolveHeadshot(
    { tsdCutout, tsdThumb, espnHeadshot: headshotUrl },
    name,
  )
  const s = ASSET_SIZE[size]
  const posColor = getPositionColor(position)

  const handleError = useCallback(() => {
    if (!errored) {
      setErrored(true)
      const key = `${name}_${tsdCutout || ''}`
      handleAssetError('headshot', key)
    }
  }, [name, tsdCutout, errored])

  // Fallback: position-colored circle with initials
  if (errored || !resolved.url) {
    return (
      <div
        className={cn(
          'shrink-0 flex items-center justify-center font-semibold text-white select-none',
          s.container,
          s.radius,
          bordered && 'border-2 border-border/40',
          className,
        )}
        style={{ backgroundColor: posColor }}
        aria-label={alt || name || undefined}
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
        alt={alt || name || undefined}
        className={cn('object-cover', size === 'xs' || size === 'sm' ? s.container : s.img)}
        loading="lazy"
        onError={handleError}
        decoding="async"
      />
    </div>
  )
})

export default PlayerHeadshot
