'use client'

import React, { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useElasticoStore } from '@/store/use-elastico-store'
import { TYPE } from '@/lib/design-system'
import { axisProps, cartesianGridProps, tooltipContentStyle, tooltipLabelStyle, legendProps, chartColor } from '@/lib/chart-theme'
import { TeamCrest, PlayerHeadshot, StatBlock, StatBlockProps, SectionHeader, DataState, StatusBadge } from '@/components/elastico/primitives'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Crosshair, Swords, Zap, Shield, Target } from 'lucide-react'

// ── Formation Position Map ─────────────────────────────────────────────
// Normalized 0–100 pitch coordinates for common formations
// Each entry: [x, y] where x=0 is own goal, x=100 is opponent goal

const FORMATIONS: Record<string, { label: string; positions: { x: number; y: number; role: string }[] }> = {
  '4-4-2': {
    label: '4-4-2',
    positions: [
      { x: 5, y: 50, role: 'GK' },
      { x: 20, y: 15, role: 'RB' }, { x: 18, y: 38, role: 'CB' }, { x: 18, y: 62, role: 'CB' }, { x: 20, y: 85, role: 'LB' },
      { x: 38, y: 15, role: 'RM' }, { x: 35, y: 38, role: 'CM' }, { x: 35, y: 62, role: 'CM' }, { x: 38, y: 85, role: 'LM' },
      { x: 48, y: 35, role: 'ST' }, { x: 48, y: 65, role: 'ST' },
    ],
  },
  '4-3-3': {
    label: '4-3-3',
    positions: [
      { x: 5, y: 50, role: 'GK' },
      { x: 20, y: 15, role: 'RB' }, { x: 18, y: 38, role: 'CB' }, { x: 18, y: 62, role: 'CB' }, { x: 20, y: 85, role: 'LB' },
      { x: 35, y: 30, role: 'CM' }, { x: 32, y: 50, role: 'CDM' }, { x: 35, y: 70, role: 'CM' },
      { x: 48, y: 15, role: 'RW' }, { x: 46, y: 50, role: 'ST' }, { x: 48, y: 85, role: 'LW' },
    ],
  },
  '4-2-3-1': {
    label: '4-2-3-1',
    positions: [
      { x: 5, y: 50, role: 'GK' },
      { x: 20, y: 15, role: 'RB' }, { x: 18, y: 38, role: 'CB' }, { x: 18, y: 62, role: 'CB' }, { x: 20, y: 85, role: 'LB' },
      { x: 32, y: 38, role: 'CDM' }, { x: 32, y: 62, role: 'CDM' },
      { x: 44, y: 18, role: 'RAM' }, { x: 42, y: 50, role: 'CAM' }, { x: 44, y: 82, role: 'LAM' },
      { x: 50, y: 50, role: 'ST' },
    ],
  },
  '3-5-2': {
    label: '3-5-2',
    positions: [
      { x: 5, y: 50, role: 'GK' },
      { x: 18, y: 25, role: 'CB' }, { x: 16, y: 50, role: 'CB' }, { x: 18, y: 75, role: 'CB' },
      { x: 35, y: 10, role: 'RWB' }, { x: 34, y: 32, role: 'CM' }, { x: 32, y: 50, role: 'CDM' }, { x: 34, y: 68, role: 'CM' }, { x: 35, y: 90, role: 'LWB' },
      { x: 48, y: 35, role: 'ST' }, { x: 48, y: 65, role: 'ST' },
    ],
  },
  '4-1-4-1': {
    label: '4-1-4-1',
    positions: [
      { x: 5, y: 50, role: 'GK' },
      { x: 20, y: 15, role: 'RB' }, { x: 18, y: 38, role: 'CB' }, { x: 18, y: 62, role: 'CB' }, { x: 20, y: 85, role: 'LB' },
      { x: 30, y: 50, role: 'CDM' },
      { x: 42, y: 15, role: 'RM' }, { x: 40, y: 38, role: 'CM' }, { x: 40, y: 62, role: 'CM' }, { x: 42, y: 85, role: 'LM' },
      { x: 52, y: 50, role: 'ST' },
    ],
  },
}

// ── Tactical Radar Dimensions ───────────────────────────────────────────

const RADAR_DIMS = [
  { key: 'attack', label: 'Attack' },
  { key: 'midfield', label: 'Midfield' },
  { key: 'defense', label: 'Defense' },
  { key: 'pressing', label: 'Pressing' },
  { key: 'possession', label: 'Possession' },
  { key: 'setPiece', label: 'Set Piece' },
]

