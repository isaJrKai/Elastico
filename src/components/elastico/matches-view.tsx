'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useElasticoStore } from '@/store/use-elastico-store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Search, Clock, Trophy, RefreshCw,
  Eye, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TeamCrest, StatusBadge, LeagueBadge } from '@/components/elastico/primitives'
import { FD_COMPETITIONS } from '@/lib/football-data-org'

// ── Types ────────────────────────────────────────────────────────────────────

type MatchTab = 'live' | 'upcoming' | 'finished' | 'all'
type ViewState = 'loading' | 'empty' | 'error' | 'success'

interface FDTeam {
  id: string
  name: string
  abbreviation: string
  logo: string
  color: string
}

interface FDMatch {
  id: string
  competition: string
  competitionCode: string
  competitionEmblem: string
  homeTeam: FDTeam
  awayTeam: FDTeam
  homeScore: number
  awayScore: number
  halfTimeHome: number | null
  halfTimeAway: number | null
  winner: string | null
  status: string
  date: string
  matchday: number | null
}

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS: { value: MatchTab; label: string }[] = [
  { value: 'live', label: 'Live' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'finished', label: 'Finished' },
  { value: 'all', label: 'All' },
]

/** Map our tab to football-data.org status query param */
function statusToApiParam(tab: MatchTab): string | undefined {
  switch (tab) {
    case 'live':     return 'IN_PLAY,PAUSED'
    case 'upcoming': return 'SCHEDULED,TIMED'
    case 'finished': return 'FINISHED'
    case 'all':      return undefined
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMatchDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatMatchTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function MatchCardSkeleton() {
  return (
    <Card className="glass-card animate-fade-in-up">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-14 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 flex items-center gap-2.5">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 w-28 rounded" />
          </div>
          <Skeleton className="h-8 w-16 rounded-md" />
          <div className="flex-1 flex items-center gap-2.5 justify-end">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="size-8 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-px w-full" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
      </CardContent>
    </Card>
  )
}

// ── Match Card ──────────────────────────────────────────────────────────────

function MatchCard({ match, onClick }: { match: FDMatch; onClick?: () => void }) {
  const isLive = match.status === 'live' || match.status === 'halftime'
  const isFinished = match.status === 'finished'
  const isUpcoming = match.status === 'upcoming'

  return (
    <Card
      className={cn(
        'glass-card-premium card-hover-lift rounded-xl transition-all duration-200 animate-fade-in-up group cursor-pointer',
        isLive && 'border-red-500/20 hover:border-red-500/40',
        !isLive && 'hover:border-primary/30',
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() }}
      aria-label={`${match.homeTeam.name} vs ${match.awayTeam.name}`}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header: Status + Competition */}
        <div className="flex items-center justify-between">
          <StatusBadge variant="status" value={match.status} />
          <LeagueBadge code={match.competitionCode} name={match.competition} size={16} />
        </div>

        {/* Teams + Score */}
        <div className="flex items-center justify-between gap-2">
          {/* Home Team */}
          <div className="flex-1 flex items-center gap-2.5 min-w-0">
            <TeamCrest
              code={match.homeTeam.abbreviation}
              espnLogo={match.homeTeam.logo}
              color={match.homeTeam.color}
              size="lg"
            />
            <div className="min-w-0">
              <span className="text-sm font-semibold truncate block text-primary">
                {match.homeTeam.name}
              </span>
              <span className="text-[10px] text-muted-foreground block">
                {match.homeTeam.abbreviation}
              </span>
            </div>
          </div>

          {/* Score */}
          <div className="shrink-0 flex items-center gap-1.5 min-w-[64px] justify-center">
            {isUpcoming ? (
              <span className="text-xs font-bold text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1">
                {formatMatchTime(match.date)}
              </span>
            ) : (
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'text-2xl font-black tabular-nums',
                    isFinished && match.winner === 'HOME' && 'text-primary',
                    !isFinished && match.homeScore > match.awayScore && 'text-primary',
                  )}
                >
                  {match.homeScore}
                </span>
                <span className="text-xs text-muted-foreground">-</span>
                <span
                  className={cn(
                    'text-2xl font-black tabular-nums',
                    isFinished && match.winner === 'AWAY' && 'text-primary',
                    !isFinished && match.awayScore > match.homeScore && 'text-primary',
                  )}
                >
                  {match.awayScore}
                </span>
              </div>
            )}
          </div>

          {/* Away Team */}
          <div className="flex-1 flex items-center gap-2.5 min-w-0 justify-end">
            <div className="min-w-0 text-right">
              <span className="text-sm font-semibold truncate block text-primary">
                {match.awayTeam.name}
              </span>
              <span className="text-[10px] text-muted-foreground block">
                {match.awayTeam.abbreviation}
              </span>
            </div>
            <TeamCrest
              code={match.awayTeam.abbreviation}
              espnLogo={match.awayTeam.logo}
              color={match.awayTeam.color}
              size="lg"
            />
          </div>
        </div>

        {/* Half-time scores for finished/live matches */}
        {!isUpcoming &&
          match.halfTimeHome !== null &&
          match.halfTimeAway !== null && (
            <div className="flex justify-center">
              <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground border-border h-5 px-2">
                HT {match.halfTimeHome}&ndash;{match.halfTimeAway}
              </Badge>
            </div>
          )}

        <Separator className="opacity-20" />

        {/* Footer: Date + Matchday */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="size-3 shrink-0" />
            {formatMatchDate(match.date)}
          </span>
          {match.matchday != null && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-medium">
              MD {match.matchday}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  tab,
  hasSearch,
  onClearSearch,
}: {
  tab: MatchTab
  hasSearch: boolean
  onClearSearch: () => void
}) {
  const label =
    tab === 'all'
      ? ''
      : tab === 'live'
        ? 'live'
        : tab === 'upcoming'
          ? 'upcoming'
          : 'finished'

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <Eye className="size-7 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold mb-1">
        No {label} matches found
      </h3>
      <p className="text-xs text-muted-foreground max-w-[260px]">
        {hasSearch
          ? 'Try adjusting your search or filters.'
          : 'No matches available for this selection. Try a different competition or tab.'}
      </p>
      {hasSearch && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 h-8 text-xs border-border"
          onClick={onClearSearch}
        >
          Clear Search
        </Button>
      )}
    </div>
  )
}

