'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Target,
  Flame,
  ArrowRightLeft,
  TrendingUp,
  MapPin,
  BarChart3,
  Shield,
  RefreshCw,
  Wind,
  AlertTriangle,
  Mountain,
  Zap,
  Brain,
  ChevronDown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
  ReferenceLine,
} from 'recharts'
import { useElasticoStore } from '@/store/use-elastico-store'
import { cn } from '@/lib/utils'

// ── Mock Data ──────────────────────────────────────────────────────────────────

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

const MOCK_PLAYER_NAMES = ['Alisson', 'Walker', 'Dias', 'Stones', 'Robertson', 'Rodri', 'De Bruyne', 'Bellingham', 'Vinicius Jr', 'Haaland', 'Salah', 'Modric', 'Pedri', 'Gavi', 'Mbappé']

const PRESSING_HEATMAP = [
  { zone: 'D1', intensity: 85 }, { zone: 'D2', intensity: 72 }, { zone: 'D3', intensity: 65 },
  { zone: 'M1', intensity: 92 }, { zone: 'M2', intensity: 88 }, { zone: 'M3', intensity: 78 },
  { zone: 'A1', intensity: 45 }, { zone: 'A2', intensity: 55 }, { zone: 'A3', intensity: 38 },
  { zone: 'M4', intensity: 80 }, { zone: 'M5', intensity: 76 }, { zone: 'M6', intensity: 70 },
  { zone: 'A4', intensity: 42 }, { zone: 'A5', intensity: 48 }, { zone: 'A6', intensity: 35 },
]

const XG_TIMELINE = Array.from({ length: 90 }, (_, i) => ({
  minute: i + 1,
  home: Math.min(2.8, 0.05 * (i + 1) + ((i * 7 + 3) % 10) / 30 - 0.15 + (i > 60 ? 0.3 : 0)),
  away: Math.min(1.6, 0.03 * (i + 1) + ((i * 11 + 5) % 10) / 40 - 0.1 + (i > 75 ? 0.2 : 0)),
}))

const SHOT_MAP = [
  { x: 62, y: 22, xg: 0.35, result: 'goal', player: 'Haaland' },
  { x: 45, y: 35, xg: 0.22, result: 'goal', player: 'De Bruyne' },
  { x: 78, y: 30, xg: 0.15, result: 'save', player: 'Vinicius Jr' },
  { x: 55, y: 28, xg: 0.42, result: 'miss', player: 'Bellingham' },
  { x: 38, y: 18, xg: 0.55, result: 'goal', player: 'Mbappé' },
  { x: 25, y: 40, xg: 0.08, result: 'blocked', player: 'Rodri' },
  { x: 70, y: 15, xg: 0.18, result: 'save', player: 'Salah' },
  { x: 50, y: 32, xg: 0.12, result: 'miss', player: 'Modric' },
]

const PASS_NETWORK = [
  { from: [25, 52], to: [75, 52], freq: 28 },
  { from: [50, 48], to: [50, 22], freq: 35 },
  { from: [25, 52], to: [18, 28], freq: 22 },
  { from: [75, 52], to: [82, 28], freq: 20 },
  { from: [37, 75], to: [25, 52], freq: 18 },
  { from: [63, 75], to: [75, 52], freq: 19 },
  { from: [50, 48], to: [25, 52], freq: 25 },
  { from: [50, 48], to: [75, 52], freq: 24 },
  { from: [15, 72], to: [18, 28], freq: 15 },
  { from: [85, 72], to: [82, 28], freq: 14 },
]

const MOMENTUM_DATA = Array.from({ length: 90 }, (_, i) => ({
  minute: i + 1,
  momentum: 50 + Math.sin(i / 10) * 20 + ((i * 13 + 7) % 10) - 5,
}))

const ZONE_CONTROL = [
  { zone: 'Defensive Left', home: 65, away: 35 },
  { zone: 'Defensive Center', home: 70, away: 30 },
  { zone: 'Defensive Right', home: 55, away: 45 },
  { zone: 'Midfield Left', home: 58, away: 42 },
  { zone: 'Midfield Center', home: 52, away: 48 },
  { zone: 'Midfield Right', home: 45, away: 55 },
  { zone: 'Attack Left', home: 40, away: 60 },
  { zone: 'Attack Center', home: 48, away: 52 },
  { zone: 'Attack Right', home: 35, away: 65 },
]

