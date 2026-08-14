'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useElasticoStore } from '@/store/use-elastico-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Trophy, Star, TrendingUp, Zap, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TeamCrest, SectionHeader, DataState } from '@/components/elastico/primitives'

// ── Types ──────────────────────────────────────────────────────────────────

interface StandingTeam {
  rank: number
  team: string
  code: string
  logo: string
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
  form: string
}

const LEAGUES = [
  { code: 'PL',    name: 'Premier League' },
  { code: 'LIGA',  name: 'La Liga' },
  { code: 'SA',    name: 'Serie A' },
  { code: 'BL',    name: 'Bundesliga' },
  { code: 'L1',    name: 'Ligue 1' },
  { code: 'MLS',   name: 'MLS' },
  { code: 'UCL',   name: 'Champions League' },
  { code: 'UEL',   name: 'Europa League' },
  { code: 'ERE',   name: 'Eredivisie' },
  { code: 'PPL',   name: 'Primeira Liga' },
  { code: 'BL2',   name: '2. Bundesliga' },
  { code: 'ECH',   name: 'Championship' },
  { code: 'BRA',   name: 'Serie A Brazil' },
  { code: 'ARG',   name: 'Liga Profesional' },
  { code: 'MX',    name: 'Liga MX' },
]

// ═══════════════════════════════════════════════════════════════════════════════

