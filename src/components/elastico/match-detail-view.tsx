'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useElasticoStore, type Match, type MatchEvent, type Team, type User } from '@/store/use-elastico-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell, LineChart, Line, PieChart, Pie,
} from 'recharts'
import {
  ArrowLeft, Bookmark, BookmarkCheck, Share2, Sparkles, Brain, MapPin, Cloud,
  Thermometer, Users, Trophy, Clock, Zap, Target, Activity, ChevronDown,
  Loader2, AlertCircle, Swords, Flame, MessageSquare, Copy, Check, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { axisProps, cartesianGridProps, tooltipContentStyle, tooltipLabelStyle, chartColor } from '@/lib/chart-theme'
import { TeamCrest, StatusBadge, SectionHeader } from '@/components/elastico/primitives'

// ── Extended Types ──────────────────────────────────────────────────────────

interface VoteUser { id: string; name: string; displayName: string | null; avatarUrl: string | null; plan: string }
interface Vote { id: string; userId: string; matchId: string; choice: string; createdAt: string; user: VoteUser }
interface PredictionUser { id: string; name: string; displayName: string | null; avatarUrl: string | null; predictionAccuracy: number }
interface Prediction { id: string; userId: string; matchId: string; predictedHomeGoals: number; predictedAwayGoals: number; predictedOutcome: string; confidence: number; model: string; isCorrect: boolean | null; points: number; createdAt: string; user: PredictionUser }

interface MatchDetail extends Match {
  homeTeam: Team & { players: Team['players'] }
  awayTeam: Team & { players: Team['players'] }
  events: MatchEvent[]
  votes: Vote[]
  predictions: Prediction[]
  voteDistribution: { home: number; draw: number; away: number }
  _count: { predictions: number; votes: number; bookmarks: number }
  attendance?: number | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

function computeEloProb(homeElo: number, awayElo: number, outcome: string): number {
  const expectedHome = 1 / (1 + Math.pow(10, (awayElo - homeElo) / 400))
  if (outcome === 'home') return Math.round(expectedHome * 100)
  if (outcome === 'away') return Math.round((1 - expectedHome) * 100 * 0.75)
  return Math.round(100 - expectedHome * 100 - (1 - expectedHome) * 100 * 0.75)
}

function StatBarRow({ label, homeValue, awayValue, homeColor, awayColor, suffix = '', decimals = 0 }: { label: string; homeValue: number | null; awayValue: number | null; homeColor?: string; awayColor?: string; suffix?: string; decimals?: number }) {
  if (homeValue === null || awayValue === null) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold tabular-nums text-muted-foreground">N/A</span>
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
          <span className="font-semibold tabular-nums text-muted-foreground">N/A</span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-muted">
          <div className="h-full w-1/2 rounded-full bg-muted-foreground/20" />
          <div className="h-full w-1/2 rounded-full bg-muted-foreground/20 ml-auto" />
        </div>
      </div>
    )
  }
  const total = homeValue + awayValue || 1
  const hp = (homeValue / total) * 100
  const fmt = (v: number) => decimals > 0 ? v.toFixed(decimals) : String(Math.round(v))
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className={cn('font-semibold tabular-nums', hp >= 50 ? 'text-foreground' : 'text-muted-foreground')}>{fmt(homeValue)}{suffix}</span>
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
        <span className={cn('font-semibold tabular-nums', (100 - hp) > hp ? 'text-foreground' : 'text-muted-foreground')}>{fmt(awayValue)}{suffix}</span>
      </div>
      <div className="flex h-2 gap-0.5 rounded-full overflow-hidden bg-muted">
        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${hp}%`, backgroundColor: homeColor || chartColor(0) }} />
        <div className="h-full rounded-full transition-all duration-700 ease-out ml-auto" style={{ width: `${100 - hp}%`, backgroundColor: awayColor || chartColor(1) }} />
      </div>
    </div>
  )
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'live': return { label: 'LIVE', cls: 'bg-red-500/15 text-red-400 border-red-500/30', pulse: true }
    case 'halftime': return { label: 'HALF TIME', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', pulse: false }
    case 'finished': return { label: 'FULL TIME', cls: 'bg-muted text-muted-foreground border-border', pulse: false }
    default: return { label: 'UPCOMING', cls: 'bg-primary/15 text-primary border-primary/30', pulse: false }
  }
}

function getEventIcon(type: string): React.ReactNode {
  const iconClass = 'size-3.5 shrink-0'
  switch (type) {
    case 'goal': case 'penalty': case 'own_goal': return <Target className={cn(iconClass, 'text-primary')} />
    case 'yellow_card': return <AlertCircle className={cn(iconClass, 'text-yellow-400')} />
    case 'red_card': return <AlertCircle className={cn(iconClass, 'text-red-400')} />
    case 'substitution': return <Activity className={cn(iconClass, 'text-muted-foreground')} />
    default: return <Zap className={cn(iconClass, 'text-muted-foreground')} />
  }
}

// ── SHOT MAP DATA ──────────────────────────────────────────────────────────

interface ShotMapPoint {
  x: number; y: number; team: string; goal: boolean
  xg?: number; player?: string | null; minute?: number; outcome?: string
}

// Fallback: generate shot positions from match events when no deep data source
function generateShotsFromEvents(events: MatchEvent[], homeXg: number, awayXg: number): ShotMapPoint[] {
  const shots: ShotMapPoint[] = []
  const homeGoals = events.filter(e => e.type === 'goal' && e.team === 'home')
  const awayGoals = events.filter(e => e.type === 'goal' && e.team === 'away')
  for (let i = 0; i < Math.ceil(homeXg * 3); i++) {
    shots.push({ x: 15 + (i * 17 % 30), y: 10 + (i * 23 % 80), team: 'home', goal: i < homeGoals.length })
  }
  for (let i = 0; i < Math.ceil(awayXg * 3); i++) {
    shots.push({ x: 55 + (i * 17 % 30), y: 10 + (i * 23 % 80), team: 'away', goal: i < awayGoals.length })
  }
  return shots
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function MatchDetailView() {
  const selectedMatchId = useElasticoStore(s => s.selectedMatchId)
  const setView = useElasticoStore(s => s.setView)
  const user = useElasticoStore(s => s.user)
  const token = useElasticoStore(s => s.token)
  const [match, setMatch] = useState<MatchDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('statistics')
  const [bookmarked, setBookmarked] = useState(false)
  const [copied, setCopied] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [simulating, setSimulating] = useState(false)

  const fetchMatch = useCallback(async () => {
    if (!selectedMatchId) return
    setLoading(true)
    try {
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`/api/matches/${selectedMatchId}`, { headers })
      if (!res.ok) throw new Error(`Failed to fetch match`)
      const data = await res.json()
      setMatch(data.match)
      setBookmarked((data.match._count?.bookmarks ?? 0) > 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load match')
    } finally { setLoading(false) }
  }, [selectedMatchId, token])

  useEffect(() => { fetchMatch() }, [fetchMatch])

  const handleVote = useCallback(async (choice: 'home' | 'draw' | 'away') => {
    if (!selectedMatchId || !token) return
    try {
      await fetch(`/api/matches/${selectedMatchId}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ choice }) })
      fetchMatch()
    } catch (err) { console.error('[MatchDetail] Vote submission failed:', err) }
  }, [selectedMatchId, token, fetchMatch])

  const handleToggleBookmark = useCallback(async () => {
    if (!selectedMatchId || !token) return
    try {
      if (bookmarked) {
        await fetch(`/api/bookmarks?matchId=${selectedMatchId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
        setBookmarked(false)
        toast.success('Bookmark removed')
      } else {
        const res = await fetch('/api/bookmarks', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ matchId: selectedMatchId }) })
        if (res.ok) {
          setBookmarked(true)
          toast.success('Match bookmarked')
        }
      }
    } catch (err) { console.error('[MatchDetail] Bookmark toggle failed:', err) }
  }, [selectedMatchId, token, bookmarked])

  const handleSimulate = useCallback(async () => {
    if (!selectedMatchId || !token) return
    setSimulating(true)
    try {
      const res = await fetch(`/api/matches/${selectedMatchId}/simulate`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Simulation failed' }))
        toast.error('Simulation failed', { description: err.error || 'Unknown error' })
        return
      }
      toast.success('Simulation complete', { description: 'Match has been simulated with events and stats' })
      fetchMatch()
    } catch (e: any) {
      toast.error('Simulation error', { description: e.message || 'Failed to run simulation' })
    } finally { setSimulating(false) }
  }, [selectedMatchId, token, fetchMatch])

  const handleCopySummary = useCallback(() => {
    if (!match) return
    const hXg = match.homeXg ?? null
    const aXg = match.awayXg ?? null
    const xgStr = hXg != null && aXg != null
      ? `xG: ${hXg.toFixed(1)} - ${aXg.toFixed(1)}`
      : 'xG: N/A (data not available)'
    const text = `${match.homeTeam?.name} ${match.homeScore} - ${match.awayScore} ${match.awayTeam?.name}\n${match.competition} · ${match.stage}\n${xgStr}\n\n— ELASTICO Analytics`
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }, [match])

  const handleAIAnalysis = useCallback(() => {
    if (!match) return
    setAiLoading(true)
    fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message: `Analyze the match ${match.homeTeam?.name} vs ${match.awayTeam?.name}. ELO: ${match.homeEloBefore} vs ${match.awayEloBefore}. Score: ${match.homeScore}-${match.awayScore}. xG: ${match.homeXg}-${match.awayXg}.`, matchId: selectedMatchId }),
    }).then(() => { setView('ai-chat'); setAiLoading(false) }).catch((err) => { console.error('[MatchDetail] AI analysis request failed:', err); setAiLoading(false) })
  }, [match, token, selectedMatchId, setView])

  // Derived
  const isUpcoming = match?.status === 'upcoming'
  const isLive = match?.status === 'live' || match?.status === 'halftime'
  const isFinished = match?.status === 'finished'
  const statusConfig = match ? getStatusConfig(match.status) : null
  const homeTeam = match?.homeTeam
  const awayTeam = match?.awayTeam

  const homeWinProb = match?.homeWinProb ?? computeEloProb(match?.homeEloBefore ?? 1500, match?.awayEloBefore ?? 1500, 'home')
  const drawProb = match?.drawProb ?? computeEloProb(match?.homeEloBefore ?? 1500, match?.awayEloBefore ?? 1500, 'draw')
  const awayWinProb = match?.awayWinProb ?? computeEloProb(match?.homeEloBefore ?? 1500, match?.awayEloBefore ?? 1500, 'away')
  const totalVotes = (match?.voteDistribution?.home ?? 0) + (match?.voteDistribution?.draw ?? 0) + (match?.voteDistribution?.away ?? 0)

  const votePieData = useMemo(() => [
    { name: 'Home', value: match?.voteDistribution?.home ?? 0, fill: chartColor(0) },
    { name: 'Draw', value: match?.voteDistribution?.draw ?? 0, fill: chartColor(2) },
    { name: 'Away', value: match?.voteDistribution?.away ?? 0, fill: chartColor(4) },
  ].filter(d => d.value > 0), [match])

  const xgTimeline = useMemo(() => {
    return []
  }, [])

  const sortedEvents = useMemo(() =>
    (match?.events || []).sort((a, b) => a.minute - b.minute),
    [match?.events]
  )

  // ── StatsBomb shot map (real xG + coordinates) ────────────────────────
  const [sbShots, setSbShots] = useState<ShotMapPoint[]>([])
  const [sbLoading, setSbLoading] = useState(false)
  const [sbSource, setSbSource] = useState<string>('')

  useEffect(() => {
    // Only fetch StatsBomb shot data for the specific demo match (2022 World Cup Final)
    // For all other matches, show a placeholder instead of loading wrong data
    const demoMatchId = '3869151'
    if (selectedMatchId !== demoMatchId) {
      setSbShots([])
      setSbSource('')
      return
    }
    setSbLoading(true)
    fetch(`/api/statsbomb?action=shots&match=${demoMatchId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data?.length > 0) {
          setSbShots(data.data)
          setSbSource(`StatsBomb: ${data.homeTeam} vs ${data.awayTeam}`)
        }
      })
      .catch((err) => { console.warn('[MatchDetail] StatsBomb fetch failed:', err) })
      .finally(() => setSbLoading(false))
  }, [selectedMatchId])

  // ── xT (Expected Threat) leaderboard from analytics engine ──────────────
  const [xtLeaderboard, setXtLeaderboard] = useState<Array<{ player: string; team: string; totalXtGained: number; totalActions: number; avgXtPerAction: number; progressiveActions: number }>>([])
  const [xtLoading, setXtLoading] = useState(false)

  useEffect(() => {
    // Only fetch xT leaderboard for the specific demo match (2022 World Cup Final)
    // For all other matches, show placeholder
    const demoMatchId = '3869151'
    if (selectedMatchId !== demoMatchId) {
      setXtLeaderboard([])
      return
    }
    setXtLoading(true)
    fetch('/api/analytics?action=xt-match&match=3869151')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data?.leaderboard) {
          setXtLeaderboard(data.data.leaderboard)
        }
      })
      .catch((err) => { console.warn('[MatchDetail] xT leaderboard fetch failed:', err) })
      .finally(() => setXtLoading(false))
  }, [selectedMatchId])

  const shotMapData = useMemo((): ShotMapPoint[] | null => {
    if (sbShots.length > 0) return sbShots
    // Only show generated-from-events shots for the demo match; all others → null
    if (selectedMatchId === '3869151' && match && match.homeXg != null && match.awayXg != null) return generateShotsFromEvents(match.events || [], match.homeXg, match.awayXg)
    return null
  }, [sbShots, match, selectedMatchId])

  // ── Loading ──
  if (loading) return (<div className="flex flex-col gap-4 animate-fade-in-up"><Skeleton className="h-44 w-full rounded-xl" /><div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><Skeleton className="h-64 w-full rounded-xl" /><Skeleton className="h-64 w-full rounded-xl" /></div></div>)

  if (error || !match) return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in-up">
      <AlertCircle className="size-12 text-destructive mb-4" /><h3 className="text-lg font-semibold mb-2">Failed to Load Match</h3>
      <Button variant="outline" onClick={() => setView('matches')} className="gap-2 border-border"><ArrowLeft className="size-4" />Back to Matches</Button>
    </div>
  )

  const stats = [
    { label: 'Possession', h: match.possessionHome ?? null, a: match.possessionHome != null ? (100 - match.possessionHome) : null, suffix: '%' },
    { label: 'Shots', h: match.shotsHome, a: match.shotsAway },
    { label: 'Shots on Target', h: match.shotsOnTargetHome, a: match.shotsOnTargetAway },
    { label: 'Corners', h: match.cornersHome, a: match.cornersAway },
    // Fouls: no DB field exists. Explicitly null → renders honest N/A.
    { label: 'Fouls', h: null, a: null },
    { label: 'Pass Accuracy', h: homeTeam?.passAccuracy ?? null, a: awayTeam?.passAccuracy ?? null, suffix: '%' },
    { label: 'Press Intensity', h: homeTeam?.pressIntensity ?? null, a: awayTeam?.pressIntensity ?? null, suffix: '%' },
    { label: 'xG', h: match.homeXg, a: match.awayXg, decimals: 2 },
    { label: 'xG/Match', h: homeTeam?.xgPerGame ?? null, a: awayTeam?.xgPerGame ?? null, decimals: 2 },
  ]

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4 animate-fade-in-up">
        {/* ── ACTION BAR ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 border-border text-xs" onClick={() => setView('matches')}><ArrowLeft className="size-3.5" />Back</Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { fetchMatch(); toast.success('Match data refreshed') }} disabled={loading}><RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />Refresh</Button>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" className={cn('h-8 gap-1.5 text-xs', bookmarked && 'text-primary')} onClick={handleToggleBookmark}>
            {bookmarked ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}{bookmarked ? 'Saved' : 'Bookmark'}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleCopySummary}>
            {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}{copied ? 'Copied!' : 'Copy Summary'}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleAIAnalysis} disabled={aiLoading}>
            {aiLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Brain className="size-3.5" />}AI Analysis
          </Button>
          {isUpcoming && (user?.plan === 'pro' || user?.plan === 'elite') && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs bg-primary/10 text-primary border-primary/30" onClick={handleSimulate} disabled={simulating}>
              <Zap className="size-3.5" />{simulating ? 'Simulating...' : 'Simulate'}
            </Button>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            MATCH HEADER
            ═══════════════════════════════════════════════════════════════════ */}
        <Card className="glass-card-premium rounded-xl overflow-hidden">
          <CardContent className="p-6">
            {/* Competition + Status */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs bg-muted/50"><Trophy className="size-3 mr-1" />{match.competition}</Badge>
                <Badge variant="secondary" className="text-xs bg-muted/50">{match.stage}</Badge>
                {match.group && <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">Group {match.group}</Badge>}
              </div>
              <Badge variant="outline" className={cn('text-xs font-bold', statusConfig?.cls)}>
                {statusConfig?.pulse && <span className="relative flex size-1.5 mr-1.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex size-1.5 rounded-full bg-red-500" /></span>}
                {statusConfig?.label}
              </Badge>
            </div>

            {/* Teams + Score */}
            <div className="flex items-center justify-between gap-4">
              {/* Home */}
              <div className="flex-1 text-center">
                <div className="flex justify-center mb-3">
                  <TeamCrest code={homeTeam?.code ?? '?'} espnLogo={homeTeam?.logo} color={homeTeam?.primaryColor} size="3xl" bordered />
                </div>
                <h2 className="text-lg font-bold">{homeTeam?.name}</h2>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px] border-border/50">ELO {match.homeEloBefore ?? homeTeam?.eloRating ?? '—'}</Badge>
                  <StatusBadge variant="dataclass" value={homeTeam?.xgTruthClass || 'MISSING'} />
                  {homeTeam?.form && <div className="flex gap-0.5">{homeTeam.form.split('').map((f, i) => <span key={i} className={cn('inline-flex size-4 items-center justify-center rounded text-[9px] font-bold', f === 'W' ? 'bg-emerald-500/20 text-emerald-400' : f === 'D' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400')}>{f}</span>)}</div>}
                </div>
              </div>

              {/* Score */}
              <div className="text-center shrink-0 px-4">
                {isUpcoming ? (
                  <div className="text-muted-foreground">
                    <p className="text-sm font-medium">Upcoming</p>
                    <p className="text-xs mt-1">{match.date ? new Date(match.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBD'}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span className={cn('text-5xl font-black tabular-nums', match.homeScore > match.awayScore && isFinished && 'text-primary')}>{match.homeScore}</span>
                      <span className="text-2xl text-muted-foreground font-light">:</span>
                      <span className={cn('text-5xl font-black tabular-nums', match.awayScore > match.homeScore && isFinished && 'text-primary')}>{match.awayScore}</span>
                    </div>
                    <div className="flex items-center justify-center gap-3 mt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-cyan-400 font-medium">xG {match.homeXg != null ? match.homeXg.toFixed(1) : 'N/A'}</span>
                        <StatusBadge variant="dataclass" value={match.homeXgTruthClass || 'MISSING'} />
                      </div>
                      <span className="text-muted-foreground">·</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-cyan-400 font-medium">xG {match.awayXg != null ? match.awayXg.toFixed(1) : 'N/A'}</span>
                        <StatusBadge variant="dataclass" value={match.awayXgTruthClass || 'MISSING'} />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Away */}
              <div className="flex-1 text-center">
                <div className="flex justify-center mb-3">
                  <TeamCrest code={awayTeam?.code ?? '?'} espnLogo={awayTeam?.logo} color={awayTeam?.primaryColor} size="3xl" bordered />
                </div>
                <h2 className="text-lg font-bold">{awayTeam?.name}</h2>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px] border-border/50">ELO {match.awayEloBefore ?? awayTeam?.eloRating ?? '—'}</Badge>
                  <StatusBadge variant="dataclass" value={awayTeam?.xgTruthClass || 'MISSING'} />
                  {awayTeam?.form && <div className="flex gap-0.5">{awayTeam.form.split('').map((f, i) => <span key={i} className={cn('inline-flex size-4 items-center justify-center rounded text-[9px] font-bold', f === 'W' ? 'bg-emerald-500/20 text-emerald-400' : f === 'D' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400')}>{f}</span>)}</div>}
                </div>
              </div>
            </div>

            {/* Venue + Weather */}
            <div className="flex items-center justify-center gap-4 mt-5 text-[11px] text-muted-foreground">
              {match.venue && <span className="flex items-center gap-1"><MapPin className="size-3" />{match.venue}</span>}
              {match.weather && <span className="flex items-center gap-1"><Cloud className="size-3" />{match.weather}</span>}
              {match.temperature != null && <span className="flex items-center gap-1"><Thermometer className="size-3" />{match.temperature}°C</span>}
            </div>

            {/* Probability Bars */}
            <div className="mt-5 max-w-md mx-auto space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] w-10 text-right text-emerald-400 font-medium">Home</span>
                <div className="flex-1 h-3 rounded-full bg-muted/50 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-1000" style={{ width: `${homeWinProb}%` }} /></div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold tabular-nums">{homeWinProb}%</span>
                  <StatusBadge variant="dataclass" value="DERIVED" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] w-10 text-right text-amber-400 font-medium">Draw</span>
                <div className="flex-1 h-3 rounded-full bg-muted/50 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-1000" style={{ width: `${drawProb}%` }} /></div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold tabular-nums">{drawProb}%</span>
                  <StatusBadge variant="dataclass" value="DERIVED" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] w-10 text-right text-red-400 font-medium">Away</span>
                <div className="flex-1 h-3 rounded-full bg-muted/50 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-1000" style={{ width: `${awayWinProb}%` }} /></div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold tabular-nums">{awayWinProb}%</span>
                  <StatusBadge variant="dataclass" value="DERIVED" />
                </div>
              </div>
            </div>

            {/* Vote buttons */}
            {isUpcoming && (
              <div className="flex justify-center gap-3 mt-5">
                {(['home', 'draw', 'away'] as const).map((c) => (
                  <Button key={c} size="sm" variant="outline" className={cn('flex-1 max-w-[120px] text-xs font-semibold', c === 'home' ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10' : c === 'draw' ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10' : 'border-red-500/30 text-red-400 hover:bg-red-500/10')} onClick={() => handleVote(c)}>
                    {c === 'home' ? 'Home Win' : c === 'draw' ? 'Draw' : 'Away Win'}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════════
            TABS: TIMELINE / STATISTICS / xG / SHOT MAP / VOTES
            ═══════════════════════════════════════════════════════════════════ */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="glass-card w-full h-10 bg-muted/30 p-1 rounded-lg overflow-x-auto flex-nowrap">
            {[
              { value: 'timeline', label: 'Timeline' },
              { value: 'statistics', label: 'Statistics' },
              { value: 'xg', label: 'xG Timeline' },
              { value: 'shotmap', label: 'Shot Map' },
              { value: 'xt', label: 'xT Threat' },
              { value: 'votes', label: 'Votes' },
            ].map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="flex-shrink-0 min-w-[90px] h-8 text-xs font-semibold rounded-md transition-all data-[state=active]:bg-primary/15 data-[state=active]:text-primary">{t.label}</TabsTrigger>
            ))}
          </TabsList>

          {/* TIMELINE TAB */}
          <TabsContent value="timeline" className="mt-4">
            <Card className="glass-card-premium rounded-xl"><CardContent className="p-5">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2"><Activity className="size-4 text-primary" />Match Events</h3>
              {sortedEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No events recorded</p>
              ) : (
                <div className="relative ml-4 border-l-2 border-border/30 space-y-4">
                  {sortedEvents.map((ev, i) => (
                    <div key={ev.id || i} className="relative pl-6 animate-slide-in-left" style={{ animationDelay: `${i * 50}ms` }}>
                      <div className="absolute -left-[9px] top-0.5 size-4 rounded-full bg-background border-2 border-border flex items-center justify-center text-[10px]">{getEventIcon(ev.type)}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold tabular-nums text-primary">{ev.minute}&apos;</span>
                        <span className={cn('text-xs font-medium', ev.team === 'home' ? (homeTeam?.code ? '' : 'text-foreground') : (awayTeam?.code ? '' : 'text-foreground'))}>
                          {ev.team === 'home' ? homeTeam?.code : awayTeam?.code}
                        </span>
                        <span className="text-xs text-muted-foreground">{ev.playerName}</span>
                      </div>
                      {ev.description && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{ev.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* STATISTICS TAB */}
          <TabsContent value="statistics" className="mt-4">
            <Card className="glass-card-premium rounded-xl"><CardContent className="p-5 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2"><Target className="size-4 text-primary" />Match Statistics</h3>
              {stats.map((s) => <StatBarRow key={s.label} label={s.label} homeValue={s.h} awayValue={s.a} suffix={s.suffix} decimals={s.decimals ?? 0} />)}
            </CardContent></Card>
          </TabsContent>

          {/* xG TIMELINE TAB */}
          <TabsContent value="xg" className="mt-4">
            <Card className="glass-card-premium rounded-xl"><CardContent className="p-5">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2"><Flame className="size-4 text-cyan-400" />Cumulative xG Timeline</h3>
              {xgTimeline.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={xgTimeline}>
                    <CartesianGrid {...cartesianGridProps} />
                    <XAxis dataKey="minute" {...axisProps} tick={{ ...axisProps.tick, fontSize: 10 }} />
                    <YAxis {...axisProps} tick={{ ...axisProps.tick, fontSize: 10 }} />
                    <RTooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} />
                    <Line type="monotone" dataKey="Home" stroke={chartColor(0)} strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Away" stroke={chartColor(1)} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-8">No xG data available</p>}
            </CardContent></Card>
          </TabsContent>

          {/* SHOT MAP TAB */}
          <TabsContent value="shotmap" className="mt-4">
            <Card className="glass-card-premium rounded-xl"><CardContent className="p-5">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2"><Swords className="size-4 text-amber-400" />Shot Map {sbSource && <span className="text-[10px] font-normal text-muted-foreground">({sbSource})</span>}{sbLoading && <Loader2 className="size-3 animate-spin text-muted-foreground" />}</h3>
              {shotMapData === null ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Swords className="size-10 mb-3 opacity-40" />
                  <p className="text-sm">Shot map data not available for this match</p>
                </div>
              ) : (
              <>
              <div className="pitch-bg rounded-xl p-4 relative" style={{ aspectRatio: '3/2' }}>
                {/* Pitch markings */}
                <div className="absolute inset-0 border-2 border-emerald-500/20 rounded-xl" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[40%] h-[15%] border-b-2 border-x-2 border-emerald-500/20 rounded-b-lg" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[40%] h-[15%] border-t-2 border-x-2 border-emerald-500/20 rounded-t-lg" />
                <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[15%] h-[30%] border-r-2 border-t-2 border-b-2 border-emerald-500/20 rounded-r-lg" />
                <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[15%] h-[30%] border-l-2 border-t-2 border-b-2 border-emerald-500/20 rounded-l-lg" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-16 rounded-full border-2 border-emerald-500/20" />
                {/* Shots */}
                {shotMapData.map((s, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <div className={cn('absolute rounded-full border-2 transform -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-150 cursor-pointer', s.goal ? 'size-4 border-white bg-amber-400 shadow-lg shadow-amber-400/40' : 'size-3', !s.goal && s.team === 'home' && 'border-primary/50 bg-primary/30', !s.goal && s.team === 'away' && 'border-cyan-500/50 bg-cyan-500/30')} style={{ left: `${s.x}%`, top: `${s.y}%` }} />
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px] space-y-0.5">
                      <div className="font-semibold">{s.player ? `${s.player} ${s.minute ? `${s.minute}'` : ''}` : `${s.team === 'home' ? homeTeam?.code : awayTeam?.code} ${s.goal ? 'GOAL' : 'Shot'}`}</div>
                      {'xg' in s && s.xg != null && <div className="text-muted-foreground">xG: {s.xg.toFixed(3)}</div>}
                      {s.outcome && <div className="text-muted-foreground">{s.outcome}</div>}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <div className="flex items-center justify-center gap-6 mt-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><div className="size-2.5 rounded-full bg-primary/50" />{homeTeam?.code} Shot</span>
                <span className="flex items-center gap-1.5"><div className="size-2.5 rounded-full bg-amber-400" />Goal</span>
                <span className="flex items-center gap-1.5"><div className="size-2.5 rounded-full bg-cyan-500/50" />{awayTeam?.code} Shot</span>
              </div>
              </>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* xT (EXPECTED THREAT) TAB */}
          <TabsContent value="xt" className="mt-4">
            <Card className="glass-card-premium rounded-xl"><CardContent className="p-5">
              <h3 className="text-sm font-bold mb-1 flex items-center gap-2"><Flame className="size-4 text-orange-400" />Expected Threat (xT) Leaderboard</h3>
              <p className="text-[10px] text-muted-foreground mb-4">Measures how much each pass increased the probability of scoring. Powered by a 12x8 pitch grid trained on thousands of matches.</p>
              {xtLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
              ) : xtLeaderboard.length > 0 ? (
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {xtLeaderboard.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-muted/30 transition-colors">
                      <span className="text-[10px] font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold truncate">{p.player}</span>
                          <Badge variant="outline" className="text-[9px] shrink-0">{p.team.split(' ').slice(-1)[0]}</Badge>
                        </div>
                        <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                          <span>{p.totalActions} actions</span>
                          <span>{p.progressiveActions} progressive</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-sm font-black tabular-nums text-primary">{(p.totalXtGained ?? 0).toFixed(3)}</span>
                          <StatusBadge variant="dataclass" value="DERIVED" />
                        </div>
                        <div className="text-[9px] text-muted-foreground">xT total</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No xT data available for this match</p>
              )}
              <div className="mt-3 pt-3 border-t border-border/30 flex items-center gap-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><Flame className="size-3 text-orange-400" />xT = probability of scoring from that zone</span>
                <span>Higher = more threatening pass progression</span>
              </div>
            </CardContent></Card>
          </TabsContent>

          {/* VOTES TAB */}
          <TabsContent value="votes" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="glass-card-premium rounded-xl"><CardContent className="p-5">
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2"><Users className="size-4 text-primary" />Community Vote Distribution</h3>
                {totalVotes > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={votePieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" stroke="none">
                          {votePieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Pie>
                        <RTooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-4 mt-2 text-[11px]">
                      {votePieData.map((d) => <span key={d.name} className="flex items-center gap-1.5"><div className="size-2 rounded-full" style={{ backgroundColor: d.fill }} />{d.name}: {d.value} ({totalVotes > 0 ? Math.round((d.value / totalVotes) * 100) : 0}%)</span>)}
                    </div>
                    <p className="text-center text-[10px] text-muted-foreground mt-2">{totalVotes} total votes</p>
                  </>
                ) : <p className="text-sm text-muted-foreground text-center py-8">No votes yet</p>}
              </CardContent></Card>

              <Card className="glass-card-premium rounded-xl"><CardContent className="p-5">
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2"><MessageSquare className="size-4 text-cyan-400" />Prediction Summary</h3>
                {(match.predictions || []).length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {(match.predictions || []).slice(0, 10).map((p) => (
                      <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-border/10">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{p.user.displayName || p.user.name}</span>
                          <Badge variant="outline" className="text-[9px] border-border/50">{p.model}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{p.predictedOutcome.replace('_', ' ')}</span>
                          {p.isCorrect !== null && (
                            <span className={cn('text-[10px] font-bold', p.isCorrect ? 'text-emerald-400' : 'text-red-400')}>
                              {p.isCorrect ? '✓' : '✗'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground text-center py-8">No predictions yet</p>}
              </CardContent></Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}