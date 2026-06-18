'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Search,
  Filter,
  Download,
  Star,
  TrendingUp,
  Award,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  X,
  User,
  Copy,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  ReferenceLine,
} from 'recharts'
import { useElasticoStore, type Player } from '@/store/use-elastico-store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────────────────

interface EnhancedPlayer extends Player {
  teamName?: string
  teamCode?: string
  teamColor?: string
  nationality?: string
  appearances?: number
  minutesPlayed?: number
}

// ── Mock Data ──────────────────────────────────────────────────────────────────

const MOCK_PLAYERS: EnhancedPlayer[] = [
  { id: 'p1', name: 'Kylian Mbappé', number: 10, position: 'FWD', goals: 8, assists: 4, yellowCards: 1, redCards: 0, rating: 8.4, marketValue: 180, age: 27, nationality: 'France', appearances: 7, minutesPlayed: 580, teamName: 'France', teamCode: 'FRA', teamColor: '#002395' },
  { id: 'p2', name: 'Erling Haaland', number: 9, position: 'FWD', goals: 7, assists: 2, yellowCards: 0, redCards: 0, rating: 8.1, marketValue: 170, age: 24, nationality: 'Norway', appearances: 7, minutesPlayed: 560, teamName: 'Norway', teamCode: 'NOR', teamColor: '#EF2B2D' },
  { id: 'p3', name: 'Vinicius Jr', number: 7, position: 'FWD', goals: 6, assists: 5, yellowCards: 2, redCards: 0, rating: 8.2, marketValue: 150, age: 24, nationality: 'Brazil', appearances: 7, minutesPlayed: 590, teamName: 'Brazil', teamCode: 'BRA', teamColor: '#009739' },
  { id: 'p4', name: 'Kevin De Bruyne', number: 17, position: 'MID', goals: 2, assists: 7, yellowCards: 0, redCards: 0, rating: 7.9, marketValue: 75, age: 33, nationality: 'Belgium', appearances: 6, minutesPlayed: 480, teamName: 'Belgium', teamCode: 'BEL', teamColor: '#ED2939' },
  { id: 'p5', name: 'Jude Bellingham', number: 5, position: 'MID', goals: 4, assists: 3, yellowCards: 1, redCards: 0, rating: 7.8, marketValue: 120, age: 21, nationality: 'England', appearances: 7, minutesPlayed: 600, teamName: 'England', teamCode: 'ENG', teamColor: '#CF081F' },
  { id: 'p6', name: 'Rodri', number: 16, position: 'MID', goals: 1, assists: 3, yellowCards: 2, redCards: 0, rating: 7.6, marketValue: 90, age: 28, nationality: 'Spain', appearances: 7, minutesPlayed: 570, teamName: 'Spain', teamCode: 'ESP', teamColor: '#AA151B' },
  { id: 'p7', name: 'Virgil van Dijk', number: 4, position: 'DEF', goals: 1, assists: 1, yellowCards: 1, redCards: 0, rating: 7.5, marketValue: 55, age: 33, nationality: 'Netherlands', appearances: 7, minutesPlayed: 630, teamName: 'Netherlands', teamCode: 'NED', teamColor: '#FF6C00' },
  { id: 'p8', name: 'Alisson Becker', number: 1, position: 'GK', goals: 0, assists: 0, yellowCards: 0, redCards: 0, rating: 7.4, marketValue: 45, age: 32, nationality: 'Brazil', appearances: 7, minutesPlayed: 630, teamName: 'Brazil', teamCode: 'BRA', teamColor: '#009739' },
  { id: 'p9', name: 'Luka Modrić', number: 10, position: 'MID', goals: 1, assists: 4, yellowCards: 1, redCards: 0, rating: 7.7, marketValue: 10, age: 38, nationality: 'Croatia', appearances: 6, minutesPlayed: 420, teamName: 'Croatia', teamCode: 'CRO', teamColor: '#171796' },
  { id: 'p10', name: 'Mohamed Salah', number: 11, position: 'FWD', goals: 5, assists: 6, yellowCards: 0, redCards: 0, rating: 8.0, marketValue: 80, age: 32, nationality: 'Egypt', appearances: 7, minutesPlayed: 580, teamName: 'Egypt', teamCode: 'EGY', teamColor: '#C8102E' },
  { id: 'p11', name: 'Ruben Dias', number: 3, position: 'DEF', goals: 0, assists: 1, yellowCards: 3, redCards: 0, rating: 7.3, marketValue: 65, age: 27, nationality: 'Portugal', appearances: 7, minutesPlayed: 610, teamName: 'Portugal', teamCode: 'POR', teamColor: '#006600' },
  { id: 'p12', name: 'Pedri', number: 8, position: 'MID', goals: 2, assists: 5, yellowCards: 0, redCards: 0, rating: 7.8, marketValue: 100, age: 21, nationality: 'Spain', appearances: 7, minutesPlayed: 550, teamName: 'Spain', teamCode: 'ESP', teamColor: '#AA151B' },
  { id: 'p13', name: 'Jamal Musiala', number: 14, position: 'MID', goals: 3, assists: 3, yellowCards: 1, redCards: 0, rating: 7.6, marketValue: 110, age: 22, nationality: 'Germany', appearances: 7, minutesPlayed: 500, teamName: 'Germany', teamCode: 'DEU', teamColor: '#DD0000' },
  { id: 'p14', name: 'William Saliba', number: 2, position: 'DEF', goals: 1, assists: 0, yellowCards: 2, redCards: 0, rating: 7.4, marketValue: 70, age: 23, nationality: 'France', appearances: 7, minutesPlayed: 620, teamName: 'France', teamCode: 'FRA', teamColor: '#002395' },
  { id: 'p15', name: 'Florian Wirtz', number: 10, position: 'MID', goals: 4, assists: 2, yellowCards: 0, redCards: 0, rating: 7.9, marketValue: 130, age: 22, nationality: 'Germany', appearances: 6, minutesPlayed: 480, teamName: 'Germany', teamCode: 'DEU', teamColor: '#DD0000' },
  { id: 'p16', name: 'Thibaut Courtois', number: 1, position: 'GK', goals: 0, assists: 0, yellowCards: 0, redCards: 0, rating: 7.2, marketValue: 35, age: 32, nationality: 'Belgium', appearances: 7, minutesPlayed: 630, teamName: 'Belgium', teamCode: 'BEL', teamColor: '#ED2939' },
  { id: 'p17', name: 'Declan Rice', number: 4, position: 'MID', goals: 1, assists: 2, yellowCards: 3, redCards: 0, rating: 7.3, marketValue: 85, age: 25, nationality: 'England', appearances: 7, minutesPlayed: 590, teamName: 'England', teamCode: 'ENG', teamColor: '#CF081F' },
  { id: 'p18', name: 'Dani Olmo', number: 20, position: 'FWD', goals: 5, assists: 3, yellowCards: 1, redCards: 0, rating: 7.8, marketValue: 60, age: 26, nationality: 'Spain', appearances: 6, minutesPlayed: 430, teamName: 'Spain', teamCode: 'ESP', teamColor: '#AA151B' },
  { id: 'p19', name: 'Kyle Walker', number: 2, position: 'DEF', goals: 0, assists: 2, yellowCards: 2, redCards: 0, rating: 7.0, marketValue: 15, age: 34, nationality: 'England', appearances: 7, minutesPlayed: 580, teamName: 'England', teamCode: 'ENG', teamColor: '#CF081F' },
  { id: 'p20', name: 'Lamine Yamal', number: 19, position: 'FWD', goals: 3, assists: 4, yellowCards: 0, redCards: 0, rating: 7.7, marketValue: 100, age: 18, nationality: 'Spain', appearances: 7, minutesPlayed: 520, teamName: 'Spain', teamCode: 'ESP', teamColor: '#AA151B' },
]

