'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useElasticoStore, type Match } from '@/store/use-elastico-store'
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
  Search, MapPin, Clock, Trophy, Users, RefreshCw, Zap, Filter,
  Eye, ArrowUpDown, TrendingUp, Bookmark, BookmarkCheck, Cloud,
  Thermometer, Wind, Target, BarChart3, ChevronDown, ChevronUp,
  Droplets,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

// ── Types ────────────────────────────────────────────────────────────────────

type MatchTab = 'live' | 'upcoming' | 'finished' | 'all'
type SortKey = 'date' | 'elo' | 'xg'

interface MatchesApiResponse { matches: Match[]; error?: string }

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_TABS: { value: MatchTab; label: string }[] = [
  { value: 'live', label: 'Live' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'finished', label: 'Finished' },
  { value: 'all', label: 'All' },
]

const STAGES = ['Group Stage', 'Round of 16', 'Quarter-Final', 'Semi-Final', 'Final', 'Third Place']
const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

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

// ── Enhanced Match Card ─────────────────────────────────────────────────────

function MatchCard({ match }: { match: Match }) {
  const selectMatch = useElasticoStore(s => s.selectMatch)
  const token = useElasticoStore(s => s.token)
  const statusConfig = getStatusConfig(match.status)
  const isLive = match.status === 'live' || match.status === 'halftime'
  const [expanded, setExpanded] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)

  const handleOpen = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-predict-btn]')) return
    selectMatch(match.id)
  }, [selectMatch, match.id])

  const handlePredict = useCallback((e: React.MouseEvent, choice: string) => {
    e.stopPropagation()
    fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ matchId: match.id, predictedOutcome: choice === 'home' ? 'home_win' : choice === 'draw' ? 'draw' : 'away_win', confidence: 70 }),
    }).then(() => toast({ title: 'Prediction submitted!', description: `${choice} predicted for ${match.homeTeam?.name} vs ${match.awayTeam?.name}` }))
      .catch(() => toast({ title: 'Error', description: 'Failed to submit prediction', variant: 'destructive' }))
  }, [match, token])

  const totalXg = match.homeXg + match.awayXg
  const homeXgPct = totalXg > 0 ? (match.homeXg / totalXg) * 100 : 50
  const eloDiff = (match.homeEloBefore ?? 0) - (match.awayEloBefore ?? 0)

  return (
    <TooltipProvider>
      <Card
        className={cn(
          'glass-card-premium cursor-pointer transition-all duration-200 animate-fade-in-up group',
          isLive && 'border-red-500/20 hover:border-red-500/40',
          !isLive && 'hover:border-primary/30',
          bookmarked && 'ring-glow-emerald',
        )}
        onClick={handleOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') handleOpen(e as unknown as React.MouseEvent) }}
        aria-label={`${match.homeTeam?.name} vs ${match.awayTeam?.name}`}
      >
        <CardContent className="p-4 space-y-3">
          {/* Header: Status + Bookmark + Stage */}
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
              </Badge>
              <Badge variant="secondary" className="h-5 rounded-md px-1.5 text-[10px] bg-muted/50 text-muted-foreground">
                {match.stage}
              </Badge>
            </div>
            <button
              data-predict-btn
              onClick={(e) => { e.stopPropagation(); setBookmarked(!bookmarked) }}
              className="p-1 rounded-md hover:bg-muted/50 transition-colors"
              aria-label={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
            >
              {bookmarked ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4 text-muted-foreground" />}
            </button>
          </div>

          {/* Teams + Score */}
          <div className="flex items-center justify-between gap-2">
            {/* Home Team */}
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <Tooltip>
                <TooltipTrigger><div className="shrink-0 size-8 rounded-full border-2 border-border/50 flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: match.homeTeam?.primaryColor || '#555' }}>{match.homeTeam?.code ?? '?'}</div></TooltipTrigger>
                <TooltipContent>{match.homeTeam?.name}</TooltipContent>
              </Tooltip>
              <span className="text-sm font-semibold truncate">{match.homeTeam?.name || 'Home'}</span>
            </div>

            {/* Score */}
            <div className="shrink-0 flex items-center gap-1.5 min-w-[64px] justify-center">
              {match.status === 'upcoming' ? (
                <span className="text-xs font-bold text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1">vs</span>
              ) : (
                <div className="flex items-center gap-1">
                  <span className={cn('text-xl font-black tabular-nums', match.homeScore > match.awayScore && match.status === 'finished' && 'text-primary')}>{match.homeScore}</span>
                  <span className="text-xs text-muted-foreground">-</span>
                  <span className={cn('text-xl font-black tabular-nums', match.awayScore > match.homeScore && match.status === 'finished' && 'text-primary')}>{match.awayScore}</span>
                </div>
              )}
            </div>

            {/* Away Team */}
            <div className="flex-1 flex items-center gap-2 min-w-0 justify-end">
              <span className="text-sm font-semibold truncate text-right">{match.awayTeam?.name || 'Away'}</span>
              <Tooltip>
                <TooltipTrigger><div className="shrink-0 size-8 rounded-full border-2 border-border/50 flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: match.awayTeam?.primaryColor || '#555' }}>{match.awayTeam?.code ?? '?'}</div></TooltipTrigger>
                <TooltipContent>{match.awayTeam?.name}</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* xG Comparison Mini Bars */}
          {(isLive || match.status === 'finished') && totalXg > 0 && (
            <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] text-cyan-400 font-medium tabular-nums w-8 text-right">{match.homeXg.toFixed(1)}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden flex">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-l-full transition-all duration-700" style={{ width: `${homeXgPct}%` }} />
                <div className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-r-full transition-all duration-700" style={{ width: `${100 - homeXgPct}%` }} />
              </div>
              <span className="text-[10px] text-orange-400 font-medium tabular-nums w-8">{match.awayXg.toFixed(1)}</span>
            </div>
          )}

          {/* Probability bars for upcoming */}
          {match.status === 'upcoming' && match.homeWinProb != null && (
            <div className="flex items-center gap-1 px-1">
              {[
                { pct: match.homeWinProb, color: 'bg-emerald-500', label: 'H' },
                { pct: match.drawProb ?? 0, color: 'bg-amber-500', label: 'D' },
                { pct: match.awayWinProb ?? 0, color: 'bg-red-500', label: 'A' },
              ].map((p) => (
                <div key={p.label} className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <div className={cn('h-full rounded-full', p.color)} style={{ width: `${p.pct}%` }} />
                </div>
              ))}
            </div>
          )}

          <Separator className="opacity-20" />

          {/* Footer info */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1"><Clock className="size-3" />{formatMatchDate(match.date)}</span>
              {match.venue && <span className="flex items-center gap-1 truncate max-w-[100px]"><MapPin className="size-3 shrink-0" />{match.venue}</span>}
            </div>
            {match.weather && (
              <Tooltip>
                <TooltipTrigger><span className="flex items-center gap-1 text-sky-400"><Cloud className="size-3" />{match.weather}</span></TooltipTrigger>
                <TooltipContent>
                  {match.temperature != null && <span>{match.temperature}°C</span>}
                  {match.temperature != null && ' · '}
                  {match.weather}
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Attendance for finished */}
          {match.status === 'finished' && (
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Users className="size-3" />
              <span>35,421 attendance</span>
              <span className="text-muted-foreground/50">·</span>
              <TrendingUp className="size-3 text-primary" />
              <span>ELO diff: {eloDiff > 0 ? '+' : ''}{eloDiff}</span>
            </div>
          )}

          {/* Quick Predict Buttons for upcoming */}
          {match.status === 'upcoming' && (
            <div className="flex gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
              {[
                { key: 'home', label: 'Home', cls: 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10' },
                { key: 'draw', label: 'Draw', cls: 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10' },
                { key: 'away', label: 'Away', cls: 'border-red-500/30 text-red-400 hover:bg-red-500/10' },
              ].map((btn) => (
                <Button
                  key={btn.key}
                  data-predict-btn
                  size="sm"
                  variant="outline"
                  className={cn('flex-1 h-7 text-[10px] font-semibold', btn.cls)}
                  onClick={(e) => handlePredict(e, btn.key)}
                >
                  {btn.label}
                </Button>
              ))}
            </div>
          )}

          {/* Expandable Stats Preview */}
          {(isLive || match.status === 'finished') && (
            <div>
              <button
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full"
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
              >
                {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                Match Stats
              </button>
              {expanded && (
                <div className="mt-2 space-y-1.5 animate-scale-in">
                  {[
                    { label: 'Possession', home: match.possessionHome, away: 100 - match.possessionHome },
                    { label: 'Shots', home: match.shotsHome, away: match.shotsAway },
                    { label: 'On Target', home: match.shotsOnTargetHome, away: match.shotsOnTargetAway },
                    { label: 'Corners', home: match.cornersHome, away: match.cornersAway },
                    { label: 'Fouls', home: match.foulsHome, away: match.foulsAway },
                  ].map((stat) => {
                    const total = stat.home + stat.away || 1
                    const pct = (stat.home / total) * 100
                    return (
                      <div key={stat.label} className="flex items-center gap-2 text-[10px]">
                        <span className="w-8 text-right font-medium tabular-nums">{stat.home}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground/60 truncate max-w-[60px]">{stat.label}</span>
                          </div>
                          <div className="h-1 rounded-full bg-muted overflow-hidden flex mt-0.5">
                            <div className="h-full bg-primary/60 rounded-l-full" style={{ width: `${pct}%` }} />
                            <div className="h-full bg-cyan-500/60 rounded-r-full" style={{ width: `${100 - pct}%` }} />
                          </div>
                        </div>
                        <span className="w-8 font-medium tabular-nums">{stat.away}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Group + Competition */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="secondary" className="h-4 rounded px-1.5 text-[9px] bg-muted/50 text-muted-foreground"><Trophy className="size-2.5 mr-1" />{match.competition}</Badge>
            {match.group && <Badge variant="secondary" className="h-4 rounded px-1.5 text-[9px] bg-primary/10 text-primary">Group {match.group}</Badge>}
            {match._count && (match._count.predictions > 0 || match._count.votes > 0) && (
              <span className="text-[9px] text-muted-foreground/50 ml-auto">{match._count.predictions} preds · {match._count.votes} votes</span>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}

function MatchCardSkeleton() {
  return (
    <Card className="glass-card animate-fade-in-up"><CardContent className="p-4 space-y-3">
      <div className="flex items-center justify-between"><Skeleton className="h-5 w-14 rounded-md" /><Skeleton className="h-5 w-10 rounded-md" /></div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 flex items-center gap-2"><Skeleton className="size-8 rounded-full" /><Skeleton className="h-4 w-24 rounded" /></div>
        <Skeleton className="h-8 w-16 rounded-md" />
        <div className="flex-1 flex items-center gap-2 justify-end"><Skeleton className="h-4 w-24 rounded" /><Skeleton className="size-8 rounded-full" /></div>
      </div>
      <Skeleton className="h-px w-full" />
      <div className="flex items-center gap-3"><Skeleton className="h-3 w-20 rounded" /><Skeleton className="h-3 w-24 rounded" /></div>
    </CardContent></Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN MATCHES VIEW
// ═══════════════════════════════════════════════════════════════════════════════

export function MatchesView() {
  const token = useElasticoStore(s => s.token)
  const [activeTab, setActiveTab] = useState<MatchTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [sortBy, setSortBy] = useState<SortKey>('date')
  const [matchesData, setMatchesData] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchMatches = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (activeTab !== 'all') params.set('status', activeTab)
      if (searchQuery) params.set('search', searchQuery)
      if (stageFilter !== 'all') params.set('stage', stageFilter)
      if (groupFilter !== 'all') params.set('group', groupFilter)
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`/api/fixtures?${params.toString()}`, { headers })
      const data: any = await res.json()
      setMatchesData(data.matches || [])
    } catch (err) {
      console.error('Failed to fetch matches:', err)
    } finally {
      setLoading(false)
      setLastRefresh(new Date())
    }
  }, [activeTab, searchQuery, stageFilter, groupFilter, token])

  useEffect(() => { fetchMatches() }, [fetchMatches])

  // Auto-refresh live
  useEffect(() => {
    const iv = setInterval(() => { if (activeTab === 'live') fetchMatches() }, 15000)
    return () => clearInterval(iv)
  }, [activeTab, fetchMatches])

  // Sort
  const sortedMatches = useMemo(() => {
    const arr = [...matchesData]
    switch (sortBy) {
      case 'elo': return arr.sort((a, b) => Math.abs((b.homeEloBefore ?? 0) - (b.awayEloBefore ?? 0)) - Math.abs((a.homeEloBefore ?? 0) - (a.awayEloBefore ?? 0)))
      case 'xg': return arr.sort((a, b) => (b.homeXg + b.awayXg) - (a.homeXg + a.awayXg))
      default: return arr
    }
  }, [matchesData, sortBy])

  const allMatches = matchesData
  const liveCount = allMatches.filter((m) => m.status === 'live' || m.status === 'halftime').length
  const availableStages = useMemo(() => STAGES.filter((s) => allMatches.some((m) => m.stage === s)), [allMatches])
  const availableGroups = useMemo(() => GROUPS.filter((g) => allMatches.some((m) => m.group === g)), [allMatches])

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15"><Zap className="size-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Matches</h1>
          <p className="text-sm text-muted-foreground">Browse, filter, and predict match outcomes</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card-premium rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Search by team name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 bg-muted/50 border-border text-sm" />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="h-9 w-full sm:w-[160px] bg-muted/50 border-border text-sm">
              <Filter className="size-3.5 mr-1.5 text-muted-foreground" /><SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent className="glass-card border-border">
              <SelectItem value="all">All Stages</SelectItem>
              {availableStages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="h-9 w-full sm:w-[120px] bg-muted/50 border-border text-sm"><SelectValue placeholder="Group" /></SelectTrigger>
            <SelectContent className="glass-card border-border">
              <SelectItem value="all">All Groups</SelectItem>
              {availableGroups.map((g) => <SelectItem key={g} value={g}>Group {g}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="h-9 w-full sm:w-[130px] bg-muted/50 border-border text-sm">
              <ArrowUpDown className="size-3.5 mr-1.5 text-muted-foreground" /><SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent className="glass-card border-border">
              <SelectItem value="date">By Date</SelectItem>
              <SelectItem value="elo">By ELO Diff</SelectItem>
              <SelectItem value="xg">By xG Total</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-border bg-muted/50 hover:bg-accent" onClick={() => fetchMatches()} disabled={loading} aria-label="Refresh">
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </Button>
        </div>
        {/* Group quick-buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground mr-1">Groups:</span>
          {GROUPS.map((g) => (
            <button key={g} onClick={() => setGroupFilter(groupFilter === g ? 'all' : g)}
              className={cn('flex size-7 items-center justify-center rounded-md text-[10px] font-bold transition-all',
                groupFilter === g ? 'bg-primary/20 text-primary ring-glow-emerald' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground')}>
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MatchTab)} className="w-full">
        <TabsList className="glass-card w-full h-10 bg-muted/30 p-1 rounded-lg">
          {STATUS_TABS.map((tab) => {
            const count = tab.value === 'live' ? liveCount : allMatches.length
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="flex-1 h-8 text-xs font-semibold rounded-md transition-all gap-1.5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                {tab.value === 'live' && liveCount > 0 && (
                  <span className="relative flex size-1.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-red-500" /></span>
                )}
                {tab.label}
                {count > 0 && <span className="ml-0.5 text-[10px] opacity-60">({count})</span>}
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
                  {searchQuery || stageFilter !== 'all' || groupFilter !== 'all' ? 'Try adjusting your filters.' : 'No matches available. Check back later!'}
                </p>
                {(searchQuery || stageFilter !== 'all' || groupFilter !== 'all') && (
                  <Button variant="outline" size="sm" className="mt-4 h-8 text-xs border-border" onClick={() => { setSearchQuery(''); setStageFilter('all'); setGroupFilter('all') }}>Clear Filters</Button>
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