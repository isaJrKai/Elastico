/*
 * ELASTICO Primitives — barrel export
 *
 * These are the ONLY components for rendering football assets.
 * All views must import from here, never use raw <img> for crests/headshots.
 */

export { TeamCrest, type TeamCrestProps } from './team-crest'
export { PlayerHeadshot, type PlayerHeadshotProps } from './player-headshot'
export { FlagIcon, type FlagIconProps } from './flag-icon'
export { LeagueBadge, type LeagueBadgeProps } from './league-badge'
export { StatBlock, type StatBlockProps } from './stat-block'
export { StatusBadge, type StatusBadgeProps } from './status-badge'
export { DataState, type DataStateProps } from './data-state'
export { SectionHeader, type SectionHeaderProps } from './section-header'
