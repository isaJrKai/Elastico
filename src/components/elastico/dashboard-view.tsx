'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useElasticoStore, type Match, type Team, type NewsItem } from '@/store/use-elastico-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, LineChart, Line,
} from 'recharts'
import {
  TrendingUp, Target, Zap, Activity, Users, Trophy, Swords, Clock,
  ArrowRight, Star, Flame, Brain, BarChart3, Network, Gamepad2,
  CalendarDays, MapPin, Cloud, Thermometer, Newspaper, MessageSquare,
  ChevronRight, Sparkles, Eye, Wind, Droplets, Shield, Award,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════════

interface TickerMatch {
  id: string; homeCode: string; awayCode: string; homeColor: string; awayColor: string
  homeScore: number; awayScore: number; status: string; minute?: number
}

const MOCK_TICKER: TickerMatch[] = [
  { id: '1', homeCode: 'BRA', awayCode: 'GER', homeColor: '#009c3b', awayColor: '#000000', homeScore: 2, awayScore: 1, status: 'finished' },
  { id: '2', homeCode: 'ARG', awayCode: 'FRA', homeColor: '#75aadb', awayColor: '#002395', homeScore: 3, awayScore: 3, status: 'live', minute: 78 },
  { id: '3', homeCode: 'ESP', awayCode: 'ENG', homeColor: '#c60b1e', awayColor: '#cf081f', homeScore: 1, awayScore: 0, status: 'finished' },
  { id: '4', homeCode: 'POR', awayCode: 'NED', homeColor: '#006600', awayColor: '#ff6600', homeScore: 0, awayScore: 0, status: 'upcoming' },
  { id: '5', homeCode: 'ITA', awayCode: 'JPN', homeColor: '#008c45', awayColor: '#bc002d', homeScore: 2, awayScore: 2, status: 'finished' },
]

const MOCK_TOP_PERFORMERS = [
  { name: 'Kylian Mbappé', code: 'FRA', rating: 8.7, goals: 3, assists: 2, position: 'FW' },
  { name: 'Jude Bellingham', code: 'ENG', rating: 8.4, goals: 2, assists: 3, position: 'MF' },
  { name: 'Vinícius Jr', code: 'BRA', rating: 8.2, goals: 2, assists: 1, position: 'FW' },
]

const MOCK_COMMUNITY_PIES = [
  { name: 'Home', value: 45, fill: '#00e676' },
  { name: 'Draw', value: 25, fill: '#ffd700' },
  { name: 'Away', value: 30, fill: '#ff4757' },
]

const MOCK_ELO_TEAMS = [
  { name: 'Brazil', code: 'BRA', elo: 2085, change: +12 },
  { name: 'Argentina', code: 'ARG', elo: 2071, change: +8 },
  { name: 'France', code: 'FRA', elo: 2058, change: -3 },
  { name: 'Spain', code: 'ESP', elo: 2042, change: +5 },
  { name: 'England', code: 'ENG', elo: 2035, change: -1 },
]

const MOCK_RECENT_ACTIVITY = [
  { match: 'BRA vs GER', prediction: 'Home Win', result: 'W' as const, points: 10 },
  { match: 'ESP vs ENG', prediction: 'Home Win', result: 'W' as const, points: 10 },
  { match: 'ITA vs JPN', prediction: 'Home Win', result: 'D' as const, points: 3 },
  { match: 'POR vs NED', prediction: 'Draw', result: 'P' as const, points: 0 },
  { match: 'ARG vs FRA', prediction: 'Away Win', result: 'P' as const, points: 0 },
]

const MOCK_XG_DATA = [
  { match: 'BRA-GER', xg: 2.4, goals: 2 },
  { match: 'ARG-FRA', xg: 1.8, goals: 3 },
  { match: 'ESP-ENG', xg: 1.2, goals: 1 },
  { match: 'ITA-JPN', xg: 2.1, goals: 2 },
  { match: 'POR-NED', xg: 1.5, goals: 0 },
]

const MOCK_FORM_TABLE = [
  { pos: 1, team: 'BRA', code: 'BRA', color: '#009c3b', p: 3, w: 3, d: 0, l: 0, gd: +5, pts: 9, form: 'WWW' },
  { pos: 2, team: 'ARG', code: 'ARG', color: '#75aadb', p: 3, w: 2, d: 1, l: 0, gd: +3, pts: 7, form: 'WDW' },
  { pos: 3, team: 'FRA', code: 'FRA', color: '#002395', p: 3, w: 1, d: 2, l: 0, gd: +2, pts: 5, form: 'DWD' },
  { pos: 4, team: 'GER', code: 'GER', color: '#000000', p: 3, w: 0, d: 1, l: 2, gd: -3, pts: 1, form: 'LDL' },
]

const MOCK_NEWS = [
  { title: 'Mbappé scores hat-trick in group stage', category: 'Performance', time: '2h ago' },
  { title: 'VAR controversy in Spain vs England match', category: 'Controversy', time: '4h ago' },
  { title: 'Brazil secures top spot in Group A', category: 'Tournament', time: '6h ago' },
]

const MOCK_WEATHER = [
  { match: 'POR vs NED', condition: 'Partly Cloudy', temp: 22, wind: 12, humidity: 65 },
  { match: 'JPN vs KOR', condition: 'Sunny', temp: 28, wind: 8, humidity: 45 },
]

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD VIEW
// ═══════════════════════════════════════════════════════════════════════════════

export default function DashboardView() {
  const user = useElasticoStore(s => s.user)
  const matches = useElasticoStore(s => s.matches)
  const teams = useElasticoStore(s => s.teams)
  const news = useElasticoStore(s => s.news)
  const setView = useElasticoStore(s => s.setView)
  const selectMatch = useElasticoStore(s => s.selectMatch)
  const tickerRef = useRef<HTMLDivElement>(null)

  // ── Derived data ─────────────────────────────────────────────────────────
  const liveMatches = useMemo(() => matches.filter((m) => m.status === 'live' || m.status === 'halftime'), [matches])
  const upcomingMatches = useMemo(() => matches.filter((m) => m.status === 'upcoming').slice(0, 5), [matches])
  const finishedMatches = useMemo(() => matches.filter((m) => m.status === 'finished').slice(0, 5), [matches])
  const nextMatch = upcomingMatches[0] || null

  const accuracy = user?.predictionAccuracy ?? 0
  const streak = user?.predictionStreak ?? 0
  const bestStreak = user?.bestStreak ?? 0

  const nextMatchProbs = useMemo(() => {
    if (!nextMatch) return { home: 40, draw: 28, away: 32 }
    return {
      home: nextMatch.homeWinProb ?? 40,
      draw: nextMatch.drawProb ?? 28,
      away: nextMatch.awayWinProb ?? 32,
    }
  }, [nextMatch])

  // Build ticker items from real + mock data
  const tickerItems: TickerMatch[] = useMemo(() => {
    const real = matches.slice(0, 5).map((m) => ({
      id: m.id,
      homeCode: m.homeTeam?.code ?? '???',
      awayCode: m.awayTeam?.code ?? '???',
      homeColor: m.homeTeam?.primaryColor ?? '#555',
      awayColor: m.awayTeam?.primaryColor ?? '#555',
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      status: m.status,
    }))
    return real.length > 0 ? real : MOCK_TICKER
  }, [matches])

  // xG chart data
  const xgChartData = useMemo(() => {
    const real = finishedMatches.slice(0, 5).map((m) => ({
      match: `${m.homeTeam?.code ?? '?'}-${m.awayTeam?.code ?? '?'}`,
      xg: (m.homeXg + m.awayXg).toFixed(1),
      goals: m.homeScore + m.awayScore,
    }))
    return real.length > 0 ? real : MOCK_XG_DATA
  }, [finishedMatches])

  // News data
  const newsItems = useMemo(() => {
    if (news.length > 0) {
      return news.slice(0, 3).map((n) => ({
        title: n.title,
        category: n.category,
        time: n.publishedAt ? new Date(n.publishedAt).toLocaleDateString() : 'Recent',
      }))
    }
    return MOCK_NEWS
  }, [news])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleQuickPredict = useCallback((choice: 'home' | 'draw' | 'away') => {
    if (!nextMatch) return
    fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${store.token}` },
      body: JSON.stringify({
        matchId: nextMatch.id,
        predictedOutcome: choice === 'home' ? 'home_win' : choice === 'draw' ? 'draw' : 'away_win',
        confidence: 75,
      }),
    }).then(() => {
      store.fetchMatches()
    }).catch(() => {})
  }, [nextMatch, store])

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <TooltipProvider>
      <div className="space-y-5 animate-fade-in-up">
        {/* ═══════════════════════════════════════════════════════════════════
            1. LIVE SCORE TICKER
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="glass-card-premium rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30 bg-red-500/5">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-red-500" />
            </span>
            <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Live Scores</span>
          </div>
          <div ref={tickerRef} className="overflow-hidden">
            <div
              className="flex gap-6 py-3 px-4"
              style={{ animation: 'ticker-scroll 30s linear infinite', width: 'max-content' }}
            >
              {[...tickerItems, ...tickerItems].map((m, i) => (
                <div key={`${m.id}-${i}`} className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="size-5 rounded-full border border-border/50 shrink-0" style={{ backgroundColor: m.homeColor }} />
                    <span className="text-xs font-semibold">{m.homeCode}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold tabular-nums">{m.homeScore}</span>
                    <span className="text-xs text-muted-foreground">-</span>
                    <span className="text-sm font-bold tabular-nums">{m.awayScore}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{m.awayCode}</span>
                    <div className="size-5 rounded-full border border-border/50 shrink-0" style={{ backgroundColor: m.awayColor }} />
                  </div>
                  {m.status === 'live' && (
                    <Badge variant="outline" className="h-4 px-1.5 text-[9px] bg-red-500/15 text-red-400 border-red-500/30">
                      <span className="pulse-live inline-block size-1.5 rounded-full bg-red-500 mr-1" />
                      LIVE
                    </Badge>
                  )}
                  {m.status === 'finished' && (
                    <Badge variant="outline" className="h-4 px-1.5 text-[9px] text-emerald-400 border-emerald-500/30">FT</Badge>
                  )}
                  <span className="text-border/50">|</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            MAIN GRID
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

          {/* ─── LEFT COLUMN ─── */}
          <div className="lg:col-span-2 space-y-5">

            {/* 2. QUICK PREDICT WIDGET + 5. MATCH PROBABILITIES */}
            {nextMatch && (
              <Card className="glass-card-premium card-hover-lift rounded-xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Zap className="size-4 text-primary" />
                      Next Match Prediction
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] border-primary/30 text-primary badge-glow">
                      Quick Predict
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full border-2 border-border/50" style={{ backgroundColor: nextMatch.homeTeam?.primaryColor ?? '#555' }} />
                      <div>
                        <p className="font-semibold text-sm">{nextMatch.homeTeam?.name ?? 'TBD'}</p>
                        <p className="text-[10px] text-muted-foreground">ELO {nextMatch.homeEloBefore ?? '—'}</p>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-black text-muted-foreground">VS</p>
                      <p className="text-[10px] text-muted-foreground">{nextMatch.venue ?? 'TBD'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold text-sm">{nextMatch.awayTeam?.name ?? 'TBD'}</p>
                        <p className="text-[10px] text-muted-foreground">ELO {nextMatch.awayEloBefore ?? '—'}</p>
                      </div>
                      <div className="size-10 rounded-full border-2 border-border/50" style={{ backgroundColor: nextMatch.awayTeam?.primaryColor ?? '#555' }} />
                    </div>
                  </div>

                  {/* Probability bars */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] w-8 text-emerald-400 font-medium">Home</span>
                      <div className="flex-1 h-3 rounded-full bg-muted/50 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-1000" style={{ width: `${nextMatchProbs.home}%` }} />
                      </div>
                      <span className="text-[11px] font-bold tabular-nums w-10 text-right">{nextMatchProbs.home}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] w-8 text-amber-400 font-medium">Draw</span>
                      <div className="flex-1 h-3 rounded-full bg-muted/50 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-1000" style={{ width: `${nextMatchProbs.draw}%` }} />
                      </div>
                      <span className="text-[11px] font-bold tabular-nums w-10 text-right">{nextMatchProbs.draw}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] w-8 text-red-400 font-medium">Away</span>
                      <div className="flex-1 h-3 rounded-full bg-muted/50 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-1000" style={{ width: `${nextMatchProbs.away}%` }} />
                      </div>
                      <span className="text-[11px] font-bold tabular-nums w-10 text-right">{nextMatchProbs.away}%</span>
                    </div>
                  </div>

                  {/* Predict buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 text-xs font-semibold"
                      onClick={() => handleQuickPredict('home')}
                    >
                      Home Win
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 text-xs font-semibold"
                      onClick={() => handleQuickPredict('draw')}
                    >
                      Draw
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 text-xs font-semibold"
                      onClick={() => handleQuickPredict('away')}
                    >
                      Away Win
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 8. RECENT ACTIVITY */}
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Clock className="size-4 text-primary" />
                  Recent Predictions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {MOCK_RECENT_ACTIVITY.map((a, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'flex size-6 items-center justify-center rounded-full text-[10px] font-bold',
                          a.result === 'W' ? 'bg-emerald-500/20 text-emerald-400' :
                          a.result === 'D' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-red-500/20 text-red-400'
                        )}>
                          {a.result}
                        </div>
                        <div>
                          <p className="text-xs font-medium">{a.match}</p>
                          <p className="text-[10px] text-muted-foreground">{a.prediction}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold tabular-nums">+{a.points} pts</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 9. xG vs ACTUAL GOALS CHART */}
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Target className="size-4 text-cyan-400" />
                  xG vs Actual Goals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={xgChartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.2 0.03 260)" />
                    <XAxis dataKey="match" tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }} />
                    <RTooltip contentStyle={{ background: 'oklch(0.12 0.02 260)', border: '1px solid oklch(0.25 0.03 260)', borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="xg" fill="#00b4d8" name="xG" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="goals" fill="#00e676" name="Goals" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 10. FORM TABLE */}
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Trophy className="size-4 text-amber-400" />
                  Mini League Table
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/30 text-muted-foreground">
                        <th className="py-2 text-left w-6">#</th>
                        <th className="py-2 text-left">Team</th>
                        <th className="py-2 text-center">P</th>
                        <th className="py-2 text-center">W</th>
                        <th className="py-2 text-center">D</th>
                        <th className="py-2 text-center">L</th>
                        <th className="py-2 text-center">GD</th>
                        <th className="py-2 text-center font-bold">Pts</th>
                        <th className="py-2 text-center">Form</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_FORM_TABLE.map((row) => (
                        <tr key={row.code} className={cn('border-b border-border/10', row.pos <= 2 && 'bg-primary/5')}>
                          <td className="py-2 font-bold">
                            {row.pos <= 2 ? (
                              <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px]">{row.pos}</span>
                            ) : row.pos}
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <div className="size-4 rounded-full border border-border/50" style={{ backgroundColor: row.color }} />
                              <span className="font-medium">{row.code}</span>
                            </div>
                          </td>
                          <td className="py-2 text-center text-muted-foreground">{row.p}</td>
                          <td className="py-2 text-center text-emerald-400">{row.w}</td>
                          <td className="py-2 text-center text-amber-400">{row.d}</td>
                          <td className="py-2 text-center text-red-400">{row.l}</td>
                          <td className="py-2 text-center font-medium">{row.gd > 0 ? '+' : ''}{row.gd}</td>
                          <td className="py-2 text-center font-bold text-primary">{row.pts}</td>
                          <td className="py-2">
                            <div className="flex gap-0.5 justify-center">
                              {row.form.split('').map((f, fi) => (
                                <span key={fi} className={cn('inline-flex size-4 items-center justify-center rounded text-[9px] font-bold', f === 'W' ? 'bg-emerald-500/20 text-emerald-400' : f === 'D' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400')}>
                                  {f}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ─── RIGHT COLUMN ─── */}
          <div className="space-y-5">

            {/* 3. PREDICTION ACCURACY RING */}
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Target className="size-4 text-primary" />
                  Accuracy
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <div className="relative size-32">
                  <svg className="size-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="oklch(0.15 0.02 260)" strokeWidth="10" />
                    <circle
                      cx="60" cy="60" r="50" fill="none"
                      stroke="url(#accuracyGrad)" strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${accuracy * 3.14} 314`}
                      className="transition-all duration-1000"
                    />
                    <defs>
                      <linearGradient id="accuracyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#00e676" />
                        <stop offset="100%" stopColor="#00bfa5" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-primary">{accuracy}%</span>
                    <span className="text-[10px] text-muted-foreground">Accuracy</span>
                  </div>
                </div>
                <div className="mt-3 flex gap-4 text-center text-xs">
                  <div>
                    <p className="font-bold text-foreground">{user?.totalPredictions ?? 0}</p>
                    <p className="text-muted-foreground">Total</p>
                  </div>
                  <div>
                    <p className="font-bold text-emerald-400">{user?.correctPredictions ?? 0}</p>
                    <p className="text-muted-foreground">Correct</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 4. TOP PERFORMERS */}
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Star className="size-4 text-amber-400" />
                  Top Performers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {MOCK_TOP_PERFORMERS.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                    <div className="flex size-8 items-center justify-center rounded-full bg-amber-500/15 text-amber-400 text-xs font-bold">
                      #{i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.code} · {p.position}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">{p.rating}</p>
                      <p className="text-[10px] text-muted-foreground">{p.goals}G {p.assists}A</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 6. COMMUNITY PREDICTIONS PIE */}
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Users className="size-4 text-cyan-400" />
                  Community Predictions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={MOCK_COMMUNITY_PIES} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={3} dataKey="value" stroke="none">
                      {MOCK_COMMUNITY_PIES.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RTooltip contentStyle={{ background: 'oklch(0.12 0.02 260)', border: '1px solid oklch(0.25 0.03 260)', borderRadius: 8, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-1">
                  {MOCK_COMMUNITY_PIES.map((p) => (
                    <div key={p.name} className="flex items-center gap-1.5 text-[10px]">
                      <div className="size-2 rounded-full" style={{ backgroundColor: p.fill }} />
                      <span className="text-muted-foreground">{p.name}</span>
                      <span className="font-bold">{p.value}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 7. ELO RANKINGS */}
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" />
                  ELO Rankings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {MOCK_ELO_TEAMS.map((t, i) => (
                  <div key={t.code} className="flex items-center justify-between py-1.5 border-b border-border/10 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] w-4 text-muted-foreground font-bold">{i + 1}</span>
                      <div className="size-4 rounded-full border border-border/50" style={{ backgroundColor: teams.find((tm) => tm.code === t.code)?.primaryColor ?? '#555' }} />
                      <span className="text-xs font-medium">{t.code}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold tabular-nums">{t.elo}</span>
                      <span className={cn('text-[10px] font-bold', t.change > 0 ? 'text-emerald-400' : t.change < 0 ? 'text-red-400' : 'text-muted-foreground')}>
                        {t.change > 0 ? '▲' : t.change < 0 ? '▼' : '—'}{Math.abs(t.change)}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 11. WEATHER IMPACT */}
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Cloud className="size-4 text-sky-400" />
                  Weather Impact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {MOCK_WEATHER.map((w, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-muted/20 space-y-2">
                    <p className="text-xs font-semibold">{w.match}</p>
                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Thermometer className="size-3" /> {w.temp}°C
                      </span>
                      <span className="flex items-center gap-1">
                        <Wind className="size-3" /> {w.wind} km/h
                      </span>
                      <span className="flex items-center gap-1">
                        <Droplets className="size-3" /> {w.humidity}%
                      </span>
                    </div>
                    <p className="text-[10px] text-sky-400 font-medium">{w.condition}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 12. TRENDING NEWS */}
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Newspaper className="size-4 text-amber-400" />
                  Trending News
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {newsItems.map((n, i) => (
                  <div key={i} className="flex items-start gap-2.5 group cursor-pointer">
                    <Badge variant="outline" className="shrink-0 mt-0.5 text-[9px] border-amber-500/30 text-amber-400">
                      {n.category}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-xs font-medium leading-tight group-hover:text-primary transition-colors line-clamp-2">{n.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{n.time}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 13. STREAK COUNTER */}
            <Card className="glass-card-premium rounded-xl ring-glow-emerald">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-orange-500/15">
                  <span className="text-2xl streak-fire">🔥</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-primary">{streak}</p>
                  <p className="text-[10px] text-muted-foreground">Current Streak</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-sm font-bold text-amber-400">Best: {bestStreak}</p>
                  <p className="text-[10px] text-muted-foreground">All Time</p>
                </div>
              </CardContent>
            </Card>

            {/* 14. QUICK ACTIONS */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                className="glass-card flex-col h-auto py-3 gap-1.5 text-xs border-border/50 hover:border-primary/30 hover:bg-primary/5"
                onClick={() => setView('matches')}
              >
                <Swords className="size-4 text-primary" />
                <span>Matches</span>
              </Button>
              <Button
                variant="outline"
                className="glass-card flex-col h-auto py-3 gap-1.5 text-xs border-border/50 hover:border-primary/30 hover:bg-primary/5"
                onClick={() => setView('ai-chat')}
              >
                <MessageSquare className="size-4 text-cyan-400" />
                <span>AI Chat</span>
              </Button>
              <Button
                variant="outline"
                className="glass-card flex-col h-auto py-3 gap-1.5 text-xs border-border/50 hover:border-primary/30 hover:bg-primary/5"
                onClick={() => setView('predictions')}
              >
                <Target className="size-4 text-amber-400" />
                <span>Predict</span>
              </Button>
            </div>

            {/* 15. PERSONALIZED INSIGHT */}
            <Card className="glass-card-premium rounded-xl border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                    <Sparkles className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-primary mb-1">AI Insight</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {accuracy > 70
                        ? "You're on fire! Your prediction accuracy is above 70%. Focus on underdog matches where the community leans heavily toward favorites — you have an edge in spotting upsets."
                        : accuracy > 50
                        ? "Good progress! Try analyzing xG differentials before predicting draws — matches where both teams have similar xG often end in draws."
                        : "Tip: Start by predicting matches with the highest ELO differentials. Favorites with a 150+ ELO advantage win 72% of the time."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}