/*
 * ELASTICO Dashboard — Command Center
 *
 * Answers: "What matters right now?"
 *
 * Composition: KPI strip → Live ticker → 2:1 asymmetric main area
 *   Left (primary):  Featured match with ELO probability bars
 *   Right (secondary): News rail + quick actions
 *
 * Design reference: ChatGPT-generated ELASTICO mockups (dark analytical aesthetic)
 * All data is real. No fabricated metrics.
 */

'use client'

import { useEffect, useCallback, useMemo } from 'react'
import { useElasticoStore } from '@/store/use-elastico-store'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Radio, Newspaper, RefreshCw, AlertCircle, Zap, ChevronRight,
  Trophy, Brain, BarChart3, Clock, ArrowRight, Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TeamCrest } from '@/components/elastico/primitives'
import { chartColor } from '@/lib/chart-theme'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function computeEloProb(homeElo: number, awayElo: number, outcome: string): number {
  const expectedHome = 1 / (1 + Math.pow(10, (awayElo - homeElo) / 400))
  if (outcome === 'home') return Math.round(expectedHome * 100)
  if (outcome === 'away') return Math.round((1 - expectedHome) * 100 * 0.75)
  return Math.round(100 - expectedHome * 100 - (1 - expectedHome) * 100 * 0.75)
}

// ─── KPI Strip ────────────────────────────────────────────────────────────────