const FORM_CHART_DATA = (name: string) => Array.from({ length: 8 }, (_, i) => ({
  match: `M${i + 1}`,
  rating: +(6.5 + Math.random() * 2.5 - (i === 4 ? 1 : 0)).toFixed(1),
}))

const RADAR_STATS = {
  'Kylian Mbappé': { Pace: 97, Shooting: 91, Passing: 80, Defending: 36, Physical: 78, Dribbling: 94 },
  'Erling Haaland': { Pace: 89, Shooting: 95, Passing: 65, Defending: 45, Physical: 92, Dribbling: 80 },
  'Kevin De Bruyne': { Pace: 74, Shooting: 86, Passing: 94, Defending: 58, Physical: 72, Dribbling: 88 },
  'Virgil van Dijk': { Pace: 78, Shooting: 62, Passing: 70, Defending: 92, Physical: 88, Dribbling: 55 },
  'Alisson Becker': { Pace: 52, Shooting: 20, Passing: 72, Defending: 40, Physical: 80, Dribbling: 35 },
}

function generateRadarStats(p: EnhancedPlayer) {
  if (RADAR_STATS[p.name]) return RADAR_STATS[p.name]
  return {
    Pace: 50 + Math.round(Math.random() * 40),
    Shooting: p.position === 'FWD' ? 70 + Math.round(Math.random() * 25) : 40 + Math.round(Math.random() * 30),
    Passing: p.position === 'MID' ? 75 + Math.round(Math.random() * 20) : 50 + Math.round(Math.random() * 30),
    Defending: p.position === 'DEF' ? 70 + Math.round(Math.random() * 25) : 30 + Math.round(Math.random() * 25),
    Physical: 55 + Math.round(Math.random() * 35),
    Dribbling: p.position === 'FWD' || p.position === 'MID' ? 65 + Math.round(Math.random() * 30) : 35 + Math.round(Math.random() * 25),
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export function PlayerView() {
  const teams = useElasticoStore(s => s.teams)
  const token = useElasticoStore(s => s.token)
  const [players, setPlayers] = useState<EnhancedPlayer[]>(MOCK_PLAYERS)
  const [search, setSearch] = useState('')
  const [positionFilter, setPositionFilter] = useState<string>('all')
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('rating')
  const [selectedPlayer, setSelectedPlayer] = useState<EnhancedPlayer | null>(null)
  const [comparePlayer, setComparePlayer] = useState<EnhancedPlayer | null>(null)
  const [page, setPage] = useState(0)
  const perPage = 12

  // Fetch players from API
  useEffect(() => {
    async function fetchPlayers() {
      try {
        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`
        const params = new URLSearchParams()
        if (sortBy) params.set('sortBy', sortBy)
        if (positionFilter !== 'all') params.set('position', positionFilter)
        if (search) params.set('search', search)
        params.set('limit', '100')
        const res = await fetch(`/api/players?${params}`, { headers })
        if (res.ok) {
          const data = await res.json()
          if (data.players && data.players.length > 0) {
            setPlayers(data.players.map((p: Record<string, unknown>) => ({
              ...p,
              teamName: (p.team as Record<string, unknown>)?.name as string || p.teamName,
              teamCode: (p.team as Record<string, unknown>)?.code as string || p.teamCode,
              teamColor: (p.team as Record<string, unknown>)?.primaryColor as string || '#00e676',
            } as EnhancedPlayer)))
            return
          }
        }
      } catch {
        // fallback to mock
      }
    }
    fetchPlayers()
  }, [token, sortBy, positionFilter, search])

  // Derived data
  const filteredPlayers = useMemo(() => {
    let result = [...players]
    if (search) result = result.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    if (positionFilter !== 'all') result = result.filter(p => p.position === positionFilter)
    if (teamFilter !== 'all') result = result.filter(p => p.teamName === teamFilter)
    result.sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating
      if (sortBy === 'goals') return b.goals - a.goals
      if (sortBy === 'assists') return b.assists - a.assists
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'age') return (a.age || 0) - (b.age || 0)
      if (sortBy === 'marketValue') return (b.marketValue || 0) - (a.marketValue || 0)
      return 0
    })
    return result
  }, [players, search, positionFilter, teamFilter, sortBy])

  const pagedPlayers = filteredPlayers.slice(page * perPage, (page + 1) * perPage)
  const totalPages = Math.ceil(filteredPlayers.length / perPage)

  const topScorers = useMemo(() => [...players].sort((a, b) => b.goals - a.goals).slice(0, 10), [players])
  const topByValue = useMemo(() => [...players].filter(p => p.marketValue).sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0)).slice(0, 10), [players])

  const positionalGroups = useMemo(() => {
    const groups: Record<string, EnhancedPlayer[]> = {}
    for (const p of players) {
      if (!groups[p.position]) groups[p.position] = []
      groups[p.position].push(p)
    }
    return groups
  }, [players])

  const ageData = useMemo(() => {
    const buckets: Record<string, number> = { '18-21': 0, '22-25': 0, '26-29': 0, '30-33': 0, '34+': 0 }
    for (const p of players) {
      const age = p.age || 25
      if (age <= 21) buckets['18-21']++
      else if (age <= 25) buckets['22-25']++
      else if (age <= 29) buckets['26-29']++
      else if (age <= 33) buckets['30-33']++
      else buckets['34+']++
    }
    return Object.entries(buckets).map(([range, count]) => ({ range, count }))
  }, [players])

  const nationalities = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of players) {
      const nat = p.nationality || 'Unknown'
      map[nat] = (map[nat] || 0) + 1
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [players])

  const uniqueTeams = useMemo(() => [...new Set(players.map(p => p.teamName).filter(Boolean))], [players])

  // Similar players
  const similarPlayers = useMemo(() => {
    if (!selectedPlayer) return []
    const stats = generateRadarStats(selectedPlayer)
    return players
      .filter(p => p.id !== selectedPlayer.id && p.position === selectedPlayer.position)
      .map(p => {
        const ps = generateRadarStats(p)
        const diff = Math.abs(stats.Pace - ps.Pace) + Math.abs(stats.Shooting - ps.Shooting) +
          Math.abs(stats.Passing - ps.Passing) + Math.abs(stats.Defending - ps.Defending) +
          Math.abs(stats.Physical - ps.Physical) + Math.abs(stats.Dribbling - ps.Dribbling)
        return { player: p, similarity: 100 - Math.round(diff / 6) }
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
  }, [selectedPlayer, players])

  // CSV Export
  const exportCSV = useCallback(() => {
    const headers = ['Name', 'Position', 'Team', 'Age', 'Goals', 'Assists', 'Rating', 'Market Value (€M)', 'Yellow Cards', 'Red Cards', 'Nationality']
    const rows = filteredPlayers.map(p => [
      p.name, p.position, p.teamName || '', p.age || '', p.goals, p.assists, p.rating, p.marketValue || '', p.yellowCards, p.redCards, p.nationality || ''
    ])
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'elastico-players.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Players exported to CSV')
  }, [filteredPlayers])

  const getPositionColor = (pos: string) => {
    switch (pos) {
      case 'GK': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30'
      case 'DEF': return 'text-blue-400 bg-blue-400/10 border-blue-400/30'
      case 'MID': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30'
      case 'FWD': return 'text-red-400 bg-red-400/10 border-red-400/30'
      default: return ''
    }
  }

  const getRatingColor = (r: number) => {
    if (r >= 8.0) return 'text-emerald-400'
    if (r >= 7.0) return 'text-emerald-300'
    if (r >= 6.0) return 'text-yellow-400'
    return 'text-red-400'
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
            <Users className="text-primary" /> Player Analytics
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Search, analyze, and compare football players</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search players..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="pl-9"
          />
        </div>
        <Select value={positionFilter} onValueChange={(v) => { setPositionFilter(v); setPage(0) }}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Position" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Positions</SelectItem>
            <SelectItem value="GK">GK</SelectItem>
            <SelectItem value="DEF">DEF</SelectItem>
            <SelectItem value="MID">MID</SelectItem>
            <SelectItem value="FWD">FWD</SelectItem>
          </SelectContent>
        </Select>
        <Select value={teamFilter} onValueChange={(v) => { setTeamFilter(v); setPage(0) }}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            {uniqueTeams.map(t => (
              <SelectItem key={t} value={t!}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rating">Rating</SelectItem>
            <SelectItem value="goals">Goals</SelectItem>
            <SelectItem value="assists">Assists</SelectItem>
            <SelectItem value="marketValue">Market Value</SelectItem>
            <SelectItem value="age">Age</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="grid" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 h-auto bg-card/50 p-1 rounded-lg">
          <TabsTrigger value="grid" className="text-xs">Player Grid</TabsTrigger>
          <TabsTrigger value="leaderboard" className="text-xs">Top Scorers</TabsTrigger>
          <TabsTrigger value="radar" className="text-xs">Radar Charts</TabsTrigger>
          <TabsTrigger value="compare" className="text-xs">Compare</TabsTrigger>
          <TabsTrigger value="value" className="text-xs">Market Value</TabsTrigger>
          <TabsTrigger value="positions" className="text-xs">By Position</TabsTrigger>
          <TabsTrigger value="age" className="text-xs">Age Dist.</TabsTrigger>
          <TabsTrigger value="nationality" className="text-xs">Nationality</TabsTrigger>
          <TabsTrigger value="cards" className="text-xs">Cards</TabsTrigger>
          <TabsTrigger value="subs" className="text-xs">Substitutions</TabsTrigger>
          <TabsTrigger value="similar" className="text-xs">Similar</TabsTrigger>
          <TabsTrigger value="form" className="text-xs">Form</TabsTrigger>
        </TabsList>

        {/* Player Cards Grid */}
        <TabsContent value="grid">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pagedPlayers.map((player) => (
              <motion.div
                key={player.id}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                className="cursor-pointer"
                onClick={() => setSelectedPlayer(player)}
              >
                <Card className="glass-card h-full overflow-hidden">
                  <div className="h-2" style={{ backgroundColor: player.teamColor || '#00e676' }} />
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-lg font-bold shrink-0 border-2 border-border">
                        {player.number}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold truncate">{player.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={cn('text-[10px]', getPositionColor(player.position))}>
                            {player.position}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground truncate">{player.teamName}</span>
                        </div>
                      </div>
                      <div className={cn('text-xl font-bold', getRatingColor(player.rating))}>
                        {player.rating.toFixed(1)}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <div className="text-center">
                        <div className="text-lg font-bold text-primary">{player.goals}</div>
                        <div className="text-[10px] text-muted-foreground">Goals</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-primary">{player.assists}</div>
                        <div className="text-[10px] text-muted-foreground">Assists</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-primary">{player.yellowCards + player.redCards}</div>
                        <div className="text-[10px] text-muted-foreground">Cards</div>
                      </div>
                    </div>
                    {player.marketValue && (
                      <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-1">
                        <TrendingUp className="size-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">€{player.marketValue}M</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Top Scorers Leaderboard */}
        <TabsContent value="leaderboard">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Star className="size-4 text-yellow-400" /> Top Scorers Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead className="text-center">Goals</TableHead>
                      <TableHead className="text-center">Assists</TableHead>
                      <TableHead className="text-center">Mins</TableHead>
                      <TableHead className="text-center">G/90</TableHead>
                      <TableHead className="text-center">Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topScorers.map((p, i) => (
                      <TableRow key={p.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setSelectedPlayer(p)}>
                        <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{p.name}</span>
                            <Badge variant="outline" className={cn('text-[9px]', getPositionColor(p.position))}>{p.position}</Badge>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{p.teamName}</span>
                        </TableCell>
                        <TableCell className="text-center font-bold text-primary">{p.goals}</TableCell>
                        <TableCell className="text-center">{p.assists}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{p.minutesPlayed || (p.appearances || 0) * 90}</TableCell>
                        <TableCell className="text-center font-medium">
                          {((p.goals / ((p.minutesPlayed || (p.appearances || 0) * 90) / 90))).toFixed(2)}
                        </TableCell>
                        <TableCell className={cn('text-center font-bold', getRatingColor(p.rating))}>{p.rating.toFixed(1)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Player Radar Chart */}
        <TabsContent value="radar">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Award className="size-4 text-primary" /> Player Radar Charts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {topScorers.slice(0, 6).map((player) => {
                  const stats = generateRadarStats(player)
                  const radarData = Object.entries(stats).map(([k, v]) => ({ stat: k, value: v }))
                  return (
                    <Card key={player.id} className="glass-card border-border/30">
                      <CardContent className="p-3">
                        <h4 className="text-sm font-semibold text-center mb-1">{player.name}</h4>
                        <p className="text-[10px] text-center text-muted-foreground mb-2">{player.position} · {player.teamName}</p>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="65%">
                              <PolarGrid stroke="hsl(var(--border))" />
                              <PolarAngleAxis dataKey="stat" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                              <PolarRadiusAxis tick={{ fontSize: 8 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                              <Radar dataKey="value" stroke="#00e676" fill="#00e676" fillOpacity={0.15} strokeWidth={2} />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Player Comparison */}
        <TabsContent value="compare">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Select Player 1</CardTitle>
              </CardHeader>
              <CardContent className="max-h-64 overflow-y-auto">
                {players.slice(0, 10).map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlayer(p)}
                    className={cn(
                      'w-full flex items-center gap-3 p-2 rounded-lg text-left text-sm transition-colors',
                      selectedPlayer?.id === p.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
                    )}
                  >
                    <span className="font-medium">{p.name}</span>
                    <Badge variant="outline" className={cn('text-[9px] ml-auto', getPositionColor(p.position))}>{p.position}</Badge>
                  </button>
                ))}
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Select Player 2</CardTitle>
              </CardHeader>
              <CardContent className="max-h-64 overflow-y-auto">
                {players.slice(0, 10).map(p => (
                  <button
                    key={p.id}
                    onClick={() => setComparePlayer(p)}
                    className={cn(
                      'w-full flex items-center gap-3 p-2 rounded-lg text-left text-sm transition-colors',
                      comparePlayer?.id === p.id ? 'bg-orange-500/10 text-orange-400' : 'hover:bg-accent'
                    )}
                  >
                    <span className="font-medium">{p.name}</span>
                    <Badge variant="outline" className={cn('text-[9px] ml-auto', getPositionColor(p.position))}>{p.position}</Badge>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
          {selectedPlayer && comparePlayer && (
            <Card className="glass-card mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-center">
                  {selectedPlayer.name} vs {comparePlayer.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="h-56">
                    <p className="text-xs text-center text-primary mb-1">{selectedPlayer.name}</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={Object.entries(generateRadarStats(selectedPlayer)).map(([k, v]) => ({ stat: k, value: v }))}>
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis dataKey="stat" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8 }} stroke="hsl(var(--muted-foreground))" />
                        <Radar dataKey="value" stroke="#00e676" fill="#00e676" fillOpacity={0.15} strokeWidth={2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-56">
                    <p className="text-xs text-center text-orange-400 mb-1">{comparePlayer.name}</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={Object.entries(generateRadarStats(comparePlayer)).map(([k, v]) => ({ stat: k, value: v }))}>
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis dataKey="stat" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8 }} stroke="hsl(var(--muted-foreground))" />
                        <Radar dataKey="value" stroke="#ff5252" fill="#ff5252" fillOpacity={0.15} strokeWidth={2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Market Value Tracker */}
        <TabsContent value="value">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" /> Market Value Tracker (€M)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topByValue} layout="vertical" barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" unit="M" />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={110} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => `€${v}M`} />
                    <Bar dataKey="marketValue" fill="#00e676" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Positional Breakdown */}
        <TabsContent value="positions">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(positionalGroups).map(([pos, group]) => {
              const avgRating = (group.reduce((s, p) => s + p.rating, 0) / group.length).toFixed(1)
              const totalGoals = group.reduce((s, p) => s + p.goals, 0)
              const totalAssists = group.reduce((s, p) => s + p.assists, 0)
              return (
                <Card key={pos} className="glass-card">
                  <CardHeader className="pb-2">
                    <Badge variant="outline" className={cn('w-fit', getPositionColor(pos))}>{pos}</Badge>
                    <span className="text-xs text-muted-foreground">{group.length} players</span>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Avg Rating</span>
                      <span className={cn('font-bold', getRatingColor(parseFloat(avgRating)))}>{avgRating}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Goals</span>
                      <span className="font-bold">{totalGoals}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Assists</span>
                      <span className="font-bold">{totalAssists}</span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Age Distribution */}
        <TabsContent value="age">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Age Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageData} barSize={40}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="range" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" fill="#00e676" radius={[4, 4, 0, 0]} name="Players" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Nationality Mix */}
        <TabsContent value="nationality">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Nationality Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-96 overflow-y-auto">
              {nationalities.map(([nat, count]) => (
                <div key={nat} className="flex items-center gap-3">
                  <span className="text-sm w-24 shrink-0 truncate">{nat}</span>
                  <div className="flex-1 h-3 rounded-full bg-muted/50 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / players.length) * 100}%` }}
                      className="h-full bg-primary/70 rounded-full"
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Card Accumulation */}
        <TabsContent value="cards">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Card Accumulation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead className="text-center">Yellow</TableHead>
                      <TableHead className="text-center">Red</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...players].sort((a, b) => (b.yellowCards + b.redCards) - (a.yellowCards + a.redCards)).slice(0, 15).map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">{p.name}</TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="text-yellow-400 border-yellow-400/30">{p.yellowCards}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="text-red-400 border-red-400/30">{p.redCards}</Badge></TableCell>
                        <TableCell className="text-center font-bold">{p.yellowCards + p.redCards}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Substitution Frequency */}
        <TabsContent value="subs">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Substitution Frequency</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {players.slice(0, 10).map(p => {
                  const startPct = 75
                  const subPct = 100 - startPct
                  return (
                    <div key={p.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="truncate">{p.name}</span>
                        <span className="text-muted-foreground">{startPct}% starter</span>
                      </div>
                      <div className="flex h-2 rounded-full overflow-hidden bg-muted/50">
                        <div className="bg-primary/70" style={{ width: `${startPct}%` }} />
                        <div className="bg-orange-500/60" style={{ width: `${subPct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Player Similarity Finder */}
        <TabsContent value="similar">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="glass-card lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Select Player</CardTitle>
              </CardHeader>
              <CardContent className="max-h-64 overflow-y-auto">
                {players.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlayer(p)}
                    className={cn(
                      'w-full flex items-center gap-2 p-2 rounded text-left text-sm transition-colors',
                      selectedPlayer?.id === p.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
                    )}
                  >
                    <span className="truncate">{p.name}</span>
                    <Badge variant="outline" className={cn('text-[9px] ml-auto shrink-0', getPositionColor(p.position))}>{p.position}</Badge>
                  </button>
                ))}
              </CardContent>
            </Card>
            <Card className="glass-card lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Similar Players</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedPlayer ? (
                  <div className="space-y-3">
                    {similarPlayers.length > 0 ? similarPlayers.map(({ player, similarity }) => (
                      <div key={player.id} className="flex items-center gap-4 p-3 rounded-lg bg-card/50 border border-border/30">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-sm">{player.number}</div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">{player.name}</div>
                          <div className="text-[10px] text-muted-foreground">{player.position} · {player.teamName}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-primary">{similarity}%</div>
                          <div className="text-[10px] text-muted-foreground">similar</div>
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No similar players found</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Select a player to find similar profiles</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Player Form Chart */}
        <TabsContent value="form">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" /> Player Form (Recent Matches)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={FORM_CHART_DATA(selectedPlayer?.name || 'Mbappé')}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="match" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis domain={[5, 10]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="rating" stroke="#00e676" strokeWidth={2} dot={{ fill: '#00e676', r: 4 }} />
                    <ReferenceLine y={7} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">Rating trend for {selectedPlayer?.name || 'selected player'}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Player Detail Panel (Slide-over) */}
      <AnimatePresence>
        {selectedPlayer && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-background border-l border-border z-50 overflow-y-auto shadow-2xl"
          >
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Player Detail</h2>
                <Button variant="ghost" size="icon" onClick={() => setSelectedPlayer(null)}>
                  <X className="size-4" />
                </Button>
              </div>

              <div className="text-center space-y-3">
                <div className="w-24 h-24 mx-auto rounded-full bg-muted flex items-center justify-center text-3xl font-bold border-4 border-primary/30" style={{ borderColor: selectedPlayer.teamColor }}>
                  {selectedPlayer.number}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedPlayer.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedPlayer.teamName} · {selectedPlayer.position}</p>
                  <p className="text-xs text-muted-foreground mt-1">{selectedPlayer.nationality} · Age {selectedPlayer.age}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Rating', value: selectedPlayer.rating.toFixed(1), color: getRatingColor(selectedPlayer.rating) },
                  { label: 'Goals', value: selectedPlayer.goals, color: 'text-primary' },
                  { label: 'Assists', value: selectedPlayer.assists, color: 'text-primary' },
                  { label: 'Appearances', value: selectedPlayer.appearances || '-', color: 'text-foreground' },
                  { label: 'Minutes', value: selectedPlayer.minutesPlayed || '-', color: 'text-foreground' },
                  { label: 'Market Value', value: selectedPlayer.marketValue ? `€${selectedPlayer.marketValue}M` : '-', color: 'text-primary' },
                ].map(item => (
                  <Card key={item.label} className="glass-card">
                    <CardContent className="p-3 text-center">
                      <div className="text-[10px] text-muted-foreground">{item.label}</div>
                      <div className={cn('text-xl font-bold', item.color)}>{item.value}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="h-48">
                <p className="text-xs text-muted-foreground mb-2 text-center">Attribute Radar</p>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={Object.entries(generateRadarStats(selectedPlayer)).map(([k, v]) => ({ stat: k, value: v }))}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="stat" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8 }} stroke="hsl(var(--muted-foreground))" />
                    <Radar dataKey="value" stroke="#00e676" fill="#00e676" fillOpacity={0.15} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <Button variant="outline" className="w-full gap-2" onClick={() => { setSelectedPlayer(null); setComparePlayer(selectedPlayer) }}>
                <ArrowUpDown className="size-4" /> Use for Comparison
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default PlayerView