export default function TournamentView() {
  const [selectedLeague, setSelectedLeague] = useState('PL')
  const [standings, setStandings] = useState<StandingTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  const fetchStandings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/live?action=standings&league=${selectedLeague}`)
      const data = await res.json()
      if (data.success && data.data && data.data.length > 0) {
        setStandings(data.data)
      } else {
        setStandings([])
      }
    } catch {
      setFetchError(true)
      setStandings([])
    } finally {
      setLoading(false)
    }
  }, [selectedLeague])

  useEffect(() => { fetchStandings() }, [fetchStandings])

  // Stats
  const totalTeams = standings.length
  const topTeam = standings[0]
  const topScorer = useMemo(() => {
    const sorted = [...standings].sort((a, b) => b.goalsFor - a.goalsFor)
    return sorted[0]
  }, [standings])
  const bestDefense = useMemo(() => {
    const sorted = [...standings].sort((a, b) => a.goalsAgainst - b.goalsAgainst)
    return sorted[0]
  }, [standings])
  const totalGoals = standings.reduce((s, t) => s + t.goalsFor, 0)
  const avgGoals = totalTeams > 0 ? (totalGoals / Math.max(standings.reduce((s, t) => s + t.played, 0), 1) * 2).toFixed(2) : '0.00'

  const renderForm = (form: string) => {
    if (!form) return <span className="text-muted-foreground">—</span>
    return (
      <div className="flex gap-0.5 justify-center">
        {form.split('').map((c, i) => (
          <span
            key={i}
            className={cn(
              'inline-flex size-3.5 items-center justify-center rounded text-[8px] font-bold',
              c === 'W' && 'bg-emerald-500/20 text-emerald-400',
              c === 'D' && 'bg-amber-500/20 text-amber-400',
              c === 'L' && 'bg-red-500/20 text-red-400',
            )}
          >
            {c}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Select value={selectedLeague} onValueChange={setSelectedLeague}>
            <SelectTrigger className="h-9 w-[180px] bg-muted/50 border-border text-sm">
              <Trophy className="size-3.5 mr-1.5 text-muted-foreground" /><SelectValue placeholder="League" />
            </SelectTrigger>
            <SelectContent className="glass-card border-border max-h-[280px]">
              {LEAGUES.map((l) => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-9 w-9 border-border bg-muted/50 hover:bg-accent" onClick={fetchStandings} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Star, label: 'Teams', value: totalTeams, color: 'text-primary' },
          { icon: TrendingUp, label: 'Total Goals', value: totalGoals, color: 'text-emerald-400' },
          { icon: Zap, label: 'Avg Goals/Match', value: avgGoals, color: 'text-cyan-400' },
          { icon: Trophy, label: 'Leader', value: topTeam?.team?.split(' ').slice(-1)[0] || '—', color: 'text-amber-400' },
        ].map(s => (
          <Card key={s.label} className="glass-card-premium card-hover-lift rounded-xl"><CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/50"><s.icon className={cn('size-4', s.color)} /></div>
            <div><p className="text-lg font-bold leading-tight truncate">{s.value}</p><p className="text-[10px] text-muted-foreground">{s.label}</p></div>
          </CardContent></Card>
        ))}
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {topTeam && (
          <Card className="glass-card-premium rounded-xl"><CardContent className="p-4 text-center">
            <p className="text-[10px] text-muted-foreground mb-2">League Leader</p>
            <TeamCrest code={topTeam.code} espnLogo={topTeam.logo} size="xl" className="mx-auto mb-2" />
            <p className="text-sm font-bold">{topTeam.team}</p>
            <p className="text-2xl font-black text-primary mt-1">{topTeam.points} pts</p>
            <p className="text-[10px] text-muted-foreground">{topTeam.played} played</p>
          </CardContent></Card>
        )}
        {topScorer && (
          <Card className="glass-card-premium rounded-xl"><CardContent className="p-4 text-center">
            <p className="text-[10px] text-muted-foreground mb-2">Most Goals Scored</p>
            <TeamCrest code={topScorer.code} espnLogo={topScorer.logo} size="xl" className="mx-auto mb-2" />
            <p className="text-sm font-bold">{topScorer.team}</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{topScorer.goalsFor} GF</p>
            <p className="text-[10px] text-muted-foreground">{topScorer.played} played</p>
          </CardContent></Card>
        )}
        {bestDefense && (
          <Card className="glass-card-premium rounded-xl"><CardContent className="p-4 text-center">
            <p className="text-[10px] text-muted-foreground mb-2">Best Defense</p>
            <TeamCrest code={bestDefense.code} espnLogo={bestDefense.logo} size="xl" className="mx-auto mb-2" />
            <p className="text-sm font-bold">{bestDefense.team}</p>
            <p className="text-2xl font-black text-cyan-400 mt-1">{bestDefense.goalsAgainst} GA</p>
            <p className="text-[10px] text-muted-foreground">{bestDefense.played} played</p>
          </CardContent></Card>
        )}
      </div>

      {/* Standings Table */}
      <Card className="glass-card-premium rounded-xl">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Trophy className="size-4 text-primary" />
            {LEAGUES.find(l => l.code === selectedLeague)?.name || 'Standings'}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : fetchError && standings.length === 0 ? (
            <DataState type="error" message="Failed to load standings. Check your connection and try again." />
          ) : standings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Trophy className="mb-3 size-10 opacity-30" />
              <p className="text-sm font-medium">No standings data available</p>
              <p className="text-xs mt-1">Try selecting a different league</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/30">
                    <TableHead className="w-8 text-xs text-center">#</TableHead>
                    <TableHead className="text-xs">Team</TableHead>
                    <TableHead className="w-8 text-xs text-center">P</TableHead>
                    <TableHead className="w-8 text-xs text-center">W</TableHead>
                    <TableHead className="w-8 text-xs text-center">D</TableHead>
                    <TableHead className="w-8 text-xs text-center">L</TableHead>
                    <TableHead className="w-8 text-xs text-center">GF</TableHead>
                    <TableHead className="w-8 text-xs text-center">GA</TableHead>
                    <TableHead className="w-8 text-xs text-center">GD</TableHead>
                    <TableHead className="w-10 text-xs text-center font-bold">Pts</TableHead>
                    <TableHead className="w-16 text-xs text-center">Form</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standings.map((row, idx) => {
                    const qualifiesChampions = idx < 4
                    const qualifiesEuropa = idx >= 4 && idx < 6
                    const relegation = idx >= standings.length - 3
                    return (
                      <TableRow
                        key={row.rank}
                        className={cn(
                          'cursor-pointer hover:bg-muted/20 transition-colors',
                          qualifiesChampions && 'bg-primary/5',
                          relegation && 'bg-red-500/5',
                        )}
                      >
                        <TableCell className="text-center text-xs font-bold">
                          {qualifiesChampions ? (
                            <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px]">{row.rank}</span>
                          ) : relegation ? (
                            <span className="inline-flex size-5 items-center justify-center rounded-full bg-red-500/20 text-red-400 text-[10px]">{row.rank}</span>
                          ) : (
                            <span className="text-muted-foreground">{row.rank}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TeamCrest code={row.code} espnLogo={row.logo} size="sm" />
                            <span className="text-xs font-medium">{row.team}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">{row.played}</TableCell>
                        <TableCell className="text-center text-xs text-emerald-400">{row.wins}</TableCell>
                        <TableCell className="text-center text-xs text-amber-400">{row.draws}</TableCell>
                        <TableCell className="text-center text-xs text-red-400">{row.losses}</TableCell>
                        <TableCell className="text-center text-xs">{row.goalsFor}</TableCell>
                        <TableCell className="text-center text-xs">{row.goalsAgainst}</TableCell>
                        <TableCell className="text-center text-xs font-medium">
                          <span className={row.goalDiff > 0 ? 'text-emerald-400' : row.goalDiff < 0 ? 'text-red-400' : ''}>
                            {row.goalDiff > 0 ? '+' : ''}{row.goalDiff}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-xs font-bold text-primary">{row.points}</TableCell>
                        <TableCell className="text-center">{renderForm(row.form)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