function KpiStrip() {
  const { liveMatches, matches, user } = useElasticoStore()

  const liveCount = (liveMatches || []).filter(
    (m: any) => m.status === 'IN_PROGRESS' || m.status === 'LIVE'
  ).length

  const upcomingCount = matches.filter(
    (m) => !m.isSimulated && (m.status === 'upcoming' || m.status === 'live' || m.status === 'halftime')
  ).length

  const accuracy = user?.predictionAccuracy ?? null
  const streak = user?.predictionStreak ?? 0

  const kpis = [
    {
      label: 'LIVE NOW',
      value: liveCount,
      intent: liveCount > 0 ? 'danger' as const : 'default' as const,
      icon: <Radio className="size-3.5" />,
    },
    {
      label: 'UPCOMING',
      value: upcomingCount,
      intent: 'info' as const,
      icon: <Clock className="size-3.5" />,
    },
    {
      label: 'ACCURACY',
      value: accuracy !== null ? `${accuracy}%` : '—',
      intent: accuracy !== null && accuracy >= 55 ? 'success' as const : 'default' as const,
      icon: <BarChart3 className="size-3.5" />,
    },
    {
      label: 'BEST STREAK',
      value: streak > 0 ? streak : '—',
      intent: streak >= 3 ? 'success' as const : 'default' as const,
      icon: <Zap className="size-3.5" />,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="relative rounded-lg border border-border/40 bg-muted/20 px-4 py-3"
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className={cn(
            'text-muted-foreground',
            kpi.intent === 'danger' && 'text-red-400',
            kpi.intent === 'success' && 'text-emerald-400',
            kpi.intent === 'info' && 'text-blue-400',
          )}>
            {kpi.icon}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {kpi.label}
          </span>
        </div>
          <span className={cn(
            'text-2xl font-black tabular-nums leading-none',
            kpi.intent === 'danger' && 'text-red-400',
            kpi.intent === 'success' && 'text-emerald-400',
            kpi.intent === 'info' && 'text-blue-400',
            !['danger', 'success', 'info'].includes(kpi.intent) && 'text-foreground',
          )}>
            {kpi.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Live Ticker ──────────────────────────────────────────────────────────────

function LiveTicker() {
  const { liveMatches, isLiveLoading, errors, fetchLiveScores, selectMatch } =
    useElasticoStore()

  const liveGames = useMemo(
    () => (liveMatches || []).filter(
      (m: any) => m.status === 'IN_PROGRESS' || m.status === 'LIVE'
    ),
    [liveMatches]
  )

  if (isLiveLoading) {
    return (
      <div className="flex items-center gap-3 border-y border-border/40 bg-muted/10 px-4 py-2">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-muted-foreground/40" />
            <span className="relative inline-flex size-1.5 rounded-full bg-muted-foreground" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Live</span>
        </div>
        <div className="flex gap-6 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-4" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="size-4 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (errors.fetchLiveScores || liveGames.length === 0) return null

  return (
    <div className="flex items-center gap-3 border-y border-border/40 bg-muted/10 px-4 py-2 overflow-x-auto">
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-red-500" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-red-400">
          {liveGames.length} LIVE
        </span>
      </div>
      <div className="w-px h-4 bg-border/60 shrink-0" />
      <div className="flex gap-5">
        {liveGames.map((m: any, idx: number) => (
          <button
            key={m.id || idx}
            onClick={() => m.id && selectMatch(m.id)}
            className="flex items-center gap-2 shrink-0 hover:bg-accent/40 rounded-md px-1.5 py-0.5 -mx-1.5 transition-colors"
          >
            <TeamCrest
              code={m.homeTeam?.abbreviation || ''}
              espnLogo={m.homeTeam?.logo}
              size="xs"
            />
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {m.homeScore ?? 0}
            </span>
            <span className="text-[10px] text-muted-foreground">-</span>
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {m.awayScore ?? 0}
            </span>
            <TeamCrest
              code={m.awayTeam?.abbreviation || ''}
              espnLogo={m.awayTeam?.logo}
              size="xs"
            />
          </button>
        ))}
      </div>
      <div className="flex-1" />
      <button
        onClick={() => fetchLiveScores()}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Refresh live scores"
      >
        <RefreshCw className="size-3" />
      </button>
    </div>
  )
}

// ─── Featured Match Panel ────────────────────────────────────────────────────

function FeaturedMatchPanel() {
  const { matches, isLoading, errors, fetchMatches, selectMatch, liveMatches } =
    useElasticoStore()

  // Priority: live ESPN match → upcoming DB match → first available
  const featured = useMemo(() => {
    // Try live ESPN matches first
    const espnLive = (liveMatches || []).find(
      (m: any) => m.status === 'IN_PROGRESS' || m.status === 'LIVE'
    )
    if (espnLive) {
      return {
        id: espnLive.id,
        homeTeam: espnLive.homeTeam,
        awayTeam: espnLive.awayTeam,
        homeScore: espnLive.homeScore ?? 0,
        awayScore: espnLive.awayScore ?? 0,
        homeElo: null as number | null,
        awayElo: null as number | null,
        competition: espnLive.competition,
        status: 'live' as const,
        source: 'espn',
        date: espnLive.date,
      }
    }
    // Try DB upcoming matches
    const upcoming = matches.find(
      (m) => !m.isSimulated && (m.status === 'upcoming' || m.status === 'live')
    )
    if (upcoming) {
      return {
        id: upcoming.id,
        homeTeam: upcoming.homeTeam,
        awayTeam: upcoming.awayTeam,
        homeScore: upcoming.homeScore,
        awayScore: upcoming.awayScore,
        homeElo: upcoming.homeEloBefore ?? upcoming.homeTeam?.eloRating ?? 1500,
        awayElo: upcoming.awayEloBefore ?? upcoming.awayTeam?.eloRating ?? 1500,
        competition: upcoming.competition,
        status: (upcoming.status === 'live' ? 'live' : 'upcoming') as 'live' | 'upcoming',
        source: 'database',
        date: upcoming.date,
      }
    }
    return null
  }, [matches, liveMatches])

  // Loading
  if (isLoading && matches.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-muted/10 p-6 animate-pulse">
        <div className="flex items-center justify-between gap-6">
          <div className="flex-1 flex items-center gap-4">
            <Skeleton className="size-14 rounded-full" />
            <div className="space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-3 w-16" /></div>
          </div>
          <div className="text-center"><Skeleton className="h-10 w-24 mx-auto" /><Skeleton className="h-3 w-16 mt-2" /></div>
          <div className="flex-1 flex items-center gap-4 justify-end">
            <div className="space-y-2 text-right"><Skeleton className="h-5 w-32" /><Skeleton className="h-3 w-16" /></div>
            <Skeleton className="size-14 rounded-full" />
          </div>
        </div>
        <div className="mt-6 space-y-2">
          <Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    )
  }

  // Error
  if (errors.fetchMatches) {
    return (
      <div className="rounded-xl border border-border/40 bg-muted/10 p-8 flex flex-col items-center gap-3 text-center">
        <AlertCircle className="size-8 text-destructive" />
        <p className="text-sm text-muted-foreground">Failed to load match data.</p>
        <Button variant="outline" size="sm" onClick={fetchMatches} className="gap-1.5">
          <RefreshCw className="size-3" /> Retry
        </Button>
      </div>
    )
  }

  // No matches
  if (!featured) {
    return (
      <div className="rounded-xl border border-border/40 bg-muted/10 p-8 flex flex-col items-center gap-3 text-center">
        <Eye className="size-10 text-muted-foreground/30" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">No matches available right now</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Try a different time or browse all competitions</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => useElasticoStore.getState().setView('matches')}
          className="gap-1.5 mt-1"
        >
          <Trophy className="size-3" /> Browse Matches
        </Button>
      </div>
    )
  }

  // Compute probabilities — only when real ELO is available
  const hasElo = featured.homeElo != null && featured.awayElo != null
  const homeProb = hasElo ? computeEloProb(featured.homeElo!, featured.awayElo!, 'home') : null
  const drawProb = hasElo ? computeEloProb(featured.homeElo!, featured.awayElo!, 'draw') : null
  const awayProb = hasElo ? computeEloProb(featured.homeElo!, featured.awayElo!, 'away') : null

  const isLive = featured.status === 'live'

  return (
    <div className="rounded-xl border border-border/40 bg-muted/10 overflow-hidden">
      {/* Competition bar */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Trophy className="size-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">{featured.competition || 'Unknown Competition'}</span>
          {featured.source && (
            <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/50 border border-border/30 rounded px-1 py-px">
              {featured.source}
            </span>
          )}
        </div>
        {isLive && (
          <div className="flex items-center gap-1.5">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-red-500" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Live</span>
          </div>
        )}
      </div>

      {/* Match identity — team names, crests, score */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between gap-4">
          {/* Home team */}
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <TeamCrest
              code={featured.homeTeam?.abbreviation || featured.homeTeam?.code || '?'}
              espnLogo={featured.homeTeam?.logo}
              color={featured.homeTeam?.primaryColor}
              size="2xl"
              bordered
            />
            <div className="min-w-0">
              <p className="text-base font-bold truncate">
                {featured.homeTeam?.name || 'Home'}
              </p>
              <p className="text-[11px] text-muted-foreground tabular-nums font-medium">
                ELO {featured.homeElo ?? 'N/A'}
              </p>
            </div>
          </div>

          {/* Score / Time */}
          <div className="shrink-0 text-center min-w-[80px]">
            {isLive ? (
              <>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-3xl font-black tabular-nums text-foreground">
                    {featured.homeScore}
                  </span>
                  <span className="text-lg text-muted-foreground/50">:</span>
                  <span className="text-3xl font-black tabular-nums text-foreground">
                    {featured.awayScore}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">In Progress</p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">vs</p>
                {featured.date && (
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    {new Date(featured.date).toLocaleDateString(undefined, {
                      weekday: 'short', month: 'short', day: 'numeric',
                    })}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Away team */}
          <div className="flex-1 flex items-center gap-3 min-w-0 justify-end">
            <div className="min-w-0 text-right">
              <p className="text-base font-bold truncate">
                {featured.awayTeam?.name || 'Away'}
              </p>
              <p className="text-[11px] text-muted-foreground tabular-nums font-medium">
                ELO {featured.awayElo ?? 'N/A'}
              </p>
            </div>
            <TeamCrest
              code={featured.awayTeam?.abbreviation || featured.awayTeam?.code || '?'}
              espnLogo={featured.awayTeam?.logo}
              color={featured.awayTeam?.primaryColor}
              size="2xl"
              bordered
            />
          </div>
        </div>
      </div>

      {/* Probability bars — only shown when real ELO data exists */}
      {hasElo ? (
      <div className="px-6 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">Match Probability</span>
          <span className="text-[9px] text-muted-foreground/40 font-mono">(ELO-derived)</span>
        </div>
        <div className="space-y-1.5">
          {/* Home win bar */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-10 text-right shrink-0">Home</span>
            <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${homeProb}%`, backgroundColor: chartColor(0) }}
              />
            </div>
            <span className="text-xs font-bold tabular-nums w-9 text-right shrink-0" style={{ color: chartColor(0) }}>
              {homeProb}%
            </span>
          </div>
          {/* Draw bar */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-10 text-right shrink-0">Draw</span>
            <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${drawProb}%`, backgroundColor: chartColor(2) }}
              />
            </div>
            <span className="text-xs font-bold tabular-nums w-9 text-right shrink-0" style={{ color: chartColor(2) }}>
              {drawProb}%
            </span>
          </div>
          {/* Away win bar */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-10 text-right shrink-0">Away</span>
            <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${awayProb}%`, backgroundColor: chartColor(4) }}
              />
            </div>
            <span className="text-xs font-bold tabular-nums w-9 text-right shrink-0" style={{ color: chartColor(4) }}>
              {awayProb}%
            </span>
          </div>
        </div>
      </div>
      ) : (
      <div className="px-6 pb-4">
        <p className="text-[11px] text-muted-foreground/60 text-center py-3">ELO ratings unavailable for this match — probability bars require database-backed ELO data.</p>
      </div>
      )}

      {/* Action bar */}
      <div className="px-6 pb-5">
        <Button
          className="w-full h-9 gap-2 text-sm font-semibold"
          onClick={() => selectMatch(featured.id)}
        >
          <Eye className="size-3.5" />
          Analyse Match
          <ArrowRight className="size-3 ml-auto opacity-50" />
        </Button>
      </div>
    </div>
  )
}

// ─── News Rail ─────────────────────────────────────────────────────────────────

function NewsRail() {
  const { news, errors, fetchNews, isLoading, setView } = useElasticoStore()

  const handleRetry = useCallback(() => fetchNews(), [fetchNews])

  if (isLoading && news.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    )
  }

  if (errors.fetchNews) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <AlertCircle className="size-6 text-destructive" />
        <p className="text-xs text-muted-foreground">News unavailable</p>
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleRetry}>
          <RefreshCw className="size-3 mr-1" /> Retry
        </Button>
      </div>
    )
  }

  const articles = (news || []).slice(0, 8)

  if (articles.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Latest News
        </span>
        <button
          onClick={() => setView('news')}
          className="text-[10px] text-muted-foreground/60 hover:text-primary transition-colors flex items-center gap-0.5"
        >
          View all <ChevronRight className="size-2.5" />
        </button>
      </div>
      <div className="space-y-0 divide-y divide-border/30">
        {articles.map((item) => (
          <div
            key={item.id}
            className="group py-2.5 first:pt-0 last:pb-0 cursor-default"
          >
            <div className="flex items-start gap-2">
              {item.isBreaking && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-red-400 bg-red-400/10 px-1 py-px rounded shrink-0 mt-px">
                  Breaking
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[13px] font-medium leading-snug group-hover:text-primary transition-colors line-clamp-2">
                  {item.title}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {item.source && (
                    <span className="text-[10px] text-muted-foreground/60">{item.source}</span>
                  )}
                  {item.publishedAt && (
                    <span className="text-[10px] text-muted-foreground/40">{formatRelativeTime(item.publishedAt)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Quick Actions ─────────────────────────────────────────────────────────────

function QuickActions() {
  const setView = useElasticoStore((s) => s.setView)

  const actions = [
    { label: 'All Matches', icon: <Trophy className="size-3.5" />, view: 'matches' as const },
    { label: 'Predictions', icon: <BarChart3 className="size-3.5" />, view: 'predictions' as const },
    { label: 'AI Analyst', icon: <Brain className="size-3.5" />, view: 'ai-chat' as const },
  ]

  return (
    <div className="grid grid-cols-3 gap-2">
      {actions.map((a) => (
        <button
          key={a.view}
          onClick={() => setView(a.view)}
          className="flex flex-col items-center gap-1.5 rounded-lg border border-border/30 bg-muted/10 px-2 py-3 text-muted-foreground hover:text-foreground hover:bg-accent/40 hover:border-border/60 transition-all"
        >
          {a.icon}
          <span className="text-[10px] font-medium">{a.label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function DashboardView() {
  const { fetchLiveScores, fetchNews, fetchMatches } = useElasticoStore()

  useEffect(() => {
    fetchLiveScores()
    fetchNews()
    fetchMatches()
  }, [fetchLiveScores, fetchNews, fetchMatches])

  return (
    <section className="flex flex-col gap-4" aria-label="Dashboard">
      {/* Orientation: KPI strip */}
      <KpiStrip />

      {/* Live ticker — full width, only when live matches exist */}
      <LiveTicker />

      {/* Main content — 2:1 asymmetric split */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-0">
        {/* Primary: Featured match (3/5 = 60%) */}
        <div className="lg:col-span-3 min-w-0">
          <FeaturedMatchPanel />
        </div>

        {/* Secondary: News + actions (2/5 = 40%) */}
        <div className="lg:col-span-2 min-w-0 flex flex-col gap-4">
          <div className="rounded-xl border border-border/40 bg-muted/10 p-4 flex-1">
            <NewsRail />
          </div>
          <QuickActions />
        </div>
      </div>
    </section>
  )
}
