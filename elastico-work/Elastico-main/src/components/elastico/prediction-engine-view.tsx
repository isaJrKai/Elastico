'use client'

import { useState, useCallback, useEffect } from 'react'
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
  Plus, Trash2, RefreshCw, Play, Save, RotateCcw, Sparkles, AlertOctagon, Minus,
  Server, ServerOff, Workflow, CircleDot
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

// ── Mega Ensemble Types ─────────────────────────────────────────────────────────

interface MegaModelResult {
  model: string
  home_win: number
  draw: number
  away_win: number
  expected_home_goals: number
  expected_away_goals: number
}

interface MegaPredictionResponse {
  elo: MegaModelResult
  poisson: MegaModelResult
  dixon_coles: MegaModelResult
  ensemble: MegaModelResult
  confidence: string
  signals: string[]
  risks: string[]
  simulation?: {
    num_simulations: number
    home_win_pct: number
    draw_pct: number
    away_win_pct: number
    over_25_pct: number
    btts_pct: number
    top_scorelines: { score: string; count: number; pct: number }[]
    avg_home_goals: number
    avg_away_goals: number
  }
}

interface MegaEngineStatus {
  status: 'connected' | 'not_configured' | 'unreachable' | 'error'
  message: string
  models: string[]
}

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

  // ── Mega Ensemble state ──────────────────────────────────────────────────────
  const [megaStatus, setMegaStatus] = useState<MegaEngineStatus | null>(null)
  const [megaLoading, setMegaLoading] = useState(false)
  const [megaResult, setMegaResult] = useState<MegaPredictionResponse | null>(null)
  const [megaSimLoading, setMegaSimLoading] = useState(false)
  const [megaSimResult, setMegaSimResult] = useState<MegaPredictionResponse['simulation'] | null>(null)

  // Fetch mega engine status on mount
  useEffect(() => {
    fetch('/api/mega-predict', { headers: authHeaders() })
      .then(r => r.json()).then(setMegaStatus).catch(() =>
        setMegaStatus({ status: 'error', message: 'Failed to check status', models: [] })
      )
  }, [])

  // ── Run Mega Ensemble Prediction ─────────────────────────────────────────────
  const runMegaPredict = useCallback(async () => {
    if (!homeTeamId || !awayTeamId) { toast.error('Select both teams'); return }
    setMegaLoading(true)
    try {
      const payload = {
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_elo: +homeElo,
        away_elo: +awayElo,
        home_avg_goals: +homeXg,
        away_avg_goals: +awayXg,
        home_avg_conceded: +awayXg * 0.9,
        away_avg_conceded: +homeXg * 0.9,
        league_avg_goals: 1.35,
        odds_home: +oddsHome,
        odds_draw: +oddsDraw,
        odds_away: +oddsAway,
      }
      const res = await fetch('/api/mega-predict', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Mega predict failed' }))
        throw new Error(err.error || 'Mega predict failed')
      }
      const json = await res.json()
      setMegaResult(json.data)
      toast.success('Mega Ensemble prediction complete', { icon: <Sparkles className="text-emerald-400" /> })
    } catch (e: any) {
      toast.error(e.message || 'Mega predict error')
    } finally {
      setMegaLoading(false)
    }
  }, [homeTeamId, awayTeamId, homeElo, awayElo, homeXg, awayXg, oddsHome, oddsDraw, oddsAway])

  // ── Run Mega Monte Carlo ─────────────────────────────────────────────────────
  const runMegaSim = useCallback(async () => {
    if (!homeTeamId || !awayTeamId) { toast.error('Select both teams'); return }
    setMegaSimLoading(true)
    try {
      const res = await fetch('/api/mega-predict/simulate', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          home_expected_goals: +homeXg,
          away_expected_goals: +awayXg,
          num_simulations: Math.min(+simRuns, 100000),
          dixon_coles_rho: -0.1,
        }),
      })
      if (!res.ok) throw new Error('Mega simulation failed')
      const json = await res.json()
      setMegaSimResult(json.data)
      toast.success('Monte Carlo simulation complete')
    } catch (e: any) {
      toast.error(e.message || 'Mega sim error')
    } finally {
      setMegaSimLoading(false)
    }
  }, [homeTeamId, awayTeamId, homeXg, awayXg, simRuns])

  // ── Config state ──────────────────────────────────────────────────────────────
  const [config, setConfig] = useState<EngineConfig>({
    simulationRuns: 150000, kellyFraction: 0.25, garchEnabled: true,
    jumpDiffusionEnabled: true, minEdgeThreshold: 0.02, maxBankrollRisk: 0.05,
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
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ matchInput: input, config: { simulationRuns: +simRuns }, bankroll: +bankroll }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Simulation failed' }))
        throw new Error(err.error || 'Simulation failed')
      }
      const json = await res.json()
      const data: FullMatchAnalysis = json.data || json
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
      // Map portfolio outcomes to the format calculatePortfolioAllocation expects
      const outcomes = (analysis.portfolioAllocation?.outcomes || []).map(o => ({
        label: o.label,
        modelProb: o.modelProb,
        odds: o.marketOdds,
      }))
      const res = await fetch('/api/prediction-engine/kelly', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          mode: 'portfolio',
          outcomes,
          bankroll: +kellyBankroll,
        }),
      })
      if (!res.ok) throw new Error('Kelly calculation failed')
      const json = await res.json()
      setKellyResult(json.data || json)
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
      const json = await res.json()
      setSignalResult(json.data || json)
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
        method: 'PATCH', headers: authHeaders(), body: JSON.stringify(config),
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
        const json = await res.json()
        const data: EngineConfig = json.config || json.defaults || json
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
  const sim = analysis?.simulation
  const mp = sim?.matchProbabilities
  const tm = sim?.totalsMarket
  const ah = sim?.asianHandicap
  const em = sim?.expectedMeans

  const probBars = analysis && mp ? [
    { name: 'Home', value: +((mp.homeVictory ?? 0) * 100).toFixed(1), fill: '#00e676' },
    { name: 'Draw', value: +((mp.draw ?? 0) * 100).toFixed(1), fill: '#ffd700' },
    { name: 'Away', value: +((mp.awayVictory ?? 0) * 100).toFixed(1), fill: '#ff4757' },
  ] : []

  const topScorelines = analysis && sim?.exoticScorelines
    ? Object.entries(sim.exoticScorelines)
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([score, prob]) => ({ score, prob: +((prob ?? 0) * 100).toFixed(2) }))
    : []

  const totalsData = analysis && tm ? [
    { name: 'O1.5', value: +((tm.over15 ?? 0) * 100).toFixed(1), fill: '#00e676' },
    { name: 'U1.5', value: +(100 - (tm.over15 ?? 0) * 100).toFixed(1), fill: '#ff4757' },
    { name: 'O2.5', value: +((tm.over25 ?? 0) * 100).toFixed(1), fill: '#00e676' },
    { name: 'U2.5', value: +((tm.under25 ?? 0) * 100).toFixed(1), fill: '#ff4757' },
    { name: 'O3.5', value: +((tm.over35 ?? 0) * 100).toFixed(1), fill: '#00e676' },
    { name: 'U3.5', value: +(100 - (tm.over35 ?? 0) * 100).toFixed(1), fill: '#ff4757' },
  ] : []

  const ahData = analysis && ah ? [
    { line: '0', home: +((ah.line0?.home ?? 0) * 100).toFixed(1), away: +((ah.line0?.away ?? 0) * 100).toFixed(1) },
    { line: '-0.5', home: +((ah.lineHalf?.home ?? 0) * 100).toFixed(1), away: +((ah.lineHalf?.away ?? 0) * 100).toFixed(1) },
    { line: '-1', home: +((ah.line1?.home ?? 0) * 100).toFixed(1), away: +((ah.line1?.away ?? 0) * 100).toFixed(1) },
    { line: '-1.5', home: +((ah.line15?.home ?? 0) * 100).toFixed(1), away: +((ah.line15?.away ?? 0) * 100).toFixed(1) },
  ] : []

  const kellyPie = kellyResult ? kellyResult.outcomes
    .filter(o => o.action === 'BET')
    .map(o => ({ name: o.label, value: +(o.wagerAmount ?? 0).toFixed(2), fill: '#00e676' }))
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
          <TabsTrigger value="mega" className="data-[state=active]:bg-purple-500/15 data-[state=active]:text-purple-400 text-zinc-400 transition-all">
            <Workflow className="w-4 h-4 mr-2" />Mega Ensemble
            {megaStatus?.status === 'connected' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1.5 animate-pulse" />}
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
                          <SelectContent>{teams.map(t => <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>)}</SelectContent>
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
                          <span className="text-xs text-emerald-400">{(inj.xgImpact ?? 0).toFixed(2)}</span>
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
                      <Activity className="w-3 h-3 mr-1" /> Volatility: {(sim?.volatilityIndex ?? 0).toFixed(0)}/100
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
                              <span className="text-zinc-300">O {((t.over ?? 0) * 100).toFixed(1)}% / U {((1 - (t.over ?? 0)) * 100).toFixed(1)}%</span>
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
                          <p className="text-3xl font-bold text-white">{(em?.home ?? 0).toFixed(2)}</p>
                          <p className="text-xs text-zinc-500">Home xG</p>
                        </div>
                        <div className="text-center">
                          <p className="text-3xl font-bold text-white">{(em?.away ?? 0).toFixed(2)}</p>
                          <p className="text-xs text-zinc-500">Away xG</p>
                        </div>
                        <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-700/50">
                          Total: {(em?.total ?? 0).toFixed(2)}
                        </Badge>
                      </CardContent>
                    </Card>
                    <Card className="glass-card border-zinc-800/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-zinc-400">BTTS & Volatility</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col items-center justify-center h-[140px] space-y-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-emerald-400">{((sim?.bothTeamsToScore ?? 0) * 100).toFixed(1)}%</p>
                          <p className="text-xs text-zinc-500">Both Teams To Score</p>
                        </div>
                        <Separator className="bg-zinc-800/50" />
                        <div className="text-center w-full">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-zinc-500">Volatility Index</span>
                            <span className="text-xs font-mono text-zinc-300">{(sim?.volatilityIndex ?? 0).toFixed(0)}</span>
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
                        <span className="text-white font-medium">${(kellyResult.totalExposure ?? 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Expected Value</span>
                        <span className={cn('font-medium', kellyResult.totalExpectedValue >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          ${(kellyResult.totalExpectedValue ?? 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Sharpe Ratio</span>
                        <span className="text-white font-medium">{(kellyResult.sharpeRatio ?? 0).toFixed(3)}</span>
                      </div>
                      <Separator className="bg-zinc-800/50" />
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Bankroll Utilization</span>
                        <span className="text-emerald-400 font-medium">{((kellyResult.totalExposure ?? 0) / Math.max(1, kellyResult.totalBankroll ?? 1) * 100).toFixed(1)}%</span>
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
                            <TableCell className="text-xs text-right text-zinc-300">{((o.modelProb ?? 0) * 100).toFixed(1)}%</TableCell>
                            <TableCell className="text-xs text-right text-zinc-300">{(o.marketOdds ?? 0).toFixed(2)}</TableCell>
                            <TableCell className={cn('text-xs text-right font-medium', (o.edge ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400')}>
                              {(o.edge ?? 0) > 0 ? '+' : ''}{((o.edge ?? 0) * 100).toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-xs text-right text-zinc-300">{((o.kellyFraction ?? 0) * 100).toFixed(1)}%</TableCell>
                            <TableCell className="text-xs text-right text-white font-medium">${(o.wagerAmount ?? 0).toFixed(2)}</TableCell>
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
                                  {vel > 0 ? '+' : ''}{(vel ?? 0).toFixed(4)}
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
                        <p className="text-4xl font-bold text-white">{((signalResult?.confidence ?? 0) * 100).toFixed(0)}%</p>
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

        {/* ═════════════════════ TAB 4: MEGA ENSEMBLE ═════════════════════ */}
        <TabsContent value="mega" className="space-y-6 mt-6">
          {/* Engine Status Banner */}
          <Card className={cn('glass-card border', megaStatus?.status === 'connected' ? 'border-emerald-500/30' : megaStatus?.status === 'not_configured' ? 'border-amber-500/30' : 'border-red-500/30')}>
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {megaStatus?.status === 'connected' ? <Server className="w-5 h-5 text-emerald-400" /> : <ServerOff className="w-5 h-5 text-amber-400" />}
                <div>
                  <p className="text-sm font-medium text-zinc-200">Mega Predict Engine</p>
                  <p className="text-xs text-zinc-500">{megaStatus?.message || 'Checking...'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {megaStatus?.models.map(m => (
                  <Badge key={m} className="text-[9px] font-medium bg-purple-500/10 text-purple-400 border-purple-500/20 hidden sm:inline-flex">{m}</Badge>
                ))}
                <Badge className={cn('text-[10px] font-bold border',
                  megaStatus?.status === 'connected' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                  megaStatus?.status === 'not_configured' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                  'bg-red-500/20 text-red-400 border-red-500/30'
                )}>
                  {megaStatus?.status === 'connected' ? 'ONLINE' : megaStatus?.status === 'not_configured' ? 'NOT CONFIGURED' : 'OFFLINE'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {megaStatus?.status === 'not_configured' && (
            <Card className="glass-card border-zinc-800/50">
              <CardContent className="py-8 text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-500/10 flex items-center justify-center">
                  <Workflow className="w-8 h-8 text-purple-400/50" />
                </div>
                <p className="text-sm text-zinc-400">Set <code className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">MEGA_PREDICT_API_URL</code> in your Vercel environment to connect the 6-model ensemble backend.</p>
                <p className="text-xs text-zinc-600">The FastAPI backend runs ELO + Poisson + Dixon-Coles + Monte Carlo + XGBoost + BiLSTM with calibrated super-ensemble weighting.</p>
              </CardContent>
            </Card>
          )}

          {megaStatus?.status !== 'not_configured' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Input Panel — reuses same team/odds inputs */}
              <div className="space-y-4">
                <Card className="glass-card border-zinc-800/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                      <Workflow className="w-4 h-4 text-purple-400" /> 6-Model Ensemble
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-500">Uses teams & odds from the Stochastic tab</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/50">
                      <p className="text-xs text-zinc-500 mb-1">Match</p>
                      <p className="text-sm text-white font-medium">{homeTeam?.name || 'Home'} vs {awayTeam?.name || 'Away'}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2 rounded-lg bg-zinc-900/60">
                        <p className="text-xs text-zinc-500">H ELO</p>
                        <p className="text-sm font-mono text-emerald-400">{homeElo}</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-zinc-900/60">
                        <p className="text-xs text-zinc-500">A ELO</p>
                        <p className="text-sm font-mono text-red-400">{awayElo}</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-zinc-900/60">
                        <p className="text-xs text-zinc-500">ELO Diff</p>
                        <p className="text-sm font-mono text-zinc-300">{(+homeElo - +awayElo) > 0 ? '+' : ''}{+homeElo - +awayElo}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-zinc-500 font-medium">Available Models</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {['ELO Rating', 'Poisson', 'Dixon-Coles', 'Monte Carlo', 'XGBoost', 'BiLSTM+Attn', 'Super-Ensemble'].map(m => (
                          <div key={m} className="flex items-center gap-1.5 text-xs text-zinc-400">
                            <CircleDot className="w-3 h-3 text-purple-400" />{m}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Button onClick={() => { runMegaPredict(); runMegaSim(); }} disabled={megaLoading || megaSimLoading || megaStatus?.status !== 'connected'} className="w-full h-12 bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm tracking-wide rounded-xl transition-all">
                  {(megaLoading || megaSimLoading) ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Running 6-model ensemble...</> : <><Sparkles className="w-4 h-4 mr-2" /> RUN MEGA ENSEMBLE</>}
                </Button>
              </div>

              {/* Results Panel */}
              <div className="lg:col-span-2 space-y-4">
                {!megaResult && !megaSimResult ? (
                  <Card className="glass-card border-zinc-800/50 h-full min-h-[400px] flex items-center justify-center">
                    <div className="text-center space-y-3">
                      <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-500/10 flex items-center justify-center">
                        <Workflow className="w-8 h-8 text-purple-400/50" />
                      </div>
                      <p className="text-zinc-600 text-sm">Select teams in the Stochastic tab, then run the Mega Ensemble</p>
                    </div>
                  </Card>
                ) : (
                  <>
                    {/* Model Comparison Table */}
                    {megaResult && (
                      <Card className="glass-card border-zinc-800/50">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-xs font-medium text-zinc-400 flex items-center gap-2">
                              <BarChart3 className="w-3.5 h-3.5 text-purple-400" /> Model Comparison
                            </CardTitle>
                            <Badge className={cn('text-[10px] font-bold border',
                              megaResult.confidence === 'high' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                              megaResult.confidence === 'medium' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                              'bg-red-500/20 text-red-400 border-red-500/30'
                            )}>
                              {megaResult.confidence.toUpperCase()} CONFIDENCE
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow className="border-zinc-800/50 hover:bg-transparent">
                                <TableHead className="text-xs text-zinc-500">Model</TableHead>
                                <TableHead className="text-xs text-zinc-500 text-right">Home Win</TableHead>
                                <TableHead className="text-xs text-zinc-500 text-right">Draw</TableHead>
                                <TableHead className="text-xs text-zinc-500 text-right">Away Win</TableHead>
                                <TableHead className="text-xs text-zinc-500 text-right">Exp H xG</TableHead>
                                <TableHead className="text-xs text-zinc-500 text-right">Exp A xG</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {([megaResult.elo, megaResult.poisson, megaResult.dixon_coles, megaResult.ensemble] as MegaModelResult[]).map((m, i) => {
                                const isEnsemble = i === 3
                                return (
                                  <TableRow key={m.model} className={cn('border-zinc-800/30 hover:bg-zinc-800/20', isEnsemble && 'bg-purple-500/5')}> 
                                    <TableCell className="text-xs font-medium text-white">
                                      {isEnsemble && <Sparkles className="w-3 h-3 text-purple-400 mr-1 inline" />}
                                      {m.model}
                                    </TableCell>
                                    <TableCell className="text-xs text-right text-emerald-400 font-medium">{(m.home_win * 100).toFixed(1)}%</TableCell>
                                    <TableCell className="text-xs text-right text-yellow-400">{(m.draw * 100).toFixed(1)}%</TableCell>
                                    <TableCell className="text-xs text-right text-red-400 font-medium">{(m.away_win * 100).toFixed(1)}%</TableCell>
                                    <TableCell className="text-xs text-right text-zinc-300 font-mono">{m.expected_home_goals.toFixed(2)}</TableCell>
                                    <TableCell className="text-xs text-right text-zinc-300 font-mono">{m.expected_away_goals.toFixed(2)}</TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>

                          {/* Signals & Risks */}
                          {(megaResult.signals.length > 0 || megaResult.risks.length > 0) && (
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                              {megaResult.signals.length > 0 && (
                                <div className="space-y-1.5">
                                  <p className="text-xs text-emerald-400 font-medium">Signals</p>
                                  {megaResult.signals.map((s, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs text-zinc-300">
                                      <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />{s}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {megaResult.risks.length > 0 && (
                                <div className="space-y-1.5">
                                  <p className="text-xs text-amber-400 font-medium">Risks</p>
                                  {megaResult.risks.map((r, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs text-zinc-300">
                                      <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />{r}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Model Probability Comparison Chart */}
                    {megaResult && (
                      <Card className="glass-card border-zinc-800/50">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-medium text-zinc-400">Probability Distribution Across Models</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={
                              [megaResult.elo, megaResult.poisson, megaResult.dixon_coles, megaResult.ensemble].map(m => ({
                                model: m.model.replace('dixon-coles', 'Dixon-Coles').replace('ensemble', 'Ensemble'),
                                home: +(m.home_win * 100).toFixed(1),
                                draw: +(m.draw * 100).toFixed(1),
                                away: +(m.away_win * 100).toFixed(1),
                              }))
                            } barSize={18}>
                              <XAxis dataKey="model" tick={{ fill: '#a1a1aa', fontSize: 10 }} axisLine={false} tickLine={false} />
                              <YAxis domain={[0, 80]} tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                              <RTooltip contentStyle={{ background: 'var(--card, #18181b)', border: '1px solid var(--border, #27272a)', borderRadius: 8, fontSize: 11 }} />
                              <Bar dataKey="home" fill="#00e676" radius={[4, 4, 0, 0]} name="Home" />
                              <Bar dataKey="draw" fill="#ffd700" radius={[4, 4, 0, 0]} name="Draw" />
                              <Bar dataKey="away" fill="#ff4757" radius={[4, 4, 0, 0]} name="Away" />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    )}

                    {/* Monte Carlo Simulation Results */}
                    {megaSimResult && (
                      <Card className="glass-card border-zinc-800/50">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-xs font-medium text-zinc-400 flex items-center gap-2">
                              <Cpu className="w-3.5 h-3.5 text-purple-400" /> Monte Carlo Simulation
                            </CardTitle>
                            <Badge className="text-[10px] font-medium bg-zinc-800/60 text-zinc-400 border-zinc-700/50">
                              {megaSimResult.num_simulations?.toLocaleString()} sims
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Outcome probabilities */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className="text-center p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                              <p className="text-2xl font-bold text-emerald-400">{(megaSimResult.home_win_pct * 100).toFixed(1)}%</p>
                              <p className="text-xs text-zinc-500">Home Win</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                              <p className="text-2xl font-bold text-yellow-400">{(megaSimResult.draw_pct * 100).toFixed(1)}%</p>
                              <p className="text-xs text-zinc-500">Draw</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                              <p className="text-2xl font-bold text-red-400">{(megaSimResult.away_win_pct * 100).toFixed(1)}%</p>
                              <p className="text-xs text-zinc-500">Away Win</p>
                            </div>
                          </div>

                          {/* Markets */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <p className="text-xs text-zinc-500 font-medium">Over 2.5 Goals</p>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                                  <motion.div initial={{ width: 0 }} animate={{ width: `${megaSimResult.over_25_pct * 100}%` }} transition={{ duration: 0.8 }} className="bg-emerald-500 h-full rounded-full" />
                                </div>
                                <span className="text-xs font-mono text-emerald-400">{(megaSimResult.over_25_pct * 100).toFixed(1)}%</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs text-zinc-500 font-medium">BTTS</p>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                                  <motion.div initial={{ width: 0 }} animate={{ width: `${megaSimResult.btts_pct * 100}%` }} transition={{ duration: 0.8 }} className="bg-purple-500 h-full rounded-full" />
                                </div>
                                <span className="text-xs font-mono text-purple-400">{(megaSimResult.btts_pct * 100).toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>

                          {/* Top scorelines */}
                          {megaSimResult.top_scorelines && megaSimResult.top_scorelines.length > 0 && (
                            <div>
                              <p className="text-xs text-zinc-500 font-medium mb-2">Top Scorelines</p>
                              <div className="flex gap-2 flex-wrap">
                                {megaSimResult.top_scorelines.slice(0, 8).map((s, i) => (
                                  <Badge key={s.score} variant="outline" className="text-xs font-mono border-zinc-700/50 text-zinc-300">
                                    {s.score} <span className="text-emerald-400 ml-1">{s.pct}%</span>
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Average goals */}
                          <div className="flex items-center justify-center gap-6 pt-2">
                            <div className="text-center">
                              <p className="text-xl font-bold text-white">{megaSimResult.avg_home_goals?.toFixed(2)}</p>
                              <p className="text-[10px] text-zinc-500">Avg Home Goals</p>
                            </div>
                            <div className="text-2xl text-zinc-600 font-light">-</div>
                            <div className="text-center">
                              <p className="text-xl font-bold text-white">{megaSimResult.avg_away_goals?.toFixed(2)}</p>
                              <p className="text-[10px] text-zinc-500">Avg Away Goals</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ═════════════════════ TAB 5: ENGINE CONFIG ═════════════════════ */}
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
                    <span className="text-xs font-mono text-emerald-400">{(config.kellyFraction * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[config.kellyFraction * 100]}
                    min={5} max={100} step={5}
                    onValueChange={([v]) => setConfig(p => ({ ...p, kellyFraction: v / 100 }))}
                  />
                  <div className="flex justify-between text-[10px] text-zinc-600"><span>5% (Quarter)</span><span>100% (Full)</span></div>
                </div>

                <Separator className="bg-zinc-800/50" />

                {/* Min edge threshold */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-zinc-300">Min Edge Threshold</Label>
                    <span className="text-xs font-mono text-emerald-400">{(config.minEdgeThreshold * 100).toFixed(1)}%</span>
                  </div>
                  <Slider
                    value={[config.minEdgeThreshold * 100]}
                    min={0} max={10} step={0.5}
                    onValueChange={([v]) => setConfig(p => ({ ...p, minEdgeThreshold: v / 100 }))}
                  />
                  <div className="flex justify-between text-[10px] text-zinc-600"><span>0%</span><span>10%</span></div>
                </div>

                <Separator className="bg-zinc-800/50" />

                {/* Max bankroll risk */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-zinc-300">Max Bankroll Risk</Label>
                    <span className="text-xs font-mono text-emerald-400">{(config.maxBankrollRisk * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[config.maxBankrollRisk * 100]}
                    min={1} max={25} step={1}
                    onValueChange={([v]) => setConfig(p => ({ ...p, maxBankrollRisk: v / 100 }))}
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