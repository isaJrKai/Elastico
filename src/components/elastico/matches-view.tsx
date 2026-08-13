'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useElasticoStore } from '@/store/use-elastico-store'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Search, MapPin, Clock, Trophy, RefreshCw, Zap,
  Eye, Bookmark, BookmarkCheck,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

type MatchTab = 'live' | 'upcoming' | 'finished' | 'all'

interface ESPNMatchItem {
  id: string
  competition: string
  homeTeam: { name: string; abbreviation: string; logo: string; color: string }
  awayTeam: { name: string; abbreviation: string; logo: string; color: string }
  homeScore: number
  awayScore: number
  status: string
  date: string
  venue: string
  minute?: number
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_TABS: { value: MatchTab; label: string }[] = [
  { value: 'live', label: 'Live' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'finished', label: 'Finished' },
  { value: 'all', label: 'All' },
]

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
  { code: 'WC',    name: 'World Cup' },
  { code: 'CA',    name: 'Copa America' },
  { code: 'EURO',  name: 'Euro Championship' },
  { code: 'BRA',   name: 'Serie A Brazil' },
  { code: 'ARG',   name: 'Liga Profesional' },
  { code: 'MX',    name: 'Liga MX' },
  { code: 'CAFCL', name: 'CAF Champions League' },
  { code: 'AFCCL', name: 'AFC Champions League' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function getStatusConfig(status: string) {
  switch (status) {
    case 'live': return { label: 'LIVE', cls: 'bg-red-500/15 text-red-400 border-red-500/30', pulse: true }
    case 'halftime': return { label: 'HT', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', pulse: false }
    case 'finished': return { label: 'FT', cls: 'bg-muted text-muted-foreground border-border', pulse: false }
    case 'postponed': return { label: 'PPD', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30', pulse: false }
    default: return { label: 'Upcoming', cls: 'bg-primary/15 text-primary border-primary/30', pulse: false }
  }
}

function formatMatchDate(dateStr: string | null): string {
  if (!dateStr) return 'TBD'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Team Logo Component ─────────────────────────────────────────────────────

function TeamLogo({ team, size = 'sm' }: { team: ESPNMatchItem['homeTeam']; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'size-8' : 'size-10'
  if (team?.logo) {
    return (
      <img
        src={team.logo}
        alt={team.name}
        className={cn('shrink-0 rounded-full object-contain bg-muted/30 p-0.5', sz)}
        loading="lazy"
      />
    )
  }
  return (
    <div
      className={cn('shrink-0 rounded-full border-2 border-border/50 flex items-center justify-center text-[10px] font-bold text-white', sz)}
      style={{ backgroundColor: team?.color || '#555' }}
    >
      {team?.abbreviation?.[0] || '?'}
    </div>
  )
}

// ── Enhanced Match Card ─────────────────────────────────────────────────────

function MatchCard({ match }: { match: ESPNMatchItem }) {
  const statusConfig = getStatusConfig(match.status)
  const isLive = match.status === 'live' || match.status === 'halftime'
  const [expanded, setExpanded] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)

  return (
    <TooltipProvider>
      <Card
        className={cn(
          'glass-card-premium transition-all duration-200 animate-fade-in-up group',
          isLive && 'border-red-500/20 hover:border-red-500/40',
          !isLive && 'hover:border-primary/30',
          bookmarked && 'ring-glow-emerald',
        )}
      >
        <CardContent className="p-4 space-y-3">
          {/* Header: Status + Bookmark + Competition */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn('h-5 rounded-md px-1.5 text-[10px] font-bold tracking-wider', statusConfig.cls)}>
                {statusConfig.pulse && (
                  <span className="relative flex size-1.5 mr-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-red-500" />
                  </span>
                )}
                {statusConfig.label}
                {match.minute != null && match.minute > 0 && <span className="ml-1 text-[9px] opacity-70">{match.minute}'</span>}
              </Badge>
              <Badge variant="secondary" className="h-5 rounded-md px-1.5 text-[10px] bg-muted/50 text-muted-foreground truncate max-w-[140px]">
                {match.competition}
              </Badge>
            </div>
            <button
              onClick={() => setBookmarked(!bookmarked)}
              className="p-1 rounded-md hover:bg-muted/50 transition-colors"
              aria-label={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
            >
              {bookmarked ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4 text-muted-foreground" />}
            </button>
          </div>

          {/* Teams + Score */}
          <div className="flex items-center justify-between gap-2">
            {/* Home Team */}
            <div className="flex-1 flex items-center gap-2.5 min-w-0">
              <TeamLogo team={match.homeTeam} />
              <div className="min-w-0">
                <span className="text-sm font-semibold truncate block">{match.homeTeam?.name || 'Home'}</span>
                <span className="text-[10px] text-muted-foreground block">{match.homeTeam?.abbreviation}</span>
              </div>
            </div>

            {/* Score */}
            <div className="shrink-0 flex items-center gap-1.5 min-w-[64px] justify-center">
              {match.status === 'upcoming' ? (
                <span className="text-xs font-bold text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1">vs</span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-2xl font-black tabular-nums', match.homeScore > match.awayScore && match.status === 'finished' && 'text-primary')}>{match.homeScore}</span>
                  <span className="text-xs text-muted-foreground">-</span>
                  <span className={cn('text-2xl font-black tabular-nums', match.awayScore > match.homeScore && match.status === 'finished' && 'text-primary')}>{match.awayScore}</span>
                </div>
              )}
            </div>

            {/* Away Team */}
            <div className="flex-1 flex items-center gap-2.5 min-w-0 justify-end">
              <div className="min-w-0 text-right">
                <span className="text-sm font-semibold truncate block">{match.awayTeam?.name || 'Away'}</span>
                <span className="text-[10px] text-muted-foreground block">{match.awayTeam?.abbreviation}</span>
              </div>
              <TeamLogo team={match.awayTeam} />
            </div>
          </div>

          <Separator className="opacity-20" />

          {/* Footer info */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1"><Clock className="size-3" />{formatMatchDate(match.date)}</span>
              {match.venue && <span className="flex items-center gap-1 truncate max-w-[100px]"><MapPin className="size-3 shrink-0" />{match.venue}</span>}
            </div>
            {isLive && (
              <button
                className="flex items-center gap-1 hover:text-foreground transition-colors"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              </button>
            )}
          </div>

          {/* Expanded: show match minute info for live */}
          {expanded && isLive && (
            <div className="text-[10px] text-muted-foreground animate-scale-in pt-1">
              <span className="text-red-400 font-medium">{match.minute}'</span> — Match in progress
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}

function MatchCardSkeleton() {
  return (
    <Card className="glass-card animate-fade-in-up"><CardContent className="p-4 space-y-3">
      <div className="flex items-center justify-between"><Skeleton className="h-5 w-14 rounded-md" /><Skeleton className="h-5 w-24 rounded-md" /></div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 flex items-center gap-2.5"><Skeleton className="size-8 rounded-full" /><Skeleton className="h-4 w-28 rounded" /></div>
        <Skeleton className="h-8 w-16 rounded-md" />
        <div className="flex-1 flex items-center gap-2.5 justify-end"><Skeleton className="h-4 w-28 rounded" /><Skeleton className="size-8 rounded-full" /></div>
      </div>
      <Skeleton className="h-px w-full" />
      <div className="flex items-center gap-3"><Skeleton className="h-3 w-20 rounded" /><Skeleton className="h-3 w-28 rounded" /></div>
    </CardContent></Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN MATCHES VIEW
// ═══════════════════════════════════════════════════════════════════════════════

export default function MatchesView() {
  const [activeTab, setActiveTab] = useState<MatchTab>('all')
  const [leagueFilter, setLeagueFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [matchesData, setMatchesData] = useState<ESPNMatchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchMatches = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (leagueFilter) params.set('league', leagueFilter)
      if (activeTab !== 'all') params.set('status', activeTab)

      const res = await fetch(`/api/live?${params}`)
      const data: any = await res.json()
      const matches: ESPNMatchItem[] = data.matches || []

      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        setMatchesData(matches.filter((m: ESPNMatchItem) =>
          m.homeTeam.name.toLowerCase().includes(q) ||
          m.awayTeam.name.toLowerCase().includes(q) ||
          m.competition.toLowerCase().includes(q)
        ))
      } else {
        setMatchesData(matches)
      }
    } catch (err) {
      console.error('Failed to fetch matches:', err)
    } finally {
      setLoading(false)
      setLastRefresh(new Date())
    }
  }, [activeTab, leagueFilter, searchQuery])

  useEffect(() => { fetchMatches() }, [fetchMatches])

  // Auto-refresh
  useEffect(() => {
    const iv = setInterval(() => fetchMatches(), 30000)
    return () => clearInterval(iv)
  }, [fetchMatches])

  // Sort by date (newest first)
  const sortedMatches = useMemo(() => {
    return [...matchesData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [matchesData])

  const liveCount = matchesData.filter((m) => m.status === 'live' || m.status === 'halftime').length

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15"><Zap className="size-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Matches</h1>
          <p className="text-sm text-muted-foreground">Live scores, fixtures & results from {LEAGUES.length} leagues</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card-premium rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={leagueFilter || 'all'} onValueChange={(v) => setLeagueFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-9 w-full sm:w-[180px] bg-muted/50 border-border text-sm">
              <Trophy className="size-3.5 mr-1.5 text-muted-foreground" /><SelectValue placeholder="League" />
            </SelectTrigger>
            <SelectContent className="glass-card border-border max-h-[280px]">
              <SelectItem value="all">All Leagues</SelectItem>
              {LEAGUES.map((l) => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Search by team name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 bg-muted/50 border-border text-sm" />
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-border bg-muted/50 hover:bg-accent" onClick={() => fetchMatches()} disabled={loading} aria-label="Refresh">
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MatchTab)} className="w-full">
        <TabsList className="glass-card w-full h-10 bg-muted/30 p-1 rounded-lg">
          {STATUS_TABS.map((tab) => {
            const count = tab.value === 'live' ? liveCount : tab.value === 'all' ? matchesData.length : undefined
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="flex-1 h-8 text-xs font-semibold rounded-md transition-all gap-1.5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                {tab.value === 'live' && liveCount > 0 && (
                  <span className="relative flex size-1.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-red-500" /></span>
                )}
                {tab.label}
                {count != null && count > 0 && <span className="ml-0.5 text-[10px] opacity-60">({count})</span>}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {STATUS_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            {loading && sortedMatches.length === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <MatchCardSkeleton key={i} />)}
              </div>
            )}

            {!loading && sortedMatches.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center mb-4"><Eye className="size-7 text-muted-foreground" /></div>
                <h3 className="text-sm font-semibold mb-1">No {tab.value === 'all' ? '' : tab.value} matches found</h3>
                <p className="text-xs text-muted-foreground max-w-[260px]">
                  {searchQuery ? 'Try adjusting your search.' : 'No matches available for this selection. Try a different league or tab.'}
                </p>
                {searchQuery && (
                  <Button variant="outline" size="sm" className="mt-4 h-8 text-xs border-border" onClick={() => setSearchQuery('')}>Clear Search</Button>
                )}
              </div>
            )}

            {sortedMatches.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[11px] text-muted-foreground">{sortedMatches.length} match{sortedMatches.length !== 1 ? 'es' : ''}{loading && ' (refreshing...)'}</span>
                  <span className="text-[10px] text-muted-foreground/50">Updated {lastRefresh.toLocaleTimeString()}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortedMatches.map((match, idx) => (
                    <div key={match.id} style={{ animationDelay: `${Math.min(idx * 50, 300)}ms` }}><MatchCard match={match} /></div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
