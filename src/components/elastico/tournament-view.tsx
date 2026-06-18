'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useElasticoStore } from '@/store/use-elastico-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Trophy, Star, Crown, Users, Swords, Goal, TrendingUp, ChevronRight, Zap, Award, BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

interface TeamData { id: string; name: string; code: string; primaryColor: string; secondaryColor: string; eloRating: number; group: string | null }
interface MatchData { id: string; homeTeamId: string; awayTeamId: string; homeTeam: { id: string; name: string; code: string; primaryColor: string } | null; awayTeam: { id: string; name: string; code: string; primaryColor: string } | null; stage: string; group: string | null; status: string; homeScore: number; awayScore: number; date: string | null }
interface GroupStanding { pos: number; team: TeamData; played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; goalDiff: number; points: number }
interface KnockoutMatch { id: string; label: string; stage: string; homeTeam: { name: string; code: string; primaryColor: string } | null; awayTeam: { name: string; code: string; primaryColor: string } | null; homeScore: number; awayScore: number; status: string; date: string | null }

const GROUPS = ['A', 'B', 'C', 'D']

// ── Helpers ────────────────────────────────────────────────────────────────

function computeGroupStandings(teams: TeamData[], matches: MatchData[], group: string): GroupStanding[] {
  const gt = teams.filter(t => t.group === group)
  const gm = matches.filter(m => m.group === group && m.status === 'finished')
  const stats: Record<string, { w: number; d: number; l: number; gf: number; ga: number }> = {}
  for (const t of gt) stats[t.id] = { w: 0, d: 0, l: 0, gf: 0, ga: 0 }
  for (const m of gm) {
    const h = m.homeTeam?.id, a = m.awayTeam?.id
    if (!h || !a || !stats[h] || !stats[a]) continue
    stats[h].gf += m.homeScore; stats[h].ga += m.awayScore
    stats[a].gf += m.awayScore; stats[a].ga += m.homeScore
    if (m.homeScore > m.awayScore) { stats[h].w++; stats[a].l++ }
    else if (m.homeScore < m.awayScore) { stats[a].w++; stats[h].l++ }
    else { stats[h].d++; stats[a].d++ }
  }
  return gt.map(team => {
    const s = stats[team.id]; const played = s.w + s.d + s.l
    return { pos: 0, team, played, won: s.w, drawn: s.d, lost: s.l, goalsFor: s.gf, goalsAgainst: s.ga, goalDiff: s.gf - s.ga, points: s.w * 3 + s.d }
  }).sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor).map((r, i) => ({ ...r, pos: i + 1 }))
}

function isKnockoutStage(stage: string) { return ['R16', 'QF', 'SF', 'Final', 'Third Place'].includes(stage) }
function getStageLabel(s: string) { return s === 'R16' ? 'Round of 16' : s === 'QF' ? 'Quarter-Finals' : s === 'SF' ? 'Semi-Finals' : s === 'Third Place' ? '3rd Place' : s }
function getStageOrder(s: string) { return s === 'R16' ? 0 : s === 'QF' ? 1 : s === 'SF' ? 2 : s === 'Third Place' ? 3 : 4 }

// ═══════════════════════════════════════════════════════════════════════════════

