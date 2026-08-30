'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { TeamCrest, StatusBadge, SectionHeader, DataState, StatBlock } from '@/components/elastico/primitives'

// ── State type ─────────────────────────────────────────────────────────────────

type ViewState = 'loading' | 'empty' | 'error' | 'success'

// ── CompareView ────────────────────────────────────────────────────────────────

export default function CompareView() {
  const teams = useElasticoStore(s => s.teams)
  const fetchTeams = useElasticoStore(s => s.fetchTeams)
  const [loading, setLoading] = useState(true)
  const [homeTeamId, setHomeTeamId] = useState<string>('')
  const [awayTeamId, setAwayTeamId] = useState<string>('')

  const homeTeam = useMemo(() => teams.find(t => t.id === homeTeamId), [teams, homeTeamId])
  const awayTeam = useMemo(() => teams.find(t => t.id === awayTeamId), [teams, awayTeamId])

  // Fetch teams if store is empty (handles direct navigation)
  useEffect(() => {
    if (teams.length === 0) {
      fetchTeams().finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [teams.length, fetchTeams])

  // Transition to success/empty when teams load
  const viewState = useMemo<ViewState>(() => {
    if (teams.length === 0 && loading) return 'loading'
    if (teams.length === 0 && !loading) return 'empty'
    if (!homeTeam || !awayTeam) return 'empty'
    return 'success'
  }, [teams, loading, homeTeamId, awayTeamId, homeTeam, awayTeam])

  // Stat comparisons — real data preferred, derived from basic stats when missing
  const statComparisons = useMemo(() => {
    if (!homeTeam || !awayTeam) return []
    const homeMatches = Math.max(homeTeam.wins + homeTeam.draws + homeTeam.losses, 1)
    const awayMatches = Math.max(awayTeam.wins + awayTeam.draws + awayTeam.losses, 1)

    // Derived fallback values from basic stats
    const homeXg = homeTeam.xgPerGame ?? +(homeTeam.goalsFor / homeMatches).toFixed(2)
    const awayXg = awayTeam.xgPerGame ?? +(awayTeam.goalsFor / awayMatches).toFixed(2)
    const homeXga = homeTeam.xgaPerGame ?? +(homeTeam.goalsAgainst / homeMatches).toFixed(2)
    const awayXga = awayTeam.xgaPerGame ?? +(awayTeam.goalsAgainst / awayMatches).toFixed(2)
    const homePoss = homeTeam.possession ?? +Math.min(70, Math.max(30, 50 + ((homeTeam.goalsFor - homeTeam.goalsAgainst) / homeMatches) * 3)).toFixed(1)
    const awayPoss = awayTeam.possession ?? +Math.min(70, Math.max(30, 50 + ((awayTeam.goalsFor - awayTeam.goalsAgainst) / awayMatches) * 3)).toFixed(1)
    const homePass = homeTeam.passAccuracy ?? +Math.min(95, ((homeTeam.wins + homeTeam.draws) / homeMatches) * 15 + 70).toFixed(1)
    const awayPass = awayTeam.passAccuracy ?? +Math.min(95, ((awayTeam.wins + awayTeam.draws) / awayMatches) * 15 + 70).toFixed(1)
    const homePress = (homeTeam.pressIntensity != null && homeTeam.pressIntensity > 0) ? homeTeam.pressIntensity : +Math.min(95, (homeTeam.wins / homeMatches) * 90 + 20).toFixed(1)
    const awayPress = (awayTeam.pressIntensity != null && awayTeam.pressIntensity > 0) ? awayTeam.pressIntensity : +Math.min(95, (awayTeam.wins / awayMatches) * 90 + 20).toFixed(1)

    return [
      { label: 'ELO Rating', home: homeTeam.eloRating ?? null, away: awayTeam.eloRating ?? null, higher: 'higher' as const, truthClass: null as string | null, source: null as string | null },
      { label: 'xG per Game', home: homeXg, away: awayXg, higher: 'higher' as const, truthClass: homeTeam.xgPerGame != null ? (homeTeam.xgTruthClass || 'REAL') : 'DERIVED', source: homeTeam.xgSource || null },
      { label: 'xGA per Game', home: homeXga, away: awayXga, higher: 'lower' as const, truthClass: homeTeam.xgaPerGame != null ? (homeTeam.xgTruthClass || 'REAL') : 'DERIVED', source: homeTeam.xgSource || null },
      { label: 'Possession %', home: homePoss, away: awayPoss, higher: 'higher' as const, truthClass: homeTeam.possession != null ? 'REAL' : 'DERIVED', source: homeTeam.possession != null ? null : 'basic-stats' },
      { label: 'Pass Accuracy %', home: homePass, away: awayPass, higher: 'higher' as const, truthClass: homeTeam.passAccuracy != null ? 'REAL' : 'DERIVED', source: homeTeam.passAccuracy != null ? null : 'basic-stats' },
      { label: 'Press Intensity', home: homePress, away: awayPress, higher: 'higher' as const, truthClass: (homeTeam.pressIntensity != null && homeTeam.pressIntensity > 0) ? 'DERIVED' : 'DERIVED', source: (homeTeam.pressIntensity != null && homeTeam.pressIntensity > 0) ? null : 'basic-stats' },
      { label: 'Goals For', home: homeTeam.goalsFor ?? 0, away: awayTeam.goalsFor ?? 0, higher: 'higher' as const, truthClass: 'REAL' as string | null, source: null as string | null },
      { label: 'Goals Against', home: homeTeam.goalsAgainst ?? 0, away: awayTeam.goalsAgainst ?? 0, higher: 'lower' as const, truthClass: 'REAL' as string | null, source: null as string | null },
      { label: 'Wins', home: homeTeam.wins, away: awayTeam.wins, higher: 'higher' as const, truthClass: 'REAL' as string | null, source: null as string | null },
      { label: 'Draws', home: homeTeam.draws, away: awayTeam.draws, higher: 'neutral' as const, truthClass: 'REAL' as string | null, source: null as string | null },
      { label: 'Losses', home: homeTeam.losses, away: awayTeam.losses, higher: 'lower' as const, truthClass: 'REAL' as string | null, source: null as string | null },
      { label: 'GD', home: homeTeam.goalsFor - homeTeam.goalsAgainst, away: awayTeam.goalsFor - awayTeam.goalsAgainst, higher: 'higher' as const, truthClass: 'REAL' as string | null, source: null as string | null },
      { label: 'Avg Goals/Game', home: +(homeTeam.goalsFor / homeMatches).toFixed(2), away: +(awayTeam.goalsFor / awayMatches).toFixed(2), higher: 'higher' as const, truthClass: 'DERIVED' as string | null, source: 'basic-stats' },
      { label: 'Win Rate %', home: +((homeTeam.wins / homeMatches) * 100).toFixed(1), away: +((awayTeam.wins / awayMatches) * 100).toFixed(1), higher: 'higher' as const, truthClass: 'DERIVED' as string | null, source: 'basic-stats' },
    ]
  }, [homeTeam, awayTeam])

  // Only show form if real form data exists
  const homeForm = useMemo(() => {
    if (!homeTeam?.form) return []
    // Form may be a plain string like "WDLWW" or a JSON array
    if (typeof homeTeam.form === 'string' && !homeTeam.form.startsWith('[')) {
      return homeTeam.form.split('').filter(c => c === 'W' || c === 'D' || c === 'L')
    }
    try {
      const parsed = JSON.parse(homeTeam.form) as string[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
      return []
    } catch { return [] }
  }, [homeTeam])

  const awayForm = useMemo(() => {
    if (!awayTeam?.form) return []
    if (typeof awayTeam.form === 'string' && !awayTeam.form.startsWith('[')) {
      return awayTeam.form.split('').filter(c => c === 'W' || c === 'D' || c === 'L')
    }
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
            <p className="text-sm text-muted-foreground">Loading teams...</p>
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

        {teams.length === 0 ? (
          <Card className="glass-card-premium card-hover-lift rounded-xl">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Inbox className="size-12 opacity-30" />
              <p className="text-sm font-medium">No teams available</p>
              <p className="text-xs text-muted-foreground/70">Add teams in the Squad Builder to compare them here.</p>
              <Button variant="outline" size="sm" className="mt-2 border-border text-xs" onClick={() => { fetchTeams(); toast.info('Retrying team data load...') }}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card-premium card-hover-lift rounded-xl">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Inbox className="size-12 opacity-30" />
              <p className="text-sm">Select two teams above to start comparing</p>
            </CardContent>
          </Card>
        )}
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
            <Button variant="outline" size="sm" className="mt-2 border-border text-xs" onClick={() => { fetchTeams(); toast.info('Retrying team data load...') }}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // ── SUCCESS STATE ───────────────────────────────────────────────────────
  // Guard: viewState ensures this, but TypeScript needs explicit narrowing
  if (!homeTeam || !awayTeam) return null

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
            <p className="text-sm font-semibold text-primary">{homeTeam.name}</p>
            <p className="text-xs text-muted-foreground">ELO {homeTeam.eloRating ?? 'N/A'}</p>
          </div>
          <TeamCrest code={homeTeam.code} espnLogo={homeTeam.logo} color={homeTeam.primaryColor} size="xl" />
        </div>
        <div className="flex items-center justify-center">
          <Badge variant="outline" className="text-xs border-border">VS</Badge>
        </div>
        <div className="flex items-center gap-3">
          <TeamCrest code={awayTeam.code} espnLogo={awayTeam.logo} color={awayTeam.primaryColor} size="xl" />
          <div>
            <p className="text-sm font-semibold text-orange-400">{awayTeam.name}</p>
            <p className="text-xs text-muted-foreground">ELO {awayTeam.eloRating ?? 'N/A'}</p>
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
                <span className="text-sm font-medium text-primary">{homeTeam.name}</span>
                <div className="flex gap-1">
                  {homeForm.length > 0
                    ? homeForm.slice(0, 5).map((r, i) => <span key={i}>{getFormBadge(r)}</span>)
                    : <span className="text-xs text-muted-foreground">No form data</span>}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-orange-400">{awayTeam.name}</span>
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
                // Handle null values — show N/A with provenance
                if (stat.home === null || stat.away === null) {
                  const tc = stat.truthClass
                  const src = stat.source
                  return (
                    <div key={stat.label} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-16 text-right shrink-0">N/A</span>
                      <div className="flex-1">
                        <div className="flex h-2.5 rounded-full overflow-hidden bg-muted/20">
                          <div className="rounded-l-full bg-muted/30" style={{ width: '50%' }} />
                          <div className="rounded-r-full bg-muted/30" style={{ width: '50%' }} />
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground w-16 shrink-0">N/A</span>
                      <span className="text-[10px] text-muted-foreground w-28 shrink-0 hidden lg:block">
                        {stat.label}
                        {tc && tc !== 'REAL' && tc !== 'DERIVED' && (
                          <span className="ml-1 text-yellow-500/70">{tc}</span>
                        )}
                        {tc === 'DERIVED' && src && (
                          <span className="ml-1 text-blue-400/70">DERIVED · {src}</span>
                        )}
                        {!tc && (
                          <span className="ml-1 text-muted-foreground/50">MISSING</span>
                        )}
                      </span>
                    </div>
                  )
                }
                const total = Math.max(stat.home + stat.away, 0.01)
                const homePct = Math.round((stat.home / total) * 100)
                const homeWins = stat.higher === 'higher' ? stat.home > stat.away : stat.higher === 'lower' ? stat.home < stat.away : true
                const tc = stat.truthClass
                const src = stat.source
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
                    <span className="text-[10px] text-muted-foreground w-28 shrink-0 hidden lg:block">
                      {stat.label}
                      {tc === 'REAL' && <span className="ml-1 text-emerald-500/80">REAL</span>}
                      {tc === 'DERIVED' && <span className="ml-1 text-blue-400/80">DERIVED</span>}
                      {tc && tc !== 'REAL' && tc !== 'DERIVED' && tc !== 'MISSING' && <span className="ml-1 text-yellow-500/70">{tc}</span>}
                      {src && <span className="ml-1 text-muted-foreground/50">via {src}</span>}
                    </span>
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
                  Head-to-head history requires shared match data between {homeTeam.name} and {awayTeam.name}.
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
            <span className="text-emerald-500/80">REAL</span> = from synced database records.
            <span className="text-blue-400/80 ml-1">DERIVED</span> = approximated from basic stats (wins, goals, etc.) when advanced analytics are unavailable.
            Sections like Head-to-Head, ELO History, and Scoring Trends require additional data sources.
          </p>
        </div>
      </div>
    </motion.div>
  )
}
