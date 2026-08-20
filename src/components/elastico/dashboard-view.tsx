/*
 * ELASTICO Dashboard — Honest rebuild (Phase 6A audit remediation)
 *
 * Removed all fabricated widgets. Only real-data widgets remain:
 *   1. Live Score Ticker — ESPN via /api/live
 *   2. News Feed — ESPN / Newsdata.io via /api/news
 *   3. Quick Predict cards — only shown when real match data is available
 *   4. Navigation prompt — directs users to Matches / Predictions for more
 *
 * Every widget has 4 states: LOADING → SUCCESS | EMPTY | ERROR (with retry)
 */

'use client'

import { useEffect, useCallback } from 'react'
import { useElasticoStore } from '@/store/use-elastico-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Radio,
  Newspaper,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  Inbox,
  ChevronRight,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str
}

// ─── Live Score Ticker Widget ────────────────────────────────────────────────

function LiveScoreWidget() {
  const { liveMatches, isLiveLoading, errors, fetchLiveScores, selectMatch, setView } =
    useElasticoStore()

  const handleRetry = useCallback(() => {
    fetchLiveScores()
  }, [fetchLiveScores])

  const handleMatchClick = useCallback(
    (id: string) => {
      selectMatch(id)
    },
    [selectMatch]
  )

  // Loading state
  if (isLiveLoading) {
    return (
      <Card className="glass-card-premium card-hover-lift rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Live Scores</CardTitle>
            <Badge variant="outline" className="ml-auto text-xs">
              Loading…
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-8 w-16 rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (errors.fetchLiveScores) {
    return (
      <Card className="glass-card-premium card-hover-lift rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Live Scores</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Failed to load live scores from ESPN.
            </p>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCw className="mr-2 h-3 w-3" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Empty state
  if (!liveMatches || liveMatches.length === 0) {
    return (
      <Card className="glass-card-premium card-hover-lift rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Live Scores</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No live matches right now.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('matches')}
              className="text-primary"
            >
              Browse all matches
              <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Success state
  return (
    <Card className="glass-card-premium card-hover-lift rounded-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Live Scores</CardTitle>
          <Badge variant="secondary" className="ml-auto text-xs">
            {liveMatches.length} {liveMatches.length === 1 ? 'match' : 'matches'}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleRetry}
            aria-label="Refresh live scores"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {liveMatches.map((match: any, idx: number) => {
            const isLive =
              match.status === 'IN_PROGRESS' || match.status === 'LIVE'
            return (
              <button
                key={match.id || idx}
                onClick={() => match.id && handleMatchClick(match.id)}
                className={cn(
                  'w-full flex items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent/50',
                  !match.id && 'cursor-default'
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {match.homeTeam || match.home_team || 'Home'}
                    </span>
                    <span className={cn(
                      'text-sm font-bold tabular-nums',
                      isLive ? 'text-primary' : 'text-foreground'
                    )}>
                      {match.homeScore ?? match.home_score ?? 0}
                    </span>
                    <span className="text-xs text-muted-foreground mx-1">-</span>
                    <span className={cn(
                      'text-sm font-bold tabular-nums',
                      isLive ? 'text-primary' : 'text-foreground'
                    )}>
                      {match.awayScore ?? match.away_score ?? 0}
                    </span>
                    <span className="text-sm font-medium truncate">
                      {match.awayTeam || match.away_team || 'Away'}
                    </span>
                  </div>
                  {match.competition && (
                    <span className="text-xs text-muted-foreground">
                      {match.competition}
                    </span>
                  )}
                </div>
                {isLive && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
                    <Zap className="h-2.5 w-2.5 mr-0.5" />
                    LIVE
                  </Badge>
                )}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── News Widget ─────────────────────────────────────────────────────────────

function NewsWidget() {
  const { news, errors, fetchNews, isLoading, setView } = useElasticoStore()

  const handleRetry = useCallback(() => {
    fetchNews()
  }, [fetchNews])

  // Loading state — show skeleton while store hasn't loaded yet
  if (isLoading && news.length === 0) {
    return (
      <Card className="glass-card-premium card-hover-lift rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Football News</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (errors.fetchNews) {
    return (
      <Card className="glass-card-premium card-hover-lift rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Football News</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Failed to load news feed.
            </p>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCw className="mr-2 h-3 w-3" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Empty state
  if (!news || news.length === 0) {
    return (
      <Card className="glass-card-premium card-hover-lift rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Football News</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No news articles available right now.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('news')}
              className="text-primary"
            >
              View all news
              <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Success state
  const displayNews = news.slice(0, 8)

  return (
    <Card className="glass-card-premium card-hover-lift rounded-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Football News</CardTitle>
          <Badge variant="secondary" className="ml-auto text-xs">
            {news.length} articles
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleRetry}
            aria-label="Refresh news"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {displayNews.map((item) => (
            <article key={item.id} className="group">
              <div className="flex items-start gap-2">
                {item.isBreaking && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0 mt-0.5">
                    BREAKING
                  </Badge>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium leading-snug group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    {item.source && (
                      <span className="text-xs text-muted-foreground">
                        {item.source}
                      </span>
                    )}
                    {item.publishedAt && (
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(item.publishedAt)}
                      </span>
                    )}
                    {item.category && item.category !== 'general' && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {item.category}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Quick Predict Widget ────────────────────────────────────────────────────

function QuickPredictWidget() {
  const { matches, isLoading, errors, fetchMatches, selectMatch, setView } =
    useElasticoStore()

  const handleRetry = useCallback(() => {
    fetchMatches()
  }, [fetchMatches])

  // Only show upcoming or in-progress matches (real data, not simulated)
  const realMatches = matches.filter(
    (m) => !m.isSimulated && (m.status === 'upcoming' || m.status === 'IN_PROGRESS')
  )

  // Loading state
  if (isLoading && matches.length === 0) {
    return (
      <Card className="glass-card-premium card-hover-lift rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Upcoming Matches</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (errors.fetchMatches) {
    return (
      <Card className="glass-card-premium card-hover-lift rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Upcoming Matches</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Failed to load match data.
            </p>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCw className="mr-2 h-3 w-3" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Empty state — no real upcoming matches
  if (realMatches.length === 0) {
    return (
      <Card className="glass-card-premium card-hover-lift rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Upcoming Matches</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No upcoming real matches available.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('matches')}
              className="text-primary"
            >
              Browse matches
              <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Success state — show up to 4 real upcoming matches
  const displayMatches = realMatches.slice(0, 4)

  return (
    <Card className="glass-card-premium card-hover-lift rounded-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Upcoming Matches</CardTitle>
          <Badge variant="secondary" className="ml-auto text-xs">
            {realMatches.length} upcoming
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {displayMatches.map((match) => (
            <button
              key={match.id}
              onClick={() => selectMatch(match.id)}
              className="w-full rounded-lg border border-border/50 px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <span className="truncate">
                      {match.homeTeam?.name || match.homeTeamId}
                    </span>
                    <span className="text-muted-foreground text-xs">vs</span>
                    <span className="truncate">
                      {match.awayTeam?.name || match.awayTeamId}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {match.competition && (
                      <span className="text-xs text-muted-foreground">
                        {match.competition}
                      </span>
                    )}
                    {match.date && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(match.date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Navigation Prompt ───────────────────────────────────────────────────────

function NavigationPrompt() {
  const setView = useElasticoStore((s) => s.setView)

  return (
    <Card className="glass-card-premium card-hover-lift rounded-xl">
      <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="rounded-full bg-primary/10 p-3">
          <Zap className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Explore More</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Navigate to Matches for detailed stats, or Predictions to submit and
            track your forecasts.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView('matches')}
          >
            <ChevronRight className="mr-1 h-3 w-3" />
            Matches
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView('predictions')}
          >
            <TrendingUp className="mr-1 h-3 w-3" />
            Predictions
          </Button>
        </div>
      </CardContent>
    </Card>
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
    <section className="space-y-6" aria-label="Dashboard">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live scores and news from verified sources only.
        </p>
      </div>

      {/* Main grid — only real-data widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Live Score Ticker — spans 2 cols on lg */}
        <div className="sm:col-span-2 lg:col-span-2">
          <LiveScoreWidget />
        </div>

        {/* Navigation prompt — right column */}
        <div className="hidden lg:block">
          <NavigationPrompt />
        </div>

        {/* News Feed — spans 2 cols on lg */}
        <div className="sm:col-span-2 lg:col-span-2">
          <NewsWidget />
        </div>

        {/* Upcoming Matches — right column on lg */}
        <div className="hidden lg:block">
          <QuickPredictWidget />
        </div>
      </div>

      {/* Mobile-only: stack remaining widgets below */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:hidden">
        <NavigationPrompt />
        <QuickPredictWidget />
      </div>
    </section>
  )
}
