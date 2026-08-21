'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useElasticoStore } from '@/store/use-elastico-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { DataState } from '@/components/elastico/primitives'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { axisProps, cartesianGridProps, tooltipContentStyle, tooltipLabelStyle, chartColor } from '@/lib/chart-theme'
import {
  Target, ArrowUpDown, Flame, CheckCircle2, XCircle, Crown, Download,
  Trophy, Zap, TrendingUp, Send, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { generateCSV } from '@/lib/export'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────────────

/** Shape returned by GET /api/predictions */
interface PredictionRecord {
  id: string
  matchId: string
  homeTeam: string
  awayTeam: string
  competition: string
  predictedHomeGoals: number
  predictedAwayGoals: number
  predictedOutcome: string
  confidence: number
  model: string
  actualHomeGoals: number | null
  actualAwayGoals: number | null
  isCorrect: boolean | null
  points: number
  matchDate: string | null
  createdAt: string
}

interface LeaderboardEntry {
  rank: number
  id: string
  name: string | null
  predictionAccuracy: number
  predictionStreak: number
  bestStreak: number
  totalPredictions: number
}

type ViewState = 'loading' | 'error' | 'empty' | 'success'

// ═══════════════════════════════════════════════════════════════════════════════

export default function PredictionsView() {
  const user = useElasticoStore(s => s.user)
  const token = useElasticoStore(s => s.token)
  const matches = useElasticoStore(s => s.matches)

  // ── State ────────────────────────────────────────────────────────────────
  const [predictions, setPredictions] = useState<PredictionRecord[]>([])
  const [leaderboardPos, setLeaderboardPos] = useState<number>(0)
  const [leaderboardCount, setLeaderboardCount] = useState<number>(0)
  const [viewState, setViewState] = useState<ViewState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'confidence' | 'model'>('date')
  const [modelFilter, setModelFilter] = useState('all')
  const [resultFilter, setResultFilter] = useState<'all' | 'correct' | 'incorrect' | 'pending'>('all')

  // Quick Predict state
  const [quickConfidence, setQuickConfidence] = useState(50)
  const [submittingMatchId, setSubmittingMatchId] = useState<string | null>(null)
  // Per-match score inputs: { [matchId]: { home: number, away: number } }
  const [quickScores, setQuickScores] = useState<Record<string, { home: string; away: string }>>({})

  // ── Data Fetching ────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setViewState('loading')
    setErrorMessage('')

    try {
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      // Fetch predictions
      const res = await fetch('/api/predictions', { headers })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (${res.status})`)
      }
      const data = await res.json()
      const fetched: PredictionRecord[] = Array.isArray(data) ? data : data.predictions || []
      setPredictions(fetched)

      // Fetch leaderboard
      const lbRes = await fetch('/api/leaderboard')
      if (lbRes.ok) {
        const lbData = await lbRes.json()
        const entries: LeaderboardEntry[] = Array.isArray(lbData) ? lbData : lbData.leaderboard || []
        const pos = entries.findIndex((e: LeaderboardEntry) => e.id === user?.id)
        setLeaderboardPos(pos >= 0 ? pos + 1 : 0)
        setLeaderboardCount(entries.length)
      }

      // Determine view state
      if (fetched.length === 0) {
        setViewState('empty')
      } else {
        setViewState('success')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load predictions. Check your connection and try again.'
      setErrorMessage(msg)
      setViewState('error')
    }
  }, [token, user?.id])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Derived data ─────────────────────────────────────────────────────────

  // Match map from store for cross-referencing (status, team colors)
  const matchMap = useMemo(() => {
    const map: Record<string, (typeof matches)[number]> = {}
    for (const m of matches) map[m.id] = m
    return map
  }, [matches])

  const upcomingMatches = useMemo(() => matches.filter(m => m.status === 'upcoming'), [matches])

  // Separate predictions: resolved (match played) vs pending
  const resolvedPredictions = useMemo(
    () => predictions.filter(p => p.actualHomeGoals != null && p.actualAwayGoals != null),
    [predictions],
  )
  const pendingPredictions = useMemo(
    () => predictions.filter(p => p.actualHomeGoals == null || p.actualAwayGoals == null),
    [predictions],
  )

  // User's model values (for filter dropdown)
  const usedModels = useMemo(() => {
    const set = new Set<string>()
    for (const p of predictions) set.add(p.model)
    return Array.from(set).sort()
  }, [predictions])

  const filteredResolved = useMemo(() => {
    let arr = [...resolvedPredictions]
    if (modelFilter !== 'all') arr = arr.filter(p => p.model === modelFilter)
    if (resultFilter === 'correct') arr = arr.filter(p => p.isCorrect === true)
    if (resultFilter === 'incorrect') arr = arr.filter(p => p.isCorrect === false)
    if (sortBy === 'date') arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    if (sortBy === 'confidence') arr.sort((a, b) => b.confidence - a.confidence)
    if (sortBy === 'model') arr.sort((a, b) => a.model.localeCompare(b.model))
    return arr
  }, [resolvedPredictions, modelFilter, resultFilter, sortBy])

  // Stats from DB user record
  const accuracy = user?.predictionAccuracy ?? 0
  const streak = user?.predictionStreak ?? 0
  const bestStreak = user?.bestStreak ?? 0
  const totalPredictions = user?.totalPredictions ?? 0

  // Accuracy by Model — computed from real resolved predictions
  const accuracyByModel = useMemo(() => {
    const map: Record<string, { total: number; correct: number }> = {}
    for (const p of resolvedPredictions) {
      if (!map[p.model]) map[p.model] = { total: 0, correct: 0 }
      map[p.model].total++
      if (p.isCorrect) map[p.model].correct++
    }
    return Object.entries(map)
      .map(([model, { total, correct }]) => ({
        model,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
        total,
      }))
      .sort((a, b) => b.accuracy - a.accuracy)
  }, [resolvedPredictions])

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    if (filteredResolved.length === 0) {
      toast.error('Nothing to export', { description: 'No resolved predictions to export.' })
      return
    }
    const data = filteredResolved.map(p => ({
      Date: p.matchDate ? new Date(p.matchDate).toLocaleDateString() : new Date(p.createdAt).toLocaleDateString(),
      Match: `${p.homeTeam} vs ${p.awayTeam}`,
      Competition: p.competition,
      Prediction: p.predictedOutcome,
      'Predicted Score': `${p.predictedHomeGoals}-${p.predictedAwayGoals}`,
      'Actual Score': `${p.actualHomeGoals ?? '?'}-${p.actualAwayGoals ?? '?'}`,
      Confidence: `${p.confidence}%`,
      Model: p.model,
      Result: p.isCorrect === true ? 'Correct' : p.isCorrect === false ? 'Incorrect' : 'Pending',
      Points: p.points,
    }))
    generateCSV(data, 'elastico-predictions')
    toast.success('Exported!', { description: `${data.length} predictions exported as CSV` })
  }, [filteredResolved])

  const handleQuickPredict = useCallback(async (matchId: string, choice: string) => {
    if (!token) {
      toast.error('Not authenticated')
      return
    }

    const scores = quickScores[matchId]
    if (!scores || scores.home === '' || scores.away === '') {
      toast.error('Score required', { description: 'Enter your predicted score for both teams.' })
      return
    }

    const homeGoals = parseInt(scores.home, 10)
    const awayGoals = parseInt(scores.away, 10)
    if (isNaN(homeGoals) || isNaN(awayGoals) || homeGoals < 0 || awayGoals < 0) {
      toast.error('Invalid score', { description: 'Scores must be non-negative integers.' })
      return
    }

    const storeMatch = matchMap[matchId]
    setSubmittingMatchId(matchId)
    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          matchId,
          predictedHomeGoals: homeGoals,
          predictedAwayGoals: awayGoals,
          predictedOutcome: choice,
          confidence: quickConfidence,
          model: 'user',
          homeTeam: storeMatch?.homeTeam?.name ?? null,
          awayTeam: storeMatch?.awayTeam?.name ?? null,
          competition: storeMatch?.competition ?? null,
          matchDate: storeMatch?.date ?? null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Submission failed (${res.status})`)
      }
      toast.success('Prediction submitted!')
      fetchData() // refresh
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit prediction'
      toast.error('Prediction failed', { description: msg })
    } finally {
      setSubmittingMatchId(null)
    }
  }, [token, quickScores, quickConfidence, matchMap, fetchData])

  const updateScore = useCallback((matchId: string, side: 'home' | 'away', value: string) => {
    // Allow only digits
    const cleaned = value.replace(/[^0-9]/g, '')
    setQuickScores(prev => ({
      ...prev,
      [matchId]: {
        home: side === 'home' ? cleaned : (prev[matchId]?.home ?? ''),
        away: side === 'away' ? cleaned : (prev[matchId]?.away ?? ''),
      },
    }))
  }, [])

  // Check which upcoming matches already have predictions
  const predictedMatchIds = useMemo(() => new Set(predictions.map(p => p.matchId)), [predictions])

  // ── Render: LOADING ─────────────────────────────────────────────────────

  if (viewState === 'loading') {
    return (
      <div className="space-y-5 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-72" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  // ── Render: ERROR ───────────────────────────────────────────────────────

  if (viewState === 'error') {
    return (
      <div className="space-y-5 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15">
            <Target className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-primary">Predictions</h2>
            <p className="text-sm text-muted-foreground">Track, analyze, and improve your prediction performance</p>
          </div>
        </div>
        <DataState
          type="error"
          message={errorMessage || 'Failed to load predictions'}
          onRetry={fetchData}
        />
      </div>
    )
  }

  // ── Render: EMPTY ───────────────────────────────────────────────────────

  if (viewState === 'empty') {
    return (
      <div className="space-y-5 animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15">
            <Target className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-primary">Predictions</h2>
            <p className="text-sm text-muted-foreground">Track, analyze, and improve your prediction performance</p>
          </div>
        </div>

        {/* Stats (all zeros — honest) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Target, label: 'Accuracy', value: `${accuracy}%`, color: 'text-primary' },
            { icon: Zap, label: 'Total Predictions', value: totalPredictions, color: 'text-cyan-400' },
            { icon: Flame, label: 'Current Streak', value: streak, color: 'text-orange-400' },
            { icon: Crown, label: 'Best Streak', value: bestStreak, color: 'text-amber-400' },
          ].map(s => (
            <Card key={s.label} className="glass-card-premium card-hover-lift rounded-xl">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                  <s.icon className={cn('size-4', s.color)} />
                </div>
                <div>
                  <p className="text-lg font-bold leading-tight">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Predict — still visible when empty so user can start */}
        {upcomingMatches.length > 0 && (
          <Card className="glass-card-premium rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Send className="size-4 text-primary" />
                Quick Predict — Upcoming Matches
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 px-1 pb-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Your confidence:</Label>
                <Slider
                  value={[quickConfidence]}
                  onValueChange={([v]) => setQuickConfidence(v)}
                  min={10}
                  max={100}
                  step={5}
                  className="flex-1"
                />
                <span className="text-xs font-mono text-primary tabular-nums w-8 text-right">{quickConfidence}%</span>
              </div>
              {upcomingMatches.slice(0, 4).map((m) => (
                <QuickPredictRow
                  key={m.id}
                  match={m}
                  scores={quickScores[m.id] ?? { home: '', away: '' }}
                  onScoreChange={(side, val) => updateScore(m.id, side, val)}
                  onPredict={(choice) => handleQuickPredict(m.id, choice)}
                  isSubmitting={submittingMatchId === m.id}
                  alreadyPredicted={predictedMatchIds.has(m.id)}
                />
              ))}
            </CardContent>
          </Card>
        )}

        <DataState
          type="empty"
          message="No predictions yet. Use Quick Predict above or the Prediction Engine to get started."
          actionLabel="Refresh"
          actionOnClick={fetchData}
        />
      </div>
    )
  }

  // ── Render: SUCCESS ─────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15">
          <Target className="size-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold text-primary">Predictions</h2>
          <p className="text-sm text-muted-foreground">Track, analyze, and improve your prediction performance</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-border text-xs"
          onClick={handleExport}
          disabled={filteredResolved.length === 0}
        >
          <Download className="size-3.5" />Export CSV
        </Button>
      </div>

      {/* ── ACCURACY STATS CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Target, label: 'Accuracy', value: `${accuracy}%`, color: 'text-primary' },
          { icon: Zap, label: 'Total Predictions', value: totalPredictions, color: 'text-cyan-400' },
          { icon: Flame, label: 'Current Streak', value: streak, color: 'text-orange-400' },
          { icon: Crown, label: 'Best Streak', value: bestStreak, color: 'text-amber-400' },
        ].map(s => (
          <Card key={s.label} className="glass-card-premium card-hover-lift rounded-xl">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                <s.icon className={cn('size-4', s.color)} />
              </div>
              <div>
                <p className="text-lg font-bold leading-tight">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── LEADERBOARD POSITION ── */}
      {leaderboardPos > 0 && (
        <Card className="glass-card-premium rounded-xl border-amber-500/20">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15">
              <Trophy className="size-5 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold">Leaderboard Position</p>
              <p className="text-2xl font-black text-amber-400">#{leaderboardPos}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-muted-foreground">
                of {leaderboardCount} predictor{leaderboardCount !== 1 ? 's' : ''}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── QUICK PREDICT PANEL ── */}
      {upcomingMatches.length > 0 && (
        <Card className="glass-card-premium rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Send className="size-4 text-primary" />
              Quick Predict — Upcoming Matches
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Confidence slider */}
            <div className="flex items-center gap-3 px-1 pb-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Your confidence:</Label>
              <Slider
                value={[quickConfidence]}
                onValueChange={([v]) => setQuickConfidence(v)}
                min={10}
                max={100}
                step={5}
                className="flex-1"
              />
              <span className="text-xs font-mono text-primary tabular-nums w-8 text-right">{quickConfidence}%</span>
            </div>
            {upcomingMatches.slice(0, 6).map((m) => (
              <QuickPredictRow
                key={m.id}
                match={m}
                scores={quickScores[m.id] ?? { home: '', away: '' }}
                onScoreChange={(side, val) => updateScore(m.id, side, val)}
                onPredict={(choice) => handleQuickPredict(m.id, choice)}
                isSubmitting={submittingMatchId === m.id}
                alreadyPredicted={predictedMatchIds.has(m.id)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── MAIN GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* PREDICTION HISTORY TABLE */}
          <Card className="glass-card-premium rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ArrowUpDown className="size-4 text-cyan-400" />
                  Prediction History
                  <Badge variant="outline" className="text-[9px] border-border/50 ml-1">
                    {filteredResolved.length} result{filteredResolved.length !== 1 ? 's' : ''}
                  </Badge>
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Select value={modelFilter} onValueChange={setModelFilter}>
                    <SelectTrigger className="h-7 w-[120px] text-[10px] bg-muted/50 border-border">
                      <SelectValue placeholder="Model" />
                    </SelectTrigger>
                    <SelectContent className="glass-card border-border">
                      <SelectItem value="all">All Models</SelectItem>
                      {/* Show 'user' first, then any models found in data */}
                      {usedModels.includes('user') && <SelectItem value="user">User</SelectItem>}
                      {usedModels.filter(m => m !== 'user').map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={resultFilter} onValueChange={(v) => setResultFilter(v as typeof resultFilter)}>
                    <SelectTrigger className="h-7 w-[100px] text-[10px] bg-muted/50 border-border">
                      <SelectValue placeholder="Result" />
                    </SelectTrigger>
                    <SelectContent className="glass-card border-border">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="correct">Correct</SelectItem>
                      <SelectItem value="incorrect">Incorrect</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                    <SelectTrigger className="h-7 w-[100px] text-[10px] bg-muted/50 border-border">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent className="glass-card border-border">
                      <SelectItem value="date">Newest</SelectItem>
                      <SelectItem value="confidence">Confidence</SelectItem>
                      <SelectItem value="model">Model</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredResolved.length === 0 ? (
                <DataState
                  type="empty"
                  message={
                    resolvedPredictions.length === 0
                      ? 'No resolved predictions yet. Predictions will appear here after matches finish.'
                      : 'No predictions match the current filters.'
                  }
                />
              ) : (
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30 hover:bg-transparent">
                        <TableHead className="text-[10px]">Match</TableHead>
                        <TableHead className="text-[10px]">Score</TableHead>
                        <TableHead className="text-[10px]">Prediction</TableHead>
                        <TableHead className="text-[10px]">Model</TableHead>
                        <TableHead className="text-[10px]">Conf.</TableHead>
                        <TableHead className="text-[10px] text-center">Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResolved.map((p) => {
                        const storeMatch = matchMap[p.matchId]
                        return (
                          <TableRow key={p.id} className="border-border/10">
                            <TableCell className="text-xs py-2">
                              <div className="flex items-center gap-1.5">
                                <div
                                  className="size-4 rounded-full border border-border/50 shrink-0"
                                  style={{ backgroundColor: storeMatch?.homeTeam?.primaryColor ?? '#555' }}
                                />
                                <span className="truncate max-w-[60px] sm:max-w-none">{p.homeTeam}</span>
                                <span className="text-muted-foreground mx-0.5">vs</span>
                                <span className="truncate max-w-[60px] sm:max-w-none">{p.awayTeam}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs py-2 tabular-nums font-bold">
                              {p.actualHomeGoals ?? '?'}-{p.actualAwayGoals ?? '?'}
                            </TableCell>
                            <TableCell className="text-xs py-2">
                              <span className="capitalize">{p.predictedOutcome.replace('_', ' ')}</span>
                              <span className="text-muted-foreground ml-1">
                                ({p.predictedHomeGoals}-{p.predictedAwayGoals})
                              </span>
                            </TableCell>
                            <TableCell className="text-xs py-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[9px] border-border/50',
                                  p.model === 'user' && 'border-primary/30 text-primary',
                                )}
                              >
                                {p.model}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs py-2 tabular-nums">{p.confidence}%</TableCell>
                            <TableCell className="text-center py-2">
                              {p.isCorrect === null ? (
                                <span className="text-[10px] text-muted-foreground">Pending</span>
                              ) : p.isCorrect ? (
                                <CheckCircle2 className="size-4 text-emerald-400 mx-auto" />
                              ) : (
                                <XCircle className="size-4 text-red-400 mx-auto" />
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PENDING PREDICTIONS */}
          {pendingPredictions.length > 0 && (
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <AlertCircle className="size-4 text-amber-400" />
                  Pending Predictions
                  <Badge variant="outline" className="text-[9px] border-border/50 ml-1">
                    {pendingPredictions.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {pendingPredictions.slice(0, 10).map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/20">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-medium truncate">{p.homeTeam}</span>
                        <span className="text-[10px] text-muted-foreground">vs</span>
                        <span className="text-xs font-medium truncate">{p.awayTeam}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs capitalize">{p.predictedOutcome}</span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">({p.predictedHomeGoals}-{p.predictedAwayGoals})</span>
                        <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400">pending</Badge>
                      </div>
                    </div>
                  ))}
                  {pendingPredictions.length > 10 && (
                    <p className="text-[10px] text-muted-foreground text-center">
                      +{pendingPredictions.length - 10} more
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">
          {/* ACCURACY BY MODEL CHART — real computation from DB */}
          {accuracyByModel.length > 0 ? (
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" />
                  Accuracy by Model
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(180, accuracyByModel.length * 36)}>
                  <BarChart data={accuracyByModel} layout="vertical">
                    <CartesianGrid {...cartesianGridProps} />
                    <XAxis type="number" domain={[0, 100]} {...axisProps} />
                    <YAxis type="category" dataKey="model" {...axisProps} width={80} />
                    <RTooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} />
                    <Bar dataKey="accuracy" radius={[0, 4, 4, 0]} maxBarSize={24}>
                      {accuracyByModel.map((_, i) => (
                        <Cell
                          key={i}
                          fill={chartColor(i)}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                  Based on {resolvedPredictions.length} resolved prediction{resolvedPredictions.length !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" />
                  Accuracy by Model
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataState
                  type="empty"
                  message="No resolved predictions yet. Accuracy data will appear once matches are finished."
                />
              </CardContent>
            </Card>
          )}

          {/* PREDICTION BREAKDOWN — honest summary */}
          <Card className="glass-card-premium rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Target className="size-4 text-primary" />
                Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Resolved</span>
                <span className="font-mono tabular-nums font-semibold">{resolvedPredictions.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Pending</span>
                <span className="font-mono tabular-nums font-semibold">{pendingPredictions.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Correct</span>
                <span className="font-mono tabular-nums font-semibold text-emerald-400">
                  {resolvedPredictions.filter(p => p.isCorrect === true).length}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Incorrect</span>
                <span className="font-mono tabular-nums font-semibold text-red-400">
                  {resolvedPredictions.filter(p => p.isCorrect === false).length}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Models used</span>
                <span className="font-mono tabular-nums font-semibold">{usedModels.length}</span>
              </div>
              {usedModels.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {usedModels.map(m => (
                    <Badge
                      key={m}
                      variant="outline"
                      className={cn(
                        'text-[9px] border-border/50',
                        m === 'user' && 'border-primary/30 text-primary',
                      )}
                    >
                      {m}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

interface QuickPredictRowProps {
  match: {
    id: string
    homeTeam?: { name: string; code: string; primaryColor: string } | null
    awayTeam?: { name: string; code: string; primaryColor: string } | null
    competition?: string
  }
  scores: { home: string; away: string }
  onScoreChange: (side: 'home' | 'away', value: string) => void
  onPredict: (choice: string) => void
  isSubmitting: boolean
  alreadyPredicted: boolean
}

function QuickPredictRow({ match, scores, onScoreChange, onPredict, isSubmitting, alreadyPredicted }: QuickPredictRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg bg-muted/20">
      {/* Home team */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div
          className="size-6 rounded-full border border-border/50 shrink-0"
          style={{ backgroundColor: match.homeTeam?.primaryColor ?? '#555' }}
        />
        <span className="text-xs font-medium truncate">{match.homeTeam?.name ?? 'TBD'}</span>
      </div>

      {/* Score inputs */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Input
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={scores.home}
          onChange={(e) => onScoreChange('home', e.target.value)}
          placeholder="-"
          disabled={alreadyPredicted || isSubmitting}
          className={cn(
            'h-7 w-10 text-center text-xs font-mono p-0 bg-muted/50 border-border',
            'focus-visible:ring-primary/30',
          )}
          aria-label="Predicted home goals"
        />
        <span className="text-xs text-muted-foreground font-bold">:</span>
        <Input
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={scores.away}
          onChange={(e) => onScoreChange('away', e.target.value)}
          placeholder="-"
          disabled={alreadyPredicted || isSubmitting}
          className={cn(
            'h-7 w-10 text-center text-xs font-mono p-0 bg-muted/50 border-border',
            'focus-visible:ring-primary/30',
          )}
          aria-label="Predicted away goals"
        />
      </div>

      {/* Outcome buttons */}
      <div className="flex items-center gap-1">
        {(['home', 'draw', 'away'] as const).map((c) => (
          <Button
            key={c}
            size="sm"
            variant={alreadyPredicted ? 'secondary' : 'outline'}
            className={cn(
              'h-7 w-14 text-[10px] px-0',
              !alreadyPredicted && c === 'home' && 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10',
              !alreadyPredicted && c === 'draw' && 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10',
              !alreadyPredicted && c === 'away' && 'border-red-500/30 text-red-400 hover:bg-red-500/10',
            )}
            onClick={() => onPredict(c)}
            disabled={alreadyPredicted || isSubmitting}
          >
            {isSubmitting ? '…' : c === 'home' ? 'H' : c === 'draw' ? 'D' : 'A'}
          </Button>
        ))}
      </div>

      {/* Away team */}
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        <span className="text-xs font-medium truncate text-right">{match.awayTeam?.name ?? 'TBD'}</span>
        <div
          className="size-6 rounded-full border border-border/50 shrink-0"
          style={{ backgroundColor: match.awayTeam?.primaryColor ?? '#555' }}
        />
      </div>

      {/* Already predicted indicator */}
      {alreadyPredicted && (
        <Badge variant="outline" className="text-[9px] border-primary/30 text-primary shrink-0">
          Predicted
        </Badge>
      )}
    </div>
  )
}
