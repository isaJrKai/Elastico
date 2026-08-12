'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useElasticoStore } from '@/store/use-elastico-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
import {
  Target, ArrowUpDown, Flame, CheckCircle2, XCircle, Brain, Calendar, Crown, Download, Trophy, Zap, TrendingUp, Send,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { generateCSV } from '@/lib/export'
import { toast } from '@/hooks/use-toast'

// ── Types ──────────────────────────────────────────────────────────────────

interface PredictionRecord {
  id: string; matchId: string; predictedHomeGoals: number; predictedAwayGoals: number
  predictedOutcome: string; confidence: number; model: string; isCorrect: boolean | null
  points: number; createdAt: string
  match: { homeTeam: { name: string; code: string; primaryColor: string } | null; awayTeam: { name: string; code: string; primaryColor: string } | null; homeScore: number; awayScore: number; status: string; stage: string }
}

interface LeaderboardEntry { rank: number; id: string; name: string | null; predictionAccuracy: number; predictionStreak: number; bestStreak: number; totalPredictions: number }

// ═══════════════════════════════════════════════════════════════════════════════

export default function PredictionsView() {
  const user = useElasticoStore(s => s.user)
  const token = useElasticoStore(s => s.token)
  const matches = useElasticoStore(s => s.matches)

  const [predictions, setPredictions] = useState<PredictionRecord[]>([])
  const [leaderboardPos, setLeaderboardPos] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'date' | 'confidence' | 'model'>('date')
  const [modelFilter, setModelFilter] = useState('all')
  const [resultFilter, setResultFilter] = useState<'all' | 'correct' | 'incorrect'>('all')

  const fetchPredictions = useCallback(async () => {
    setLoading(true)
    try {
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch('/api/predictions', { headers })
      if (res.ok) {
        const data = await res.json()
        setPredictions(Array.isArray(data) ? data : data.predictions || [])
      }
      // Fetch leaderboard position
      const lbRes = await fetch('/api/leaderboard')
      if (lbRes.ok) {
        const lbData = await lbRes.json()
        const entries: LeaderboardEntry[] = Array.isArray(lbData) ? lbData : lbData.leaderboard || []
        const pos = entries.findIndex((e: LeaderboardEntry) => e.id === user?.id)
        setLeaderboardPos(pos >= 0 ? pos + 1 : 0)
      }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [token, user?.id])

  useEffect(() => { fetchPredictions() }, [fetchPredictions])

  // Derived
  const upcomingMatches = useMemo(() => matches.filter(m => m.status === 'upcoming'), [matches])
  const activePredictions = useMemo(() => predictions.filter(p => p.match?.status === 'upcoming'), [predictions])
  const pastPredictions = useMemo(() => predictions.filter(p => p.match?.status === 'finished'), [predictions])

  const filteredPast = useMemo(() => {
    let arr = [...pastPredictions]
    if (modelFilter !== 'all') arr = arr.filter(p => p.model === modelFilter)
    if (resultFilter === 'correct') arr = arr.filter(p => p.isCorrect === true)
    if (resultFilter === 'incorrect') arr = arr.filter(p => p.isCorrect === false)
    if (sortBy === 'date') arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    if (sortBy === 'confidence') arr.sort((a, b) => b.confidence - a.confidence)
    if (sortBy === 'model') arr.sort((a, b) => a.model.localeCompare(b.model))
    return arr
  }, [pastPredictions, modelFilter, resultFilter, sortBy])

  const accuracy = user?.predictionAccuracy ?? 0
  const streak = user?.predictionStreak ?? 0
  const bestStreak = user?.bestStreak ?? 0
  const totalPredictions = user?.totalPredictions ?? 0
  const correctPredictions = user?.correctPredictions ?? 0

  const accuracyByModel = useMemo(() => {
    const map: Record<string, { total: number; correct: number }> = {}
    for (const p of pastPredictions) {
      if (!map[p.model]) map[p.model] = { total: 0, correct: 0 }
      map[p.model].total++
      if (p.isCorrect) map[p.model].correct++
    }
    return Object.entries(map).map(([model, { total, correct }]) => ({
      model, accuracy: total > 0 ? Math.round((correct / total) * 100) : 0, total,
    })).sort((a, b) => b.accuracy - a.accuracy)
  }, [pastPredictions])

  const handleExport = useCallback(() => {
    const data = filteredPast.map(p => ({
      Date: new Date(p.createdAt).toLocaleDateString(),
      Match: `${p.match?.homeTeam?.name} vs ${p.match?.awayTeam?.name}`,
      Prediction: p.predictedOutcome,
      Score: `${p.match?.homeScore}-${p.match?.awayScore}`,
      Confidence: `${p.confidence}%`,
      Model: p.model,
      Result: p.isCorrect === true ? 'Correct' : p.isCorrect === false ? 'Incorrect' : 'Pending',
      Points: p.points,
    }))
    generateCSV(data, 'elastico-predictions')
    toast({ title: 'Exported!', description: `${data.length} predictions exported as CSV` })
  }, [filteredPast])

  const handleQuickPredict = useCallback((matchId: string, choice: string) => {
    if (!token) return
    fetch('/api/predictions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ matchId, predictedOutcome: choice, confidence: 70 }),
    }).then(() => { fetchPredictions(); toast({ title: 'Prediction submitted!' }) }).catch(() => toast({ title: 'Error', description: 'Failed', variant: 'destructive' }))
  }, [token, fetchPredictions])

  if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full rounded-xl" /><Skeleton className="h-64 w-full rounded-xl" /></div>

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15"><Target className="size-5 text-primary" /></div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Predictions</h1>
          <p className="text-sm text-muted-foreground">Track, analyze, and improve your prediction performance</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 border-border text-xs" onClick={handleExport}><Download className="size-3.5" />Export CSV</Button>
      </div>

      {/* ── ACCURACY STATS + STREAK TRACKER ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Target, label: 'Accuracy', value: `${accuracy}%`, color: 'text-primary' },
          { icon: Zap, label: 'Total Predictions', value: totalPredictions, color: 'text-cyan-400' },
          { icon: Flame, label: 'Current Streak', value: streak, color: 'text-orange-400' },
          { icon: Crown, label: 'Best Streak', value: bestStreak, color: 'text-amber-400' },
        ].map(s => (
          <Card key={s.label} className="glass-card-premium card-hover-lift rounded-xl">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/50"><s.icon className={cn('size-4', s.color)} /></div>
              <div><p className="text-lg font-bold leading-tight">{s.value}</p><p className="text-[10px] text-muted-foreground">{s.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Leaderboard Position */}
      {leaderboardPos > 0 && (
        <Card className="glass-card-premium rounded-xl border-amber-500/20">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15"><Trophy className="size-5 text-amber-400" /></div>
            <div><p className="text-sm font-semibold">Leaderboard Position</p><p className="text-2xl font-black text-amber-400">#{leaderboardPos}</p></div>
            <div className="ml-auto text-right"><p className="text-xs text-muted-foreground">of {totalPredictions} predictors</p></div>
          </CardContent>
        </Card>
      )}

      {/* ── MAIN GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">

          {/* QUICK PREDICT PANEL */}
          {upcomingMatches.length > 0 && (
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2"><Send className="size-4 text-primary" />Quick Predict — Upcoming Matches</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingMatches.slice(0, 4).map((m) => {
                  const existing = activePredictions.find(p => p.matchId === m.id)
                  return (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="size-6 rounded-full border border-border/50 shrink-0" style={{ backgroundColor: m.homeTeam?.primaryColor ?? '#555' }} />
                        <span className="text-xs font-medium truncate">{m.homeTeam?.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {(['home', 'draw', 'away'] as const).map((c) => (
                          <Button key={c} size="sm" variant={existing?.predictedOutcome === c ? 'default' : 'outline'} className={cn('h-6 w-14 text-[10px] px-0',
                            !existing && c === 'home' ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10' : !existing && c === 'draw' ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10' : !existing && c === 'away' ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : ''
                          )} onClick={() => handleQuickPredict(m.id, c)} disabled={!!existing}>
                            {c === 'home' ? 'H' : c === 'draw' ? 'D' : 'A'}
                          </Button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                        <span className="text-xs font-medium truncate text-right">{m.awayTeam?.name}</span>
                        <div className="size-6 rounded-full border border-border/50 shrink-0" style={{ backgroundColor: m.awayTeam?.primaryColor ?? '#555' }} />
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* PREDICTION HISTORY */}
          <Card className="glass-card-premium rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2"><ArrowUpDown className="size-4 text-cyan-400" />Prediction History</CardTitle>
                <div className="flex gap-2">
                  <Select value={modelFilter} onValueChange={setModelFilter}>
                    <SelectTrigger className="h-7 w-[120px] text-[10px] bg-muted/50 border-border"><SelectValue placeholder="Model" /></SelectTrigger>
                    <SelectContent className="glass-card border-border">
                      <SelectItem value="all">All Models</SelectItem>
                      <SelectItem value="elo">ELO</SelectItem>
                      <SelectItem value="poisson">Poisson</SelectItem>
                      <SelectItem value="dixon-coles">Dixon-Coles</SelectItem>
                      <SelectItem value="monte-carlo">Monte Carlo</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={resultFilter} onValueChange={(v) => setResultFilter(v as typeof resultFilter)}>
                    <SelectTrigger className="h-7 w-[100px] text-[10px] bg-muted/50 border-border"><SelectValue placeholder="Result" /></SelectTrigger>
                    <SelectContent className="glass-card border-border">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="correct">Correct</SelectItem>
                      <SelectItem value="incorrect">Incorrect</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredPast.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No predictions found</p>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader><TableRow className="border-border/30 hover:bg-transparent">
                      <TableHead className="text-[10px]">Match</TableHead>
                      <TableHead className="text-[10px]">Prediction</TableHead>
                      <TableHead className="text-[10px]">Model</TableHead>
                      <TableHead className="text-[10px]">Confidence</TableHead>
                      <TableHead className="text-[10px]">Score</TableHead>
                      <TableHead className="text-[10px] text-center">Result</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {filteredPast.map((p) => (
                        <TableRow key={p.id} className="border-border/10">
                          <TableCell className="text-xs py-2">{p.match?.homeTeam?.code} vs {p.match?.awayTeam?.code}</TableCell>
                          <TableCell className="text-xs py-2 capitalize">{p.predictedOutcome.replace('_', ' ')}</TableCell>
                          <TableCell className="text-xs py-2"><Badge variant="outline" className="text-[9px] border-border/50">{p.model}</Badge></TableCell>
                          <TableCell className="text-xs py-2 tabular-nums">{p.confidence}%</TableCell>
                          <TableCell className="text-xs py-2 tabular-nums font-bold">{p.match?.homeScore}-{p.match?.awayScore}</TableCell>
                          <TableCell className="text-center py-2">
                            {p.isCorrect === null ? <span className="text-[10px] text-muted-foreground">—</span> :
                              p.isCorrect ? <CheckCircle2 className="size-4 text-emerald-400 mx-auto" /> : <XCircle className="size-4 text-red-400 mx-auto" />}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">
          {/* MODEL COMPARISON */}
          <Card className="glass-card-premium rounded-xl">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-bold flex items-center gap-2"><Brain className="size-4 text-purple-400" />Model Comparison</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Run predictions to see model accuracy data.</p>
              </div>
            </CardContent>
          </Card>

          {/* ACCURACY BY MODEL CHART */}
          {accuracyByModel.length > 0 && (
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-bold flex items-center gap-2"><TrendingUp className="size-4 text-primary" />Accuracy by Model</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={accuracyByModel} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.2 0.03 260)" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }} />
                    <YAxis type="category" dataKey="model" tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }} width={80} />
                    <RTooltip contentStyle={{ background: 'oklch(0.12 0.02 260)', border: '1px solid oklch(0.25 0.03 260)', borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
                      {accuracyByModel.map((_, i) => <Cell key={i} fill={i === 0 ? '#00e676' : i === 1 ? '#00b4d8' : i === 2 ? '#ffd700' : '#a855f7'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* PREDICTION CALENDAR HEATMAP */}
          <Card className="glass-card-premium rounded-xl">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-bold flex items-center gap-2"><Calendar className="size-4 text-amber-400" />Prediction Activity</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Prediction activity will appear here as you make predictions.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}