// ── Derived Tactical Profiles ───────────────────────────────────────────
// Generates tactical dimensions from real team metrics where available.
// Dimensions without real data are set to null (NOT fabricated).
// The function name uses 'derived' to reflect that these are computed, not measured.

function deriveTacticalProfile(team: { style: string | null; xgPerGame: number | null; xgaPerGame: number | null; possession: number | null; pressIntensity: number | null; passAccuracy: number | null }) {
  // Only compute a dimension if the underlying data actually exists.
  // xG-based attack: requires real xgPerGame
  const attack = team.xgPerGame != null ? Math.min(95, Math.max(20, team.xgPerGame * 25)) : null
  // Defense: inverse of xGA — requires real xgaPerGame
  const defense = team.xgaPerGame != null ? Math.min(95, Math.max(20, 100 - team.xgaPerGame * 30)) : null
  // Midfield: weighted from possession + pass accuracy — both must exist
  const midfield = (team.possession != null && team.passAccuracy != null)
    ? Math.min(95, Math.max(20, team.possession * 0.7 + team.passAccuracy * 0.2))
    : null
  // Pressing: requires pressIntensity data
  const pressing = team.pressIntensity != null && team.pressIntensity > 0
    ? Math.min(95, Math.max(20, team.pressIntensity))
    : null
  // Possession: requires possession data
  const possession = team.possession != null ? Math.min(95, Math.max(20, team.possession)) : null
  // Set piece: no reliable data source — always null
  const setPiece = null as null

  return { attack, midfield, defense, pressing, possession, setPiece }
}

// ── Pitch Component ─────────────────────────────────────────────────────