const SET_PIECE_DATA = [
  { stat: 'Corners', home: 7, away: 4 },
  { stat: 'Free Kicks', home: 12, away: 9 },
  { stat: 'Penalties', home: 1, away: 0 },
  { stat: 'Goals from Set Pieces', home: 2, away: 1 },
  { stat: 'Set Piece xG', home: 1.2, away: 0.6 },
]

const SUBSTITUTION_IMPACT = [
  { player: 'Player A', minute: 60, xgBefore: 0.8, xgAfter: 1.4, possBefore: 48, possAfter: 55 },
  { player: 'Player B', minute: 70, xgBefore: 1.2, xgAfter: 0.9, possBefore: 52, possAfter: 50 },
  { player: 'Player C', minute: 75, xgBefore: 1.5, xgAfter: 1.8, possBefore: 50, possAfter: 54 },
]

const DEFENSIVE_ACTIONS = [
  { stat: 'Tackles', home: 18, away: 14 },
  { stat: 'Interceptions', home: 12, away: 9 },
  { stat: 'Blocks', home: 6, away: 4 },
  { stat: 'Clearances', home: 22, away: 18 },
  { stat: 'Recoveries', home: 48, away: 42 },
]

const AERIAL_DUELS = [
  { category: 'Defensive', home: 65, away: 55 },
  { category: 'Offensive', home: 48, away: 58 },
  { category: 'Midfield', home: 52, away: 50 },
]

const WIDE_PLAY = [
  { side: 'Left Wing', homePasses: 145, awayPasses: 120, homeCrosses: 18, awayCrosses: 12 },
  { side: 'Right Wing', homePasses: 110, awayPasses: 160, homeCrosses: 10, awayCrosses: 22 },
  { side: 'Center', homePasses: 280, awayPasses: 260, homeCrosses: 2, awayCrosses: 3 },
]

const COUNTER_ATTACK = [
  { team: 'Home', attempts: 5, successes: 3, xg: 0.9 },
  { team: 'Away', attempts: 3, successes: 2, xg: 0.5 },
]

const BUIlD_UP_PATTERNS = [
  { pattern: 'Short Passes', home: 45, away: 38 },
  { pattern: 'Long Balls', home: 15, away: 25 },
  { pattern: 'Through Balls', home: 12, away: 8 },
  { pattern: 'Dribbles', home: 18, away: 22 },
  { pattern: 'Wing Play', home: 10, away: 7 },
]

const TRANSITION_SPEED = [
  { phase: 'Def to Off', home: 8.2, away: 10.5 },
  { phase: 'Off to Def', home: 6.8, away: 7.2 },
  { phase: 'Set Piece to Play', home: 4.5, away: 5.1 },
]

// ── Component ──────────────────────────────────────────────────────────────────