export default function TournamentView() {
  const selectMatch = useElasticoStore(s => s.selectMatch)
  const [teams, setTeams] = useState<TeamData[]>([])
  const [matches, setMatches] = useState<MatchData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTeam, setSelectedTeam] = useState<TeamData | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [tr, mr] = await Promise.all([fetch('/api/teams'), fetch('/api/matches?limit=100')])
      const td = await tr.json(); const md = await mr.json()
      setTeams(td.teams || []); setMatches(md.matches || [])
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { fetchData() }, [fetchData])

  const groupStandings = useMemo(() => {
    const map: Record<string, GroupStanding[]> = {}
    for (const g of GROUPS) map[g] = computeGroupStandings(teams, matches, g)
    return map
  }, [teams, matches])

  const allKO = useMemo(() => matches.filter(isKnockoutStage).sort((a, b) => getStageOrder(a.stage) - getStageOrder(b.stage)), [matches])
  const r16Matches = allKO.filter(m => m.stage === 'R16')
  const qfMatches = allKO.filter(m => m.stage === 'QF')
  const sfMatches = allKO.filter(m => m.stage === 'SF')
  const finalMatch = allKO.find(m => m.stage === 'Final')
  const thirdPlaceMatch = allKO.find(m => m.stage === 'Third Place')

  const totalTeams = teams.length
  const playedMatches = matches.filter(m => m.status === 'finished').length
  const totalGoals = matches.filter(m => m.status === 'finished').reduce((s, m) => s + m.homeScore + m.awayScore, 0)
  const avgGoals = playedMatches > 0 ? (totalGoals / playedMatches).toFixed(2) : '0.00'

  // Tournament progress
  const stages = ['Group Stage', 'R16', 'QF', 'SF', 'Final']
  const currentStageIdx = useMemo(() => {
    if (finalMatch?.status === 'finished') return 4
    if (sfMatches.some(m => m.status === 'finished')) return 3
    if (qfMatches.some(m => m.status === 'finished')) return 2
    if (r16Matches.some(m => m.status === 'finished')) return 1
    return 0
  }, [finalMatch, sfMatches, qfMatches, r16Matches])

  // Statistical highlights
  const highlights = useMemo(() => {
    const teamGoals: Record<string, { name: string; code: string; gf: number; ga: number; xg: number }> = {}
    for (const t of teams) teamGoals[t.id] = { name: t.name, code: t.code, gf: 0, ga: 0, xg: 0 }
    for (const m of matches.filter(m => m.status === 'finished')) {
      const hm = m.homeTeam; const am = m.awayTeam
      if (hm && teamGoals[hm.id]) { teamGoals[hm.id].gf += m.homeScore; teamGoals[hm.id].ga += m.awayScore }
      if (am && teamGoals[am.id]) { teamGoals[am.id].gf += m.awayScore; teamGoals[am.id].ga += m.homeScore }
    }
    const sorted = Object.values(teamGoals).sort((a, b) => b.gf - a.gf)
    return {
      topScorer: sorted[0] || { name: '—', code: '?', gf: 0, ga: 0, xg: 0 },
      bestDefense: [...sorted].sort((a, b) => a.ga - b.ga)[0] || { name: '—', code: '?', gf: 0, ga: 0, xg: 0 },
      topELO: [...teams].sort((a, b) => b.eloRating - a.eloRating).slice(0, 3),
    }
  }, [teams, matches])

  // Selected team's journey
  const teamJourney = useMemo(() => {
    if (!selectedTeam) return []
    return matches.filter(m => m.status === 'finished' && (m.homeTeam?.id === selectedTeam.id || m.awayTeam?.id === selectedTeam.id))
      .map(m => ({
        opponent: m.homeTeam?.id === selectedTeam.id ? m.awayTeam?.name : m.homeTeam?.name,
        homeScore: m.homeScore, awayScore: m.awayScore,
        isHome: m.homeTeam?.id === selectedTeam.id,
        result: m.homeTeam?.id === selectedTeam.id
          ? (m.homeScore > m.awayScore ? 'W' : m.homeScore === m.awayScore ? 'D' : 'L')
          : (m.awayScore > m.homeScore ? 'W' : m.awayScore === m.homeScore ? 'D' : 'L'),
        stage: m.stage,
      }))
  }, [selectedTeam, matches])

  // Qualifier scenarios
  const qualifierScenarios = useMemo(() => {
    const scenarios: { group: string; team: string; scenario: string; color: string }[] = []
    for (const g of GROUPS) {
      const rows = groupStandings[g]
      if (rows.length < 3) continue
      const second = rows[1]
      const third = rows[2]
      if (second && third && second.points - third.points <= 3) {
        scenarios.push({ group: g, team: third.team.code, scenario: `Can qualify with a win if ${second.team.code} loses`, color: 'text-amber-400' })
      }
      if (rows[0] && rows[1] && rows[0].points === rows[1].points) {
        scenarios.push({ group: g, team: rows[0].team.code, scenario: `Tied on points — GD decides`, color: 'text-primary' })
      }
    }
    return scenarios
  }, [groupStandings])

  const renderGroupTable = (group: string) => {
    const rows = groupStandings[group] || []
    return (
      <div className="overflow-hidden rounded-lg border border-border/50">
        <Table>
          <TableHeader><TableRow className="hover:bg-transparent bg-muted/30">
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
          </TableRow></TableHeader>
          <TableBody>
            {rows.map(row => {
              const advances = row.pos <= 2
              return (
                <TableRow key={row.team.id} className={cn('cursor-pointer hover:bg-muted/20', advances && 'bg-primary/5', selectedTeam?.id === row.team.id && 'ring-1 ring-primary/30')}
                  onClick={() => setSelectedTeam(selectedTeam?.id === row.team.id ? null : row.team)}>
                  <TableCell className="text-center text-xs font-bold">
                    {advances ? <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px]">{row.pos}</span> : <span className="text-muted-foreground">{row.pos}</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedTeam(selectedTeam?.id === row.team.id ? null : row.team) }}>
                      <div className="size-4 rounded-full border border-border/50" style={{ backgroundColor: row.team.primaryColor }} />
                      <span className="text-xs font-medium">{row.team.code}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">{row.played}</TableCell>
                  <TableCell className="text-center text-xs text-emerald-400">{row.won}</TableCell>
                  <TableCell className="text-center text-xs text-amber-400">{row.drawn}</TableCell>
                  <TableCell className="text-center text-xs text-red-400">{row.lost}</TableCell>
                  <TableCell className="text-center text-xs">{row.goalsFor}</TableCell>
                  <TableCell className="text-center text-xs">{row.goalsAgainst}</TableCell>
                  <TableCell className="text-center text-xs font-medium">
                    <span className={row.goalDiff > 0 ? 'text-emerald-400' : row.goalDiff < 0 ? 'text-red-400' : ''}>{row.goalDiff > 0 ? '+' : ''}{row.goalDiff}</span>
                  </TableCell>
                  <TableCell className="text-center text-xs font-bold text-primary">{row.points}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex gap-0.5 justify-center">
                      {Array.from({ length: row.won }).map((_, i) => <span key={`w${i}`} className="inline-flex size-3.5 items-center justify-center rounded text-[8px] font-bold bg-emerald-500/20 text-emerald-400">W</span>)}
                      {Array.from({ length: row.drawn }).map((_, i) => <span key={`d${i}`} className="inline-flex size-3.5 items-center justify-center rounded text-[8px] font-bold bg-amber-500/20 text-amber-400">D</span>)}
                      {Array.from({ length: row.lost }).map((_, i) => <span key={`l${i}`} className="inline-flex size-3.5 items-center justify-center rounded text-[8px] font-bold bg-red-500/20 text-red-400">L</span>)}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {rows.length === 0 && <TableRow><TableCell colSpan={11} className="text-center text-xs text-muted-foreground py-8">No teams</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    )
  }

  const renderKOMatch = (m: KnockoutMatch) => {
    const isUp = m.status === 'upcoming'; const isLive = m.status === 'live' || m.status === 'halftime'
    const winner = m.status === 'finished' ? (m.homeScore > m.awayScore ? m.homeTeam?.code : m.awayScore > m.homeScore ? m.awayTeam?.code : null) : null
    return (
      <div key={m.id} onClick={() => !isUp && selectMatch(m.id)} className={cn('glass-card-premium rounded-lg border border-border/50 p-3 transition-all cursor-pointer', isLive && 'border-red-500/20')}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{m.label}</span>
          {isLive && <Badge variant="outline" className="h-4 px-1.5 text-[9px] bg-red-500/15 text-red-400 border-red-500/30 pulse-live">LIVE</Badge>}
          {m.status === 'finished' && <Badge variant="outline" className="h-4 px-1.5 text-[9px] text-emerald-400 border-emerald-500/30">FT</Badge>}
          {isUp && <Badge variant="outline" className="h-4 px-1.5 text-[9px] text-muted-foreground border-border/50">TBD</Badge>}
        </div>
        {[m.homeTeam, m.awayTeam].map((team, idx) => {
          const isWinner = winner === team?.code; const score = idx === 0 ? m.homeScore : m.awayScore
          return (
            <div key={idx} className={cn('flex items-center justify-between py-1', winner && !isWinner ? 'opacity-50' : '')}>
              <div className="flex items-center gap-2">
                {team ? <div className="size-5 rounded-full border border-border/50 shrink-0" style={{ backgroundColor: team.primaryColor }} /> : <div className="size-5 rounded-full border border-border/50 bg-muted shrink-0" />}
                <span className={cn('text-xs font-medium', isWinner && 'text-emerald-400')}>{team?.name || 'TBD'}</span>
              </div>
              <span className="text-sm font-bold tabular-nums">{score}</span>
            </div>
          )
        })}
        <div className="my-1 border-t border-border/30" />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15"><Trophy className="size-5 text-amber-400" /></div>
          <div><h1 className="text-2xl font-bold tracking-tight">World Cup 2026</h1><p className="text-sm text-muted-foreground">Tournament bracket, group standings & knockout rounds</p></div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Users, label: 'Teams', value: totalTeams, color: 'text-primary' },
            { icon: Swords, label: 'Matches Played', value: playedMatches, color: 'text-amber-400' },
            { icon: Goal, label: 'Goals Scored', value: totalGoals, color: 'text-emerald-400' },
            { icon: TrendingUp, label: 'Avg Goals/Match', value: avgGoals, color: 'text-cyan-400' },
          ].map(s => (
            <Card key={s.label} className="glass-card-premium card-hover-lift rounded-xl"><CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/50"><s.icon className={cn('size-4', s.color)} /></div>
              <div><p className="text-lg font-bold leading-tight">{s.value}</p><p className="text-[10px] text-muted-foreground">{s.label}</p></div>
            </CardContent></Card>
          ))}
        </div>

        {/* Tournament Progress Bar */}
        <Card className="glass-card-premium rounded-xl"><CardContent className="p-4">
          <div className="flex items-center justify-between mb-2"><h3 className="text-sm font-bold">Tournament Progress</h3><span className="text-xs text-primary font-medium">{stages[currentStageIdx]}</span></div>
          <div className="flex h-2.5 rounded-full bg-muted/50 overflow-hidden gap-0.5">
            {stages.map((s, i) => (
              <div key={s} className={cn('h-full rounded-full transition-all duration-700', i <= currentStageIdx ? 'bg-gradient-to-r from-primary to-emerald-400' : 'bg-muted/30')} style={{ width: `${100 / stages.length}%` }} />
            ))}
          </div>
          <div className="flex justify-between mt-1.5 text-[8px] text-muted-foreground">{stages.map(s => <span key={s}>{s}</span>)}</div>
        </CardContent></Card>

        {/* Statistical Highlights */}
        <Card className="glass-card-premium rounded-xl"><CardContent className="p-4">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-3"><Award className="size-4 text-amber-400" />Statistical Highlights</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted/20 text-center">
              <p className="text-[10px] text-muted-foreground mb-1">Most Goals</p>
              <p className="text-sm font-bold">{highlights.topScorer.code}</p>
              <p className="text-lg font-black text-primary">{highlights.topScorer.gf}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/20 text-center">
              <p className="text-[10px] text-muted-foreground mb-1">Best Defense</p>
              <p className="text-sm font-bold">{highlights.bestDefense.code}</p>
              <p className="text-lg font-black text-cyan-400">{highlights.bestDefense.ga} GA</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/20">
              <p className="text-[10px] text-muted-foreground mb-1 text-center">Top ELO</p>
              <div className="flex justify-center gap-2">
                {highlights.topELO.map(t => <Tooltip key={t.id}><TooltipTrigger><Badge variant="outline" className="text-xs border-border/50">{t.code} <span className="text-primary font-bold">{t.eloRating}</span></Badge></TooltipTrigger><TooltipContent>{t.name}</TooltipContent></Tooltip>)}
              </div>
            </div>
          </div>
        </CardContent></Card>

        {/* Group Stage */}
        <div>
          <div className="mb-3 flex items-center gap-2"><Crown className="size-4 text-primary" /><h2 className="text-lg font-semibold">Group Stage</h2><Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Top 2 advance</Badge></div>
          {loading ? <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 w-full" />)}</div> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {GROUPS.map(g => (
                <Card key={g} className="glass-card-premium rounded-xl">
                  <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm font-bold flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary">{g}</span>Group {g}</CardTitle></CardHeader>
                  <CardContent className="px-3 pb-3">{renderGroupTable(g)}</CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Selected Team Journey */}
        {selectedTeam && (
          <Card className="glass-card-premium rounded-xl border-primary/20 animate-scale-in">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><ChevronRight className="size-4 text-primary" />{selectedTeam.name} — Tournament Journey</CardTitle></CardHeader>
            <CardContent>
              {teamJourney.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">No matches played yet</p> : (
                <div className="space-y-2">
                  {teamJourney.map((m, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border/10 last:border-0">
                      <div className="flex items-center gap-2"><Badge variant="outline" className="text-[9px] border-border/50">{m.stage}</Badge><span className="text-xs">vs {m.opponent}</span></div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold tabular-nums">{m.isHome ? '' : ''}{m.homeScore}-{m.awayScore}{m.isHome ? '' : ''}</span>
                        <span className={cn('inline-flex size-5 items-center justify-center rounded text-[10px] font-bold', m.result === 'W' ? 'bg-emerald-500/20 text-emerald-400' : m.result === 'D' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400')}>{m.result}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Qualifier Scenarios */}
        {qualifierScenarios.length > 0 && (
          <Card className="glass-card-premium rounded-xl">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><Zap className="size-4 text-amber-400" />Qualifier Scenarios</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {qualifierScenarios.map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20">
                  <Badge variant="outline" className="text-[10px] border-border/50">Group {s.group}</Badge>
                  <span className="text-xs font-medium">{s.team}</span>
                  <span className={cn('text-[10px] flex-1', s.color)}>{s.scenario}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Knockout Bracket */}
        <div>
          <div className="mb-3 flex items-center gap-2"><Star className="size-4 text-amber-400" /><h2 className="text-lg font-semibold">Knockout Stage</h2></div>
          {loading ? <Skeleton className="h-[500px] w-full" /> : allKO.length === 0 ? (
            <Card className="glass-card-premium rounded-xl"><CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground"><Trophy className="mb-3 size-10 opacity-30" /><p className="text-sm font-medium">Knockout matches not yet set</p></CardContent></Card>
          ) : (
            <Card className="glass-card-premium rounded-xl overflow-hidden"><CardContent className="p-4 md:p-6">
              {/* Desktop */}
              <div className="hidden md:flex gap-6 items-stretch min-h-[420px]">
                {[
                  { matches: r16Matches, label: 'Round of 16' },
                  { matches: qfMatches, label: 'Quarter-Finals' },
                  { matches: sfMatches, label: 'Semi-Finals' },
                ].map((col, ci) => (
                  <React.Fragment key={col.label}>
                    <div className="flex flex-col justify-around gap-3 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center mb-1">{col.label}</p>
                      {col.matches.length > 0 ? col.matches.map(m => renderKOMatch(m)) : <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/50">TBD</div>}
                    </div>
                    {ci < 2 && <div className="flex items-center w-10 shrink-0"><svg className="w-full h-full" viewBox="0 0 40 420" fill="none" preserveAspectRatio="none"><line x1="0" y1="105" x2="40" y2="105" stroke="oklch(0.25 0.03 260)" strokeWidth="1" strokeDasharray="4 3" /><line x1="40" y1="105" x2="40" y2="315" stroke="oklch(0.25 0.03 260)" strokeWidth="1" strokeDasharray="4 3" /><line x1="0" y1="315" x2="40" y2="315" stroke="oklch(0.25 0.03 260)" strokeWidth="1" strokeDasharray="4 3" /></svg></div>}
                  </React.Fragment>
                ))}
                {/* Finals column */}
                <div className="flex flex-col justify-around gap-3 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center mb-1">Finals</p>
                  {finalMatch && <div className="relative">{renderKOMatch(finalMatch)}<div className="absolute -top-1 -right-1"><Crown className="size-5 text-amber-400" /></div></div>}
                  {thirdPlaceMatch && renderKOMatch(thirdPlaceMatch)}
                  {!finalMatch && !thirdPlaceMatch && <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/50">TBD</div>}
                </div>
              </div>
              {/* Mobile */}
              <div className="md:hidden space-y-6">
                {[
                  { matches: r16Matches, label: 'Round of 16' },
                  { matches: qfMatches, label: 'Quarter-Finals' },
                  { matches: sfMatches, label: 'Semi-Finals' },
                  { matches: [finalMatch, thirdPlaceMatch].filter(Boolean) as KnockoutMatch[], label: 'Finals' },
                ].filter(c => c.matches.length > 0).map(col => (
                  <div key={col.label}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 text-center">{col.label}</p>
                    <div className="space-y-3">{col.matches.map(m => renderKOMatch(m))}</div>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}