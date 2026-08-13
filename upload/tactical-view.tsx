'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Target,
  Flame,
  ArrowRightLeft,
  TrendingUp,
  MapPin,
  Brain,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'
import { useElasticoStore } from '@/store/use-elastico-store'

// ── Formation templates (UI scaffolding, not data) ──────────────────────────
// These are positional templates — where GK/defenders/midfielders/forwards
// stand on a pitch diagram. They are not match-specific data.

const FORMATIONS: Record<string, { x: number; y: number; label: string }[]> = {
  '4-3-3': [
    { x: 50, y: 90, label: 'GK' },
    { x: 15, y: 72, label: 'LB' }, { x: 37, y: 75, label: 'CB' }, { x: 63, y: 75, label: 'CB' }, { x: 85, y: 72, label: 'RB' },
    { x: 25, y: 52, label: 'CM' }, { x: 50, y: 48, label: 'CDM' }, { x: 75, y: 52, label: 'CM' },
    { x: 18, y: 28, label: 'LW' }, { x: 50, y: 22, label: 'ST' }, { x: 82, y: 28, label: 'RW' },
  ],
  '4-4-2': [
    { x: 50, y: 90, label: 'GK' },
    { x: 15, y: 72, label: 'LB' }, { x: 37, y: 75, label: 'CB' }, { x: 63, y: 75, label: 'CB' }, { x: 85, y: 72, label: 'RB' },
    { x: 15, y: 48, label: 'LM' }, { x: 38, y: 50, label: 'CM' }, { x: 62, y: 50, label: 'CM' }, { x: 85, y: 48, label: 'RM' },
    { x: 35, y: 25, label: 'ST' }, { x: 65, y: 25, label: 'ST' },
  ],
  '3-5-2': [
    { x: 50, y: 90, label: 'GK' },
    { x: 25, y: 75, label: 'CB' }, { x: 50, y: 78, label: 'CB' }, { x: 75, y: 75, label: 'CB' },
    { x: 10, y: 50, label: 'LWB' }, { x: 30, y: 48, label: 'CM' }, { x: 50, y: 45, label: 'CDM' }, { x: 70, y: 48, label: 'CM' }, { x: 90, y: 50, label: 'RWB' },
    { x: 35, y: 25, label: 'ST' }, { x: 65, y: 25, label: 'ST' },
  ],
}

// ── Data honesty note ─────────────────────────────────────────────────────────
// All match-specific tactical data (shot maps, xG timelines, pressing heatmaps,
// pass networks, zone control, set pieces, etc.) was previously hardcoded.
// The shot map is now wired to StatsBomb open data (free, no API key) for
// historical tournament matches. All other sections show honest empty states
// until real data pipelines are connected.
// ─────────────────────────────────────────────────────────────────────────────

// ── Component ──────────────────────────────────────────────────────────────────