export default function TacticalView() {
  const matches = useElasticoStore(s => s.matches)
  const teams = useElasticoStore(s => s.teams)
  const [formation, setFormation] = useState('4-3-3')
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null)

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
                        {MOCK_PLAYER_NAMES[i] || pos.label}
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
              <div className="relative w-full max-w-lg mx-auto aspect-[3/4] bg-emerald-900/40 rounded-lg border border-emerald-800/30 p-3">
                <div className="absolute inset-3 border border-emerald-700/30 rounded-sm" />
                <div className="absolute left-1/2 top-3 bottom-3 -translate-x-1/2 border-l border-emerald-700/20" />
                <div className="grid grid-cols-3 grid-rows-5 gap-1.5 h-full p-2 pt-4">
                  {PRESSING_HEATMAP.map((zone) => (
                    <div
                      key={zone.zone}
                      className={cn('rounded flex items-center justify-center text-xs font-bold transition-all duration-300', getIntensityColor(zone.intensity))}
                      title={`${zone.zone}: ${zone.intensity}%`}
                    >
                      <span className="text-white/90 drop-shadow">{zone.intensity}</span>
                    </div>
                  ))}
                </div>
                {/* Legend */}
                <div className="absolute bottom-1 right-3 flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground">Low</span>
                  <div className="flex gap-0.5">
                    <div className="w-3 h-2 rounded-sm bg-emerald-500/50" />
                    <div className="w-3 h-2 rounded-sm bg-yellow-500/60" />
                    <div className="w-3 h-2 rounded-sm bg-orange-500/70" />
                    <div className="w-3 h-2 rounded-sm bg-red-500/80" />
                  </div>
                  <span className="text-[9px] text-muted-foreground">High</span>
                </div>
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
              <div className="relative w-full max-w-lg mx-auto aspect-[3/4] bg-emerald-900/30 rounded-lg border border-emerald-800/30 overflow-hidden">
                <div className="absolute inset-2 border border-emerald-700/20 rounded-sm" />
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {PASS_NETWORK.map((link, i) => {
                    const width = Math.max(0.3, link.freq / 12)
                    const opacity = Math.min(1, link.freq / 30)
                    return (
                      <line
                        key={i}
                        x1={link.from[0]}
                        y1={link.from[1]}
                        x2={link.to[0]}
                        y2={link.to[1]}
                        stroke="#00e676"
                        strokeWidth={width}
                        opacity={opacity}
                      />
                    )
                  })}
                </svg>
                {positions.map((pos, i) => (
                  <div
                    key={i}
                    className="absolute w-7 h-7 rounded-full bg-primary border-2 border-primary flex items-center justify-center text-[9px] font-bold text-background -translate-x-1/2 -translate-y-1/2 shadow-lg"
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  >
                    {MOCK_PLAYER_NAMES[i]?.split(' ').pop()?.[0] || pos.label[0]}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-6 h-0.5 bg-primary" /> 10+ passes
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-6 h-1 bg-primary" /> 25+ passes
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-6 h-1.5 bg-primary" /> 35+ passes
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. xG Timeline */}
        <TabsContent value="xg">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" /> Expected Goals (xG) Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={XG_TIMELINE}>
                    <defs>
                      <linearGradient id="gHome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00e676" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#00e676" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gAway" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff5252" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ff5252" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="minute" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="home" stroke="#00e676" fill="url(#gHome)" strokeWidth={2} name={homeTeam?.name || 'Home'} />
                    <Area type="monotone" dataKey="away" stroke="#ff5252" fill="url(#gAway)" strokeWidth={2} name={awayTeam?.name || 'Away'} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-muted-foreground">{homeTeam?.name || 'Home'} — {XG_TIMELINE[89].home.toFixed(2)} xG</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-muted-foreground">{awayTeam?.name || 'Away'} — {XG_TIMELINE[89].away.toFixed(2)} xG</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. Shot Map */}
        <TabsContent value="shots">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MapPin className="size-4 text-primary" /> Shot Map
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative w-full max-w-md mx-auto aspect-[3/4] bg-emerald-900/40 rounded-lg border border-emerald-800/30 overflow-hidden">
                <div className="absolute inset-2 border border-emerald-700/30 rounded-sm" />
                <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 border-l border-emerald-700/20" />
                {/* Goal */}
                <div className="absolute left-1/2 -translate-x-1/2 top-0 w-24 h-2 bg-white/30 border-b border-white/50" />
                {/* 6-yard box */}
                <div className="absolute left-1/2 -translate-x-1/2 top-0 w-20 h-10 border-b border-l border-r border-emerald-700/20" />
                {/* Penalty box */}
                <div className="absolute left-1/2 -translate-x-1/2 top-0 w-44 h-24 border-b border-l border-r border-emerald-700/20" />
                {/* Penalty spot */}
                <div className="absolute left-1/2 -translate-x-1/2 top-[22%] w-1.5 h-1.5 rounded-full bg-white/40" />
                {/* Shots */}
                {SHOT_MAP.map((shot, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.1, type: 'spring' }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                    style={{ left: `${shot.x}%`, top: `${shot.y}%` }}
                  >
                    <div
                      className="rounded-full border-2 border-background/60 shadow-lg transition-transform hover:scale-125"
                      style={{
                        width: `${Math.max(16, shot.xg * 50)}px`,
                        height: `${Math.max(16, shot.xg * 50)}px`,
                        backgroundColor: getShotColor(shot.result),
                        opacity: 0.85,
                      }}
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-card border border-border rounded px-2 py-1 text-[10px] whitespace-nowrap z-10 shadow-lg">
                      {shot.player} — {shot.result} ({shot.xg} xG)
                    </div>
                  </motion.div>
                ))}
                {/* Legend */}
                <div className="absolute bottom-2 left-2 flex flex-col gap-1 text-[9px]">
                  <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-[#00e676]" /> Goal</div>
                  <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-[#ff5252]" /> Miss</div>
                  <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-[#ffab40]" /> Save</div>
                  <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-[#78909c]" /> Blocked</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6. Tactical Comparison — detailed */}
        <TabsContent value="comparison">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Detailed Tactical Comparison</CardTitle>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto space-y-2 pr-1">
              {[
                { label: 'Possession %', home: 58, away: 42 },
                { label: 'Pass Accuracy %', home: 87, away: 82 },
                { label: 'Shots', home: 16, away: 11 },
                { label: 'Shots on Target', home: 7, away: 4 },
                { label: 'xG', home: 2.4, away: 1.1 },
                { label: 'Pressures', home: 156, away: 128 },
                { label: 'High Press Success %', home: 34, away: 28 },
                { label: 'Tackles', home: 18, away: 14 },
                { label: 'Interceptions', home: 12, away: 9 },
                { label: 'Aerial Duels Won %', home: 55, away: 45 },
                { label: 'Sprints', home: 89, away: 76 },
                { label: 'Avg Def Line (m)', home: 42, away: 38 },
                { label: 'Progressive Passes', home: 45, away: 32 },
                { label: 'Final Third Entries', home: 68, away: 49 },
                { label: 'PPDA', home: 8.2, away: 11.5 },
              ].map((stat) => {
                const total = stat.home + stat.away
                const homePct = Math.round((stat.home / total) * 100)
                return (
                  <div key={stat.label} className="flex items-center gap-3">
                    <span className="text-xs font-medium w-36 shrink-0 text-right text-primary">{stat.home}</span>
                    <div className="flex-1">
                      <div className="flex h-2.5 rounded-full overflow-hidden bg-muted/50">
                        <div className="bg-primary/80 rounded-l-full" style={{ width: `${homePct}%` }} />
                        <div className="bg-orange-500/70 rounded-r-full" style={{ width: `${100 - homePct}%` }} />
                      </div>
                    </div>
                    <span className="text-xs font-medium w-36 shrink-0 text-orange-400">{stat.away}</span>
                    <span className="text-[10px] text-muted-foreground w-32 shrink-0">{stat.label}</span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 7. Set Piece Analysis */}
        <TabsContent value="setpieces">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Mountain className="size-4 text-primary" /> Set Piece Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={SET_PIECE_DATA} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="stat" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="home" fill="#00e676" radius={[4, 4, 0, 0]} name={homeTeam?.name || 'Home'} />
                    <Bar dataKey="away" fill="#ff5252" radius={[4, 4, 0, 0]} name={awayTeam?.name || 'Away'} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 8. Substitution Impact */}
        <TabsContent value="substitutions">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <RefreshCw className="size-4 text-primary" /> Substitution Impact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {SUBSTITUTION_IMPACT.map((sub, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="glass-card p-3 rounded-lg border border-border/50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{sub.player}</span>
                    <Badge variant="outline" className="text-xs">{"'"}{sub.minute}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>xG Before</span><span>xG After</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-orange-400">{sub.xgBefore}</span>
                        <ArrowRightLeft className="size-3 text-muted-foreground" />
                        <span className="text-sm text-primary">{sub.xgAfter}</span>
                        <Badge variant="outline" className="text-[10px] text-primary border-primary/30 ml-auto">
                          {sub.xgAfter > sub.xgBefore ? '+' : ''}{(sub.xgAfter - sub.xgBefore).toFixed(1)}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Poss Before</span><span>Poss After</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-orange-400">{sub.possBefore}%</span>
                        <ArrowRightLeft className="size-3 text-muted-foreground" />
                        <span className="text-sm text-primary">{sub.possAfter}%</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 9. Match Momentum */}
        <TabsContent value="momentum">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="size-4 text-yellow-400" /> Match Momentum
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={MOMENTUM_DATA}>
                    <defs>
                      <linearGradient id="gMom" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ffab40" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#ffab40" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="minute" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <ReferenceLine y={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
                    <Area type="monotone" dataKey="momentum" stroke="#ffab40" fill="url(#gMom)" strokeWidth={2} name="Momentum" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>← {awayTeam?.name || 'Away'} dominance</span>
                <span>{homeTeam?.name || 'Home'} dominance →</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 10. Zone Control */}
        <TabsContent value="zone">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="size-4 text-primary" /> Zone Control
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto space-y-2 pr-1">
              {ZONE_CONTROL.map((z) => (
                <div key={z.zone} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{z.zone}</span>
                    <span><span className="text-primary">{z.home}%</span> / <span className="text-orange-400">{z.away}%</span></span>
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden bg-muted/50">
                    <div className="bg-primary/80 rounded-l-full transition-all" style={{ width: `${z.home}%` }} />
                    <div className="bg-orange-500/70 rounded-r-full transition-all" style={{ width: `${z.away}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 11. Build-up Play Patterns */}
        <TabsContent value="buildup">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wind className="size-4 text-primary" /> Build-up Play Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={BUIlD_UP_PATTERNS} layout="vertical" barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis dataKey="pattern" type="category" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={100} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="home" fill="#00e676" radius={[0, 4, 4, 0]} name="Home" />
                    <Bar dataKey="away" fill="#ff5252" radius={[0, 4, 4, 0]} name="Away" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 12. Defensive Actions */}
        <TabsContent value="defensive">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="size-4 text-primary" /> Defensive Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={DEFENSIVE_ACTIONS}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="stat" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="home" fill="#00e676" radius={[4, 4, 0, 0]} name="Home" />
                    <Bar dataKey="away" fill="#ff5252" radius={[4, 4, 0, 0]} name="Away" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 13. Aerial Duels */}
        <TabsContent value="aerial">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Aerial Duels Win Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={AERIAL_DUELS} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="category" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <PolarRadiusAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                    <Radar name="Home" dataKey="home" stroke="#00e676" fill="#00e676" fillOpacity={0.2} strokeWidth={2} />
                    <Radar name="Away" dataKey="away" stroke="#ff5252" fill="#ff5252" fillOpacity={0.2} strokeWidth={2} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 14. Counter-Attack Stats */}
        <TabsContent value="counter">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="size-4 text-yellow-400" /> Counter-Attack Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {COUNTER_ATTACK.map((team) => (
                  <div key={team.team} className="glass-card p-4 rounded-lg border border-border/50 space-y-3">
                    <h4 className="text-sm font-semibold">{team.team}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[10px] text-muted-foreground">Attempts</div>
                        <div className="text-xl font-bold">{team.attempts}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">Success Rate</div>
                        <div className="text-xl font-bold text-primary">{Math.round((team.successes / team.attempts) * 100)}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">xG from Counters</div>
                        <div className="text-lg font-bold">{team.xg}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">Successes</div>
                        <div className="text-xl font-bold">{team.successes}</div>
                      </div>
                    </div>
                    <Progress value={(team.successes / team.attempts) * 100} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 15. High Line / Deep Block */}
        <TabsContent value="defline">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="size-4 text-primary" /> Defensive Line Position
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative w-full max-w-md mx-auto aspect-[3/4] bg-emerald-900/40 rounded-lg border border-emerald-800/30 overflow-hidden">
                <div className="absolute inset-2 border border-emerald-700/30 rounded-sm" />
                <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 border-l border-emerald-700/20" />
                {/* Distance markers */}
                {[20, 40, 60, 80].map(m => (
                  <div key={m} className="absolute left-2 right-2 border-t border-dashed border-emerald-700/15" style={{ top: `${m}%` }}>
                    <span className="absolute -top-2.5 right-3 text-[9px] text-emerald-700/50">{m}m</span>
                  </div>
                ))}
                {/* Home defensive line at 42m */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute left-[10%] right-[10%] h-1 bg-primary rounded-full shadow-lg shadow-primary/40"
                  style={{ top: '42%' }}
                >
                  <span className="absolute -top-5 left-0 text-[9px] text-primary font-bold">Home — 42m avg</span>
                </motion.div>
                {/* Away defensive line at 38m */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { delay: 0.3 } }}
                  className="absolute left-[10%] right-[10%] h-1 bg-orange-500 rounded-full shadow-lg shadow-orange-500/40"
                  style={{ top: '38%' }}
                >
                  <span className="absolute -top-5 right-0 text-[9px] text-orange-400 font-bold">Away — 38m avg</span>
                </motion.div>
                {/* Analysis text */}
                <div className="absolute bottom-3 left-3 right-3 glass-card p-2 rounded border border-border/30">
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    <span className="text-primary font-medium">Home</span> plays a higher defensive line (42m avg), compressing space and enabling aggressive pressing.
                    <span className="text-orange-400 font-medium"> Away</span> sits deeper (38m avg), absorbing pressure and looking to counter.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 16. Wide Play Analysis */}
        <TabsContent value="wides">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Wide Play Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={WIDE_PLAY}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="side" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="homePasses" fill="#00e676" radius={[4, 4, 0, 0]} name="Home Passes" />
                    <Bar dataKey="awayPasses" fill="#ff5252" radius={[4, 4, 0, 0]} name="Away Passes" />
                    <Bar dataKey="homeCrosses" fill="#00e67680" radius={[4, 4, 0, 0]} name="Home Crosses" />
                    <Bar dataKey="awayCrosses" fill="#ff525280" radius={[4, 4, 0, 0]} name="Away Crosses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 17. Transition Speed */}
        <TabsContent value="transition">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wind className="size-4 text-primary" /> Transition Speed (seconds)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={TRANSITION_SPEED} barSize={30}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="phase" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" unit="s" />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="home" fill="#00e676" radius={[4, 4, 0, 0]} name="Home" />
                    <Bar dataKey="away" fill="#ff5252" radius={[4, 4, 0, 0]} name="Away" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">Lower is better — faster transitions from one phase to another</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 18. Tactical AI Insight */}
        <TabsContent value="ai">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Brain className="size-4 text-primary" /> Tactical AI Insight
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm prose-invert max-w-none space-y-3">
                <div className="glass-card p-4 rounded-lg border border-primary/20 bg-primary/5">
                  <p className="text-sm leading-relaxed text-foreground/90">
                    <span className="text-primary font-semibold">Formation Matchup:</span> The home team&apos;s 4-3-3 creates numerical superiority in midfield (3v2) against the away team&apos;s 4-4-2. The single defensive midfielder can be exploited by the away team&apos;s two strikers pressing high.
                  </p>
                </div>
                <div className="glass-card p-4 rounded-lg border border-orange-500/20 bg-orange-500/5">
                  <p className="text-sm leading-relaxed text-foreground/90">
                    <span className="text-orange-400 font-semibold">Pressing Vulnerability:</span> The away team&apos;s build-up is vulnerable on the left side, where pressing intensity data shows only 45% success. Targeting the left CB with direct balls could yield opportunities.
                  </p>
                </div>
                <div className="glass-card p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
                  <p className="text-sm leading-relaxed text-foreground/90">
                    <span className="text-yellow-400 font-semibold">Key Battleground:</span> The midfield transition zone (40-60m) is contested at only 52/48%. Whichever team controls this zone will dictate the tempo. The home team&apos;s faster defensive-to-offensive transition (8.2s vs 10.5s) is a significant advantage.
                  </p>
                </div>
                <div className="glass-card p-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                  <p className="text-sm leading-relaxed text-foreground/90">
                    <span className="text-emerald-400 font-semibold">Recommended Adjustment:</span> Consider shifting to a 3-5-2 to match the away team&apos;s striker count, while maintaining wing-back overlap to exploit the flanks where the away team concedes 65% of their territorial control.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}