// ── Error State ──────────────────────────────────────────────────────────────

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="size-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
        <AlertCircle className="size-7 text-red-400" />
      </div>
      <h3 className="text-sm font-semibold mb-1">Failed to load matches</h3>
      <p className="text-xs text-muted-foreground max-w-[280px] mb-4">
        {message || 'An unexpected error occurred. Please try again.'}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs border-border"
        onClick={onRetry}
      >
        <RefreshCw className="size-3 mr-1.5" />
        Retry
      </Button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN MATCHES VIEW
// ═══════════════════════════════════════════════════════════════════════════════

export default function MatchesView() {
  const [activeTab, setActiveTab] = useState<MatchTab>('all')
  const [competition, setCompetition] = useState('PL')
  const [searchQuery, setSearchQuery] = useState('')
  const [matches, setMatches] = useState<FDMatch[]>([])
  const [viewState, setViewState] = useState<ViewState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const selectMatch = useElasticoStore((s) => s.selectMatch)
  const setView = useElasticoStore((s) => s.setView)

  // ── Fetch ──────────────────────────────────────────────────────────────

  const fetchMatches = useCallback(async () => {
    setViewState('loading')
    setErrorMsg('')

    try {
      const params = new URLSearchParams()
      params.set('action', 'matches')
      params.set('competition', competition)

      const statusParam = statusToApiParam(activeTab)
      if (statusParam) params.set('status', statusParam)

      const res = await fetch(`/api/football-data?${params.toString()}`)

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `API returned ${res.status}`)
      }

      const data = await res.json()

      if (data.success === false) {
        throw new Error(data.error || 'API reported failure')
      }

      const fetched: FDMatch[] = (data.data || []).map((m: any) => {
        // Normalize status to internal values for client-side filtering
        const statusMap: Record<string, string> = {
          'SCHEDULED': 'upcoming', 'TIMED': 'upcoming', 'IN_PLAY': 'live',
          'PAUSED': 'halftime', 'FINISHED': 'finished', 'POSTPONED': 'postponed',
          'CANCELLED': 'postponed', 'SUSPENDED': 'postponed',
        }
        return { ...m, status: statusMap[m.status] || m.status }
      })

      // Client-side status filter (tab-based)
      let filtered = fetched
      if (activeTab === 'live') {
        filtered = fetched.filter(m => m.status === 'live' || m.status === 'halftime')
      } else if (activeTab === 'upcoming') {
        filtered = fetched.filter(m => m.status === 'upcoming')
      } else if (activeTab === 'finished') {
        filtered = fetched.filter(m => m.status === 'finished')
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        filtered = filtered.filter(
          (m) =>
            m.homeTeam.name.toLowerCase().includes(q) ||
            m.awayTeam.name.toLowerCase().includes(q) ||
            m.competition.toLowerCase().includes(q),
        )
      }

      setMatches(filtered)
      setViewState(filtered.length > 0 ? 'success' : 'empty')
      setLastRefresh(new Date())
    } catch (err) {
      console.error('[MatchesView] Fetch failed:', err)
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setViewState('error')
      setMatches([])
    }
  }, [activeTab, competition, searchQuery])

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  // Auto-refresh live tab every 60s
  useEffect(() => {
    if (activeTab !== 'live') return
    const iv = setInterval(() => fetchMatches(), 60_000)
    return () => clearInterval(iv)
  }, [activeTab, fetchMatches])

  // ── Derived ────────────────────────────────────────────────────────────

  const sortedMatches = useMemo(() => {
    return [...matches].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    )
  }, [matches])

  const liveCount = matches.filter(
    (m) => m.status === 'live' || m.status === 'halftime',
  ).length

  const handleMatchClick = useCallback(
    (matchId: string) => {
      // Prefix with fd: so match-detail API knows to use football-data.org fallback
      selectMatch(`fd:${matchId}`)
    },
    [selectMatch],
  )

  // ── Render helpers ─────────────────────────────────────────────────────

  const renderContent = () => {
    if (viewState === 'loading') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      )
    }

    if (viewState === 'error') {
      return <ErrorState message={errorMsg} onRetry={fetchMatches} />
    }

    if (viewState === 'empty') {
      return (
        <EmptyState
          tab={activeTab}
          hasSearch={!!searchQuery}
          onClearSearch={() => setSearchQuery('')}
        />
      )
    }

    // SUCCESS
    return (
      <>
        {/* Data summary bar */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {sortedMatches.length} match{sortedMatches.length !== 1 ? 'es' : ''}
            </span>
            <span className="source-badge">football-data.org</span>
          </div>
          {lastRefresh && (
            <span className="text-[10px] text-muted-foreground/50">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedMatches.map((match, idx) => (
            <div
              key={match.id}
              style={{ animationDelay: `${Math.min(idx * 50, 300)}ms` }}
            >
              <MatchCard
                match={match}
                onClick={() => handleMatchClick(match.id)}
              />
            </div>
          ))}
        </div>
      </>
    )
  }

  // ── Main Render ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      {/* Filter Bar */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Competition Selector */}
          <Select
            value={competition}
            onValueChange={setCompetition}
          >
            <SelectTrigger className="h-9 w-full sm:w-[200px] bg-muted/50 border-border text-sm">
              <Trophy className="size-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Competition" />
            </SelectTrigger>
            <SelectContent className="glass-card border-border max-h-[280px]">
              {FD_COMPETITIONS.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by team name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-muted/50 border-border text-sm"
            />
          </div>

          {/* Refresh */}
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 border-border bg-muted/50 hover:bg-accent"
            onClick={fetchMatches}
            disabled={viewState === 'loading'}
            aria-label="Refresh"
          >
            <RefreshCw
              className={cn(
                'size-4',
                viewState === 'loading' && 'animate-spin',
              )}
            />
          </Button>
        </div>
      </div>

      {/* Tabs + Content */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as MatchTab)}
        className="w-full"
      >
        <TabsList className="glass-card w-full h-10 bg-muted/30 p-1 rounded-lg">
          {STATUS_TABS.map((tab) => {
            const count =
              tab.value === 'live'
                ? liveCount
                : tab.value === 'all'
                  ? matches.length
                  : undefined
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex-1 h-8 text-xs font-semibold rounded-md transition-all gap-1.5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                {tab.value === 'live' && liveCount > 0 && (
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-red-500" />
                  </span>
                )}
                {tab.label}
                {count != null && count > 0 && (
                  <span className="ml-0.5 text-[10px] opacity-60">
                    ({count})
                  </span>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {STATUS_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            {renderContent()}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
