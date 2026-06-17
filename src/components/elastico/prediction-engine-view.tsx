'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useElasticoStore } from '@/store/use-elastico-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import {
  Brain, Activity, TrendingUp, TrendingDown, DollarSign, Target, Zap, Settings,
  ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle, XCircle, Flame,
  Shield, Gauge, BarChart3, Cpu, Calculator, Radio, Eye, GitBranch,
  Plus, Trash2, RefreshCw, Play, Save, RotateCcw, Sparkles, AlertOctagon, Minus
} from 'lucide-react'
import type { MatchInput, FullMatchAnalysis, EngineConfig, InjuryAdjustment } from '@/lib/prediction-engine'
import { cn } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────────

function authHeaders() {
  const t = typeof window !== 'undefined' ? localStorage.getItem('elastico_token') : null
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }
}

const CONF_COLORS: Record<string, string> = {
  'very-high': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  high: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  medium: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

const RISK_COLORS: Record<string, string> = {
  'very-high': 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  medium: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
}

const ACTION_STYLE: Record<string, string> = {
  BET: 'bg-emerald-500/20 text-emerald-400',
  NO_EDGE: 'bg-red-500/20 text-red-400',
  RISKY: 'bg-amber-500/20 text-amber-400',
}

const DEFAULT_INJURY: InjuryAdjustment = {
  teamId: '', playerName: '', status: 'questionable', importance: 'rotation', xgImpact: 0,
}

// ═══════════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════════

export default function PredictionEngineView() {
  const teams = useElasticoStore(s => s.teams)
  const token = useElasticoStore(s => s.token)

  // ── Simulation state ──────────────────────────────────────────────────────────
  const [simulating, setSimulating] = useState(false)
  const [analysis, setAnalysis] = useState<FullMatchAnalysis | null>(null)

  const [homeTeamId, setHomeTeamId] = useState('')
  const [awayTeamId, setAwayTeamId] = useState('')
  const [homeXg, setHomeXg] = useState('1.45')
  const [awayXg, setAwayXg] = useState('1.10')
  const [homeElo, setHomeElo] = useState('1850')
  const [awayElo, setAwayElo] = useState('1780')
  const [oddsHome, setOddsHome] = useState('2.10')
  const [oddsDraw, setOddsDraw] = useState('3.40')
  const [oddsAway, setOddsAway] = useState('3.60')
  const [bankroll, setBankroll] = useState('1000')
  const [simRuns, setSimRuns] = useState('150000')
  const [injuries, setInjuries] = useState<InjuryAdjustment[]>([])

  // ── Kelly state ───────────────────────────────────────────────────────────────
  const [kellyBankroll, setKellyBankroll] = useState('1000')
  const [kellyLoading, setKellyLoading] = useState(false)
  const [kellyResult, setKellyResult] = useState<FullMatchAnalysis['portfolioAllocation'] | null>(null)

  // ── Market signals state ──────────────────────────────────────────────────────
  const [sigOpenHome, setSigOpenHome] = useState('2.10')
  const [sigOpenDraw, setSigOpenDraw] = useState('3.40')
  const [sigOpenAway, setSigOpenAway] = useState('3.60')
  const [sigCurHome, setSigCurHome] = useState('1.95')
  const [sigCurDraw, setSigCurDraw] = useState('3.50')
  const [sigCurAway, setSigCurAway] = useState('4.00')
  const [sigHomeTeam, setSigHomeTeam] = useState('')
  const [sigAwayTeam, setSigAwayTeam] = useState('')
  const [sigLoading, setSigLoading] = useState(false)
  const [signalResult, setSignalResult] = useState<import('@/lib/prediction-engine').MarketSignal | null>(null)

  // ── Config state ──────────────────────────────────────────────────────────────
  const [config, setConfig] = useState<EngineConfig>({
    simulationRuns: 150000, kellyFraction: 25, garchEnabled: true,
    jumpDiffusionEnabled: true, minEdgeThreshold: 2, maxBankrollRisk: 5,
  })
  const [configLoading, setConfigLoading] = useState(false)

  const homeTeam = teams.find(t => t.id === homeTeamId)
  const awayTeam = teams.find(t => t.id === awayTeamId)

  // ── Run simulation ────────────────────────────────────────────────────────────
  const runSimulation = useCallback(async () => {
    if (!homeTeamId || !awayTeamId) { toast.error('Select both teams'); return }
    setSimulating(true)
    try {
      const input: MatchInput = {
        homeTeam: homeTeam?.name ?? '', awayTeam: awayTeam?.name ?? '',
        homeTeamId, awayTeamId, homeXg: +homeXg, awayXg: +awayXg,
        homeGoalsConceded: +awayXg * 0.9, awayGoalsConceded: +homeXg * 0.9,
        homeElo: +homeElo, awayElo: +awayElo,
        bookmakerOdds: { home: +oddsHome, draw: +oddsDraw, away: +oddsAway },
        injuries: injuries.length ? injuries : undefined,
      }
      const res = await fetch('/api/prediction-engine/simulate', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ input, bankroll: +bankroll, simulationRuns: +simRuns }),
      })
      if (!res.ok) throw new Error('Simulation failed')
      const data: FullMatchAnalysis = await res.json()
      setAnalysis(data)
      toast.success('Simulation complete', { icon: <Sparkles className="text-emerald-400" /> })
    } catch (e: any) {
      toast.error(e.message || 'Simulation error')
    } finally {
      setSimulating(false)
    }
  }, [homeTeamId, awayTeamId, homeTeam, awayTeam, homeXg, awayXg, homeElo, awayElo, oddsHome, oddsDraw, oddsAway, bankroll, simRuns, injuries])

  // ── Run Kelly ─────────────────────────────────────────────────────────────────
  const runKelly = useCallback(async () => {
    if (!analysis) { toast.error('Run a simulation first'); return }
    setKellyLoading(true)
    try {
      const res = await fetch('/api/prediction-engine/kelly', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ analysis, bankroll: +kellyBankroll }),
      })
      if (!res.ok) throw new Error('Kelly calculation failed')
      const data = await res.json()
      setKellyResult(data)
      toast.success('Kelly analysis complete')
    } catch (e: any) {
      toast.error(e.message || 'Kelly error')
    } finally {
      setKellyLoading(false)
    }
  }, [analysis, kellyBankroll])

  // ── Run market signals ────────────────────────────────────────────────────────
  const runSignals = useCallback(async () => {
    if (!sigHomeTeam || !sigAwayTeam) { toast.error('Select both teams'); return }
    setSigLoading(true)
    try {
      const res = await fetch('/api/prediction-engine/market-signals', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          homeTeam: sigHomeTeam, awayTeam: sigAwayTeam,
          openingOdds: { home: +sigOpenHome, draw: +sigOpenDraw, away: +sigOpenAway },
          currentOdds: { home: +sigCurHome, draw: +sigCurDraw, away: +sigCurAway },
        }),
      })
      if (!res.ok) throw new Error('Signal analysis failed')
      const data = await res.json()
      setSignalResult(data)
      toast.success('Market signals analyzed')
    } catch (e: any) {
      toast.error(e.message || 'Signal error')
    } finally {
      setSigLoading(false)
    }
  }, [sigHomeTeam, sigAwayTeam, sigOpenHome, sigOpenDraw, sigOpenAway, sigCurHome, sigCurDraw, sigCurAway])

  // ── Config save / reset ───────────────────────────────────────────────────────
  const saveConfig = useCallback(async () => {
    setConfigLoading(true)
    try {
      const res = await fetch('/api/prediction-engine/config', {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success('Configuration saved')
    } catch (e: any) {
      toast.error(e.message || 'Config error')
    } finally {
      setConfigLoading(false)
    }
  }, [config])

  const resetConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/prediction-engine/config', { headers: authHeaders() })
      if (res.ok) {
        const data: EngineConfig = await res.json()
        setConfig(data)
        toast.success('Configuration reset')
      }
    } catch { toast.error('Failed to reset config') }
  }, [])

  // ── Injury management ─────────────────────────────────────────────────────────
  const addInjury = () => setInjuries(p => [...p, { ...DEFAULT_INJURY }])
  const removeInjury = (i: number) => setInjuries(p => p.filter((_, idx) => idx !== i))
  const updateInjury = (i: number, patch: Partial<InjuryAdjustment>) =>
    setInjuries(p => p.map((v, idx) => idx === i ? { ...v, ...patch } : v))

  // ── Derived visuals ───────────────────────────────────────────────────────────
  const probBars = analysis ? [
    { name: 'Home', value: +(analysis.simulation.matchProbabilities.homeVictory * 100).toFixed(1), fill: '#00e676' },
    { name: 'Draw', value: +(analysis.simulation.matchProbabilities.draw * 100).toFixed(1), fill: '#ffd700' },
    { name: 'Away', value: +(analysis.simulation.matchProbabilities.awayVictory * 100).toFixed(1), fill: '#ff4757' },
  ] : []

  const topScorelines = analysis
    ? Object.entries(analysis.simulation.exoticScorelines)
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([score, prob]) => ({ score, prob: +(prob * 100).toFixed(2) }))
    : []

  const totalsData = analysis ? [
    { name: 'O1.5', value: +(analysis.simulation.totalsMarket.over15 * 100).toFixed(1), fill: '#00e676' },
    { name: 'U1.5', value: +(100 - analysis.simulation.totalsMarket.over15 * 100).toFixed(1), fill: '#ff4757' },
    { name: 'O2.5', value: +(analysis.simulation.totalsMarket.over25 * 100).toFixed(1), fill: '#00e676' },
    { name: 'U2.5', value: +(analysis.simulation.totalsMarket.under25 * 100).toFixed(1), fill: '#ff4757' },
    { name: 'O3.5', value: +(analysis.simulation.totalsMarket.over35 * 100).toFixed(1), fill: '#00e676' },
    { name: 'U3.5', value: +(100 - analysis.simulation.totalsMarket.over35 * 100).toFixed(1), fill: '#ff4757' },
  ] : []

  const ahData = analysis ? [
    { line: '0', home: +(analysis.simulation.asianHandicap.line0.home * 100).toFixed(1), away: +(analysis.simulation.asianHandicap.line0.away * 100).toFixed(1) },
    { line: '-0.5', home: +(analysis.simulation.asianHandicap.lineHalf.home * 100).toFixed(1), away: +(analysis.simulation.asianHandicap.lineHalf.away * 100).toFixed(1) },
    { line: '-1', home: +(analysis.simulation.asianHandicap.line1.home * 100).toFixed(1), away: +(analysis.simulation.asianHandicap.line1.away * 100).toFixed(1) },
    { line: '-1.5', home: +(analysis.simulation.asianHandicap.line15.home * 100).toFixed(1), away: +(analysis.simulation.asianHandicap.line15.away * 100).toFixed(1) },
  ] : []

  const kellyPie = kellyResult ? kellyResult.outcomes
    .filter(o => o.action === 'BET')
    .map(o => ({ name: o.label, value: +o.wagerAmount.toFixed(2), fill: '#00e676' }))
    : []

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <Brain className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Prediction Engine</h1>
          <p className="text-sm text-zinc-500">Stochastic simulation • Kelly criterion • Market signals</p>
        </div>
      </div>

      <Tabs defaultValue="simulator" className="w-full">
        <TabsList className="glass-card border-0 bg-transparent p-1 gap-1">
          <TabsTrigger value="simulator" className="data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 text-zinc-400 transition-all">
            <Cpu className="w-4 h-4 mr-2" />Stochastic Simulator
          </TabsTrigger>
          <TabsTrigger value="kelly" className="data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 text-zinc-400 transition-all">
            <Calculator className="w-4 h-4 mr-2" />Kelly Bankroll
          </TabsTrigger>
          <TabsTrigger value="signals" className="data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 text-zinc-400 transition-all">
            <Radio className="w-4 h-4 mr-2" />Market Signals
          </TabsTrigger>
          <TabsTrigger value="config" className="data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 text-zinc-400 transition-all">
            <Settings className="w-4 h-4 mr-2" />Engine Config
          </TabsTrigger>
        </TabsList>

        {/* ═════════════════════ TAB 1: STOCHASTIC SIMULATOR ═════════════════════ */}
        <TabsContent value="simulator" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Input Panel */}
            <motion.div layout className="lg:col-span-1 space-y-4">
              <Card className="glass-card border-zinc-800/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-400" /> Match Setup
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-zinc-500 mb-1">Home Team</Label>
                      <Select value={homeTeamId} onValueChange={v => {
                        setHomeTeamId(v)
                        const t = teams.find(x => x.id === v)
                        if (t) { setHomeElo(String(t.eloRating)); setHomeXg('1.45') }
                      }}>
                        <SelectTrigger className="bg-zinc-900/60 border-zinc-700/50 text-sm"><SelectValue placeholder="Home" /></SelectTrigger>
                        <SelectContent>{teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-zinc-500 mb-1">Away Team</Label>
                      <Select value={awayTeamId} onValueChange={v => {
                        setAwayTeamId(v)
                        const t = teams.find(x => x.id === v)
                        if (t) { setAwayElo(String(t.eloRating)); setAwayXg('1.10') }
                      }}>
                        <SelectTrigger className="bg-zinc-900/60 border-zinc-700/50 text-sm"><SelectValue placeholder="Away" /></SelectTrigger>
                        <SelectContent>{teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Separator className="bg-zinc-800/50" />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-zinc-500">Home xG</Label>
                      <Input type="number" step="0.01" value={homeXg} onChange={e => setHomeXg(e.target.value)} className="bg-zinc-900/60 border-zinc-700/50 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-zinc-500">Away xG</Label>
                      <Input type="number" step="0.01" value={awayXg} onChange={e => setAwayXg(e.target.value)} className="bg-zinc-900/60 border-zinc-700/50 text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-zinc-500">Home ELO</Label>
                      <Input type="number" value={homeElo} onChange={e => setHomeElo(e.target.value)} className="bg-zinc-900/60 border-zinc-700/50 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-zinc-500">Away ELO</Label>
                      <Input type="number" value={awayElo} onChange={e => setAwayElo(e.target.value)} className="bg-zinc-900/60 border-zinc-700/50 text-sm" />
                    </div>
                  </div>
                  <Separator className="bg-zinc-800/50" />
                  <p className="text-xs text-zinc-500 font-medium">Bookmaker Odds</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-emerald-400">Home</Label>
                      <Input type="number" step="0.01" value={oddsHome} onChange={e => setOddsHome(e.target.value)} className="bg-zinc-900/60 border-zinc-700/50 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-yellow-400">Draw</Label>
                      <Input type="number" step="0.01" value={oddsDraw} onChange={e => setOddsDraw(e.target.value)} className="bg-zinc-900/60 border-zinc-700/50 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-red-400">Away</Label>
                      <Input type="number" step="0.01" value={oddsAway} onChange={e => setOddsAway(e.target.value)} className="bg-zinc-900/60 border-zinc-700/50 text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-zinc-500">Bankroll ($)</Label>
                      <Input type="number" value={bankroll} onChange={e => setBankroll(e.target.value)} className="bg-zinc-900/60 border-zinc-700/50 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-zinc-500">Sim Runs</Label>
                      <Input type="number" value={simRuns} onChange={e => setSimRuns(e.target.value)} className="bg-zinc-900/60 border-zinc-700/50 text-sm" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Injury Overlay */}
              <Card className="glass-card border-zinc-800/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" /> Injury Overlay
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={addInjury} className="h-7 text-xs text-emerald-400 hover:text-emerald-300">
                      <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {injuries.length === 0 && <p className="text-xs text-zinc-600 text-center py-2">No injury adjustments</p>}
                  {injuries.map((inj, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <Select value={inj.teamId} onValueChange={v => updateInjury(i, { teamId: v })}>
                          <SelectTrigger className="w-[120px] h-7 text-xs bg-zinc-800/60"><SelectValue placeholder="Team" /></SelectTrigger>
                          <SelectContent>{teams.map(t => <SelectItem key={t.id} value={t.id} className="text-xs">{t.code}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button variant="ghost" size="sm" onClick={() => removeInjury(i)} className="h-7 w-7 p-0 text-red-400 hover:text-red-300">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <Input placeholder="Player name" value={inj.playerName} onChange={e => updateInjury(i, { playerName: e.target.value })} className="h-7 text-xs bg-zinc-800/60 border-zinc-700/50" />
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={inj.status} onValueChange={v => updateInjury(i, { status: v as InjuryAdjustment['status'] })}>
                          <SelectTrigger className="h-7 text-xs bg-zinc-800/60"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="out" className="text-xs">Out</SelectItem>
                            <SelectItem value="doubtful" className="text-xs">Doubtful</SelectItem>
                            <SelectItem value="questionable" className="text-xs">Questionable</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={inj.importance} onValueChange={v => updateInjury(i, { importance: v as InjuryAdjustment['importance'] })}>
                          <SelectTrigger className="h-7 text-xs bg-zinc-800/60"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="star" className="text-xs">Star</SelectItem>
                            <SelectItem value="key" className="text-xs">Key</SelectItem>
                            <SelectItem value="rotation" className="text-xs">Rotation</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-zinc-500">xG Impact</span>
                          <span className="text-xs text-emerald-400">{inj.xgImpact.toFixed(2)}</span>
                        </div>
                        <Slider value={[inj.xgImpact]} min={0} max={1} step={0.05} onValueChange={([v]) => updateInjury(i, { xgImpact: v })} className="py-1" />
                      </div>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>

              <Button onClick={runSimulation} disabled={simulating} className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-sm tracking-wide rounded-xl transition-all">
                {simulating ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Running {simRuns} simulations...</> : <><Play className="w-4 h-4 mr-2" /> RUN SIMULATION</>}
              </Button>
            </motion.div>

            {/* Results Panel */}
            <motion.div layout className="lg:col-span-2 space-y-4">
              {!analysis ? (
                <Card className="glass-card border-zinc-800/50 h-full min-h-[500px] flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                      <Brain className="w-8 h-8 text-emerald-400/50" />
                    </div>
                    <p className="text-zinc-600 text-sm">Configure match parameters and run simulation</p>
                  </div>
                </Card>
              ) : (
                <>
                  {/* Meta badges */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge className={cn('text-xs font-medium border', CONF_COLORS[analysis.simulation.confidence])}>
                      <Zap className="w-3 h-3 mr-1" /> {analysis.simulation.confidence.toUpperCase()} CONFIDENCE
                    </Badge>
                    <Badge className={cn('text-xs font-medium border', RISK_COLORS[analysis.riskRating])}>
                      <Shield className="w-3 h-3 mr-1" /> {analysis.riskRating.toUpperCase()} RISK
                    </Badge>
                    <Badge className="text-xs font-medium border bg-zinc-800/60 text-zinc-300 border-zinc-700/50">
                      <Activity className="w-3 h-3 mr-1" /> Volatility: {analysis.simulation.volatilityIndex.toFixed(0)}/100
                    </Badge>
                  </div>

                  {/* Probabilities + Totals row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="glass-card border-zinc-800/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-zinc-400 flex items-center gap-2">
                          <BarChart3 className="w-3.5 h-3.5 text-emerald-400" /> Match Probabilities
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={160}>
                          <BarChart data={probBars} barSize={32} layout="vertical">
                            <XAxis type="number" domain={[0, 100]} tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis dataKey="name" type="category" tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={false} tickLine={false} width={45} />
                            <RTooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }} />
                            <Bar dataKey="value" radius={[0, 6, 6, 0]} animationDuration={800}>
                              {probBars.map((e, idx) => <Cell key={idx} fill={e.fill} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                    <Card className="glass-card border-zinc-800/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-zinc-400 flex items-center gap-2">
                          <GitBranch className="w-3.5 h-3.5 text-emerald-400" /> Totals Market
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {[
                          { label: 'Over/Under 1.5', over: analysis.simulation.totalsMarket.over15 },
                          { label: 'Over/Under 2.5', over: analysis.simulation.totalsMarket.over25 },
                          { label: 'Over/Under 3.5', over: analysis.simulation.totalsMarket.over35 },
                        ].map(t => (
                          <div key={t.label} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-zinc-400">{t.label}</span>
                              <span className="text-zinc-300">O {(t.over * 100).toFixed(1)}% / U {((1 - t.over) * 100).toFixed(1)}%</span>
                            </div>
                            <div className="flex h-2 rounded-full overflow-hidden bg-zinc-800">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${t.over * 100}%` }} transition={{ duration: 0.8 }} className="bg-emerald-500 rounded-l-full" />
                              <motion.div initial={{ width: 0 }} animate={{ width: `${(1 - t.over) * 100}%` }} transition={{ duration: 0.8 }} className="bg-red-500/70 rounded-r-full" />
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Scorelines + xG + BTTS */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="glass-card border-zinc-800/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-zinc-400">Top 5 Scorelines</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader><TableRow className="border-zinc-800/50 hover:bg-transparent">
                            <TableHead className="text-xs text-zinc-500">Score</TableHead>
                            <TableHead className="text-xs text-zinc-500 text-right">Prob</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {topScorelines.map((s, i) => (
                              <TableRow key={s.score} className="border-zinc-800/30 hover:bg-zinc-800/20">
                                <TableCell className="text-xs font-mono text-zinc-300">{s.score}</TableCell>
                                <TableCell className="text-xs text-right text-emerald-400 font-medium">{s.prob}%</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                    <Card className="glass-card border-zinc-800/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-zinc-400">Expected Goals</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col items-center justify-center h-[140px] space-y-3">
                        <div className="text-center">
                          <p className="text-3xl font-bold text-white">{analysis.simulation.expectedMeans.home.toFixed(2)}</p>
                          <p className="text-xs text-zinc-500">Home xG</p>
                        </div>
                        <div className="text-center">
                          <p className="text-3xl font-bold text-white">{analysis.simulation.expectedMeans.away.toFixed(2)}</p>
                          <p className="text-xs text-zinc-500">Away xG</p>
                        </div>
                        <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-700/50">
                          Total: {analysis.simulation.expectedMeans.total.toFixed(2)}
                        </Badge>
                      </CardContent>
                    </Card>
                    <Card className="glass-card border-zinc-800/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-zinc-400">BTTS & Volatility</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col items-center justify-center h-[140px] space-y-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-emerald-400">{(analysis.simulation.bothTeamsToScore * 100).toFixed(1)}%</p>
                          <p className="text-xs text-zinc-500">Both Teams To Score</p>
                        </div>
                        <Separator className="bg-zinc-800/50" />
                        <div className="text-center w-full">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-zinc-500">Volatility Index</span>
                            <span className="text-xs font-mono text-zinc-300">{analysis.simulation.volatilityIndex.toFixed(0)}</span>
                          </div>
                          <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${analysis.simulation.volatilityIndex}%` }}
                              transition={{ duration: 1 }}
                              className={cn('h-full rounded-full', analysis.simulation.volatilityIndex > 70 ? 'bg-red-500' : analysis.simulation.volatilityIndex > 40 ? 'bg-amber-500' : 'bg-emerald-500')}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Asian Handicap */}
                  <Card className="glass-card border-zinc-800/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-zinc-400 flex items-center gap-2">
                        <Gauge className="w-3.5 h-3.5 text-emerald-400" /> Asian Handicap Probabilities
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4">
                        {ahData.map(ah => (
                          <div key={ah.line} className="text-center p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/50 space-y-2">
                            <p className="text-xs text-zinc-500 font-mono">Line {ah.line}</p>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-emerald-400">H {ah.home}%</span>
                                <span className="text-red-400">A {ah.away}%</span>
                              </div>
                              <div className="flex h-1.5 rounded-full overflow-hidden bg-zinc-800">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${ah.home}%` }} transition={{ duration: 0.8 }} className="bg-emerald-500" />
                                <motion.div initial={{ width: 0 }} animate={{ width: `${ah.away}%` }} transition={{ duration: 0.8 }} className="bg-red-500/70" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </motion.div>
          </div>
        </TabsContent>

        {/* ═════════════════════ TAB 2: KELLY BANKROLL MANAGER ═════════════════════ */}
        <TabsContent value="kelly" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <Card className="glass-card border-zinc-800/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" /> Bankroll Setup
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-zinc-500">Total Bankroll ($)</Label>
                    <Input type="number" value={kellyBankroll} onChange={e => setKellyBankroll(e.target.value)} className="bg-zinc-900/60 border-zinc-700/50 text-sm" />
                  </div>
                  <p className="text-xs text-zinc-600">Uses the last simulation results. Run a simulation first for Kelly analysis.</p>
                  <Button onClick={runKelly} disabled={kellyLoading || !analysis} className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-sm rounded-xl">
                    {kellyLoading ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Calculating...</> : <><Calculator className="w-4 h-4 mr-2" /> CALCULATE KELLY</>}
                  </Button>
                </CardContent>
              </Card>

              {/* Portfolio summary */}
              {kellyResult && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <Card className="glass-card border-zinc-800/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-zinc-400">Portfolio Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Total Exposure</span>
                        <span className="text-white font-medium">${kellyResult.totalExposure.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Expected Value</span>
                        <span className={cn('font-medium', kellyResult.totalExpectedValue >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          ${kellyResult.totalExpectedValue.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Sharpe Ratio</span>
                        <span className="text-white font-medium">{kellyResult.sharpeRatio.toFixed(3)}</span>
                      </div>
                      <Separator className="bg-zinc-800/50" />
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Bankroll Utilization</span>
                        <span className="text-emerald-400 font-medium">{((kellyResult.totalExposure / kellyResult.totalBankroll) * 100).toFixed(1)}%</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Pie chart */}
                  {kellyPie.length > 0 && (
                    <Card className="glass-card border-zinc-800/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-zinc-400">Bankroll Allocation</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={180}>
                          <PieChart>
                            <Pie data={kellyPie} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" stroke="none" animationDuration={800}>
                              {kellyPie.map((_, i) => <Cell key={i} fill={['#00e676', '#ffd700', '#ff4757', '#38bdf8', '#c084fc'][i % 5]} />)}
                            </Pie>
                            <RTooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap gap-2 justify-center mt-1">
                          {kellyPie.map((p, i) => (
                            <div key={i} className="flex items-center gap-1 text-xs text-zinc-400">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#00e676', '#ffd700', '#ff4757', '#38bdf8', '#c084fc'][i % 5] }} />
                              {p.name}: ${p.value}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </motion.div>
              )}
            </div>

            {/* Kelly results table */}
            <div className="lg:col-span-2">
              <Card className="glass-card border-zinc-800/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-400" /> Kelly Criterion Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!kellyResult ? (
                    <div className="flex items-center justify-center h-[300px]">
                      <p className="text-sm text-zinc-600">Run a simulation, then calculate Kelly allocation</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-zinc-800/50 hover:bg-transparent">
                          <TableHead className="text-xs text-zinc-500">Outcome</TableHead>
                          <TableHead className="text-xs text-zinc-500 text-right">Model Prob</TableHead>
                          <TableHead className="text-xs text-zinc-500 text-right">Market Odds</TableHead>
                          <TableHead className="text-xs text-zinc-500 text-right">Edge %</TableHead>
                          <TableHead className="text-xs text-zinc-500 text-right">Fraction</TableHead>
                          <TableHead className="text-xs text-zinc-500 text-right">Wager</TableHead>
                          <TableHead className="text-xs text-zinc-500 text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {kellyResult.outcomes.map((o, i) => (
                          <TableRow key={i} className="border-zinc-800/30 hover:bg-zinc-800/20">
                            <TableCell className="text-xs font-medium text-white">{o.label}</TableCell>
                            <TableCell className="text-xs text-right text-zinc-300">{(o.modelProb * 100).toFixed(1)}%</TableCell>
                            <TableCell className="text-xs text-right text-zinc-300">{o.marketOdds.toFixed(2)}</TableCell>
                            <TableCell className={cn('text-xs text-right font-medium', o.edge > 0 ? 'text-emerald-400' : 'text-red-400')}>
                              {o.edge > 0 ? '+' : ''}{(o.edge * 100).toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-xs text-right text-zinc-300">{(o.kellyFraction * 100).toFixed(1)}%</TableCell>
                            <TableCell className="text-xs text-right text-white font-medium">${o.wagerAmount.toFixed(2)}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={cn('text-[10px] font-bold', ACTION_STYLE[o.action])}>{o.action}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ═════════════════════ TAB 3: MARKET SIGNALS ═════════════════════ */}
        <TabsContent value="signals" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="glass-card border-zinc-800/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400" /> Signal Input
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-zinc-500">Home Team</Label>
                    <Select value={sigHomeTeam} onValueChange={setSigHomeTeam}>
                      <SelectTrigger className="bg-zinc-900/60 border-zinc-700/50 text-sm"><SelectValue placeholder="Home" /></SelectTrigger>
                      <SelectContent>{teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-500">Away Team</Label>
                    <Select value={sigAwayTeam} onValueChange={setSigAwayTeam}>
                      <SelectTrigger className="bg-zinc-900/60 border-zinc-700/50 text-sm"><SelectValue placeholder="Away" /></SelectTrigger>
                      <SelectContent>{teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator className="bg-zinc-800/50" />
                <p className="text-xs text-zinc-500 font-medium">Opening Odds</p>
                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" step="0.01" placeholder="Home" value={sigOpenHome} onChange={e => setSigOpenHome(e.target.value)} className="bg-zinc-900/60 border-zinc-700/50 text-xs" />
                  <Input type="number" step="0.01" placeholder="Draw" value={sigOpenDraw} onChange={e => setSigOpenDraw(e.target.value)} className="bg-zinc-900/60 border-zinc-700/50 text-xs" />
                  <Input type="number" step="0.01" placeholder="Away" value={sigOpenAway} onChange={e => setSigOpenAway(e.target.value)} className="bg-zinc-900/60 border-zinc-700/50 text-xs" />
                </div>
                <p className="text-xs text-zinc-500 font-medium">Current Odds</p>
                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" step="0.01" placeholder="Home" value={sigCurHome} onChange={e => setSigCurHome(e.target.value)} className="bg-zinc-900/60 border-zinc-700/50 text-xs" />
                  <Input type="number" step="0.01" placeholder="Draw" value={sigCurDraw} onChange={e => setSigCurDraw(e.target.value)} className="bg-zinc-900/60 border-zinc-700/50 text-xs" />
                  <Input type="number" step="0.01" placeholder="Away" value={sigCurAway} onChange={e => setSigCurAway(e.target.value)} className="bg-zinc-900/60 border-zinc-700/50 text-xs" />
                </div>
                <Button onClick={runSignals} disabled={sigLoading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-sm rounded-xl">
                  {sigLoading ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</> : <><Eye className="w-4 h-4 mr-2" /> ANALYZE</>}
                </Button>
              </CardContent>
            </Card>

            <div className="lg:col-span-2 space-y-4">
              {!signalResult ? (
                <Card className="glass-card border-zinc-800/50 h-full min-h-[400px] flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                      <Radio className="w-8 h-8 text-emerald-400/50" />
                    </div>
                    <p className="text-zinc-600 text-sm">Enter opening & current odds to analyze line movements</p>
                  </div>
                </Card>
              ) : (
                <>
                  {/* Line Velocity */}
                  <Card className="glass-card border-zinc-800/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-zinc-400 flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-emerald-400" /> Line Velocity
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        {(['home', 'draw', 'away'] as const).map(side => {
                          const vel = signalResult.lineVelocity[side]
                          const direction = vel > 0 ? 'down' : vel < 0 ? 'up' : 'flat'
                          return (
                            <div key={side} className="text-center p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/50">
                              <p className="text-xs text-zinc-500 capitalize mb-1">{side}</p>
                              <div className="flex items-center justify-center gap-2">
                                {direction === 'up' && <ArrowUpRight className="w-5 h-5 text-emerald-400" />}
                                {direction === 'down' && <ArrowDownRight className="w-5 h-5 text-red-400" />}
                                {direction === 'flat' && <Minus className="w-5 h-5 text-zinc-500" />}
                                <span className={cn('text-lg font-bold', direction === 'up' ? 'text-emerald-400' : direction === 'down' ? 'text-red-400' : 'text-zinc-400')}>
                                  {vel > 0 ? '+' : ''}{vel.toFixed(4)}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Alerts + Confidence */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="glass-card border-zinc-800/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-zinc-400">Detection Alerts</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/50">
                          <div className="flex items-center gap-2">
                            <Flame className={cn('w-4 h-4', signalResult.steamMove ? 'text-orange-400' : 'text-zinc-600')} />
                            <span className="text-sm text-zinc-300">Steam Move</span>
                          </div>
                          {signalResult.steamMove
                            ? <Badge className="text-[10px] font-bold bg-orange-500/20 text-orange-400 border-orange-500/30">DETECTED</Badge>
                            : <Badge className="text-[10px] font-bold bg-zinc-800/60 text-zinc-500 border-zinc-700/50">NONE</Badge>
                          }
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/50">
                          <div className="flex items-center gap-2">
                            <AlertOctagon className={cn('w-4 h-4', signalResult.rlmDetected ? 'text-purple-400' : 'text-zinc-600')} />
                            <span className="text-sm text-zinc-300">RLM Detected</span>
                          </div>
                          {signalResult.rlmDetected
                            ? <Badge className="text-[10px] font-bold bg-purple-500/20 text-purple-400 border-purple-500/30">DETECTED</Badge>
                            : <Badge className="text-[10px] font-bold bg-zinc-800/60 text-zinc-500 border-zinc-700/50">NONE</Badge>
                          }
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/50">
                          <div className="flex items-center gap-2">
                            <Eye className={cn('w-4 h-4', signalResult.sharpAction !== 'neutral' ? 'text-emerald-400' : 'text-zinc-600')} />
                            <span className="text-sm text-zinc-300">Sharp Action</span>
                          </div>
                          <Badge className={cn('text-[10px] font-bold border',
                            signalResult.sharpAction === 'neutral' ? 'bg-zinc-800/60 text-zinc-500 border-zinc-700/50' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          )}>
                            {signalResult.sharpAction === 'neutral' ? 'NEUTRAL' : signalResult.sharpAction.toUpperCase()}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="glass-card border-zinc-800/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-zinc-400">Signal Confidence</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col items-center justify-center h-[160px] space-y-3">
                        <p className="text-4xl font-bold text-white">{(signalResult.confidence * 100).toFixed(0)}%</p>
                        <div className="w-full h-3 rounded-full bg-zinc-800 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${signalResult.confidence * 100}%` }}
                            transition={{ duration: 1 }}
                            className={cn('h-full rounded-full', signalResult.confidence > 0.7 ? 'bg-emerald-500' : signalResult.confidence > 0.4 ? 'bg-amber-500' : 'bg-red-500')}
                          />
                        </div>
                        <p className="text-xs text-zinc-500">{signalResult.homeTeam} vs {signalResult.awayTeam}</p>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ═════════════════════ TAB 4: ENGINE CONFIG ═════════════════════ */}
        <TabsContent value="config" className="space-y-6 mt-6">
          <div className="max-w-2xl mx-auto space-y-6">
            <Card className="glass-card border-zinc-800/50">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-emerald-400" /> Engine Configuration
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500">Fine-tune the stochastic engine parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Simulation runs */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-zinc-300">Simulation Runs</Label>
                    <span className="text-xs font-mono text-emerald-400">{config.simulationRuns.toLocaleString()}</span>
                  </div>
                  <Slider
                    value={[config.simulationRuns]}
                    min={10000} max={500000} step={10000}
                    onValueChange={([v]) => setConfig(p => ({ ...p, simulationRuns: v }))}
                  />
                  <div className="flex justify-between text-[10px] text-zinc-600"><span>10K</span><span>500K</span></div>
                </div>

                <Separator className="bg-zinc-800/50" />

                {/* Kelly fraction */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-zinc-300">Kelly Fraction</Label>
                    <span className="text-xs font-mono text-emerald-400">{config.kellyFraction}%</span>
                  </div>
                  <Slider
                    value={[config.kellyFraction]}
                    min={5} max={100} step={5}
                    onValueChange={([v]) => setConfig(p => ({ ...p, kellyFraction: v }))}
                  />
                  <div className="flex justify-between text-[10px] text-zinc-600"><span>5% (Quarter)</span><span>100% (Full)</span></div>
                </div>

                <Separator className="bg-zinc-800/50" />

                {/* Min edge threshold */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-zinc-300">Min Edge Threshold</Label>
                    <span className="text-xs font-mono text-emerald-400">{config.minEdgeThreshold}%</span>
                  </div>
                  <Slider
                    value={[config.minEdgeThreshold]}
                    min={0} max={10} step={0.5}
                    onValueChange={([v]) => setConfig(p => ({ ...p, minEdgeThreshold: v }))}
                  />
                  <div className="flex justify-between text-[10px] text-zinc-600"><span>0%</span><span>10%</span></div>
                </div>

                <Separator className="bg-zinc-800/50" />

                {/* Max bankroll risk */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-zinc-300">Max Bankroll Risk</Label>
                    <span className="text-xs font-mono text-emerald-400">{config.maxBankrollRisk}%</span>
                  </div>
                  <Slider
                    value={[config.maxBankrollRisk]}
                    min={1} max={25} step={1}
                    onValueChange={([v]) => setConfig(p => ({ ...p, maxBankrollRisk: v }))}
                  />
                  <div className="flex justify-between text-[10px] text-zinc-600"><span>1%</span><span>25%</span></div>
                </div>

                <Separator className="bg-zinc-800/50" />

                {/* Toggles */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm text-zinc-300">GARCH Volatility Model</Label>
                      <p className="text-[10px] text-zinc-600">Conditional variance estimation for volatility clustering</p>
                    </div>
                    <Switch checked={config.garchEnabled} onCheckedChange={v => setConfig(p => ({ ...p, garchEnabled: v }))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm text-zinc-300">Jump-Diffusion Model</Label>
                      <p className="text-[10px] text-zinc-600">Merton jump process for sudden momentum shifts</p>
                    </div>
                    <Switch checked={config.jumpDiffusionEnabled} onCheckedChange={v => setConfig(p => ({ ...p, jumpDiffusionEnabled: v }))} />
                  </div>
                </div>

                <Separator className="bg-zinc-800/50" />

                <div className="flex gap-3">
                  <Button onClick={saveConfig} disabled={configLoading} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-sm rounded-xl">
                    <Save className="w-4 h-4 mr-2" /> {configLoading ? 'Saving...' : 'Save Configuration'}
                  </Button>
                  <Button onClick={resetConfig} variant="outline" className="border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl">
                    <RotateCcw className="w-4 h-4 mr-2" /> Reset
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}