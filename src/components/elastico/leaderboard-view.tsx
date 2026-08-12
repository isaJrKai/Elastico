'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useElasticoStore } from '@/store/use-elastico-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  Trophy, Medal, Target, Crown, TrendingUp, Star, Flame, ArrowUp, ArrowDown, Minus,
  Zap, Search, Download, Goal, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { generateCSV } from '@/lib/export'
import { toast } from '@/hooks/use-toast'

// ── Types ──────────────────────────────────────────────────────────────────

interface PredictorEntry { rank: number; id: string; name: string | null; displayName: string | null; avatarUrl: string | null; plan: string; predictionAccuracy: number; predictionStreak: number; bestStreak: number; totalPredictions: number; correctPredictions: number; rankChange?: number | null }
// GoldenBootEntry removed — backend data not yet available

type TimePeriod = 'all' | 'month' | 'week'

const PLAN_BADGE: Record<string, { label: string; cls: string }> = {
  admin: { label: 'ADMIN', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  elite: { label: 'ELITE', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  pro: { label: 'PRO', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  free: { label: 'FREE', cls: 'bg-muted text-muted-foreground border-border' },
}

// MOCK_GOLDEN_BOOT removed — backend data not yet available

// ═══════════════════════════════════════════════════════════════════════════════

export default function LeaderboardView() {
  const user = useElasticoStore(s => s.user)
  const [predictors, setPredictors] = useState<PredictorEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/leaderboard')
      if (res.ok) {
        const data = await res.json()
        const entries: PredictorEntry[] = Array.isArray(data) ? data : data.leaderboard || []
        // No rank change data available from backend
        setPredictors(entries.map((e: PredictorEntry) => ({
          ...e,
          rankChange: null,
        })))
      }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchLeaderboard() }, [fetchLeaderboard])

  const filtered = useMemo(() => {
    let arr = [...predictors]
    if (searchQuery) arr = arr.filter(p => (p.displayName || p.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
    return arr
  }, [predictors, searchQuery])

  const paginated = filtered.slice(0, page * pageSize)
  const hasMore = paginated.length < filtered.length

  const userEntry = useMemo(() => {
    if (!user) return null
    return predictors.find(p => p.id === user.id) || null
  }, [predictors, user])

  const userRank = userEntry?.rank ?? 0

  // Accuracy distribution data
  const accuracyDistribution = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0] // 0-20, 20-40, 40-60, 60-80, 80-100
    for (const p of predictors) {
      const a = p.predictionAccuracy
      if (a < 20) buckets[0]++
      else if (a < 40) buckets[1]++
      else if (a < 60) buckets[2]++
      else if (a < 80) buckets[3]++
      else buckets[4]++
    }
    return [
      { range: '0-20%', count: buckets[0], fill: '#ff4757' },
      { range: '20-40%', count: buckets[1], fill: '#ff6b6b' },
      { range: '40-60%', count: buckets[2], fill: '#ffd700' },
      { range: '60-80%', count: buckets[3], fill: '#00b4d8' },
      { range: '80-100%', count: buckets[4], fill: '#00e676' },
    ].filter(d => d.count > 0)
  }, [predictors])

  const handleExport = useCallback(() => {
    const data = paginated.map(p => ({
      Rank: p.rank, Name: p.displayName || p.name || 'Anonymous', Plan: p.plan,
      Accuracy: `${p.predictionAccuracy}%`, Streak: p.predictionStreak, Best: p.bestStreak,
      Total: p.totalPredictions, Correct: p.correctPredictions,
    }))
    generateCSV(data, 'elastico-leaderboard')
    toast({ title: 'Exported!', description: `${data.length} entries exported` })
  }, [paginated])

  // ── Podium (top 3) ──
  const top3 = predictors.slice(0, 3)
  const medalColors = ['text-amber-400', 'text-gray-300', 'text-amber-700']

  if (loading) return <div className="space-y-4"><Skeleton className="h-64 w-full rounded-xl" /><Skeleton className="h-96 w-full rounded-xl" /></div>

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15"><Trophy className="size-5 text-amber-400" /></div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-sm text-muted-foreground">Top predictors & golden boot race</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 border-border text-xs" onClick={handleExport}><Download className="size-3.5" />Export</Button>
      </div>

      {/* Your Position Card */}
      {userEntry && (
        <Card className="glass-card-premium rounded-xl border-primary/20 ring-glow-emerald">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15"><Trophy className="size-5 text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Your Position</p>
              <p className="text-2xl font-black text-primary">#{userRank}</p>
            </div>
            <div className="flex-1 grid grid-cols-4 gap-2 ml-4">
              <div className="text-center"><p className="text-sm font-bold">{userEntry.predictionAccuracy}%</p><p className="text-[9px] text-muted-foreground">Accuracy</p></div>
              <div className="text-center"><p className="text-sm font-bold text-orange-400">{userEntry.predictionStreak}</p><p className="text-[9px] text-muted-foreground">Streak</p></div>
              <div className="text-center"><p className="text-sm font-bold">{userEntry.totalPredictions}</p><p className="text-[9px] text-muted-foreground">Predictions</p></div>
              <div className="text-center"><p className="text-sm font-bold text-emerald-400">{userEntry.correctPredictions}</p><p className="text-[9px] text-muted-foreground">Correct</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="predictors" className="w-full">
        <TabsList className="glass-card w-full h-10 bg-muted/30 p-1 rounded-lg">
          <TabsTrigger value="predictors" className="flex-1 h-8 text-xs font-semibold rounded-md data-[state=active]:bg-primary/15 data-[state=active]:text-primary">🏆 Predictors</TabsTrigger>
          <TabsTrigger value="analytics" className="flex-1 h-8 text-xs font-semibold rounded-md data-[state=active]:bg-primary/15 data-[state=active]:text-primary">📊 Analytics</TabsTrigger>
        </TabsList>

        {/* PREDICTORS TAB */}
        <TabsContent value="predictors" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 bg-muted/50 border-border text-sm" />
            </div>
            {/* TODO: Backend time period filtering not yet implemented */}
            <div className="flex gap-1 bg-muted/30 p-1 rounded-lg">
              {([['all', 'All Time'], ['month', 'This Month'], ['week', 'This Week']] as const).map(([val, label]) => (
                <button key={val} onClick={() => setTimePeriod(val as TimePeriod)} className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all', timePeriod === val ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground')}>{label}</button>
              ))}
            </div>
          </div>

          {/* Top 3 Podium */}
          {top3.length >= 3 && (
            <div className="grid grid-cols-3 gap-3">
              {[top3[1], top3[0], top3[2]].map((entry, i) => {
                const order = i === 0 ? 2 : i === 1 ? 1 : 3
                return (
                  <Card key={entry.id} className={cn('glass-card-premium rounded-xl text-center', order === 1 && 'border-amber-500/30 ring-glow-emerald', order === 1 ? 'order-2 sm:order-none' : '')}>
                    <CardContent className="p-4 pt-6">
                      <div className={cn('flex justify-center mb-2', order === 1 ? '-mt-6' : '')}>
                        <div className={cn('flex size-14 items-center justify-center rounded-full border-2', order === 1 ? 'border-amber-400 bg-amber-500/15' : order === 2 ? 'border-gray-400 bg-gray-500/10' : 'border-amber-700 bg-amber-800/10')}>
                          <span className="text-2xl">{order === 1 ? '🥇' : order === 2 ? '🥈' : '🥉'}</span>
                        </div>
                      </div>
                      <Avatar className="mx-auto size-10 mb-2"><AvatarImage src={entry.avatarUrl || undefined} /><AvatarFallback className="bg-muted text-xs">{(entry.displayName || entry.name || '?')[0]}</AvatarFallback></Avatar>
                      <p className="text-xs font-bold truncate">{entry.displayName || entry.name || 'Anonymous'}</p>
                      <p className={cn('text-lg font-black', medalColors[order - 1])}>{entry.predictionAccuracy}%</p>
                      <p className="text-[10px] text-muted-foreground">{entry.correctPredictions}/{entry.totalPredictions} correct</p>
                      <Badge variant="outline" className={cn('mt-2 text-[9px]', PLAN_BADGE[entry.plan]?.cls)}>{PLAN_BADGE[entry.plan]?.label}</Badge>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Full Table */}
          <Card className="glass-card-premium rounded-xl overflow-hidden">
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                    <tr className="border-b border-border/30">
                      <th className="py-2.5 px-4 text-left text-[10px] font-semibold text-muted-foreground w-12">#</th>
                      <th className="py-2.5 px-4 text-left text-[10px] font-semibold text-muted-foreground">User</th>
                      <th className="py-2.5 px-4 text-center text-[10px] font-semibold text-muted-foreground">Accuracy</th>
                      <th className="py-2.5 px-4 text-center text-[10px] font-semibold text-muted-foreground">Streak</th>
                      <th className="py-2.5 px-4 text-center text-[10px] font-semibold text-muted-foreground">Predictions</th>
                      <th className="py-2.5 px-4 text-center text-[10px] font-semibold text-muted-foreground">Move</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((entry) => {
                      const isCurrentUser = entry.id === user?.id
                      return (
                        <tr key={entry.id} className={cn('border-b border-border/10 hover:bg-muted/20 transition-colors', isCurrentUser && 'bg-primary/5')}>
                          <td className="py-2.5 px-4 text-xs font-bold tabular-nums">{entry.rank}</td>
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2">
                              <Avatar className="size-6"><AvatarImage src={entry.avatarUrl || undefined} /><AvatarFallback className="bg-muted text-[9px]">{(entry.displayName || entry.name || '?')[0]}</AvatarFallback></Avatar>
                              <div>
                                <p className="text-xs font-medium truncate max-w-[140px]">{entry.displayName || entry.name || 'Anonymous'}{isCurrentUser && ' (You)'}</p>
                                <Badge variant="outline" className={cn('text-[8px] h-3 px-1', PLAN_BADGE[entry.plan]?.cls)}>{PLAN_BADGE[entry.plan]?.label}</Badge>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-muted/50 overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${entry.predictionAccuracy}%` }} /></div>
                              <span className="text-xs font-bold tabular-nums w-10 text-right">{entry.predictionAccuracy}%</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Flame className="size-3 text-orange-400" />
                              <span className="text-xs font-bold tabular-nums">{entry.predictionStreak}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-center text-xs tabular-nums">{entry.correctPredictions}/{entry.totalPredictions}</td>
                          <td className="py-2.5 px-4 text-center">
                            {entry.rankChange == null ? (
                              <span className="text-xs text-muted-foreground">-</span>
                            ) : entry.rankChange > 0 ? (
                              <ArrowUp className="size-3.5 text-emerald-400 mx-auto" />
                            ) : entry.rankChange < 0 ? (
                              <ArrowDown className="size-3.5 text-red-400 mx-auto" />
                            ) : (
                              <Minus className="size-3.5 text-muted-foreground mx-auto" />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {hasMore && (
                <div className="flex justify-center py-3 border-t border-border/20">
                  <Button variant="outline" size="sm" className="text-xs border-border" onClick={() => setPage(p => p + 1)}>Show More</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ANALYTICS TAB */}
        <TabsContent value="analytics" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><Target className="size-4 text-primary" />Accuracy Distribution</CardTitle></CardHeader>
              <CardContent>
                {accuracyDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={accuracyDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.2 0.03 260)" />
                      <XAxis dataKey="range" tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }} />
                      <RTooltip contentStyle={{ background: 'oklch(0.12 0.02 260)', border: '1px solid oklch(0.25 0.03 260)', borderRadius: 8, fontSize: 11 }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {accuracyDistribution.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-8">No data</p>}
              </CardContent>
            </Card>

            <Card className="glass-card-premium rounded-xl">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><Star className="size-4 text-amber-400" />Platform Stats</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Total Predictors', value: predictors.length, icon: Users },
                  { label: 'Avg Accuracy', value: predictors.length > 0 ? `${Math.round(predictors.reduce((s, p) => s + p.predictionAccuracy, 0) / predictors.length)}%` : '—', icon: Target },
                  { label: 'Best Streak (All Time)', value: Math.max(...predictors.map(p => p.bestStreak), 0), icon: Flame },
                  { label: 'Highest Accuracy', value: predictors.length > 0 ? `${Math.max(...predictors.map(p => p.predictionAccuracy))}%` : '—', icon: Crown },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                    <div className="flex items-center gap-2"><s.icon className="size-4 text-muted-foreground" /><span className="text-xs">{s.label}</span></div>
                    <span className="text-sm font-bold">{s.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}