function FormationPitch({
  formation,
  teamColor,
  mirror,
  players,
}: {
  formation: string
  teamColor: string
  mirror?: boolean
  players?: { name: string; number: number; position: string }[]
}) {
  const fmt = FORMATIONS[formation]
  if (!fmt) return null

  return (
    <div className="relative w-full aspect-[3/4] rounded-lg border border-border/60 overflow-hidden bg-emerald-950/30">
      {/* Pitch markings */}
      <div className="absolute inset-2 border border-white/10 rounded-sm" />
      <div className="absolute top-1/2 left-2 right-2 border-t border-white/10" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-24 rounded-full border border-white/10" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-1 rounded-full bg-white/20" />
      {/* Penalty areas */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[40%] h-[16%] border border-white/10 border-t-0 rounded-b-md" />
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[40%] h-[16%] border border-white/10 border-b-0 rounded-t-md" />
      {/* Goal areas */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[20%] h-[8%] border border-white/10 border-t-0" />
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[20%] h-[8%] border border-white/10 border-b-0" />

      {/* Player dots */}
      {fmt.positions.map((pos, i) => {
        const x = mirror ? 100 - pos.x : pos.x
        const y = pos.y
        const player = players?.[i]
        return (
          <div
            key={i}
            className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 group"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <div
              className="size-5 rounded-full border-2 border-white/40 shadow-md flex items-center justify-center transition-transform hover:scale-125"
              style={{ backgroundColor: teamColor }}
            >
              <span className="text-[8px] font-bold text-white leading-none">
                {player?.number || (i === 0 ? '1' : '')}
              </span>
            </div>
            {player && (
              <span className="text-[8px] text-white/70 mt-0.5 whitespace-nowrap font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                {player.name}
              </span>
            )}
            {!player && (
              <span className="text-[8px] text-white/40 mt-0.5 font-mono">
                {pos.role}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main View ───────────────────────────────────────────────────────────

export function TacticalView() {
  const { teams, matches, selectedMatchId } = useElasticoStore()

  const [homeTeamId, setHomeTeamId] = useState<string>('')
  const [awayTeamId, setAwayTeamId] = useState<string>('')
  const [homeFormation, setHomeFormation] = useState('4-3-3')
  const [awayFormation, setAwayFormation] = useState('4-3-3')

  // Resolve teams
  const homeTeam = useMemo(() => teams.find((t) => t.id === homeTeamId), [teams, homeTeamId])
  const awayTeam = useMemo(() => teams.find((t) => t.id === awayTeamId), [teams, awayTeamId])

  // Pre-select from a selected match
  // NOTE: selectedMatchId may be prefixed (fd:, espn:), so also match by externalId
  React.useEffect(() => {
    if (selectedMatchId && matches.length > 0) {
      const rawId = selectedMatchId.replace(/^(fd|espn|api-sports):/, '')
      const m = matches.find(
        (match) => match.id === selectedMatchId || match.id === rawId || match.externalId === rawId,
      )
      if (m) {
        setHomeTeamId(m.homeTeamId)
        setAwayTeamId(m.awayTeamId)
      }
    }
  }, [selectedMatchId, matches])

  // Auto-select first two teams if none selected
  React.useEffect(() => {
    if (!homeTeamId && teams.length >= 2) {
      setHomeTeamId(teams[0].id)
      setAwayTeamId(teams[1].id)
    }
  }, [teams, homeTeamId])

  // Generate tactical profiles
  const homeProfile = useMemo(
    () => homeTeam ? deriveTacticalProfile(homeTeam) : null,
    [homeTeam],
  )
  const awayProfile = useMemo(
    () => awayTeam ? deriveTacticalProfile(awayTeam) : null,
    [awayTeam],
  )

  // Radar chart data
  // Count how many dimensions have real data for both teams
  const dataAvailability = useMemo(() => {
    if (!homeProfile || !awayProfile) return 0
    let count = 0
    for (const dim of RADAR_DIMS) {
      const hVal = homeProfile[dim.key as keyof typeof homeProfile]
      const aVal = awayProfile[dim.key as keyof typeof awayProfile]
      if (hVal != null && aVal != null) count++
    }
    return count
  }, [homeProfile, awayProfile])

  const radarData = useMemo(() => {
    if (!homeProfile || !awayProfile) return []
    return RADAR_DIMS.map((dim) => {
      const hVal = homeProfile[dim.key as keyof typeof homeProfile]
      const aVal = awayProfile[dim.key as keyof typeof awayProfile]
      return {
        dimension: dim.label,
        [homeTeam!.code]: hVal != null ? Math.round(hVal * 10) / 10 : null,
        [awayTeam!.code]: aVal != null ? Math.round(aVal * 10) / 10 : null,
        hasData: hVal != null && aVal != null,
      }
    })
  }, [homeProfile, awayProfile, homeTeam, awayTeam])

  // Style comparison bar chart
  const styleData = useMemo(() => {
    if (!homeTeam || !awayTeam) return []
    return [
      { metric: 'xG/Game', [homeTeam.code]: homeTeam.xgPerGame ?? null, [awayTeam.code]: awayTeam.xgPerGame ?? null, dataClass: homeTeam.xgTruthClass || 'MISSING' },
      { metric: 'xGA/Game', [homeTeam.code]: homeTeam.xgaPerGame ?? null, [awayTeam.code]: awayTeam.xgaPerGame ?? null, dataClass: homeTeam.xgTruthClass || 'MISSING' },
      { metric: 'Poss %', [homeTeam.code]: homeTeam.possession, [awayTeam.code]: awayTeam.possession, dataClass: (homeTeam.possession != null && awayTeam.possession != null) ? 'REAL' as const : 'MISSING' as const },
      { metric: 'Pass Acc', [homeTeam.code]: homeTeam.passAccuracy, [awayTeam.code]: awayTeam.passAccuracy, dataClass: (homeTeam.passAccuracy != null && awayTeam.passAccuracy != null) ? 'REAL' as const : 'MISSING' as const },
      { metric: 'Press', [homeTeam.code]: homeTeam.pressIntensity, [awayTeam.code]: awayTeam.pressIntensity, dataClass: (homeTeam.pressIntensity != null && homeTeam.pressIntensity > 0) ? 'DERIVED' as const : 'MISSING' as const },
    ]
  }, [homeTeam, awayTeam])

  // Key players (top from each team by rating)
  const homeKeyPlayers = useMemo(() => {
    if (!homeTeam?.players) return []
    return [...homeTeam.players].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 5)
  }, [homeTeam])

  const awayKeyPlayers = useMemo(() => {
    if (!awayTeam?.players) return []
    return [...awayTeam.players].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 5)
  }, [awayTeam])

  const hasBothTeams = homeTeam && awayTeam
  const hasData = hasBothTeams && homeProfile && awayProfile

  // ── Empty state ──
  if (teams.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-4 lg:p-6 max-w-7xl mx-auto w-full">
        <DataState
          type="empty"
          message="No teams loaded. Fetch teams from the database to analyze tactics."
          actionLabel="Fetch Teams"
          actionOnClick={() => useElasticoStore.getState().fetchTeams()}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6 max-w-7xl mx-auto w-full">
      {/* ── Team Selector Bar ── */}
      <Card className="border-border/60">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Home team */}
            <div className="flex items-center gap-2 flex-1 min-w-[160px]">
              {homeTeam && (
                <TeamCrest code={homeTeam.code} espnLogo={homeTeam.logo} color={homeTeam.primaryColor} size="lg" />
              )}
              <Select value={homeTeamId} onValueChange={setHomeTeamId}>
                <SelectTrigger className="h-8 w-full text-xs" size="sm">
                  <SelectValue placeholder="Home team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Swords className="size-4 text-muted-foreground shrink-0" />

            {/* Away team */}
            <div className="flex items-center gap-2 flex-1 min-w-[160px]">
              <Select value={awayTeamId} onValueChange={setAwayTeamId}>
                <SelectTrigger className="h-8 w-full text-xs" size="sm">
                  <SelectValue placeholder="Away team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {awayTeam && (
                <TeamCrest code={awayTeam.code} espnLogo={awayTeam.logo} color={awayTeam.primaryColor} size="lg" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Main Content ── */}
      {!hasData ? (
        <DataState
          type="empty"
          message="Select two teams to compare tactical profiles."
        />
      ) : (
        <Tabs defaultValue="formations" className="w-full">
          <TabsList className="h-8">
            <TabsTrigger value="formations" className="text-xs gap-1.5 h-7 px-3">
              <Crosshair className="size-3" />
              Formations
            </TabsTrigger>
            <TabsTrigger value="radar" className="text-xs gap-1.5 h-7 px-3">
              <Target className="size-3" />
              Radar
            </TabsTrigger>
            <TabsTrigger value="style" className="text-xs gap-1.5 h-7 px-3">
              <Zap className="size-3" />
              Style
            </TabsTrigger>
            <TabsTrigger value="players" className="text-xs gap-1.5 h-7 px-3">
              <Shield className="size-3" />
              Key Players
            </TabsTrigger>
          </TabsList>

          {/* ── FORMATIONS TAB ── */}
          <TabsContent value="formations">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
              {/* Home Formation */}
              <Card className="border-border/60">
                <CardContent className="p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TeamCrest code={homeTeam!.code} espnLogo={homeTeam!.logo} color={homeTeam!.primaryColor} size="md" />
                      <span className={TYPE.h3}>{homeTeam!.name}</span>
                    </div>
                    <Select value={homeFormation} onValueChange={setHomeFormation}>
                      <SelectTrigger className="h-7 w-24 text-xs" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(FORMATIONS).map((f) => (
                          <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <FormationPitch
                    formation={homeFormation}
                    teamColor={homeTeam!.primaryColor}
                    players={homeKeyPlayers.map((p) => ({ name: p.name, number: p.number, position: p.position }))}
                  />
                  <div className="flex items-center justify-between">
                    <span className={TYPE.caption}>Style: {homeTeam!.style || 'Tactical style unavailable'}</span>
                    <StatusBadge variant="dataclass" value={homeTeam!.style ? 'DERIVED' : 'MISSING'} />
                  </div>
                </CardContent>
              </Card>

              {/* Away Formation (mirrored) */}
              <Card className="border-border/60">
                <CardContent className="p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TeamCrest code={awayTeam!.code} espnLogo={awayTeam!.logo} color={awayTeam!.primaryColor} size="md" />
                      <span className={TYPE.h3}>{awayTeam!.name}</span>
                    </div>
                    <Select value={awayFormation} onValueChange={setAwayFormation}>
                      <SelectTrigger className="h-7 w-24 text-xs" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(FORMATIONS).map((f) => (
                          <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <FormationPitch
                    formation={awayFormation}
                    teamColor={awayTeam!.primaryColor}
                    mirror
                    players={awayKeyPlayers.map((p) => ({ name: p.name, number: p.number, position: p.position }))}
                  />
                  <div className="flex items-center justify-between">
                    <span className={TYPE.caption}>Style: {awayTeam!.style || 'Tactical style unavailable'}</span>
                    <StatusBadge variant="dataclass" value={awayTeam!.style ? 'DERIVED' : 'MISSING'} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick stat comparison row */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <StatBlock
                label="Home xG/Game"
                value={homeTeam!.xgPerGame != null ? homeTeam!.xgPerGame.toFixed(2) : 'N/A'}
                dataClass={(homeTeam!.xgTruthClass as 'MISSING' | 'DERIVED' | 'REAL' | 'PROXY' | 'STALE' | 'UNAVAILABLE' | undefined) || 'MISSING'}
                compact
                className="p-3 rounded-lg bg-card border border-border/60"
              />
              <StatBlock
                label="Away xG/Game"
                value={awayTeam!.xgPerGame != null ? awayTeam!.xgPerGame.toFixed(2) : 'N/A'}
                dataClass={(awayTeam!.xgTruthClass as 'MISSING' | 'DERIVED' | 'REAL' | 'PROXY' | 'STALE' | 'UNAVAILABLE' | undefined) || 'MISSING'}
                compact
                className="p-3 rounded-lg bg-card border border-border/60"
              />
              <StatBlock
                label="Possession Gap"
                value={homeTeam!.possession != null && awayTeam!.possession != null ? `${Math.abs(homeTeam!.possession - awayTeam!.possession).toFixed(0)}%` : 'N/A'}
                sublabel={homeTeam!.possession != null && awayTeam!.possession != null ? (homeTeam!.possession > awayTeam!.possession ? homeTeam!.code : awayTeam!.possession > homeTeam!.possession ? awayTeam!.code : 'Even') : '—'}
                dataClass={homeTeam!.possession != null && awayTeam!.possession != null ? 'DERIVED' : 'MISSING'}
                compact
                className="p-3 rounded-lg bg-card border border-border/60"
              />
            </div>
          </TabsContent>

          {/* ── RADAR TAB ── */}
          <TabsContent value="radar">
            <Card className="border-border/60 mt-3">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <SectionHeader label="Tactical Radar Comparison" />
                  <StatusBadge variant="dataclass" value={dataAvailability >= 4 ? 'DERIVED' : dataAvailability > 0 ? 'PARTIAL' : 'MISSING'} />
                </div>
                {dataAvailability === 0 ? (
                  <DataState type="empty" message="Insufficient real data for tactical radar. Requires xG, possession, passing, and pressing data from database." />
                ) : (
                <div className="w-full mx-auto" style={{ maxWidth: 480 }}>
                  <ResponsiveContainer width="100%" aspect={1}>
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                      <PolarGrid stroke="rgba(255,255,255,0.06)" />
                      <PolarAngleAxis
                        dataKey="dimension"
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                      />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tick={false}
                        axisLine={false}
                      />
                      <Radar
                        name={homeTeam!.code}
                        dataKey={homeTeam!.code}
                        stroke={chartColor(0)}
                        fill={chartColor(0)}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                      <Radar
                        name={awayTeam!.code}
                        dataKey={awayTeam!.code}
                        stroke={chartColor(1)}
                        fill={chartColor(1)}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                      <Legend {...legendProps} />
                      <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} wrapperStyle={{ backgroundColor: 'transparent', border: 'none' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                )}

                {/* Radar dimension breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
                  {RADAR_DIMS.map((dim, i) => {
                    const hVal = homeProfile![dim.key as keyof typeof homeProfile]
                    const aVal = awayProfile![dim.key as keyof typeof awayProfile]
                    const hasData = hVal != null && aVal != null
                    const winner = hasData ? (hVal! > aVal! ? 'home' : aVal! > hVal! ? 'away' : 'tie') : null
                    return (
                      <div key={dim.key} className="flex flex-col gap-1 p-2 rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between">
                          <span className={TYPE.caption}>{dim.label}</span>
                          <StatusBadge variant="dataclass" value={hasData ? 'DERIVED' : 'MISSING'} />
                        </div>
                        <div className="flex items-baseline gap-1">
                          {hasData ? (
                            <>
                              <span className={cn('text-sm font-bold tabular-nums', winner === 'home' ? 'text-emerald-400' : 'text-muted-foreground')}>
                                {Math.round(hVal!)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">vs</span>
                              <span className={cn('text-sm font-bold tabular-nums', winner === 'away' ? 'text-emerald-400' : 'text-muted-foreground')}>
                                {Math.round(aVal!)}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">N/A</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── STYLE TAB ── */}
          <TabsContent value="style">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
              {/* Style comparison bar chart */}
              <Card className="border-border/60 lg:col-span-2">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <SectionHeader label="Playing Style Metrics" />
                    <StatusBadge variant="dataclass" value="MIXED" />
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={styleData} barGap={4} barCategoryGap="20%">
                      <CartesianGrid {...cartesianGridProps} />
                      <XAxis dataKey="metric" {...axisProps} />
                      <YAxis {...axisProps} domain={[0, 'auto']} />
                      <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} wrapperStyle={{ backgroundColor: 'transparent', border: 'none' }} />
                      <Legend {...legendProps} />
                      <Bar dataKey={homeTeam!.code} fill={chartColor(0)} radius={[3, 3, 0, 0]} maxBarSize={32} />
                      <Bar dataKey={awayTeam!.code} fill={chartColor(1)} radius={[3, 3, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Stat cards for each team */}
              <Card className="border-border/60">
                <CardContent className="p-4 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <TeamCrest code={homeTeam!.code} espnLogo={homeTeam!.logo} color={homeTeam!.primaryColor} size="md" />
                    <span className={TYPE.h3}>{homeTeam!.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <StatBlock label="xG/Game" value={homeTeam!.xgPerGame != null ? homeTeam!.xgPerGame.toFixed(2) : '--'} dataClass={(homeTeam!.xgTruthClass || 'MISSING') as StatBlockProps['dataClass']} compact />
                    <StatBlock label="xGA/Game" value={homeTeam!.xgaPerGame != null ? homeTeam!.xgaPerGame.toFixed(2) : '--'} dataClass={(homeTeam!.xgTruthClass || 'MISSING') as StatBlockProps['dataClass']} compact />
                    <StatBlock label="Possession" value={homeTeam!.possession != null ? `${homeTeam!.possession}%` : 'N/A'} dataClass={homeTeam!.possession != null ? 'REAL' : 'MISSING'} compact />
                    <StatBlock label="Pass Acc" value={homeTeam!.passAccuracy != null ? `${homeTeam!.passAccuracy}%` : 'N/A'} dataClass={homeTeam!.passAccuracy != null ? 'REAL' : 'MISSING'} compact />
                    <StatBlock label="Press Int." value={homeTeam!.pressIntensity != null && homeTeam!.pressIntensity > 0 ? homeTeam!.pressIntensity.toFixed(0) : 'N/A'} dataClass={homeTeam!.pressIntensity != null && homeTeam!.pressIntensity > 0 ? 'DERIVED' : 'MISSING'} compact />
                    <StatBlock label="Form" value={homeTeam!.form || 'N/A'} dataClass={homeTeam!.form ? 'REAL' : 'MISSING'} compact />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardContent className="p-4 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <TeamCrest code={awayTeam!.code} espnLogo={awayTeam!.logo} color={awayTeam!.primaryColor} size="md" />
                    <span className={TYPE.h3}>{awayTeam!.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <StatBlock label="xG/Game" value={awayTeam!.xgPerGame != null ? awayTeam!.xgPerGame.toFixed(2) : '--'} dataClass={(awayTeam!.xgTruthClass || 'MISSING') as StatBlockProps['dataClass']} compact />
                    <StatBlock label="xGA/Game" value={awayTeam!.xgaPerGame != null ? awayTeam!.xgaPerGame.toFixed(2) : '--'} dataClass={(awayTeam!.xgTruthClass || 'MISSING') as StatBlockProps['dataClass']} compact />
                    <StatBlock label="Possession" value={awayTeam!.possession != null ? `${awayTeam!.possession}%` : 'N/A'} dataClass={awayTeam!.possession != null ? 'REAL' : 'MISSING'} compact />
                    <StatBlock label="Pass Acc" value={awayTeam!.passAccuracy != null ? `${awayTeam!.passAccuracy}%` : 'N/A'} dataClass={awayTeam!.passAccuracy != null ? 'REAL' : 'MISSING'} compact />
                    <StatBlock label="Press Int." value={awayTeam!.pressIntensity != null && awayTeam!.pressIntensity > 0 ? awayTeam!.pressIntensity.toFixed(0) : 'N/A'} dataClass={awayTeam!.pressIntensity != null && awayTeam!.pressIntensity > 0 ? 'DERIVED' : 'MISSING'} compact />
                    <StatBlock label="Form" value={awayTeam!.form || 'N/A'} dataClass={awayTeam!.form ? 'REAL' : 'MISSING'} compact />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── KEY PLAYERS TAB ── */}
          <TabsContent value="players">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
              {/* Home key players */}
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TeamCrest code={homeTeam!.code} espnLogo={homeTeam!.logo} color={homeTeam!.primaryColor} size="md" />
                    <SectionHeader label={`Key Players — ${homeTeam!.name}`} />
                  </div>
                  {homeKeyPlayers.length === 0 ? (
                    <DataState type="empty" message="No player data available for this team." />
                  ) : (
                    <div className="flex flex-col gap-2">
                      {homeKeyPlayers.map((player, i) => (
                        <button
                          key={player.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors w-full text-left"
                          onClick={() => useElasticoStore.getState().setView('players')}
                        >
                          <span className="text-xs font-bold tabular-nums w-4 text-center text-muted-foreground">{i + 1}</span>
                          <PlayerHeadshot name={player.name} position={player.position} size="lg" />
                          <div className="flex-1 min-w-0">
                            <p className={TYPE.body + ' font-medium truncate'}>{player.name}</p>
                            <p className={TYPE.caption}>{player.position}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col items-end gap-0.5">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground">G</span>
                                <span className="text-sm font-bold tabular-nums">{player.goals}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground">A</span>
                                <span className="text-sm font-bold tabular-nums">{player.assists}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-0.5">
                              <span className={cn(
                                'text-sm font-bold tabular-nums',
                                player.rating != null && player.rating >= 7 ? 'text-emerald-400' : player.rating != null && player.rating >= 6 ? 'text-amber-400' : 'text-muted-foreground',
                              )}>
                                {player.rating != null ? player.rating.toFixed(1) : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Away key players */}
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TeamCrest code={awayTeam!.code} espnLogo={awayTeam!.logo} color={awayTeam!.primaryColor} size="md" />
                    <SectionHeader label={`Key Players — ${awayTeam!.name}`} />
                  </div>
                  {awayKeyPlayers.length === 0 ? (
                    <DataState type="empty" message="No player data available for this team." />
                  ) : (
                    <div className="flex flex-col gap-2">
                      {awayKeyPlayers.map((player, i) => (
                        <button
                          key={player.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors w-full text-left"
                          onClick={() => useElasticoStore.getState().setView('players')}
                        >
                          <span className="text-xs font-bold tabular-nums w-4 text-center text-muted-foreground">{i + 1}</span>
                          <PlayerHeadshot name={player.name} position={player.position} size="lg" />
                          <div className="flex-1 min-w-0">
                            <p className={TYPE.body + ' font-medium truncate'}>{player.name}</p>
                            <p className={TYPE.caption}>{player.position}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col items-end gap-0.5">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground">G</span>
                                <span className="text-sm font-bold tabular-nums">{player.goals}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground">A</span>
                                <span className="text-sm font-bold tabular-nums">{player.assists}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-0.5">
                              <span className={cn(
                                'text-sm font-bold tabular-nums',
                                player.rating != null && player.rating >= 7 ? 'text-emerald-400' : player.rating != null && player.rating >= 6 ? 'text-amber-400' : 'text-muted-foreground',
                              )}>
                                {player.rating != null ? player.rating.toFixed(1) : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Combined xG impact chart */}
            {homeKeyPlayers.length > 0 && awayKeyPlayers.length > 0 && (
              <Card className="border-border/60 mt-4">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <SectionHeader label="Goal Contribution Comparison" />
                    <StatusBadge variant="dataclass" value="DERIVED" />
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={[
                        ...homeKeyPlayers.slice(0, 4).map((p) => ({ name: p.name.split(' ').pop() || p.name, Goals: p.goals, Assists: p.assists, team: homeTeam!.code })),
                        { name: '—', Goals: 0, Assists: 0, team: '' },
                        ...awayKeyPlayers.slice(0, 4).map((p) => ({ name: p.name.split(' ').pop() || p.name, Goals: p.goals, Assists: p.assists, team: awayTeam!.code })),
                      ]}
                      barGap={2} barCategoryGap="16%"
                    >
                      <CartesianGrid {...cartesianGridProps} />
                      <XAxis dataKey="name" {...axisProps} />
                      <YAxis {...axisProps} />
                      <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} wrapperStyle={{ backgroundColor: 'transparent', border: 'none' }} />
                      <Legend {...legendProps} />
                      <Bar dataKey="Goals" fill={chartColor(0)} radius={[3, 3, 0, 0]} maxBarSize={24} />
                      <Bar dataKey="Assists" fill={chartColor(4)} radius={[3, 3, 0, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

export default TacticalView
