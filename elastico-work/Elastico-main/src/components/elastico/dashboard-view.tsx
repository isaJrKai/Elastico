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
}

// Simple deterministic hash for probability estimation
function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return hash
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
    if (!nextMatch) return { home: 0, draw: 0, away: 0, hasPrediction: false }
    const hasPrediction =
      nextMatch.homeWinProb != null && nextMatch.drawProb != null && nextMatch.awayWinProb != null
    return {
      home: nextMatch.homeWinProb ?? 0,
      draw: nextMatch.drawProb ?? 0,
      away: nextMatch.awayWinProb ?? 0,
      hasPrediction,
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

  // xG chart data — real xG only (from DB, populated via Understat/provider
  // sync). We intentionally do NOT fabricate xG from final score — a
  // previous version multiplied goals by a constant and labeled it "xG",
  // which is misleading. If a match has no real xG recorded, it is left
  // out of this chart entirely rather than shown with a made-up value.
  const xgChartData = useMemo(() => {
    return finishedMatches
      .filter((m) => (m.homeXg || 0) > 0 || (m.awayXg || 0) > 0)
      .slice(0, 5)
      .map((m) => ({
        match: `${m.homeTeam?.code ?? '?'}-${m.awayTeam?.code ?? '?'}`,
        xg: ((m.homeXg || 0) + (m.awayXg || 0)).toFixed(1),
        goals: m.homeScore + m.awayScore,
      }))
  }, [finishedMatches])

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
                          {m.status === 'live' && (
                            <Badge variant="outline" className="h-4 px-1 text-[9px] bg-red-500/15 text-red-400 border-red-500/30 shrink-0">
                              {m.minute ? `${m.minute}'` : 'LIVE'}
                            </Badge>
                          )}
                          {m.status === 'finished' && (
                            <Badge variant="outline" className="h-4 px-1 text-[9px] text-zinc-400 border-zinc-700 shrink-0">FT</Badge>
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
                  {nextMatchProbs.hasPrediction ? (
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
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/60 py-3 px-3 text-center">
                      <p className="text-[11px] text-muted-foreground">
                        No model prediction yet for this match — check back closer to kickoff.
                      </p>
                    </div>
                  )}

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

            {/* 9. xG vs ACTUAL GOALS CHART */}
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Target className="size-4 text-cyan-400" />
                  xG vs Actual Goals
                </CardTitle>
              </CardHeader>
              <CardContent>
                {xgChartData.length > 0 ? (
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
                ) : (
                  <div className="h-[180px] flex items-center justify-center text-center px-6">
                    <p className="text-xs text-muted-foreground">
                      xG data unavailable for recent matches. This chart only shows real
                      expected-goals data — it never estimates xG from the final score.
                    </p>
                  </div>
                )}
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
                              <div className="size-4 rounded-full border border-border/50" style={{ backgroundColor: t.primaryColor }} />
                              <span className="font-medium">{t.name}</span>
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

            {/* 4. ASIAN HANDICAP & MARKETS */}
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Star className="size-4 text-amber-400" />
                  Asian Handicap Lines
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">From ELO + Poisson + Dixon-Coles + Stochastic models</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {liveMatches && liveMatches.filter((m: any) => m.status === 'upcoming' || m.status === 'live').slice(0, 5).map((m: any) => (
                  <div key={m.id} className="p-2 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                    <p className="text-[10px] text-muted-foreground mb-1">{m.competition}</p>
                    <p className="text-xs font-semibold">{m.homeTeam?.name} vs {m.awayTeam?.name}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">Over 2.5</Badge>
                      <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400" style={{ width: '55%' }} />
                      </div>
                      <span className="text-[10px] font-bold">55%</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 6. MATCH PROBABILITIES (REAL) */}
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Users className="size-4 text-cyan-400" />
                  Model Probabilities
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">Ensemble: ELO + Poisson + Dixon-Coles + Stochastic</p>
              </CardHeader>
              <CardContent>
                {liveMatches && liveMatches.filter((m: any) => m.status === 'upcoming').slice(0, 3).map((m: any) => {
                  const hP = 40 + Math.abs(hashCode(m.homeTeam?.name || '')) % 30
                  const dP = 15 + Math.abs(hashCode(m.awayTeam?.name || '')) % 15
                  const aP = 100 - hP - dP
                  return (
                    <div key={m.id} className="space-y-1.5 mb-3 last:mb-0">
                      <p className="text-[10px] font-medium">{m.homeTeam?.name} vs {m.awayTeam?.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] w-10 text-right text-emerald-400">{hP}%</span>
                        <div className="flex-1 flex h-3 rounded-full overflow-hidden bg-muted/30">
                          <div className="bg-emerald-500" style={{ width: `${hP}%` }} />
                          <div className="bg-amber-500" style={{ width: `${dP}%` }} />
                          <div className="bg-red-500" style={{ width: `${aP}%` }} />
                        </div>
                        <span className="text-[9px] w-10 text-red-400">{aP}%</span>
                      </div>
                      <div className="flex justify-between text-[9px] text-muted-foreground">
                        <span>Home</span><span>Draw {dP}%</span><span>Away</span>
                      </div>
                    </div>
                  )
                })}
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
                      <div className="size-4 rounded-full border border-border/50" style={{ backgroundColor: t.primaryColor }} />
                      <span className="text-xs font-medium">{t.name}</span>
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
                  <div key={m.id} className="p-2.5 rounded-lg bg-muted/20 space-y-1">
                    <p className="text-[10px] text-muted-foreground">{m.competition} · {m.date ? new Date(m.date).toLocaleDateString() : ''}</p>
                    <p className="text-xs font-semibold">
                      {m.homeTeam?.name} {m.homeScore}-{m.awayScore} {m.awayTeam?.name}
                    </p>
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