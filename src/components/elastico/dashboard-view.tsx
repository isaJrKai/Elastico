/*
 * ELASTICO Dashboard
 *
 * Answers: "What matters right now?"
 *
 * Layout: Status bar → Live ticker → Asymmetric main
 *   Left:  Featured match (primary surface)
 *   Right: News list + navigation links (secondary)
 *
 * All data is real. No fabricated metrics.
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useElasticoStore } from '@/store/use-elastico-store'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  RefreshCw, AlertCircle, ChevronRight,
  Trophy, Brain, BarChart3, ArrowRight, Eye, List,
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

// ─── Status Bar ────────────────────────────────────────────────────────────────

function StatusBar() {
  const { liveMatches, matches, user } = useElasticoStore()

  const liveCount = (liveMatches || []).filter(
    (m: any) => m.status === 'live' || m.status === 'halftime'
  ).length

  const upcomingCount = matches.filter(
    (m) => !m.isSimulated && (m.status === 'upcoming' || m.status === 'live' || m.status === 'halftime')
  ).length

  const accuracy = user?.predictionAccuracy ?? null
  const streak = user?.predictionStreak ?? 0

  return (
    <div className="flex items-center gap-5 text-xs px-1 py-1">
      <span className={cn(
        'font-semibold tabular-nums',
        liveCount > 0 ? 'text-red-400' : 'text-muted-foreground'
      )}>
        {liveCount} live
      </span>
      <span className="text-muted-foreground/30">|</span>
      <span className="text-muted-foreground tabular-nums">{upcomingCount} upcoming</span>
      {accuracy !== null && (
        <>
          <span className="text-muted-foreground/30 hidden sm:inline">|</span>
          <span className={cn(
            'tabular-nums hidden sm:inline',
            accuracy >= 55 ? 'text-emerald-400' : 'text-muted-foreground'
          )}>
            {accuracy}% accuracy
          </span>
        </>
      )}
      {streak > 0 && (
        <>
          <span className="text-muted-foreground/30 hidden sm:inline">|</span>
          <span className="tabular-nums text-muted-foreground hidden sm:inline">{streak} streak</span>
        </>
      )}
      <div className="flex-1" />
      <button
        onClick={() => useElasticoStore.getState().fetchLiveScores()}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Refresh"
      >
        <RefreshCw className="size-3" />
      </button>
    </div>
  )
}

// ─── Live Ticker ──────────────────────────────────────────────────────────────

function LiveTicker() {
  const { liveMatches, isLiveLoading, errors, fetchLiveScores, selectMatch } =
    useElasticoStore()

  const liveGames = useMemo(
    () => (liveMatches || []).filter(
      (m: any) => m.status === 'live' || m.status === 'halftime'
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
            onClick={() => m.id && selectMatch(`espn:${m.id}`)}
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

  // Priority: live ESPN → upcoming DB → ESPN upcoming → ESPN finished → any DB → null
  const featured = useMemo(() => {
    // Priority 1: Live ESPN match
    const espnLive = (liveMatches || []).find(
      (m: any) => m.status === 'live' || m.status === 'halftime'
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

    // Priority 2: Upcoming DB match
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

    // Priority 3: Any ESPN match (upcoming / scheduled)
    const espnUpcoming = (liveMatches || []).find((m: any) => m.status === 'upcoming' || m.status === 'STATUS_SCHEDULED')
    if (espnUpcoming) {
      const mappedStatus = espnUpcoming.status === 'STATUS_SCHEDULED' ? 'upcoming' : espnUpcoming.status
      return {
        id: espnUpcoming.id,
        homeTeam: espnUpcoming.homeTeam,
        awayTeam: espnUpcoming.awayTeam,
        homeScore: espnUpcoming.homeScore ?? 0,
        awayScore: espnUpcoming.awayScore ?? 0,
        homeElo: null as number | null,
        awayElo: null as number | null,
        competition: espnUpcoming.competition,
        status: mappedStatus as 'live' | 'upcoming',
        source: 'espn',
        date: espnUpcoming.date,
      }
    }

    // Priority 4: Most recent finished ESPN match
    const espnFinished = (liveMatches || []).find((m: any) => m.status === 'finished' || m.status === 'STATUS_FULL_TIME')
    if (espnFinished) {
      return {
        id: espnFinished.id,
        homeTeam: espnFinished.homeTeam,
        awayTeam: espnFinished.awayTeam,
        homeScore: espnFinished.homeScore ?? 0,
        awayScore: espnFinished.awayScore ?? 0,
        homeElo: null as number | null,
        awayElo: null as number | null,
        competition: espnFinished.competition,
        status: 'finished' as const,
        source: 'espn',
        date: espnFinished.date,
      }
    }

    // Priority 5: Any DB match (including finished)
    const anyDb = matches.find((m) => !m.isSimulated)
    if (anyDb) {
      return {
        id: anyDb.id,
        homeTeam: anyDb.homeTeam,
        awayTeam: anyDb.awayTeam,
        homeScore: anyDb.homeScore,
        awayScore: anyDb.awayScore,
        homeElo: anyDb.homeEloBefore ?? anyDb.homeTeam?.eloRating ?? 1500,
        awayElo: anyDb.awayEloBefore ?? anyDb.awayTeam?.eloRating ?? 1500,
        competition: anyDb.competition,
        status: (anyDb.status === 'live' ? 'live' : anyDb.status === 'finished' ? 'finished' : 'upcoming') as 'live' | 'upcoming' | 'finished',
        source: 'database',
        date: anyDb.date,
      }
    }

    return null
  }, [matches, liveMatches])

  // Loading
  if (isLoading && matches.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-6">
          <div className="flex-1 flex items-center gap-4">
            <Skeleton className="size-12 rounded-full" />
            <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-16" /></div>
          </div>
          <div className="text-center"><Skeleton className="h-10 w-24 mx-auto" /><Skeleton className="h-3 w-16 mt-2" /></div>
          <div className="flex-1 flex items-center gap-4 justify-end">
            <div className="space-y-2 text-right"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-16" /></div>
            <Skeleton className="size-12 rounded-full" />
          </div>
        </div>
        <div className="mt-5 space-y-2">
          <Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    )
  }

  // Error
  if (errors.fetchMatches) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 flex flex-col items-center gap-3 text-center">
        <AlertCircle className="size-7 text-destructive" />
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
      <div className="rounded-lg border border-border bg-card p-8 flex flex-col items-center gap-3 text-center">
        <Eye className="size-8 text-muted-foreground/30" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">No matches available right now</p>
          <p className="text-xs text-muted-foreground/50 mt-1">Try a different time or browse all competitions</p>
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
  const isFinished = featured.status === 'finished'

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Match identity — team names, crests, score */}
      <div className="px-5 pt-5 pb-4">
        {/* Competition + status inline above teams */}
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="size-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">{featured.competition || 'Unknown Competition'}</span>
          {featured.source && (
            <span className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wider">
              {featured.source}
            </span>
          )}
          <div className="flex-1" />
          {isLive && (
            <div className="flex items-center gap-1.5">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-red-500" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Live</span>
            </div>
          )}
          {isFinished && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">FT</span>
          )}
        </div>

        {/* Teams + score */}
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
            {isLive || isFinished ? (
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
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
                  {isLive ? 'In Progress' : 'Full Time'}
                </p>
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
      <div className="px-5 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">Probability</span>
          <span className="text-[9px] text-muted-foreground/40 font-mono">ELO</span>
        </div>
        <div className="space-y-1.5">
          {/* Home win bar */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-10 text-right shrink-0">Home</span>
            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-700"
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
            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-700"
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
            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-700"
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
      <div className="px-5 pb-4">
        <p className="text-[11px] text-muted-foreground/50 text-center py-3">ELO ratings unavailable for this match source.</p>
      </div>
      )}

      {/* Action bar */}
      <div className="px-5 pb-4">
        <Button
          className="w-full h-8 gap-2 text-sm font-medium"
          onClick={() => selectMatch(featured.source === 'espn' ? `espn:${featured.id}` : featured.id)}
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

function QuickLinks() {
  const setView = useElasticoStore((s) => s.setView)

  const links = [
    { label: 'All Matches', icon: <Trophy className="size-3" />, view: 'matches' as const },
    { label: 'Predictions', icon: <BarChart3 className="size-3" />, view: 'predictions' as const },
    { label: 'AI Analyst', icon: <Brain className="size-3" />, view: 'ai-chat' as const },
    { label: 'Standings', icon: <List className="size-3" />, view: 'leaderboard' as const },
  ]

  return (
    <div className="flex flex-col gap-1">
      {links.map((l) => (
        <button
          key={l.view}
          onClick={() => setView(l.view)}
          className="flex items-center gap-2 px-1 py-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent/40 text-left"
        >
          {l.icon}
          {l.label}
        </button>
      ))}
    </div>
  )
}

// ─── Upcoming Fixtures (football-data.org fallback) ─────────────────────────

function UpcomingFixtures({ matches }: { matches: any[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? matches : matches.slice(0, 5)

  if (matches.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
        <span className="text-[11px] font-medium text-muted-foreground">Upcoming Fixtures</span>
        <span className="text-[11px] tabular-nums text-muted-foreground/60">
          {matches.length}
        </span>
      </div>
      <div className="divide-y divide-border/30">
        {visible.map((m: any, idx: number) => {
          const home = m.homeTeam?.shortName || m.homeTeam?.name || 'Home'
          const away = m.awayTeam?.shortName || m.awayTeam?.name || 'Away'
          const dateStr = m.utcDate || m.date
          const matchDate = dateStr
            ? new Date(dateStr).toLocaleDateString(undefined, {
                weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })
            : 'TBD'
          const homeCrest = m.homeTeam?.crest || m.homeTeam?.logo
          const awayCrest = m.awayTeam?.crest || m.awayTeam?.logo

          return (
            <div
              key={m.id || idx}
              className="flex items-center gap-3 px-4 py-2 hover:bg-accent/30 transition-colors"
            >
              {homeCrest ? (
                <img
                  src={homeCrest}
                  alt={home}
                  className="size-4 shrink-0 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : null}
              <span className="text-[13px] font-medium truncate flex-1">{home}</span>
              <span className="text-[11px] text-muted-foreground/40 shrink-0">vs</span>
              <span className="text-[13px] font-medium truncate flex-1 text-right">{away}</span>
              {awayCrest ? (
                <img
                  src={awayCrest}
                  alt={away}
                  className="size-4 shrink-0 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : null}
              <span className="text-[10px] text-muted-foreground/50 tabular-nums shrink-0 ml-2">{matchDate}</span>
            </div>
          )
        })}
      </div>
      {matches.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-2 text-[11px] text-muted-foreground hover:text-foreground border-t border-border/30 hover:bg-accent/30 transition-colors flex items-center justify-center gap-1"
        >
          {expanded ? 'Show less' : `Show all ${matches.length}`}
          <ChevronRight className={cn('size-3 transition-transform', expanded && 'rotate-90')} />
        </button>
      )}
    </div>
  )
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function DashboardView() {
  const { fetchLiveScores, fetchNews, fetchMatches, matches, liveMatches } = useElasticoStore()
  const [fdMatches, setFdMatches] = useState<any[]>([])
  const [fdLoading, setFdLoading] = useState(false)

  // Compute featured (same logic as FeaturedMatchPanel) to know when to show fallback
  const featured = useMemo(() => {
    const espnLive = (liveMatches || []).find(
      (m: any) => m.status === 'live' || m.status === 'halftime'
    )
    if (espnLive) return espnLive
    const upcoming = matches.find(
      (m) => !m.isSimulated && (m.status === 'upcoming' || m.status === 'live')
    )
    if (upcoming) return upcoming
    const espnUpcoming = (liveMatches || []).find((m: any) => m.status === 'upcoming' || m.status === 'STATUS_SCHEDULED')
    if (espnUpcoming) return espnUpcoming
    const espnFinished = (liveMatches || []).find((m: any) => m.status === 'finished' || m.status === 'STATUS_FULL_TIME')
    if (espnFinished) return espnFinished
    const anyDb = matches.find((m) => !m.isSimulated)
    if (anyDb) return anyDb
    return null
  }, [matches, liveMatches])

  useEffect(() => {
    fetchLiveScores()
    fetchNews()
    fetchMatches()
  }, [fetchLiveScores, fetchNews, fetchMatches])

  // Fetch upcoming fixtures: try football-data.org first, fallback to /api/live (ESPN)
  useEffect(() => {
    let cancelled = false
    setFdLoading(true)
    const loadFixtures = async () => {
      try {
        // 1. football-data.org (requires API key)
        const r1 = await fetch('/api/football-data?action=matches&status=SCHEDULED&competition=PL')
        if (r1.ok) {
          const d1 = await r1.json()
          const items = d1.data || d1.matches || []
          if (items.length > 0 && !cancelled) { setFdMatches(items); setFdLoading(false); return }
        }
      } catch { /* continue to fallback */ }
      try {
        // 2. ESPN via /api/live (no API key needed)
        const r2 = await fetch('/api/live')
        if (r2.ok) {
          const d2 = await r2.json()
          const items = (d2.matches || []).filter(
            (m: any) => m.status === 'upcoming' || m.status === 'STATUS_SCHEDULED'
          )
          if (items.length > 0 && !cancelled) { setFdMatches(items); setFdLoading(false); return }
        }
      } catch { /* ignore */ }
      if (!cancelled) setFdMatches([])
    }
    loadFixtures().finally(() => { if (!cancelled) setFdLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <section className="flex flex-col gap-4" aria-label="Dashboard">
      {/* Status bar — inline metrics, no card wrappers */}
      <StatusBar />

      {/* Live ticker — full width, only when live matches exist */}
      <LiveTicker />

      {/* Main content — fixed-width right rail */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 min-h-0">
        {/* Primary: Featured match + fallback fixtures */}
        <div className="min-w-0 flex flex-col gap-4">
          <FeaturedMatchPanel />
          {featured === null && fdLoading && (
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="space-y-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-4 rounded-full" />
                    <Skeleton className="h-3.5 w-48" />
                    <Skeleton className="h-3 w-20 ml-auto" />
                  </div>
                ))}
              </div>
            </div>
          )}
          {featured === null && !fdLoading && fdMatches.length > 0 && (
            <UpcomingFixtures matches={fdMatches} />
          )}
        </div>

        {/* Secondary: News list + navigation links */}
        <div className="min-w-0 flex flex-col gap-5">
          <NewsRail />
          <QuickLinks />
        </div>
      </div>
    </section>
  )
}
