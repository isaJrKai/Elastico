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
} from 'recharts'
import { useElasticoStore, type Team } from '@/store/use-elastico-store'
import { cn } from '@/lib/utils'

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

  // Head-to-head mock data
  const h2h = useMemo(() => {
    if (!homeTeam || !awayTeam) return []
    return [
      { date: '2025-11', homeGoals: 2, awayGoals: 1, result: 'H' },
      { date: '2025-06', homeGoals: 1, awayGoals: 1, result: 'D' },
      { date: '2024-11', homeGoals: 3, awayGoals: 0, result: 'H' },
      { date: '2024-06', homeGoals: 0, awayGoals: 2, result: 'A' },
      { date: '2023-11', homeGoals: 1, awayGoals: 0, result: 'H' },
    ]
  }, [homeTeam, awayTeam])

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

  // ELO history mock
  const eloHistory = useMemo(() => {
    if (!homeTeam && !awayTeam) return []
    return Array.from({ length: 12 }, (_, i) => {
      const month = `M${i + 1}`
      return {
        month,
        home: (homeTeam?.eloRating || 1500) + (Math.sin(i / 3) * 30) + ((i * 7 % 10) - 5) * 2,
        away: (awayTeam?.eloRating || 1500) + (Math.cos(i / 3) * 25) + ((i * 7 % 10) - 5) * 2,
      }
    })
  }, [homeTeam, awayTeam])

  // Form badges
  const homeForm = homeTeam?.form ? JSON.parse(homeTeam.form) as string[] : ['W', 'D', 'W', 'L', 'W']
  const awayForm = awayTeam?.form ? JSON.parse(awayTeam.form) as string[] : ['L', 'W', 'D', 'W', 'L']

  // Scoring trends
  const scoringTrends = useMemo(() => Array.from({ length: 6 }, (_, i) => ({
    match: `M${i + 1}`,
    homeScored: [1, 2, 0, 3, 1, 2][i] || 0,
    homeConceded: [0, 1, 1, 0, 2, 1][i] || 0,
    awayScored: [2, 1, 0, 1, 3, 0][i] || 0,
    awayConceded: [1, 0, 2, 1, 1, 0][i] || 0,
  })), [])

  // Stat comparisons
  const statComparisons = useMemo(() => {
    if (!homeTeam || !awayTeam) return []
    return [
      { label: 'ELO Rating', home: homeTeam.eloRating, away: awayTeam.eloRating, higher: 'higher' },
      { label: 'xG per Game', home: homeTeam.xgPerGame, away: awayTeam.xgPerGame, higher: 'higher' },
      { label: 'xGA per Game', home: homeTeam.xgaPerGame, away: awayTeam.xgaPerGame, higher: 'lower' },
      { label: 'Possession %', home: homeTeam.possession, away: awayTeam.possession, higher: 'higher' },
      { label: 'Pass Accuracy %', home: homeTeam.passAccuracy, away: awayTeam.passAccuracy, higher: 'higher' },
      { label: 'Press Intensity', home: homeTeam.pressIntensity, away: awayTeam.pressIntensity, higher: 'higher' },
      { label: 'Goals For', home: homeTeam.goalsFor, away: awayTeam.goalsFor, higher: 'higher' },
      { label: 'Goals Against', home: homeTeam.goalsAgainst, away: awayTeam.goalsAgainst, higher: 'lower' },
      { label: 'Wins', home: homeTeam.wins, away: awayTeam.wins, higher: 'higher' },
      { label: 'Draws', home: homeTeam.draws, away: awayTeam.draws, higher: 'neutral' },
      { label: 'Losses', home: homeTeam.losses, away: awayTeam.losses, higher: 'lower' },
      { label: 'Win Rate %', home: homeTeam.wins + homeTeam.draws + homeTeam.losses > 0 ? (homeTeam.wins / (homeTeam.wins + homeTeam.draws + homeTeam.losses)) * 100 : 50, away: awayTeam.wins + awayTeam.draws + awayTeam.losses > 0 ? (awayTeam.wins / (awayTeam.wins + awayTeam.draws + awayTeam.losses)) * 100 : 50, higher: 'higher' },
      { label: 'GD', home: homeTeam.goalsFor - homeTeam.goalsAgainst, away: awayTeam.goalsFor - awayTeam.goalsAgainst, higher: 'higher' },
      { label: 'Avg Goals/Game', home: +(homeTeam.goalsFor / Math.max(1, homeTeam.wins + homeTeam.draws + homeTeam.losses)).toFixed(2), away: +(awayTeam.goalsFor / Math.max(1, awayTeam.wins + awayTeam.draws + awayTeam.losses)).toFixed(2), higher: 'higher' },
      { label: 'Shots per Game', home: 12.4, away: 10.8, higher: 'higher' },
      { label: 'Corners per Game', home: 6.2, away: 5.5, higher: 'higher' },
      { label: 'Fouls per Game', home: 11.3, away: 13.1, higher: 'lower' },
    ]
  }, [homeTeam, awayTeam])

  // Squad depth by position
  const squadDepth = useMemo(() => {
    const getPos = () => ({ GK: 2 + Math.floor(Math.random() * 2), DEF: 5 + Math.floor(Math.random() * 4), MID: 5 + Math.floor(Math.random() * 4), FWD: 3 + Math.floor(Math.random() * 3) })
    return { home: getPos(), away: getPos() }
  }, [homeTeam, awayTeam])

  // Tactical edge
  const tacticalEdge = useMemo(() => {
    if (!homeTeam || !awayTeam) return []
    return [
      { phase: 'Attack', home: homeTeam.xgPerGame > awayTeam.xgPerGame, margin: Math.abs(homeTeam.xgPerGame - awayTeam.xgPerGame).toFixed(2) },
      { phase: 'Midfield Control', home: homeTeam.possession > awayTeam.possession, margin: Math.abs(homeTeam.possession - awayTeam.possession).toFixed(0) },
      { phase: 'Defensive Solidity', home: homeTeam.xgaPerGame < awayTeam.xgaPerGame, margin: Math.abs(homeTeam.xgaPerGame - awayTeam.xgaPerGame).toFixed(2) },
      { phase: 'Pressing', home: homeTeam.pressIntensity > awayTeam.pressIntensity, margin: Math.abs(homeTeam.pressIntensity - awayTeam.pressIntensity).toFixed(0) },
      { phase: 'Passing', home: homeTeam.passAccuracy > awayTeam.passAccuracy, margin: Math.abs(homeTeam.passAccuracy - awayTeam.passAccuracy).toFixed(0) },
    ]
  }, [homeTeam, awayTeam])

  const getFormBadge = (r: string) => {
    switch (r) {
      case 'W': return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 text-xs px-2 py-0">W</Badge>
      case 'D': return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20 text-xs px-2 py-0">D</Badge>
      case 'L': return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20 text-xs px-2 py-0">L</Badge>
      default: return <Badge variant="outline" className="text-xs px-2 py-0">-</Badge>
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GitCompareArrows className="text-primary" /> Team Comparison
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Compare two teams across all metrics</p>
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
                    <span className="font-bold text-primary">{winProb.home}%</span>
                  </div>
                  <Progress value={winProb.home} className="h-3" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Draw</span>
                    <span className="font-bold">{winProb.draw}%</span>
                  </div>
                  <Progress value={winProb.draw} className="h-3" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-orange-400 font-medium">{awayTeam.name}</span>
                    <span className="font-bold text-orange-400">{winProb.away}%</span>
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
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={eloHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                      <Line type="monotone" dataKey="home" stroke="#00e676" strokeWidth={2} dot={{ r: 3 }} name={homeTeam.name} />
                      <Line type="monotone" dataKey="away" stroke="#ff5252" strokeWidth={2} dot={{ r: 3 }} name={awayTeam.name} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Scoring Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scoringTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="match" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="homeScored" fill="#00e676" radius={[2, 2, 0, 0]} name={`${homeTeam.name} Scored`} />
                      <Bar dataKey="homeConceded" fill="#00e67640" radius={[2, 2, 0, 0]} name={`${homeTeam.name} Conceded`} />
                      <Bar dataKey="awayScored" fill="#ff5252" radius={[2, 2, 0, 0]} name={`${awayTeam.name} Scored`} />
                      <Bar dataKey="awayConceded" fill="#ff525240" radius={[2, 2, 0, 0]} name={`${awayTeam.name} Conceded`} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
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
              <CardContent className="space-y-4">
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
                      <Badge variant="outline" className={cn('text-[10px]', home ? 'text-primary border-primary/30' : 'text-orange-400 border-orange-400/30')}>
                        {home ? homeTeam.code : awayTeam.code} +{margin}
                      </Badge>
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
                <div className="space-y-3">
                  {Object.keys(squadDepth.home).map(pos => (
                    <div key={pos} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{pos}</span>
                        <span><span className="text-primary">{squadDepth.home[pos as keyof typeof squadDepth.home]}</span> / <span className="text-orange-400">{squadDepth.away[pos as keyof typeof squadDepth.away]}</span></span>
                      </div>
                      <div className="flex h-2 rounded-full overflow-hidden bg-muted/50">
                        <div className="bg-primary/70" style={{ width: `${(squadDepth.home[pos as keyof typeof squadDepth.home] / (squadDepth.home[pos as keyof typeof squadDepth.home] + squadDepth.away[pos as keyof typeof squadDepth.away])) * 100}%` }} />
                        <div className="bg-orange-500/60" style={{ width: `${(squadDepth.away[pos as keyof typeof squadDepth.away] / (squadDepth.home[pos as keyof typeof squadDepth.home] + squadDepth.away[pos as keyof typeof squadDepth.away])) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Key Player Matchups */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="size-4 text-primary" /> Key Player Matchups
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { homePlayer: `${homeTeam.code} Best Striker`, awayPlayer: `${awayTeam.code} Best Striker`, metric: 'Goals' },
                  { homePlayer: `${homeTeam.code} Playmaker`, awayPlayer: `${awayTeam.code} Playmaker`, metric: 'Assists' },
                  { homePlayer: `${homeTeam.code} Key Defender`, awayPlayer: `${awayTeam.code} Key Defender`, metric: 'Tackles' },
                ].map((matchup, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-card/50 border border-border/30">
                    <div className="flex-1 text-right">
                      <div className="text-xs font-medium text-primary">{matchup.homePlayer}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">{matchup.metric}</Badge>
                    <div className="flex-1">
                      <div className="text-xs font-medium text-orange-400">{matchup.awayPlayer}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Style Matchup */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Style Matchup Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Attacking vs Defensive', home: homeTeam.style || 'balanced', away: awayTeam.style || 'balanced', icon: Swords },
                  { label: 'High Press vs Low Block', home: homeTeam.pressIntensity > 60 ? 'High Press' : 'Standard', away: awayTeam.pressIntensity > 60 ? 'High Press' : 'Standard', icon: Shield },
                  { label: 'Possession vs Direct', home: homeTeam.possession > 55 ? 'Possession' : 'Direct', away: awayTeam.possession > 55 ? 'Possession' : 'Direct', icon: BarChart3 },
                  { label: 'Wing Play vs Center', home: 'Mixed', away: 'Mixed', icon: Users },
                ].map((item) => {
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
                {homeTeam.name} ({homeTeam.eloRating.toFixed(0)} ELO) enters this matchup as {winProb.home > 50 ? 'the favorite' : 'the underdog'} with a {winProb.home}% win probability.
                Their attacking output ({homeTeam.xgPerGame} xG/game) compares {homeTeam.xgPerGame > awayTeam.xgPerGame ? 'favorably' : 'unfavorably'} to {awayTeam.name}&apos;s ({awayTeam.xgPerGame} xG/game).
                The tactical edge lies in {homeTeam.possession > awayTeam.possession ? homeTeam.name : awayTeam.name}&apos;s superior possession game ({Math.max(homeTeam.possession, awayTeam.possession)}% vs {Math.min(homeTeam.possession, awayTeam.possession)}%).
                Recent form {h2hRecord.home > h2hRecord.away ? `favors ${homeTeam.name} with ${h2hRecord.home} wins in the last 5 meetings` : `shows ${awayTeam.name} has the historical edge`}.
                Key battleground: the midfield transition zone, where {homeTeam.pressIntensity > awayTeam.pressIntensity ? homeTeam.name : awayTeam.name}&apos;s pressing could prove decisive.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  )
}

export default CompareView