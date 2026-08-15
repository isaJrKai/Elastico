'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  GitCompareArrows,
  Trophy,
  TrendingUp,
  Users,
  Shield,
  Swords,
  Gauge,
  BarChart3,
  Brain,
  ArrowRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts'
import { useElasticoStore, type Team } from '@/store/use-elastico-store'
import { cn } from '@/lib/utils'
import { axisProps, cartesianGridProps, tooltipContentStyle, tooltipLabelStyle, legendProps, chartColor } from '@/lib/chart-theme'
import { TeamCrest } from '@/components/elastico/primitives/team-crest'
import { StatusBadge } from '@/components/elastico/primitives/status-badge'
import { SectionHeader } from '@/components/elastico/primitives/section-header'

// ── Helpers ────────────────────────────────────────────────────────────────────

function getEloProb(eloA: number, eloB: number) {
  const eA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400))
  return { home: +(eA * 100).toFixed(1), away: +((1 - eA) * 100).toFixed(1), draw: +(Math.min(eA, 1 - eA) * 30).toFixed(1) }
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CompareView() {
  const teams = useElasticoStore(s => s.teams)
  const [homeTeamId, setHomeTeamId] = useState<string>('')
  const [awayTeamId, setAwayTeamId] = useState<string>('')

  const homeTeam = useMemo(() => teams.find(t => t.id === homeTeamId), [teams, homeTeamId])
  const awayTeam = useMemo(() => teams.find(t => t.id === awayTeamId), [teams, awayTeamId])

  // Head-to-head — requires match history between the two teams
  const h2h: { date: string; homeGoals: number; awayGoals: number; result: string }[] = []

  const h2hRecord = useMemo(() => {
    const home = h2h.filter(m => m.result === 'H').length
    const draws = h2h.filter(m => m.result === 'D').length
    const away = h2h.filter(m => m.result === 'A').length
    return { home, draws, away }
  }, [h2h])

  // Win probability
  const winProb = useMemo(() => {
    if (!homeTeam || !awayTeam) return { home: 50, draw: 25, away: 25 }
    return getEloProb(homeTeam.eloRating, awayTeam.eloRating)
  }, [homeTeam, awayTeam])

  // ELO history — requires historical ELO data from API
  const eloHistory: { month: string; home: number; away: number }[] = []

  // Form badges
  const homeForm = homeTeam?.form ? JSON.parse(homeTeam.form) as string[] : []
  const awayForm = awayTeam?.form ? JSON.parse(awayTeam.form) as string[] : []

  // Scoring trends — requires match-by-match data from API
  const scoringTrends: { match: string; homeScored: number; homeConceded: number; awayScored: number; awayConceded: number }[] = []

  // Stat comparisons
  const statComparisons = useMemo(() => {
    if (!homeTeam || !awayTeam) return []
    return [
      { label: 'ELO Rating', home: homeTeam.eloRating ?? 1500, away: awayTeam.eloRating ?? 1500, higher: 'higher' },
      { label: 'xG per Game', home: homeTeam.xgPerGame ?? 0, away: awayTeam.xgPerGame ?? 0, higher: 'higher' },
      { label: 'xGA per Game', home: homeTeam.xgaPerGame ?? 0, away: awayTeam.xgaPerGame ?? 0, higher: 'lower' },
      { label: 'Possession %', home: homeTeam.possession ?? 50, away: awayTeam.possession ?? 50, higher: 'higher' },
      { label: 'Pass Accuracy %', home: homeTeam.passAccuracy ?? 0, away: awayTeam.passAccuracy ?? 0, higher: 'higher' },
      { label: 'Press Intensity', home: homeTeam.pressIntensity ?? 0, away: awayTeam.pressIntensity ?? 0, higher: 'higher' },
      { label: 'Goals For', home: homeTeam.goalsFor ?? 0, away: awayTeam.goalsFor ?? 0, higher: 'higher' },
      { label: 'Goals Against', home: homeTeam.goalsAgainst ?? 0, away: awayTeam.goalsAgainst ?? 0, higher: 'lower' },
      { label: 'Wins', home: homeTeam.wins, away: awayTeam.wins, higher: 'higher' },
      { label: 'Draws', home: homeTeam.draws, away: awayTeam.draws, higher: 'neutral' },
      { label: 'Losses', home: homeTeam.losses, away: awayTeam.losses, higher: 'lower' },
      { label: 'GD', home: homeTeam.goalsFor - homeTeam.goalsAgainst, away: awayTeam.goalsFor - awayTeam.goalsAgainst, higher: 'higher' },
      { label: 'Avg Goals/Game', home: +(homeTeam.goalsFor / Math.max(1, homeTeam.wins + homeTeam.draws + homeTeam.losses)).toFixed(2), away: +(awayTeam.goalsFor / Math.max(1, awayTeam.wins + awayTeam.draws + awayTeam.losses)).toFixed(2), higher: 'higher' },
      { label: 'Win Rate %', home: homeTeam.wins + homeTeam.draws + homeTeam.losses > 0 ? (homeTeam.wins / (homeTeam.wins + homeTeam.draws + homeTeam.losses)) * 100 : 0, away: awayTeam.wins + awayTeam.draws + awayTeam.losses > 0 ? (awayTeam.wins / (awayTeam.wins + awayTeam.draws + awayTeam.losses)) * 100 : 0, higher: 'higher' },
    ]
  }, [homeTeam, awayTeam])

  // Style matchup — derived from real team data
  const styleMatchup = useMemo(() => {
    if (!homeTeam || !awayTeam) return []
    return [
      { label: 'Attacking vs Defensive', home: homeTeam.style || 'balanced', away: awayTeam.style || 'balanced', icon: Swords },
      { label: 'High Press vs Low Block', home: (homeTeam.pressIntensity ?? 0) > 60 ? 'High Press' : 'Standard', away: (awayTeam.pressIntensity ?? 0) > 60 ? 'High Press' : 'Standard', icon: Shield },
      { label: 'Possession vs Direct', home: (homeTeam.possession ?? 50) > 55 ? 'Possession' : 'Direct', away: (awayTeam.possession ?? 50) > 55 ? 'Possession' : 'Direct', icon: BarChart3 },
    ]
  }, [homeTeam, awayTeam])

  // Tactical edge
  const tacticalEdge = useMemo(() => {
    if (!homeTeam || !awayTeam) return []
    const hXg = homeTeam.xgPerGame ?? 0, aXg = awayTeam.xgPerGame ?? 0
    const hPoss = homeTeam.possession ?? 50, aPoss = awayTeam.possession ?? 50
    const hXga = homeTeam.xgaPerGame ?? 0, aXga = awayTeam.xgaPerGame ?? 0
    const hPress = homeTeam.pressIntensity ?? 0, aPress = awayTeam.pressIntensity ?? 0
    const hPass = homeTeam.passAccuracy ?? 0, aPass = awayTeam.passAccuracy ?? 0
    return [
      { phase: 'Attack', home: hXg > aXg, margin: Math.abs(hXg - aXg).toFixed(2) },
      { phase: 'Midfield Control', home: hPoss > aPoss, margin: Math.abs(hPoss - aPoss).toFixed(0) },
      { phase: 'Defensive Solidity', home: hXga < aXga, margin: Math.abs(hXga - aXga).toFixed(2) },
      { phase: 'Pressing', home: hPress > aPress, margin: Math.abs(hPress - aPress).toFixed(0) },
      { phase: 'Passing', home: hPass > aPass, margin: Math.abs(hPass - aPass).toFixed(0) },
    ]
  }, [homeTeam, awayTeam])

  const getFormBadge = (r: string) => {
    if (r === 'W' || r === 'D' || r === 'L') return <StatusBadge variant="form" value={r} />
    return <StatusBadge variant="custom" value="-" />
  }

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
            <SelectTrigger>
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
            <Swords className="size-5 text-primary" />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Away Team</label>
          <Select value={awayTeamId} onValueChange={setAwayTeamId}>
            <SelectTrigger>
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

      {!homeTeam || !awayTeam ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <GitCompareArrows className="size-12 mb-4 opacity-30" />
            <p className="text-sm">Select two teams above to start comparing</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Form & Win Probability Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Form Comparison */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" /> Recent Form
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-primary">{homeTeam.name}</span>
                  <div className="flex gap-1">{homeForm.slice(0, 5).map((r, i) => <span key={i}>{getFormBadge(r)}</span>)}</div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-orange-400">{awayTeam.name}</span>
                  <div className="flex gap-1">{awayForm.slice(0, 5).map((r, i) => <span key={i}>{getFormBadge(r)}</span>)}</div>
                </div>
                <div className="pt-2 border-t border-border/50 text-center">
                  <span className="text-xs text-muted-foreground">Last 5 matches — W=Win D=Draw L=Loss</span>
                </div>
              </CardContent>
            </Card>

            {/* Win Probability */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Gauge className="size-4 text-primary" /> Win Probability (ELO-based)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-primary font-medium">{homeTeam.name}</span>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-primary">{winProb.home}%</span>
                      <StatusBadge variant="dataclass" value="DERIVED" />
                    </div>
                  </div>
                  <Progress value={winProb.home} className="h-3" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Draw</span>
                    <div className="flex items-center gap-1">
                      <span className="font-bold">{winProb.draw}%</span>
                      <StatusBadge variant="dataclass" value="DERIVED" />
                    </div>
                  </div>
                  <Progress value={winProb.draw} className="h-3" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-orange-400 font-medium">{awayTeam.name}</span>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-orange-400">{winProb.away}%</span>
                      <StatusBadge variant="dataclass" value="DERIVED" />
                    </div>
                  </div>
                  <Progress value={winProb.away} className="h-3" />
                </div>
                <div className="text-center pt-2 border-t border-border/50">
                  <Badge variant="outline" className="text-xs">
                    {winProb.home > winProb.away ? homeTeam.name : awayTeam.name} favored by {Math.abs(winProb.home - winProb.away).toFixed(1)}%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stat Comparison Bars */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="size-4 text-primary" /> Full Stat Comparison
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[500px] overflow-y-auto pr-1">
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

          {/* ELO History & Scoring Trends */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">ELO Rating History</CardTitle>
              </CardHeader>
              <CardContent>
                {eloHistory.length > 0 ? (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={eloHistory}>
                        <CartesianGrid {...cartesianGridProps} />
                        <XAxis dataKey="month" {...axisProps} />
                        <YAxis {...axisProps} />
                        <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} />
                        <Legend {...legendProps} />
                        <Line type="monotone" dataKey="home" stroke={chartColor(0)} strokeWidth={2} dot={{ r: 3 }} name={homeTeam.name} />
                        <Line type="monotone" dataKey="away" stroke={chartColor(1)} strokeWidth={2} dot={{ r: 3 }} name={awayTeam.name} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">Historical ELO data not yet available</div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Scoring Trends</CardTitle>
              </CardHeader>
              <CardContent>
                {scoringTrends.length > 0 ? (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={scoringTrends}>
                        <CartesianGrid {...cartesianGridProps} />
                        <XAxis dataKey="match" {...axisProps} />
                        <YAxis {...axisProps} />
                        <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} />
                        <Legend {...legendProps} />
                        <Bar dataKey="homeScored" fill={chartColor(0)} radius={[2, 2, 0, 0]} name={`${homeTeam.name} Scored`} />
                        <Bar dataKey="homeConceded" fill={chartColor(0)} fillOpacity={0.25} radius={[2, 2, 0, 0]} name={`${homeTeam.name} Conceded`} />
                        <Bar dataKey="awayScored" fill={chartColor(4)} radius={[2, 2, 0, 0]} name={`${awayTeam.name} Scored`} />
                        <Bar dataKey="awayConceded" fill={chartColor(4)} fillOpacity={0.25} radius={[2, 2, 0, 0]} name={`${awayTeam.name} Conceded`} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">Match-by-match scoring data not yet available</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Head-to-Head & Tactical Edge & Squad Depth & Key Players */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Head-to-Head */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Trophy className="size-4 text-primary" /> Head-to-Head Record
                </CardTitle>
              </CardHeader>
              <CardContent>
                {h2h.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-primary">{h2hRecord.home}</div>
                        <div className="text-[10px] text-muted-foreground">{homeTeam.code} Wins</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-muted-foreground">{h2hRecord.draws}</div>
                        <div className="text-[10px] text-muted-foreground">Draws</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-orange-400">{h2hRecord.away}</div>
                        <div className="text-[10px] text-muted-foreground">{awayTeam.code} Wins</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {h2h.map((m, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded bg-card/50 border border-border/30 text-sm">
                          <span className="text-xs text-muted-foreground">{m.date}</span>
                          <div className="flex items-center gap-2">
                            <span className={cn('font-bold', m.result === 'H' ? 'text-primary' : '')}>{m.homeGoals}</span>
                            <span className="text-muted-foreground">-</span>
                            <span className={cn('font-bold', m.result === 'A' ? 'text-orange-400' : '')}>{m.awayGoals}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">Head-to-head history requires shared match data</div>
                )}
              </CardContent>
            </Card>

            {/* Tactical Edge */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Shield className="size-4 text-primary" /> Tactical Edge Indicators
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {tacticalEdge.map(({ phase, home, margin }) => (
                  <div key={phase} className="flex items-center justify-between p-2.5 rounded-lg bg-card/50 border border-border/30">
                    <span className="text-sm">{phase}</span>
                    <div className="flex items-center gap-2">
                      <ArrowRight className={cn('size-4', home ? 'text-primary' : 'text-orange-400 rotate-180')} />
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className={cn('text-[10px]', home ? 'text-primary border-primary/30' : 'text-orange-400 border-orange-400/30')}>
                          {home ? homeTeam.code : awayTeam.code} +{margin}
                        </Badge>
                        <StatusBadge variant="dataclass" value="DERIVED" />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Squad Depth */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="size-4 text-primary" /> Squad Depth
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="py-8 text-center text-sm text-muted-foreground">Squad depth data requires player roster information</div>
              </CardContent>
            </Card>

            {/* Key Player Matchups */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="size-4 text-primary" /> Key Player Matchups
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="py-8 text-center text-sm text-muted-foreground">Player matchup data requires detailed player statistics</div>
              </CardContent>
            </Card>
          </div>

          {/* Style Matchup */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Style Matchup Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {styleMatchup.map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.label} className="glass-card p-4 rounded-lg border border-border/30 text-center space-y-2">
                      <Icon className="size-5 text-primary mx-auto" />
                      <div className="text-[10px] text-muted-foreground">{item.label}</div>
                      <div className="flex items-center justify-center gap-2">
                        <Badge variant="outline" className="text-[10px] text-primary border-primary/30">{item.home}</Badge>
                        <span className="text-[10px] text-muted-foreground">vs</span>
                        <Badge variant="outline" className="text-[10px] text-orange-400 border-orange-400/30">{item.away}</Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* AI Summary */}
          <Card className="glass-card border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Brain className="size-4 text-primary" /> Comparison Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground/90">
                {homeTeam.name} ({(homeTeam.eloRating ?? 1500).toFixed(0)} ELO) enters this matchup as {winProb.home > 50 ? 'the favorite' : 'the underdog'} with a {winProb.home}% win probability.
                Their attacking output ({homeTeam.xgPerGame ?? 0} xG/game) compares {(homeTeam.xgPerGame ?? 0) > (awayTeam.xgPerGame ?? 0) ? 'favorably' : 'unfavorably'} to {awayTeam.name}&apos;s ({awayTeam.xgPerGame ?? 0} xG/game).
                The tactical edge lies in {(homeTeam.possession ?? 50) > (awayTeam.possession ?? 50) ? homeTeam.name : awayTeam.name}&apos;s superior possession game ({Math.max(homeTeam.possession ?? 50, awayTeam.possession ?? 50)}% vs {Math.min(homeTeam.possession ?? 50, awayTeam.possession ?? 50)}%).
                Key battleground: the midfield transition zone, where {(homeTeam.pressIntensity ?? 0) > (awayTeam.pressIntensity ?? 0) ? homeTeam.name : awayTeam.name}&apos;s pressing could prove decisive.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  )
}

export default CompareView