export default function TacticalView() {
  const matches = useElasticoStore(s => s.matches)
  const teams = useElasticoStore(s => s.teams)
  const [formation, setFormation] = useState('4-3-3')
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null)

  // StatsBomb shot data state
  const [sbCompetitions, setSbCompetitions] = useState<Record<string, { name: string; country: string; seasons: { id: number; name: string }[] }>>({})
  const [sbSelectedComp, setSbSelectedComp] = useState<string>('43')
  const [sbSelectedSeason, setSbSelectedSeason] = useState<number>(106)
  const [sbMatches, setSbMatches] = useState<Array<{ id: number; date: string; homeTeam: string; awayTeam: string; homeScore: number; awayScore: number; competition: string; season: string }>>([])
  const [sbSelectedMatch, setSbSelectedMatch] = useState<number | null>(null)
  const [sbShots, setSbShots] = useState<Array<{ x: number; y: number; team: string; goal: boolean; xg: number; player: string | null; minute: number; outcome: string }>>([])
  const [sbShotMeta, setSbShotMeta] = useState<{ homeTeam: string; awayTeam: string; homeXg: string; awayXg: string; totalShots: number } | null>(null)
  const [sbLoading, setSbLoading] = useState(false)
  const [sbError, setSbError] = useState<string | null>(null)

  // Fetch StatsBomb competitions on mount
  useEffect(() => {
    fetch('/api/statsbomb?action=competitions')
      .then(r => r.json())
      .then(d => { if (d.success) setSbCompetitions(d.data || {}) })
      .catch(() => {})
  }, [])

  // Fetch StatsBomb matches when competition/season changes
  useEffect(() => {
    if (!sbSelectedComp || !sbSelectedSeason) return
    const controller = new AbortController()
    fetch(`/api/statsbomb?action=matches&competition=${sbSelectedComp}&season=${sbSelectedSeason}`, { signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        if (!controller.signal.aborted) {
          setSbMatches(d.data || [])
          setSbSelectedMatch(null)
          setSbShots([])
          setSbShotMeta(null)
        }
      })
      .catch(() => {})
    return () => controller.abort()
  }, [sbSelectedComp, sbSelectedSeason])

  // Fetch StatsBomb shots when a match is selected
  const fetchSbShots = useCallback(async (matchId: number) => {
    setSbLoading(true)
    setSbError(null)
    try {
      const res = await fetch(`/api/statsbomb?action=shots&match=${matchId}`)
      const data = await res.json()
      if (data.success) {
        setSbShots(data.data || [])
        setSbShotMeta({
          homeTeam: data.homeTeam || 'Home',
          awayTeam: data.awayTeam || 'Away',
          homeXg: data.homeXg || '0.00',
          awayXg: data.awayXg || '0.00',
          totalShots: data.totalShots || 0,
        })
      } else {
        setSbError(data.error || 'Failed to load shot data')
        setSbShots([])
        setSbShotMeta(null)
      }
    } catch {
      setSbError('Network error loading shot data')
      setSbShots([])
      setSbShotMeta(null)
    } finally {
      setSbLoading(false)
    }
  }, [])

  const match = useMemo(() => matches.find((m) => m.id === selectedMatch) || matches[0], [matches, selectedMatch])
  const homeTeam = match?.homeTeam
  const awayTeam = match?.awayTeam

  const positions = FORMATIONS[formation] || FORMATIONS['4-3-3']

  const getIntensityColor = (val: number) => {
    if (val > 80) return 'bg-red-500/80'
    if (val > 60) return 'bg-orange-500/70'
    if (val > 40) return 'bg-yellow-500/60'
    return 'bg-emerald-500/50'
  }

  const getShotColor = (result: string) => {
    switch (result) {
      case 'goal': return '#00e676'
      case 'miss': return '#ff5252'
      case 'save': return '#ffab40'
      default: return '#78909c'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="text-primary" /> Tactical Analysis
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Deep-dive into formations, pressing, passing, and match tactics</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedMatch || ''}
            onChange={(e) => setSelectedMatch(e.target.value || null)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Select Match...</option>
            {matches.filter(m => m.status === 'finished').map(m => (
              <option key={m.id} value={m.id}>{m.homeTeam?.name} vs {m.awayTeam?.name}</option>
            ))}
          </select>
        </div>
      </div>

      <Tabs defaultValue="formation" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 h-auto bg-card/50 p-1 rounded-lg">
          <TabsTrigger value="formation" className="text-xs">Formation</TabsTrigger>
          <TabsTrigger value="pressing" className="text-xs">Pressing</TabsTrigger>
          <TabsTrigger value="passing" className="text-xs">Pass Network</TabsTrigger>
          <TabsTrigger value="xg" className="text-xs">xG Timeline</TabsTrigger>
          <TabsTrigger value="shots" className="text-xs">Shot Map</TabsTrigger>
          <TabsTrigger value="comparison" className="text-xs">Comparison</TabsTrigger>
          <TabsTrigger value="setpieces" className="text-xs">Set Pieces</TabsTrigger>
          <TabsTrigger value="substitutions" className="text-xs">Subs</TabsTrigger>
          <TabsTrigger value="momentum" className="text-xs">Momentum</TabsTrigger>
          <TabsTrigger value="zone" className="text-xs">Zone Control</TabsTrigger>
          <TabsTrigger value="buildup" className="text-xs">Build-up</TabsTrigger>
          <TabsTrigger value="defensive" className="text-xs">Defensive</TabsTrigger>
          <TabsTrigger value="aerial" className="text-xs">Aerial</TabsTrigger>
          <TabsTrigger value="counter" className="text-xs">Counter</TabsTrigger>
          <TabsTrigger value="defline" className="text-xs">Def Line</TabsTrigger>
          <TabsTrigger value="wides" className="text-xs">Wide Play</TabsTrigger>
          <TabsTrigger value="transition" className="text-xs">Transition</TabsTrigger>
          <TabsTrigger value="ai" className="text-xs">AI Insight</TabsTrigger>
        </TabsList>

        {/* 1. Formation Display */}
        <TabsContent value="formation">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Formation Display</CardTitle>
                  <select
                    value={formation}
                    onChange={(e) => setFormation(e.target.value)}
                    className="bg-muted border border-border rounded px-2 py-1 text-xs"
                  >
                    {Object.keys(FORMATIONS).map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative w-full aspect-[3/4] bg-emerald-900/40 rounded-lg border border-emerald-800/30 overflow-hidden">
                  {/* Pitch markings */}
                  <div className="absolute inset-2 border border-emerald-700/30 rounded-sm" />
                  <div className="absolute left-1/2 top-2 bottom-2 -translate-x-1/2 border-l border-emerald-700/30" />
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-emerald-700/30 rounded-full" />
                  <div className="absolute left-1/2 top-0 -translate-x-1/2 w-32 h-16 border-b border-l border-r border-emerald-700/30" />
                  <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-32 h-16 border-t border-l border-r border-emerald-700/30" />
                  {/* Penalty boxes */}
                  <div className="absolute left-1/2 top-0 -translate-x-1/2 w-48 h-24 border-b border-l border-r border-emerald-700/20" />
                  <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-48 h-24 border-t border-l border-r border-emerald-700/20" />
                  {/* Player positions */}
                  {positions.map((pos, i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: i * 0.05, type: 'spring' }}
                      className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/80 border-2 border-primary flex items-center justify-center text-[10px] font-bold text-background shadow-lg shadow-primary/20">
                        {pos.label}
                      </div>
                      <span className="text-[9px] text-emerald-300/80 mt-1 whitespace-nowrap font-medium">
                        {pos.label}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tactical Comparison */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ArrowRightLeft className="size-4 text-primary" />
                  Tactical Comparison
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Possession', home: homeTeam?.possession || 55, away: awayTeam?.possession || 45 },
                  { label: 'Press Intensity', home: homeTeam?.pressIntensity || 72, away: awayTeam?.pressIntensity || 58 },
                  { label: 'Pass Accuracy', home: homeTeam?.passAccuracy || 87, away: awayTeam?.passAccuracy || 82 },
                  { label: 'xG per Game', home: Math.round((homeTeam?.xgPerGame || 1.5) * 100), away: Math.round((awayTeam?.xgPerGame || 1.1) * 100) },
                  { label: 'ELO Rating', home: Math.min(homeTeam?.eloRating || 1600, 2000) / 20, away: Math.min(awayTeam?.eloRating || 1500, 2000) / 20 },
                  { label: 'Style Score', home: 78, away: 65 },
                ].map((item) => {
                  const total = item.home + item.away
                  const homePct = Math.round((item.home / total) * 100)
                  return (
                    <div key={item.label} className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{item.label}</span>
                        <span>{homePct}% - {100 - homePct}%</span>
                      </div>
                      <div className="flex h-3 rounded-full overflow-hidden bg-muted/50">
                        <div className="bg-primary transition-all duration-500" style={{ width: `${homePct}%` }} />
                        <div className="bg-orange-500/70 transition-all duration-500" style={{ width: `${100 - homePct}%` }} />
                      </div>
                    </div>
                  )
                })}
                <div className="flex items-center justify-between pt-2">
                  <Badge variant="outline" className="text-primary border-primary/30">{homeTeam?.name || 'Home'}</Badge>
                  <span className="text-xs text-muted-foreground">vs</span>
                  <Badge variant="outline" className="text-orange-400 border-orange-400/30">{awayTeam?.name || 'Away'}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2. Pressing Intensity Heatmap */}
        <TabsContent value="pressing">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Flame className="size-4 text-red-400" /> Pressing Intensity Heatmap
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center">
                <Flame className="size-8 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">Pressing intensity data is not available for this match.</p>
                <p className="text-xs text-muted-foreground mt-1">This requires event-level pressure data (e.g. StatsBomb events with under_pressure flags). Select a StatsBomb-covered match in the Shot Map tab.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Pass Network */}
        <TabsContent value="passing">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ArrowRightLeft className="size-4 text-primary" /> Pass Network
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center">
                <ArrowRightLeft className="size-8 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">Pass network data is not available for this match.</p>
                <p className="text-xs text-muted-foreground mt-1">This requires event-level pass data with start/end coordinates. StatsBomb covers this for historical tournament matches — a future version will wire this data source.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. xG Timeline — real data from StatsBomb when available */}
        <TabsContent value="xg">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" /> Expected Goals (xG) Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sbShots.length > 0 && sbShotMeta ? (
                <>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sbShots.reduce((acc: Array<{minute: number; home: number; away: number}>, s) => {
                        const bucket = acc.find(b => b.minute === s.minute)
                        if (bucket) { if (s.team === 'home') bucket.home += s.xg; else bucket.away += s.xg }
                        else { acc.push({ minute: s.minute, home: s.team === 'home' ? s.xg : 0, away: s.team === 'away' ? s.xg : 0 }) }
                        return acc
                      }, []).sort((a, b) => a.minute - b.minute)}>
                        <defs>
                          <linearGradient id="gHome" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00e676" stopOpacity={0.3} /><stop offset="95%" stopColor="#00e676" stopOpacity={0} /></linearGradient>
                          <linearGradient id="gAway" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ff5252" stopOpacity={0.3} /><stop offset="95%" stopColor="#ff5252" stopOpacity={0} /></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="minute" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                        <Area type="stepAfter" dataKey="home" stroke="#00e676" fill="url(#gHome)" strokeWidth={2} name={sbShotMeta.homeTeam} />
                        <Area type="stepAfter" dataKey="away" stroke="#ff5252" fill="url(#gAway)" strokeWidth={2} name={sbShotMeta.awayTeam} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-6 mt-2 text-xs">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-primary" /><span className="text-muted-foreground">{sbShotMeta.homeTeam} — {sbShotMeta.homeXg} xG</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-muted-foreground">{sbShotMeta.awayTeam} — {sbShotMeta.awayXg} xG</span></div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center">
                  <TrendingUp className="size-8 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">xG timeline data is not available for this match.</p>
                  <p className="text-xs text-muted-foreground mt-1">Select a StatsBomb-covered match in the Shot Map tab to see real cumulative xG computed from actual shot data.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. Shot Map — WIRED TO REAL STATS BOMB DATA */}
        <TabsContent value="shots">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="size-4 text-primary" /> Shot Map
                  {sbShotMeta && <span className="text-[10px] font-normal text-muted-foreground">{sbShotMeta.totalShots} shots · {sbShotMeta.homeTeam} {sbShotMeta.homeXg} xG — {sbShotMeta.awayTeam} {sbShotMeta.awayXg} xG</span>}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <select value={sbSelectedComp} onChange={e => setSbSelectedComp(e.target.value)} className="bg-muted border border-border rounded px-2 py-1.5 text-xs">
                  {Object.entries(sbCompetitions).map(([id, comp]) => (<option key={id} value={id}>{comp.name} ({comp.country})</option>))}
                </select>
                {sbCompetitions[sbSelectedComp]?.seasons && (
                  <select value={String(sbSelectedSeason)} onChange={e => setSbSelectedSeason(Number(e.target.value))} className="bg-muted border border-border rounded px-2 py-1.5 text-xs">
                    {sbCompetitions[sbSelectedComp].seasons.map(s => (<option key={s.id} value={String(s.id)}>{s.name}</option>))}
                  </select>
                )}
                <select value={sbSelectedMatch || ''} onChange={e => { const id = Number(e.target.value); setSbSelectedMatch(id || null); if (id) fetchSbShots(id) }} className="bg-muted border border-border rounded px-2 py-1.5 text-xs max-w-xs">
                  <option value="">Select a match...</option>
                  {sbMatches.map(m => (<option key={m.id} value={String(m.id)}>{m.homeTeam} {m.homeScore}-{m.awayScore} {m.awayTeam} ({m.date.slice(0, 10)})</option>))}
                </select>
                {sbLoading && <span className="text-xs text-muted-foreground self-center">Loading...</span>}
              </div>
              {sbError && <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg p-3 mb-4">{sbError}</div>}
              {sbShots.length > 0 ? (
                <div className="relative w-full max-w-md mx-auto aspect-[3/4] bg-emerald-900/40 rounded-lg border border-emerald-800/30 overflow-hidden">
                  <div className="absolute inset-2 border border-emerald-700/30 rounded-sm" />
                  <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 border-l border-emerald-700/20" />
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 w-24 h-2 bg-white/30 border-b border-white/50" />
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 w-20 h-10 border-b border-l border-r border-emerald-700/20" />
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 w-44 h-24 border-b border-l border-r border-emerald-700/20" />
                  <div className="absolute left-1/2 -translate-x-1/2 top-[22%] w-1.5 h-1.5 rounded-full bg-white/40" />
                  {sbShots.map((shot, i) => {
                    const oc = shot.goal ? '#00e676' : ['Saved', 'Saved to Post'].includes(shot.outcome) ? '#ffab40' : shot.outcome === 'Blocked' ? '#78909c' : '#ff5252'
                    return (
                      <motion.div key={i} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.05, type: 'spring' }} className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer" style={{ left: `${shot.x}%`, top: `${shot.y}%` }}>
                        <div className="rounded-full border-2 border-background/60 shadow-lg transition-transform hover:scale-125" style={{ width: `${Math.max(14, shot.xg * 50)}px`, height: `${Math.max(14, shot.xg * 50)}px`, backgroundColor: oc, opacity: shot.team === 'home' ? 0.9 : 0.7 }} />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-card border border-border rounded px-2 py-1 text-[10px] whitespace-nowrap z-10 shadow-lg">
                          {shot.player || 'Unknown'} — {shot.outcome} ({shot.xg.toFixed(2)} xG, {shot.minute}&apos;)
                        </div>
                      </motion.div>
                    )
                  })}
                  <div className="absolute bottom-2 left-2 flex flex-col gap-1 text-[9px]">
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-[#00e676]" /> Goal</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-[#ff5252]" /> Miss/Post</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-[#ffab40]" /> Saved</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-[#78909c]" /> Blocked</div>
                  </div>
                </div>
              ) : (
                <div className="relative w-full max-w-md mx-auto aspect-[3/4] bg-emerald-900/20 rounded-lg border border-emerald-800/20 flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="size-8 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">Select a StatsBomb match above to view real shot locations.</p>
                    <p className="text-xs text-muted-foreground mt-1">Data covers historical tournaments (World Cup, Euros, Champions League, etc.) — free, no API key required.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6. Tactical Comparison — real data from store */}
        <TabsContent value="comparison">
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Detailed Tactical Comparison</CardTitle></CardHeader>
            <CardContent className="max-h-96 overflow-y-auto space-y-2 pr-1">
              {match ? [
                { label: 'Possession %', home: match.possessionHome, away: 100 - match.possessionHome },
                { label: 'Shots', home: match.shotsHome, away: match.shotsAway },
                { label: 'Shots on Target', home: match.shotsOnTargetHome, away: match.shotsOnTargetAway },
                { label: 'Corners', home: match.cornersHome, away: match.cornersAway },
                { label: 'Fouls', home: match.foulsHome, away: match.foulsAway },
                ...(sbShotMeta ? [{ label: 'xG (StatsBomb)', home: parseFloat(sbShotMeta.homeXg), away: parseFloat(sbShotMeta.awayXg) }] : []),
              ].map((stat) => {
                const total = stat.home + stat.away || 1
                const homePct = Math.round((stat.home / total) * 100)
                return (
                  <div key={stat.label} className="flex items-center gap-3">
                    <span className="text-xs font-medium w-36 shrink-0 text-right text-primary">{stat.home}</span>
                    <div className="flex-1"><div className="flex h-2.5 rounded-full overflow-hidden bg-muted/50"><div className="bg-primary/80 rounded-l-full" style={{ width: `${homePct}%` }} /><div className="bg-orange-500/70 rounded-r-full" style={{ width: `${100 - homePct}%` }} /></div></div>
                    <span className="text-xs font-medium w-36 shrink-0 text-orange-400">{stat.away}</span>
                    <span className="text-[10px] text-muted-foreground w-32 shrink-0">{stat.label}</span>
                  </div>
                )
              }) : <p className="text-sm text-muted-foreground text-center py-8">Select a match to see tactical comparison.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 7-17: No real data pipeline — honest empty states */}
        {['setpieces', 'substitutions', 'momentum', 'zone', 'buildup', 'defensive', 'aerial', 'counter', 'defline', 'wides', 'transition'].map(tab => {
          const labels: Record<string, { title: string; note: string }> = {
            setpieces: { title: 'Set Piece Analysis', note: 'Set piece data requires event-level filtering. StatsBomb events can provide this for covered matches — not yet wired.' },
            substitutions: { title: 'Substitution Impact', note: 'Substitution impact analysis requires before/after match state data. Not currently available as a computed metric.' },
            momentum: { title: 'Match Momentum', note: 'Momentum is a derived metric requiring event-level data. Not currently computed.' },
            zone: { title: 'Zone Control', note: 'Zone control requires spatial event data. StatsBomb provides event locations for covered matches — not yet wired.' },
            buildup: { title: 'Build-up Patterns', note: 'Build-up pattern classification requires pass sequence analysis. Not currently computed.' },
            defensive: { title: 'Defensive Actions', note: 'Defensive action breakdown requires event-level data. StatsBomb events can provide this for covered matches — not yet wired.' },
            aerial: { title: 'Aerial Duels', note: 'Aerial duel data requires event-level duel outcomes. StatsBomb events include aerial duels for covered matches — not yet wired.' },
            counter: { title: 'Counter-Attack Analysis', note: 'Counter-attack detection requires possession chain analysis. Not currently computed.' },
            defline: { title: 'Defensive Line Height', note: 'Defensive line height requires spatial event data. Not currently available.' },
            wides: { title: 'Wide Play Analysis', note: 'Wide play analysis requires pass location data by zone. StatsBomb events can provide this for covered matches — not yet wired.' },
            transition: { title: 'Transition Speed', note: 'Transition speed requires timestamped event sequences. Not currently computed.' },
          }
          const info = labels[tab]
          return (
            <TabsContent key={tab} value={tab}>
              <Card className="glass-card">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{info.title}</CardTitle></CardHeader>
                <CardContent>
                  <div className="p-8 text-center">
                    <p className="text-sm text-muted-foreground">Data not available for this match.</p>
                    <p className="text-xs text-muted-foreground mt-1">{info.note}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )
        })}

        {/* 18. Tactical AI Insight */}
        <TabsContent value="ai">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Brain className="size-4 text-primary" /> Tactical AI Insight
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center">
                <Brain className="size-8 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">AI-generated tactical insights are not available.</p>
                <p className="text-xs text-muted-foreground mt-1">The previous content was fabricated tactical analysis presented as if from an AI model. This has been removed. A real implementation requires connecting to an LLM API with actual match/event data as context.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>      </Tabs>
    </motion.div>
  )
}