/*
 * ELASTICO Dashboard — Phase 4 rebuild
 *
 * Design rules enforced:
 *   DS-006: All charts use chart-theme.ts
 *   DS-010: Key numbers carry data-class badges
 *   DS-011/DS-021: No raw <img> — all team assets via TeamCrest primitive
 *   DS-019: Uses primitives: TeamCrest, StatBlock, StatusBadge, SectionHeader
 *   DS-031: No placeholder cards — every section has real content or is removed
 *   DS-038: 1366x768 flagship — compact, information-dense, minimal scroll
 *
 * Layout (1366x768 target, ~1062x640px usable):
 *   1. Live Score Ticker (full-width, ~56px)
 *   2. Quick Stats Row (4 StatBlocks, ~80px)
 *   3. Main Grid (3-col: 2+1)
 *      LEFT: Live Scores, Next Match Prediction, Latest Results
 *      RIGHT: Goals Chart, Standings Top 5, Quick Actions, AI CTA
 */

'use client'

import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { useElasticoStore } from '@/store/use-elastico-store'
import { Button } from '@/components/ui/button'
import {
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts'
import { Zap, Swords, Target, MessageSquare, Trophy, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MATCH_STATUS } from '@/lib/design-system'
import { axisProps, cartesianGridProps, tooltipContentStyle, chartColor } from '@/lib/chart-theme'
import { TeamCrest, StatBlock, StatusBadge, SectionHeader } from '@/components/elastico/primitives'

// ═══════════════════════════════════════════════════════════════════════════════
// ESPN DATA HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

interface EspnTeam {
  id?: string; name?: string; abbreviation?: string; logo?: string; color?: string
}
interface EspnMatch {
  id: string; homeTeam: EspnTeam; awayTeam: EspnTeam
  homeScore: number; awayScore: number; status: string; minute?: number
  competition: string; date?: string; venue?: string
}
interface StandingRow {
  rank: number; name: string; code: string; logo: string; color: string
  played: number; wins: number; draws: number; losses: number; points: number
}

function useEspnStandings(league = 'PL') {
  const [rows, setRows] = useState<StandingRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/live?action=standings&league=${league}`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then((data: any) => {
        const items = (data.data || []).slice(0, 10).map((t: any, i: number) => ({
          rank: i + 1,
          name: t.name || t.team?.displayName || '?',
          code: t.code || t.abbreviation || '',
          logo: t.logo || t.team?.logo || '',
          color: t.color || '',
          played: t.gamesPlayed ?? t.played ?? 0,
          wins: t.wins ?? 0, draws: t.draws ?? 0, losses: t.losses ?? 0,
          points: t.points ?? 0,
        }))
        setRows(items)
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [league])

  return { rows, loading }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TICKER
// ═══════════════════════════════════════════════════════════════════════════════

function LiveTicker({ matches }: { matches: EspnMatch[] }) {
  if (matches.length === 0) return null
  const doubled = [...matches, ...matches]
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border/30 bg-red-500/5">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-red-500" />
        </span>
        <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">Live Scores</span>
      </div>
      <div className="overflow-hidden">
        <div
          className="flex gap-6 py-2.5 px-4"
          style={{ animation: 'ticker-scroll 30s linear infinite', width: 'max-content' }}
        >
          {doubled.map((m, i) => (
            <div key={`${m.id}-${i}`} className="flex items-center gap-2 shrink-0">
              <TeamCrest code={m.homeTeam.abbreviation || ''} espnLogo={m.homeTeam.logo} color={m.homeTeam.color} size="sm" />
              <span className="text-xs font-semibold">{m.homeTeam.abbreviation ?? '?'}</span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold tabular-nums">{m.homeScore}</span>
                <span className="text-[10px] text-muted-foreground">-</span>
                <span className="text-sm font-bold tabular-nums">{m.awayScore}</span>
              </div>
              <span className="text-xs font-semibold">{m.awayTeam.abbreviation ?? '?'}</span>
              <TeamCrest code={m.awayTeam.abbreviation || ''} espnLogo={m.awayTeam.logo} color={m.awayTeam.color} size="sm" />
              <StatusBadge variant="status" value={m.status} minute={m.minute} />
              <span className="text-border/30">|</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// STANDINGS (compact top-5)
// ═══════════════════════════════════════════════════════════════════════════════

function StandingsCompact() {
  const { rows, loading } = useEspnStandings('PL')
  return (
    <div className="glass-card rounded-xl p-4">
      <SectionHeader
        label="Premier League"
        action={<span className="data-class-badge REAL">ESPN</span>}
        className="mb-3"
      />
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-5 bg-muted/50 rounded" />)}
        </div>
      ) : (
        <div className="space-y-1">
          {rows.slice(0, 5).map((t, i) => (
            <div key={t.name} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn(
                  'text-[10px] w-4 font-bold tabular-nums',
                  i < 4 ? 'text-emerald-400' : i >= rows.length - 3 ? 'text-red-400' : 'text-muted-foreground',
                )}>
                  {t.rank}
                </span>
                <TeamCrest code={t.code} espnLogo={t.logo} color={t.color} size="xs" />
                <span className="text-xs font-medium truncate">{t.name}</span>
              </div>
              <span className="text-xs font-bold tabular-nums text-primary">{t.points}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

export default function DashboardView() {
  const user = useElasticoStore(s => s.user)
  const token = useElasticoStore(s => s.token)
  const matches = useElasticoStore(s => s.matches)
  const liveMatches = useElasticoStore(s => s.liveMatches) as EspnMatch[]
  const news = useElasticoStore(s => s.news)
  const fetchMatches = useElasticoStore(s => s.fetchMatches)
  const setView = useElasticoStore(s => s.setView)

  // ── Derived data ───────────────────────────────────────────────────────
  const dbLive = useMemo(() => matches.filter(m => m.status === 'live' || m.status === 'halftime'), [matches])
  const upcoming = useMemo(() => matches.filter(m => m.status === 'upcoming').slice(0, 5), [matches])
  const finished = useMemo(() => matches.filter(m => m.status === 'finished').slice(0, 5), [matches])
  const nextMatch = upcoming[0] || null

  const accuracy = user?.predictionAccuracy ?? 0
  const streak = user?.predictionStreak ?? 0
  const bestStreak = user?.bestStreak ?? 0

  const liveCount = liveMatches?.filter(m => m.status === 'live').length ?? dbLive.length
  const upcomingCount = liveMatches?.filter(m => m.status === 'upcoming').length ?? upcoming.length

  const nextMatchProbs = useMemo(() => {
    if (!nextMatch) return { home: 40, draw: 28, away: 32 }
    return {
      home: nextMatch.homeWinProb ?? 40,
      draw: nextMatch.drawProb ?? 28,
      away: nextMatch.awayWinProb ?? 32,
    }
  }, [nextMatch])

  // Ticker items from ESPN live data, fallback to DB
  const tickerItems = useMemo(() => {
    if (liveMatches && liveMatches.length > 0) return liveMatches.slice(0, 10)
    return matches.slice(0, 5).map(m => ({
      id: m.id,
      homeTeam: { abbreviation: m.homeTeam?.code ?? '???', logo: m.homeTeam?.logo || '', color: m.homeTeam?.primaryColor ?? '' },
      awayTeam: { abbreviation: m.awayTeam?.code ?? '???', logo: m.awayTeam?.logo || '', color: m.awayTeam?.primaryColor ?? '' },
      homeScore: m.homeScore, awayScore: m.awayScore, status: m.status, competition: '',
    }))
  }, [liveMatches, matches])

  // Goals chart data
  const goalsChartData = useMemo(() => {
    const realFinished = liveMatches?.filter(m => m.status === 'finished').slice(0, 6)
    if (realFinished && realFinished.length > 0) {
      return realFinished.map(m => ({
        match: `${m.homeTeam.abbreviation || '?'}-${m.awayTeam.abbreviation || '?'}`,
        goals: m.homeScore + m.awayScore,
      }))
    }
    return finished.slice(0, 6).map(m => ({
      match: `${m.homeTeam?.code ?? '?'}-${m.awayTeam?.code ?? '?'}`,
      goals: m.homeScore + m.awayScore,
    }))
  }, [liveMatches, finished])

  // Determine goals chart data source
  const goalsDataSource = liveMatches?.some(m => m.status === 'finished') ? 'REAL' as const : 'DEMO' as const

  // News
  const newsItems = useMemo(() => {
    if (news.length > 0) return news.slice(0, 4)
    return []
  }, [news])

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleQuickPredict = useCallback((choice: 'home' | 'draw' | 'away') => {
    if (!nextMatch) return
    fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ matchId: nextMatch.id, predictedOutcome: choice, confidence: 75 }),
    }).then(() => fetchMatches()).catch(() => {})
  }, [nextMatch, token, fetchMatches])

  const navigateToMatch = useCallback((matchId: string) => {
    useElasticoStore.getState().selectMatch(matchId)
    setView('match-detail')
  }, [setView])

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* 1. LIVE TICKER */}
      <LiveTicker matches={tickerItems} />

      {/* 2. QUICK STATS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card rounded-xl p-3">
          <StatBlock
            label="Live Now"
            value={liveCount}
            intent="danger"
            dataClass={liveMatches ? 'REAL' : 'DEMO'}
            compact
          />
        </div>
        <div className="glass-card rounded-xl p-3">
          <StatBlock
            label="Upcoming"
            value={upcomingCount}
            intent="info"
            dataClass={liveMatches ? 'REAL' : 'DEMO'}
            compact
          />
        </div>
        <div className="glass-card rounded-xl p-3">
          <StatBlock
            label="Accuracy"
            value={`${accuracy}%`}
            intent="success"
            sublabel={`${user?.totalPredictions ?? 0} predictions`}
            dataClass="DERIVED"
            compact
          />
        </div>
        <div className="glass-card rounded-xl p-3">
          <StatBlock
            label="Streak"
            value={streak}
            intent={streak >= 3 ? 'success' : 'default'}
            sublabel={`Best: ${bestStreak}`}
            dataClass="REAL"
            compact
          />
        </div>
      </div>

      {/* 3. MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ─── LEFT COLUMN (2/3) ─── */}
        <div className="lg:col-span-2 space-y-4">

          {/* LIVE SCORES LIST */}
          {liveMatches && liveMatches.length > 0 && (
            <div className="glass-card rounded-xl p-4">
              <SectionHeader
                label="Live Scores — All Leagues"
                action={<span className="data-class-badge REAL">ESPN Live</span>}
                className="mb-2"
              />
              <div className="space-y-0.5">
                {liveMatches.slice(0, 6).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => navigateToMatch(m.id)}
                    className="w-full flex items-center justify-between py-2 px-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <TeamCrest code={m.homeTeam.abbreviation || ''} espnLogo={m.homeTeam.logo} color={m.homeTeam.color} size="sm" />
                      <span className="text-[10px] text-muted-foreground w-16 truncate">{m.competition}</span>
                      <span className="text-xs font-medium truncate">{m.homeTeam.name}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 shrink-0">
                      <span className="text-sm font-bold tabular-nums">{m.homeScore}</span>
                      <span className="text-[10px] text-muted-foreground">-</span>
                      <span className="text-sm font-bold tabular-nums">{m.awayScore}</span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                      <span className="text-xs font-medium truncate text-right">{m.awayTeam.name}</span>
                      <TeamCrest code={m.awayTeam.abbreviation || ''} espnLogo={m.awayTeam.logo} color={m.awayTeam.color} size="sm" />
                      <StatusBadge variant="status" value={m.status} minute={m.minute} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* NEXT MATCH PREDICTION */}
          {nextMatch && (
            <div className="glass-card-premium rounded-xl p-4 space-y-3">
              <SectionHeader
                label="Next Match Prediction"
                action={
                  <span className="inline-flex items-center gap-1.5 text-primary text-[10px] font-semibold">
                    <Zap className="size-3" /> Quick Predict
                  </span>
                }
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <TeamCrest
                    code={nextMatch.homeTeam?.code || ''}
                    espnLogo={nextMatch.homeTeam?.logo}
                    color={nextMatch.homeTeam?.primaryColor}
                    size="xl" bordered
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{nextMatch.homeTeam?.name ?? 'TBD'}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">ELO {nextMatch.homeEloBefore ?? '—'}</p>
                  </div>
                </div>
                <div className="text-center shrink-0 px-2">
                  <p className="text-lg font-black text-muted-foreground">VS</p>
                  <p className="text-[10px] text-muted-foreground truncate max-w-24">{nextMatch.venue ?? 'TBD'}</p>
                </div>
                <div className="flex items-center gap-3 min-w-0 justify-end">
                  <div className="min-w-0 text-right">
                    <p className="font-semibold text-sm truncate">{nextMatch.awayTeam?.name ?? 'TBD'}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">ELO {nextMatch.awayEloBefore ?? '—'}</p>
                  </div>
                  <TeamCrest
                    code={nextMatch.awayTeam?.code || ''}
                    espnLogo={nextMatch.awayTeam?.logo}
                    color={nextMatch.awayTeam?.primaryColor}
                    size="xl" bordered
                  />
                </div>
              </div>

              {/* Probability bars */}
              <div className="space-y-1.5">
                {([
                  { label: 'Home', pct: nextMatchProbs.home, color: 'from-emerald-500 to-emerald-400', text: 'text-emerald-400' },
                  { label: 'Draw', pct: nextMatchProbs.draw, color: 'from-amber-500 to-amber-400', text: 'text-amber-400' },
                  { label: 'Away', pct: nextMatchProbs.away, color: 'from-red-500 to-red-400', text: 'text-red-400' },
                ] as const).map((bar) => (
                  <div key={bar.label} className="flex items-center gap-2">
                    <span className={cn('text-[10px] w-8 font-medium', bar.text)}>{bar.label}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-1000', bar.color)}
                        style={{ width: `${bar.pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold tabular-nums w-10 text-right">{bar.pct}%</span>
                  </div>
                ))}
              </div>

              {/* Predict buttons */}
              <div className="grid grid-cols-3 gap-2">
                <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs font-semibold" onClick={() => handleQuickPredict('home')}>Home Win</Button>
                <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs font-semibold" onClick={() => handleQuickPredict('draw')}>Draw</Button>
                <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-semibold" onClick={() => handleQuickPredict('away')}>Away Win</Button>
              </div>
            </div>
          )}

          {/* LATEST RESULTS — ESPN first, DB fallback */}
          <div className="glass-card rounded-xl p-4">
            <SectionHeader
              label="Latest Results"
              action={
                <button onClick={() => setView('matches')} className="text-[10px] text-primary hover:underline">View all</button>
              }
              className="mb-2"
            />
            <div className="space-y-0.5">
              {/* ESPN finished matches */}
              {liveMatches && liveMatches.filter(m => m.status === 'finished').slice(0, 4).map((m) => (
                <button
                  key={`espn-${m.id}`}
                  onClick={() => navigateToMatch(m.id)}
                  className="w-full flex items-center justify-between py-2 border-b border-border/10 last:border-0 hover:bg-white/[0.02] rounded px-1 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <StatusBadge variant="status" value="finished" />
                    <TeamCrest code={m.homeTeam.abbreviation || ''} espnLogo={m.homeTeam.logo} color={m.homeTeam.color} size="xs" />
                    <span className="text-xs font-medium truncate">{m.homeTeam.name}</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums px-2 shrink-0">{m.homeScore}-{m.awayScore}</span>
                  <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                    <span className="text-xs font-medium truncate text-right">{m.awayTeam.name}</span>
                    <TeamCrest code={m.awayTeam.abbreviation || ''} espnLogo={m.awayTeam.logo} color={m.awayTeam.color} size="xs" />
                  </div>
                </button>
              ))}
              {/* DB finished matches — only shown if no ESPN finished */}
              {(!liveMatches || liveMatches.filter(m => m.status === 'finished').length === 0) && finished.map((m) => (
                <button
                  key={`db-${m.id}`}
                  onClick={() => navigateToMatch(m.id)}
                  className="w-full flex items-center justify-between py-2 border-b border-border/10 last:border-0 hover:bg-white/[0.02] rounded px-1 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <StatusBadge variant="status" value="finished" />
                    <TeamCrest code={m.homeTeam?.code || ''} espnLogo={m.homeTeam?.logo} color={m.homeTeam?.primaryColor} size="xs" />
                    <span className="text-xs font-medium truncate">{m.homeTeam?.name ?? 'TBD'}</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums px-2 shrink-0">{m.homeScore}-{m.awayScore}</span>
                  <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                    <span className="text-xs font-medium truncate text-right">{m.awayTeam?.name ?? 'TBD'}</span>
                    <TeamCrest code={m.awayTeam?.code || ''} espnLogo={m.awayTeam?.logo} color={m.awayTeam?.primaryColor} size="xs" />
                  </div>
                </button>
              ))}
              {(!liveMatches || liveMatches.filter(m => m.status === 'finished').length === 0) && finished.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">No recent results</p>
              )}
            </div>
          </div>
        </div>

        {/* ─── RIGHT COLUMN (1/3) ─── */}
        <div className="space-y-4">

          {/* GOALS CHART */}
          {goalsChartData.length > 0 && (
            <div className="glass-card rounded-xl p-4">
              <SectionHeader
                label="Goals per Match"
                action={<span className="data-class-badge">{goalsDataSource}</span>}
                className="mb-2"
              />
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={goalsChartData} barGap={4}>
                  <CartesianGrid {...cartesianGridProps} />
                  <XAxis dataKey="match" {...axisProps} tick={{ ...axisProps.tick, fontSize: 9 }} />
                  <YAxis {...axisProps} tick={{ ...axisProps.tick, fontSize: 10 }} />
                  <RTooltip contentStyle={tooltipContentStyle} />
                  <Bar dataKey="goals" fill={chartColor(0)} name="Goals" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* STANDINGS TOP 5 */}
          <StandingsCompact />

          {/* QUICK ACTIONS */}
          <div className="grid grid-cols-3 gap-2">
            {([
              { icon: Swords, label: 'Matches', view: 'matches' as const, color: 'text-primary' },
              { icon: MessageSquare, label: 'AI Chat', view: 'ai-chat' as const, color: 'text-cyan-400' },
              { icon: Target, label: 'Predict', view: 'predictions' as const, color: 'text-amber-400' },
            ]).map(({ icon: Icon, label, view, color }) => (
              <Button
                key={view}
                variant="outline"
                className="glass-card flex-col h-auto py-3 gap-1.5 text-xs border-border/50 hover:border-primary/30 hover:bg-primary/5"
                onClick={() => setView(view)}
              >
                <Icon className={cn('size-4', color)} />
                <span>{label}</span>
              </Button>
            ))}
          </div>

          {/* AI CTA */}
          <div className="glass-card rounded-xl p-4 border-primary/20">
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                <Sparkles className="size-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-primary mb-1">AI Insight</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">
                  Open AI Chat for match analysis, tactical breakdowns, and predictions.
                </p>
                <Button size="sm" variant="outline" className="border-primary/30 text-primary text-[10px] h-7 px-2.5" onClick={() => setView('ai-chat')}>
                  <MessageSquare className="size-3 mr-1" /> Open AI Chat
                </Button>
              </div>
            </div>
          </div>

          {/* NEWS (compact) */}
          {newsItems.length > 0 && (
            <div className="glass-card rounded-xl p-4">
              <SectionHeader
                label="News"
                action={
                  <button onClick={() => setView('news')} className="text-[10px] text-primary hover:underline">View all</button>
                }
                className="mb-2"
              />
              <div className="space-y-2">
                {newsItems.map((n, i) => (
                  <div key={n.id || i} className="group cursor-pointer">
                    <p className="text-xs font-medium leading-tight group-hover:text-primary transition-colors line-clamp-2">{n.title}</p>
                    {n.publishedAt && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.publishedAt).toLocaleDateString()}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
