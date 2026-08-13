'use client'

import React, { useCallback, useMemo, useRef } from 'react'
import { useElasticoStore } from '@/store/use-elastico-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts'
import {
  TrendingUp, Target, Zap, Users, Trophy, Swords, Clock,
  Star, Newspaper, MessageSquare, Cloud,
  ChevronRight, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface TickerMatch {
  id: string; homeCode: string; awayCode: string; homeColor: string; awayColor: string
  homeScore: number; awayScore: number; status: string; minute?: number
  homeLogo?: string; awayLogo?: string
}


// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD VIEW
// ═══════════════════════════════════════════════════════════════════════════════

export default function DashboardView() {
  const user = useElasticoStore(s => s.user)
  const token = useElasticoStore(s => s.token)
  const matches = useElasticoStore(s => s.matches)
  const liveMatches = useElasticoStore(s => s.liveMatches) as any[]
  const teams = useElasticoStore(s => s.teams)
  const news = useElasticoStore(s => s.news)
  const fetchMatches = useElasticoStore(s => s.fetchMatches)
  const setView = useElasticoStore(s => s.setView)
  const selectMatch = useElasticoStore(s => s.selectMatch)
  const tickerRef = useRef<HTMLDivElement>(null)

  // ── Derived data ─────────────────────────────────────────────────────────
  const dbLiveMatches = useMemo(() => matches.filter((m) => m.status === 'live' || m.status === 'halftime'), [matches])
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

  // Build ticker items from ESPN live data + DB matches
  const tickerItems: TickerMatch[] = useMemo(() => {
    // Prefer ESPN live data for the ticker
    if (liveMatches && liveMatches.length > 0) {
      return liveMatches.slice(0, 10).map((m: any) => ({
        id: m.id,
        homeCode: m.homeTeam?.abbreviation ?? '???',
        awayCode: m.awayTeam?.abbreviation ?? '???',
        homeColor: m.homeTeam?.color ?? '#555',
        awayColor: m.awayTeam?.color ?? '#555',
        homeLogo: m.homeTeam?.logo || '',
        awayLogo: m.awayTeam?.logo || '',
        homeScore: m.homeScore ?? 0,
        awayScore: m.awayScore ?? 0,
        status: m.status,
      }))
    }
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
    return real
  }, [liveMatches, matches])

  // Goals chart data — use real match data from ESPN
  const xgChartData = useMemo(() => {
    const realMatches = liveMatches && liveMatches.filter((m: any) => m.status === 'finished').slice(0, 5)
    if (realMatches && realMatches.length > 0) {
      return realMatches.map((m: any) => ({
        match: `${m.homeTeam?.abbreviation || '?'}-${m.awayTeam?.abbreviation || '?'}`,
        goals: m.homeScore + m.awayScore,
      }))
    }
    const db = finishedMatches.slice(0, 5).map((m) => ({
      match: `${m.homeTeam?.code ?? '?'}-${m.awayTeam?.code ?? '?'}`,
      goals: m.homeScore + m.awayScore,
    }))
    return db
  }, [liveMatches, finishedMatches])

  // News data — real from DB or football-data.org
  const newsItems = useMemo(() => {
    if (news.length > 0) {
      return news.slice(0, 5).map((n) => ({
        title: n.title,
        category: n.category,
        time: n.publishedAt ? new Date(n.publishedAt).toLocaleDateString() : 'Recent',
      }))
    }
    return []
  }, [news])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleQuickPredict = useCallback((choice: 'home' | 'draw' | 'away') => {
    if (!nextMatch) return
    fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        matchId: nextMatch.id,
        predictedOutcome: choice, // 'home' | 'draw' | 'away'
        confidence: 75,
      }),
    }).then(() => {
      fetchMatches()
    }).catch(() => {})
  }, [nextMatch, token, fetchMatches])

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
                <div key={`${m.id}-${i}`} className="flex items-center gap-2.5 shrink-0">
                  <div className="flex items-center gap-1.5">
                    {m.homeLogo ? <img src={m.homeLogo} alt="" className="size-5 rounded-full object-contain bg-muted/30 p-px" loading="lazy" /> : <div className="size-5 rounded-full border border-border/50 shrink-0" style={{ backgroundColor: m.homeColor }} />}
                    <span className="text-xs font-semibold">{m.homeCode}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold tabular-nums">{m.homeScore}</span>
                    <span className="text-xs text-muted-foreground">-</span>
                    <span className="text-sm font-bold tabular-nums">{m.awayScore}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold">{m.awayCode}</span>
                    {m.awayLogo ? <img src={m.awayLogo} alt="" className="size-5 rounded-full object-contain bg-muted/30 p-px" loading="lazy" /> : <div className="size-5 rounded-full border border-border/50 shrink-0" style={{ backgroundColor: m.awayColor }} />}
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

            {/* LIVE SCORES FROM ESPN */}
            {liveMatches && liveMatches.length > 0 && (
              <Card className="glass-card-premium rounded-xl">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-red-500" />
                      </span>
                      Live Scores — All Leagues
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                      ESPN Live
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {liveMatches.slice(0, 8).map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {m.homeTeam?.logo ? <img src={m.homeTeam.logo} alt="" className="size-4 rounded-full object-contain bg-muted/30 p-px shrink-0" loading="lazy" /> : null}
                          <span className="text-[10px] text-muted-foreground w-20 truncate">{m.competition}</span>
                          <span className="text-xs font-medium truncate">{m.homeTeam?.name}</span>
                        </div>
                        <div className="flex items-center gap-2 px-3">
                          <span className="text-sm font-bold tabular-nums">{m.homeScore}</span>
                          <span className="text-xs text-muted-foreground">-</span>
                          <span className="text-sm font-bold tabular-nums">{m.awayScore}</span>
                        </div>
                        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                          <span className="text-xs font-medium truncate">{m.awayTeam?.name}</span>
                          {m.awayTeam?.logo ? <img src={m.awayTeam.logo} alt="" className="size-4 rounded-full object-contain bg-muted/30 p-px shrink-0" loading="lazy" /> : null}
                          {m.status === 'live' && (
                            <Badge variant="outline" className="h-4 px-1 text-[9px] bg-red-500/15 text-red-400 border-red-500/30 shrink-0">
                              {m.minute ? `${m.minute}'` : 'LIVE'}
                            </Badge>
                          )}
                                          {m.status === 'finished' && (
                            <Badge variant="outline" className="h-4 px-1 text-[9px] text-muted-foreground border-border shrink-0">FT</Badge>
                          )}
                          {m.status === 'halftime' && (
                            <Badge variant="outline" className="h-4 px-1 text-[9px] text-amber-400 border-amber-500/30 shrink-0">HT</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

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
                      {nextMatch.homeTeam?.logo ? (
                        <img src={nextMatch.homeTeam.logo as string} alt={nextMatch.homeTeam.name as string} className="size-10 rounded-full object-contain bg-muted/30 p-0.5 border-2 border-border/50" />
                      ) : (
                        <div className="size-10 rounded-full border-2 border-border/50" style={{ backgroundColor: nextMatch.homeTeam?.primaryColor ?? '#555' }} />
                      )}
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
                      {nextMatch.awayTeam?.logo ? (
                        <img src={nextMatch.awayTeam.logo as string} alt={nextMatch.awayTeam.name as string} className="size-10 rounded-full object-contain bg-muted/30 p-0.5 border-2 border-border/50" />
                      ) : (
                        <div className="size-10 rounded-full border-2 border-border/50" style={{ backgroundColor: nextMatch.awayTeam?.primaryColor ?? '#555' }} />
                      )}
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

            {/* 8. RECENT RESULTS FROM ESPN */}
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Clock className="size-4 text-primary" />
                  Latest Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {liveMatches && liveMatches.filter((m: any) => m.status === 'finished').slice(0, 5).map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-[9px] text-zinc-400 border-zinc-700 shrink-0">FT</Badge>
                        <div>
                          <p className="text-xs font-medium">{m.homeTeam?.name} vs {m.awayTeam?.name}</p>
                          <p className="text-[10px] text-muted-foreground">{m.competition}</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold tabular-nums">{m.homeScore}-{m.awayScore}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 9. TOTAL GOALS CHART */}
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Target className="size-4 text-cyan-400" />
                  Total Goals per Match
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={xgChartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.2 0.03 260)" />
                    <XAxis dataKey="match" tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }} />
                    <RTooltip contentStyle={{ background: 'oklch(0.12 0.02 260)', border: '1px solid oklch(0.25 0.03 260)', borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="goals" fill="#00e676" name="Goals" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 10. TEAMS FROM DB (REAL) */}
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Trophy className="size-4 text-amber-400" />
                  Team Rankings (ELO)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/30 text-muted-foreground">
                        <th className="py-2 text-left w-6">#</th>
                        <th className="py-2 text-left">Team</th>
                        <th className="py-2 text-center">W</th>
                        <th className="py-2 text-center">D</th>
                        <th className="py-2 text-center">L</th>
                        <th className="py-2 text-center font-bold">ELO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.sort((a, b) => (b.eloRating || 0) - (a.eloRating || 0)).slice(0, 8).map((t, i) => (
                        <tr key={t.id} className={cn('border-b border-border/10', i < 2 && 'bg-primary/5')}>
                          <td className="py-2 font-bold">{i + 1}</td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              {t.logo ? <img src={t.logo} alt={t.code} className="size-4 rounded-full object-contain bg-muted/30 p-px" loading="lazy" /> : <div className="size-4 rounded-full border border-border/50" style={{ backgroundColor: t.primaryColor }} />}
                              <span className="font-medium">{t.name || t.code}</span>
                            </div>
                          </td>
                          <td className="py-2 text-center text-emerald-400">{t.wins}</td>
                          <td className="py-2 text-center text-amber-400">{t.draws}</td>
                          <td className="py-2 text-center text-red-400">{t.losses}</td>
                          <td className="py-2 text-center font-bold text-primary">{Math.round(t.eloRating)}</td>
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

            {/* 4. HANDICAP / MARKETS — requires selected match */}
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Star className="size-4 text-amber-400" />
                  Market Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center py-4">
                <p className="text-xs text-muted-foreground text-center mb-3">
                  Select a match to view handicap lines and market analysis.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-primary/30 text-primary text-xs"
                  onClick={() => setView('matches')}
                >
                  Go to Matches
                </Button>
              </CardContent>
            </Card>

            {/* 6. PREDICTION MODELS — requires selected match */}
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Users className="size-4 text-cyan-400" />
                  Prediction Models
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center py-4">
                <p className="text-xs text-muted-foreground text-center mb-3">
                  Prediction models require a selected match. Go to Matches → select a match → run the Prediction Engine.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-primary/30 text-primary text-xs"
                  onClick={() => setView('matches')}
                >
                  Go to Matches
                </Button>
              </CardContent>
            </Card>

            {/* 7. ELO RANKINGS (REAL) */}
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" />
                  ELO Rankings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {teams.sort((a, b) => (b.eloRating || 0) - (a.eloRating || 0)).slice(0, 5).map((t, i) => (
                  <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-border/10 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] w-4 text-muted-foreground font-bold">{i + 1}</span>
                      {t.logo ? <img src={t.logo} alt={t.code} className="size-4 rounded-full object-contain bg-muted/30 p-px" loading="lazy" /> : <div className="size-4 rounded-full border border-border/50" style={{ backgroundColor: t.primaryColor }} />}
                      <span className="text-xs font-medium">{t.name || t.code}</span>
                    </div>
                    <span className="text-xs font-bold tabular-nums">{Math.round(t.eloRating)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 11. ALL MATCHES BY LEAGUE */}
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Cloud className="size-4 text-sky-400" />
                  All Matches
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {liveMatches && liveMatches.slice(0, 6).map((m: any) => (
                  <div key={m.id} className="p-2.5 rounded-lg bg-muted/20 space-y-1.5">
                    <p className="text-[10px] text-muted-foreground">{m.competition} · {m.date ? new Date(m.date).toLocaleDateString() : ''}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {m.homeTeam?.logo ? <img src={m.homeTeam.logo} alt="" className="size-4 rounded-full object-contain bg-muted/30 p-px shrink-0" loading="lazy" /> : null}
                        <span className="text-xs font-medium truncate">{m.homeTeam?.name}</span>
                      </div>
                      <span className="text-xs font-bold tabular-nums px-2">{m.homeScore}-{m.awayScore}</span>
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                        <span className="text-xs font-medium truncate">{m.awayTeam?.name}</span>
                        {m.awayTeam?.logo ? <img src={m.awayTeam.logo} alt="" className="size-4 rounded-full object-contain bg-muted/30 p-px shrink-0" loading="lazy" /> : null}
                      </div>
                    </div>
                    <p className="text-[10px] text-sky-400 font-medium">
                      {m.status === 'live' ? `LIVE${m.minute ? ` ${m.minute}'` : ''}` :
                       m.status === 'finished' ? 'Full Time' :
                       m.status === 'halftime' ? 'Half Time' :
                       m.status === 'upcoming' ? `Upcoming · ${m.venue || ''}` : m.status}
                    </p>
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
            {(!user?.bestStreak && !user?.predictionStreak) ? (
              <Card className="glass-card-premium rounded-xl">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15">
                    <Zap className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Start Your Streak!</p>
                    <p className="text-[10px] text-muted-foreground">Make your first prediction to begin tracking.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="glass-card-premium rounded-xl ring-glow-emerald">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-orange-500/15">
                    <span className="text-2xl text-red-400 font-bold">W</span>
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
            )}

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

            {/* 15. AI CHAT CTA */}
            <Card className="glass-card-premium rounded-xl border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                    <Sparkles className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-primary mb-1">AI Insight</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">
                      Open AI Chat for match analysis and predictions.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-primary/30 text-primary text-[10px] h-7 px-2.5"
                      onClick={() => setView('ai-chat')}
                    >
                      <MessageSquare className="size-3 mr-1" />
                      Open AI Chat
                    </Button>
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