'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  GitCompareArrows,
  Trophy,
  BarChart3,
  ArrowRight,
  AlertCircle,
  Loader2,
  Inbox,
  CheckCircle2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useElasticoStore, type Team } from '@/store/use-elastico-store'
import { cn } from '@/lib/utils'
import { TeamCrest } from '@/components/elastico/primitives/team-crest'
import { StatusBadge } from '@/components/elastico/primitives/status-badge'

// ── State type ─────────────────────────────────────────────────────────────────

type ViewState = 'loading' | 'empty' | 'error' | 'success'

// ── CompareView ────────────────────────────────────────────────────────────────

export default function CompareView() {
  const teams = useElasticoStore(s => s.teams)
  const [homeTeamId, setHomeTeamId] = useState<string>('')
  const [awayTeamId, setAwayTeamId] = useState<string>('')
  const [state, setState] = useState<ViewState>(teams.length === 0 ? 'loading' : 'empty')

  // Transition to success/empty when teams load
  const viewState = useMemo<ViewState>(() => {
    if (teams.length === 0) return 'loading'
    if (!homeTeam || !awayTeam) return 'empty'
    return 'success'
  }, [teams, homeTeamId, awayTeamId])

  const homeTeam = useMemo(() => teams.find(t => t.id === homeTeamId), [teams, homeTeamId])
  const awayTeam = useMemo(() => teams.find(t => t.id === awayTeamId), [teams, awayTeamId])

  // Real stat comparisons — only from DB-synced data
  const statComparisons = useMemo(() => {
    if (!homeTeam || !awayTeam) return []
    const homeMatches = homeTeam.wins + homeTeam.draws + homeTeam.losses
    const awayMatches = awayTeam.wins + awayTeam.draws + awayTeam.losses
    return [
      { label: 'ELO Rating', home: homeTeam.eloRating ?? 1500, away: awayTeam.eloRating ?? 1500, higher: 'higher' as const },
      { label: 'xG per Game', home: homeTeam.xgPerGame ?? 0, away: awayTeam.xgPerGame ?? 0, higher: 'higher' as const },
      { label: 'xGA per Game', home: homeTeam.xgaPerGame ?? 0, away: awayTeam.xgaPerGame ?? 0, higher: 'lower' as const },
      { label: 'Possession %', home: homeTeam.possession ?? 50, away: awayTeam.possession ?? 50, higher: 'higher' as const },
      { label: 'Pass Accuracy %', home: homeTeam.passAccuracy ?? 0, away: awayTeam.passAccuracy ?? 0, higher: 'higher' as const },
      { label: 'Press Intensity', home: homeTeam.pressIntensity ?? 0, away: awayTeam.pressIntensity ?? 0, higher: 'higher' as const },
      { label: 'Goals For', home: homeTeam.goalsFor ?? 0, away: awayTeam.goalsFor ?? 0, higher: 'higher' as const },
      { label: 'Goals Against', home: homeTeam.goalsAgainst ?? 0, away: awayTeam.goalsAgainst ?? 0, higher: 'lower' as const },
      { label: 'Wins', home: homeTeam.wins, away: awayTeam.wins, higher: 'higher' as const },
      { label: 'Draws', home: homeTeam.draws, away: awayTeam.draws, higher: 'neutral' as const },
      { label: 'Losses', home: homeTeam.losses, away: awayTeam.losses, higher: 'lower' as const },
      { label: 'GD', home: homeTeam.goalsFor - homeTeam.goalsAgainst, away: awayTeam.goalsFor - awayTeam.goalsAgainst, higher: 'higher' as const },
      { label: 'Avg Goals/Game', home: homeMatches > 0 ? +(homeTeam.goalsFor / homeMatches).toFixed(2) : 0, away: awayMatches > 0 ? +(awayTeam.goalsFor / awayMatches).toFixed(2) : 0, higher: 'higher' as const },
      { label: 'Win Rate %', home: homeMatches > 0 ? +((homeTeam.wins / homeMatches) * 100).toFixed(1) : 0, away: awayMatches > 0 ? +((awayTeam.wins / awayMatches) * 100).toFixed(1) : 0, higher: 'higher' as const },
    ]
  }, [homeTeam, awayTeam])

  // Only show form if real form data exists
  const homeForm = useMemo(() => {
    if (!homeTeam?.form) return []
    try {
      const parsed = JSON.parse(homeTeam.form) as string[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
      return []
    } catch { return [] }
  }, [homeTeam])

  const awayForm = useMemo(() => {
    if (!awayTeam?.form) return []
    try {
      const parsed = JSON.parse(awayTeam.form) as string[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
      return []
    } catch { return [] }
  }, [awayTeam])

  // Real player matchups — only when both teams have player data
  const playerMatchups = useMemo(() => {
    if (!homeTeam?.players?.length || !awayTeam?.players?.length) return null
    const positions = ['GK', 'CB', 'CM', 'ST']
    const matchups: { homePlayer: { name: string; position: string }; awayPlayer: { name: string; position: string } }[] = []
    for (const pos of positions) {
 const hp = homeTeam.players.find(p => p.position === pos)
      const ap = awayTeam.players.find(p => p.position === pos)
      if (hp && ap) {
        matchups.push({ homePlayer: { name: hp.name, position: hp.position }, awayPlayer: { name: ap.name, position: ap.position } })
      }
    }
    return matchups.length > 0 ? matchups : null
  }, [homeTeam, awayTeam])

  const getFormBadge = (r: string) => {
    if (r === 'W' || r === 'D' || r === 'L') return <StatusBadge variant="form" value={r} />
    return <StatusBadge variant="custom" value="-" />
  }

  // ── LOADING STATE ───────────────────────────────────────────────────────
  if (viewState === 'loading') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <p className="text-muted-foreground text-sm">Compare two teams across all metrics</p>
        </div>
        <Card className="glass-card-premium card-hover-lift rounded-xl">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading team data...</p>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // ── EMPTY STATE ─────────────────────────────────────────────────────────
  if (viewState === 'empty') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <p className="text-muted-foreground text-sm">Compare two teams across all metrics</p>
        </div>

        {/* Team Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Home Team</label>
            <Select value={homeTeamId} onValueChange={setHomeTeamId}>
              <SelectTrigger className="glass-card-premium rounded-xl">
                <SelectValue placeholder="Select team..." />
              </SelectTrigger>
              <SelectContent>
                {teams.filter(t => t.id !== awayTeamId).map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
              <GitCompareArrows className="size-5 text-primary" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Away Team</label>
            <Select value={awayTeamId} onValueChange={setAwayTeamId}>
              <SelectTrigger className="glass-card-premium rounded-xl">
                <SelectValue placeholder="Select team..." />
              </SelectTrigger>
              <SelectContent>
                {teams.filter(t => t.id !== homeTeamId).map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="glass-card-premium card-hover-lift rounded-xl">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Inbox className="size-12 opacity-30" />
            <p className="text-sm">Select two teams above to start comparing</p>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // ── ERROR STATE ─────────────────────────────────────────────────────────
  if (viewState === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <p className="text-muted-foreground text-sm">Compare two teams across all metrics</p>
        </div>
        <Card className="glass-card-premium card-hover-lift rounded-xl">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertCircle className="size-12 text-red-400" />
            <p className="text-sm text-muted-foreground">Failed to load team data</p>
            <Button variant="outline" size="sm" className="mt-2 border-border text-xs" onClick={() => setState('loading')}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // ── SUCCESS STATE ───────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <p className="text-muted-foreground text-sm">Compare two teams across all metrics</p>
      </div>

      {/* Team Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Home Team</label>
          <Select value={homeTeamId} onValueChange={setHomeTeamId}>
            <SelectTrigger className="glass-card-premium rounded-xl">
              <SelectValue placeholder="Select team..." />
            </SelectTrigger>
            <SelectContent>
              {teams.filter(t => t.id !== awayTeamId).map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
            <GitCompareArrows className="size-5 text-primary" />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Away Team</label>
          <Select value={awayTeamId} onValueChange={setAwayTeamId}>
            <SelectTrigger className="glass-card-premium rounded-xl">
              <SelectValue placeholder="Select team..." />
            </SelectTrigger>
            <SelectContent>
              {teams.filter(t => t.id !== homeTeamId).map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Team Headers */}
      <div className="grid grid-cols-3 gap-4 items-center">
        <div className="flex items-center gap-3 justify-end">
          <div className="text-right">
            <p className="text-sm font-semibold text-primary">{homeTeam!.name}</p>
            <p className="text-xs text-muted-foreground">ELO {homeTeam!.eloRating ?? 1500}</p>
          </div>
          <TeamCrest code={homeTeam!.code} espnLogo={homeTeam!.logo} color={homeTeam!.primaryColor} size="xl" />
        </div>
        <div className="flex items-center justify-center">
          <Badge variant="outline" className="text-xs border-border">VS</Badge>
        </div>
        <div className="flex items-center gap-3">
          <TeamCrest code={awayTeam!.code} espnLogo={awayTeam!.logo} color={awayTeam!.primaryColor} size="xl" />
          <div>
            <p className="text-sm font-semibold text-orange-400">{awayTeam!.name}</p>
            <p className="text-xs text-muted-foreground">ELO {awayTeam!.eloRating ?? 1500}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Form Comparison — only if real form data exists */}
        {homeForm.length > 0 || awayForm.length > 0 ? (
          <Card className="glass-card-premium card-hover-lift rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Recent Form
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-primary">{homeTeam!.name}</span>
                <div className="flex gap-1">
                  {homeForm.length > 0
                    ? homeForm.slice(0, 5).map((r, i) => <span key={i}>{getFormBadge(r)}</span>)
                    : <span className="text-xs text-muted-foreground">No form data</span>}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-orange-400">{awayTeam!.name}</span>
                <div className="flex gap-1">
                  {awayForm.length > 0
                    ? awayForm.slice(0, 5).map((r, i) => <span key={i}>{getFormBadge(r)}</span>)
                    : <span className="text-xs text-muted-foreground">No form data</span>}
                </div>
              </div>
              <div className="pt-2 border-t border-border/50 text-center">
                <span className="text-xs text-muted-foreground">W=Win D=Draw L=Loss</span>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Stat Comparison Bars */}
        <Card className="glass-card-premium card-hover-lift rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" /> Stat Comparison
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto pr-1">
            <div className="space-y-2.5">
              {statComparisons.map((stat) => {
                const total = Math.max(stat.home + stat.away, 0.01)
                const homePct = Math.round((stat.home / total) * 100)
                const homeWins = stat.higher === 'higher' ? stat.home > stat.away : stat.higher === 'lower' ? stat.home < stat.away : true
                return (
                  <div key={stat.label} className="flex items-center gap-3">
                    <span className={cn('text-xs font-medium w-16 text-right shrink-0', homeWins ? 'text-primary' : 'text-muted-foreground')}>
                      {typeof stat.home === 'number' ? (Number.isInteger(stat.home) ? stat.home : stat.home.toFixed(1)) : stat.home}
                    </span>
                    <div className="flex-1">
                      <div className="flex h-2.5 rounded-full overflow-hidden bg-muted/50">
                        <div className={cn('rounded-l-full transition-all duration-500', homeWins ? 'bg-primary' : 'bg-primary/40')} style={{ width: `${homePct}%` }} />
                        <div className={cn('rounded-r-full transition-all duration-500', !homeWins ? 'bg-orange-500' : 'bg-orange-500/40')} style={{ width: `${100 - homePct}%` }} />
                      </div>
                    </div>
                    <span className={cn('text-xs font-medium w-16 shrink-0', !homeWins ? 'text-orange-400' : 'text-muted-foreground')}>
                      {typeof stat.away === 'number' ? (Number.isInteger(stat.away) ? stat.away : stat.away.toFixed(1)) : stat.away}
                    </span>
                    <span className="text-[10px] text-muted-foreground w-28 shrink-0 hidden lg:block">{stat.label}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Head-to-Head — honest UNAVAILABLE state */}
        <Card className="glass-card-premium card-hover-lift rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="size-4 text-primary" /> Head-to-Head Record
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <div className="size-12 rounded-full bg-muted/40 flex items-center justify-center">
                <AlertCircle className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">H2H Data Unavailable</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Head-to-head history requires shared match data between {homeTeam!.name} and {awayTeam!.name}.
                  This data is not yet available from the current data source.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ELO History — not shown when no real time-series data */}
        {/* Scoring Trends — not shown when no real time-series data */}

        {/* Player Matchups — only with real player data from DB */}
        {playerMatchups ? (
          <Card className="glass-card-premium card-hover-lift rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Key Player Matchups</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {playerMatchups.map(({ homePlayer, awayPlayer }, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/30">
                  <div className="text-right">
                    <p className="text-sm font-medium text-primary">{homePlayer.name}</p>
                    <p className="text-[10px] text-muted-foreground">{homePlayer.position}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">vs</span>
                    <ArrowRight className="size-3 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-orange-400">{awayPlayer.name}</p>
                    <p className="text-[10px] text-muted-foreground">{awayPlayer.position}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {/* Data source note */}
        <div className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-secondary/20 p-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary/70" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            All statistics shown are from synced database records. Sections like Head-to-Head, ELO History, and Scoring Trends
            require additional data sources that are not yet connected.
          </p>
        </div>
      </div>
    </motion.div>
  )
}
