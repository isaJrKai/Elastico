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
} from 'recharts'
import { useElasticoStore, type Player } from '@/store/use-elastico-store'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { axisProps, cartesianGridProps, tooltipContentStyle, tooltipLabelStyle, chartColor } from '@/lib/chart-theme'
import { StatusBadge, FlagIcon, SectionHeader, DataState, StatBlock, TeamCrest, PlayerHeadshot } from '@/components/elastico/primitives'

// ── Types ──────────────────────────────────────────────────────────────────────

interface EnhancedPlayer extends Player {
  teamName?: string
  teamCode?: string
  teamColor?: string
  nationality?: string
  appearances?: number
  minutesPlayed?: number
}
// ── Helpers ────────────────────────────────────────────────────────────────────

// Radar chart removed: generateRadarStats was producing entirely fabricated per-position
// attribute values with no data source. The function has been replaced with null returns.
// When real per-player advanced metrics (pressures, sprints, pass completion, etc.) become
// available from a database-backed source, radar charts can be rebuilt from that data.
// See: PR-016 in the acceptance report for details.

// ── Component ──────────────────────────────────────────────────────────────────

export function PlayerView() {
  const teams = useElasticoStore(s => s.teams)
  const token = useElasticoStore(s => s.token)
  const [players, setPlayers] = useState<EnhancedPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [league, setLeague] = useState('PL')
  const [search, setSearch] = useState('')
  const [positionFilter, setPositionFilter] = useState<string>('all')
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('rating')
  const [selectedPlayer, setSelectedPlayer] = useState<EnhancedPlayer | null>(null)
  const [comparePlayer, setComparePlayer] = useState<EnhancedPlayer | null>(null)
  const [page, setPage] = useState(0)
  const perPage = 12

  // Fetch players — always fetch from API with league param, fallback to ESPN
  useEffect(() => {
    let cancelled = false
    async function fetchPlayers() {
      setLoading(true)
      setPlayers([])
      setTeamFilter('all')
      try {
        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`
        const params = new URLSearchParams()
        params.set('league', league)
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
      } catch (err) {
        console.warn('[PlayerView] DB player fetch failed, falling back to ESPN:', err)
      }

      // ESPN fallback: fetch teams for selected league, then fetch rosters
      try {
        const activeLeague = league
        const teamsRes = await fetch(`/api/live?action=teams&league=${activeLeague}`)
        const teamsData = await teamsRes.json()
        const espnTeams = teamsData.data || teamsData.teams || []

        if (espnTeams.length === 0) return

        // Fetch rosters for up to 6 teams (to avoid too many requests)
        const allPlayers: EnhancedPlayer[] = []
        const teamsToFetch = espnTeams.slice(0, 6)

        await Promise.allSettled(teamsToFetch.map(async (t: any) => {
          try {
            const rosterRes = await fetch(`/api/live?action=roster&league=${activeLeague}&team=${t.id}`)
            if (!rosterRes.ok) return
            const rosterData = await rosterRes.json()
            const athletes = rosterData.data || rosterData.athletes || []
            for (const a of athletes) {
              allPlayers.push({
                id: String(a.id || ''),
                name: a.name || a.displayName || 'Unknown',
                position: a.position || 'MID',
                age: a.age ?? null,
                nationality: a.nationality || '',
                rating: null, // ESPN roster API does not provide match ratings
                goals: a.goals ?? null,
                assists: a.assists ?? null,
                teamName: t.name,
                teamCode: t.abbreviation || t.code,
                teamColor: t.color || '#00e676',
                teamId: String(t.id || ''),
                appearances: a.appearances ?? null,
                minutesPlayed: null,
                number: a.shirtNumber ?? a.jersey ?? a.number ?? null,
                shirtNumber: a.shirtNumber ?? a.jersey ?? a.number ?? null,
              } as unknown as EnhancedPlayer)
            }
          } catch (err) { console.warn('[PlayerView] Failed to fetch roster for team:', err) }
        }))

        if (allPlayers.length > 0 && !cancelled) setPlayers(allPlayers)
      } catch (err) {
        console.error('[PlayerView] ESPN fallback also failed:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchPlayers()
    return () => { cancelled = true }
  }, [token, league, sortBy, positionFilter, search])

  // Derived data
  const filteredPlayers = useMemo(() => {
    let result = [...players]
    if (search) result = result.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    if (positionFilter !== 'all') result = result.filter(p => p.position === positionFilter)
    if (teamFilter !== 'all') result = result.filter(p => p.teamName === teamFilter)
    result.sort((a, b) => {
      if (sortBy === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
      if (sortBy === 'goals') return (b.goals ?? 0) - (a.goals ?? 0)
      if (sortBy === 'assists') return (b.assists ?? 0) - (a.assists ?? 0)
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'age') return (a.age ?? 99) - (b.age ?? 99)
      if (sortBy === 'marketValue') return (b.marketValue ?? 0) - (a.marketValue ?? 0)
      return 0
    })
    return result
  }, [players, search, positionFilter, teamFilter, sortBy])

  const pagedPlayers = filteredPlayers.slice(page * perPage, (page + 1) * perPage)
  const totalPages = Math.ceil(filteredPlayers.length / perPage)

  const topScorers = useMemo(() => [...players].sort((a, b) => b.goals - a.goals).slice(0, 10), [players])
  const topByValue = useMemo(() => [...players].filter(p => p.marketValue).sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0)).slice(0, 10), [players])

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
      if (!p.age) continue // skip players with unknown age — no fabrication
      if (p.age <= 21) buckets['18-21']++
      else if (p.age <= 25) buckets['22-25']++
      else if (p.age <= 29) buckets['26-29']++
      else if (p.age <= 33) buckets['30-33']++
      else buckets['34+']++
    }
    return Object.entries(buckets).map(([range, count]) => ({ range, count }))
  }, [players])

  const nationalities = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of players) {
      const nat = p.nationality || 'Unknown'
      map[nat] = (map[nat] ?? 0) + 1
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [players])

  const uniqueTeams = useMemo(() => [...new Set(players.map(p => p.teamName).filter(Boolean))], [players])

  // Similar players — based on same position and comparable goal/assist output
  // (radar-based similarity removed: generated stats were fabricated)
  const similarPlayers = useMemo(() => {
    if (!selectedPlayer) return []
    return players
      .filter(p => p.id !== selectedPlayer.id && p.position === selectedPlayer.position)
      .map(p => {
        const goalDiff = Math.abs(p.goals - selectedPlayer.goals) * 3
        const assistDiff = Math.abs(p.assists - selectedPlayer.assists) * 2
        const ratingDiff = (p.rating != null && selectedPlayer.rating != null) ? Math.abs(p.rating - selectedPlayer.rating) * 5 : 25
        const totalDiff = goalDiff + assistDiff + ratingDiff
        return { player: p, similarity: Math.max(0, 100 - Math.round(totalDiff)) }
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
        <p className="text-muted-foreground text-sm">Search, analyze, and compare football players</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      {/* League Selector */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={league} onValueChange={(v) => { setLeague(v); setPage(0) }}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Select league" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PL">Premier League</SelectItem>
            <SelectItem value="LIGA">La Liga</SelectItem>
            <SelectItem value="SA">Serie A</SelectItem>
            <SelectItem value="BL">Bundesliga</SelectItem>
            <SelectItem value="L1">Ligue 1</SelectItem>
            <SelectItem value="UCL">Champions League</SelectItem>
          </SelectContent>
        </Select>
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

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground">Fetching {league} players…</span>
        </div>
      )}

      {!loading && players.length === 0 && (
        <Card className="rounded-lg border border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="size-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-sm font-medium mb-1">No players found</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Select a league above to browse players. Data is fetched from ESPN when the database is empty.
              Try switching to a different league if the current one returned no results.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && players.length > 0 && (
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
                <Card className="rounded-lg border border-border bg-card h-full overflow-hidden">
                  <div className="h-2" style={{ backgroundColor: player.teamColor || '#00e676' }} />
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-lg font-bold shrink-0 border-2 border-border">
                        {player.number}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold truncate">{player.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <FlagIcon nationality={player.nationality} size={16} />
                          <Badge variant="outline" className={cn('text-[10px]', getPositionColor(player.position))}>
                            {player.position}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground truncate">{player.teamName}</span>
                        </div>
                      </div>
                      <div className={cn('text-xl font-bold', player.rating != null && player.rating > 0 ? getRatingColor(player.rating) : 'text-muted-foreground')}>
                        {player.rating != null && player.rating > 0 ? player.rating.toFixed(1) : 'N/A'}
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
          <Card className="rounded-lg border border-border bg-card">
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
                            <FlagIcon nationality={p.nationality} size={16} />
                            <span className="text-sm font-medium">{p.name}</span>
                            <Badge variant="outline" className={cn('text-[9px]', getPositionColor(p.position))}>{p.position}</Badge>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{p.teamName}</span>
                        </TableCell>
                        <TableCell className="text-center font-bold text-primary">{p.goals}</TableCell>
                        <TableCell className="text-center">{p.assists}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{p.minutesPlayed ?? (p.appearances ?? 0) * 90}</TableCell>
                        <TableCell className="text-center font-medium">
                          {(p.goals / Math.max(1, (p.minutesPlayed ?? (p.appearances ?? 0) * 90) / 90)).toFixed(2)}
                        </TableCell>
                        <TableCell className={cn('text-center font-bold', p.rating != null && p.rating > 0 ? getRatingColor(p.rating) : 'text-muted-foreground')}>{p.rating != null && p.rating > 0 ? p.rating.toFixed(1) : '—'}</TableCell>
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
          <Card className="rounded-lg border border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Award className="size-4 text-primary" /> Player Radar Charts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {topScorers.slice(0, 6).map((player) => (                  <Card key={player.id} className="rounded-lg border border-border bg-card border-border/30">
                    <CardContent className="p-3">
                      <h4 className="text-sm font-semibold text-center mb-1">{player.name}</h4>
                      <p className="text-[10px] text-center text-muted-foreground mb-2">{player.position} · {player.teamName}</p>
                      <div className="h-48 flex items-center justify-center">
                        <DataState type="empty" message="Advanced player metrics unavailable. Radar requires real per-player data (pressures, sprints, pass completion)." />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Player Comparison */}
        <TabsContent value="compare">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="rounded-lg border border-border bg-card">
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
            <Card className="rounded-lg border border-border bg-card">
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
            <Card className="rounded-lg border border-border bg-card mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-center">
                  {selectedPlayer.name} vs {comparePlayer.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataState type="empty" message="Player radar comparison unavailable. Advanced per-player metrics (pace, pressing, sprint distance) are not available from current data sources." />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Market Value Tracker */}
        <TabsContent value="value">
          <Card className="rounded-lg border border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" /> Market Value Tracker (€M)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topByValue} layout="vertical" barSize={18}>
                    <CartesianGrid {...cartesianGridProps} />
                    <XAxis type="number" {...axisProps} tick={{ ...axisProps.tick, fontSize: 10 }} unit="M" />
                    <YAxis dataKey="name" type="category" {...axisProps} tick={{ ...axisProps.tick, fontSize: 10 }} width={110} />
                    <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} formatter={(v: number) => `€${v}M`} />
                    <Bar dataKey="marketValue" fill={chartColor(0)} radius={[0, 4, 4, 0]} />
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
              const rated = group.filter(p => p.rating != null && p.rating > 0)
              const avgRating = rated.length > 0 ? (rated.reduce((s, p) => s + p.rating!, 0) / rated.length).toFixed(1) : 'N/A'
              const totalGoals = group.reduce((s, p) => s + p.goals, 0)
              const totalAssists = group.reduce((s, p) => s + p.assists, 0)
              return (
                <Card key={pos} className="rounded-lg border border-border bg-card">
                  <CardHeader className="pb-2">
                    <Badge variant="outline" className={cn('w-fit', getPositionColor(pos))}>{pos}</Badge>
                    <span className="text-xs text-muted-foreground">{group.length} players</span>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Avg Rating</span>
                      <div className="flex items-center gap-1">
                        <span className={cn('font-bold', getRatingColor(parseFloat(avgRating)))}>{avgRating}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Total Goals</span>
                      <div className="flex items-center gap-1">
                        <span className="font-bold">{totalGoals}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Total Assists</span>
                      <div className="flex items-center gap-1">
                        <span className="font-bold">{totalAssists}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Age Distribution */}
        <TabsContent value="age">
          <Card className="rounded-lg border border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Age Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageData} barSize={40}>
                    <CartesianGrid {...cartesianGridProps} />
                    <XAxis dataKey="range" {...axisProps} />
                    <YAxis {...axisProps} />
                    <Tooltip contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} />
                    <Bar dataKey="count" fill={chartColor(0)} radius={[4, 4, 0, 0]} name="Players" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Nationality Mix */}
        <TabsContent value="nationality">
          <Card className="rounded-lg border border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Nationality Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-96 overflow-y-auto">
              {nationalities.map(([nat, count]) => (
                <div key={nat} className="flex items-center gap-3">
                  <FlagIcon nationality={nat} size={16} showLabel className="w-28 shrink-0" />
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
          <Card className="rounded-lg border border-border bg-card">
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
          <Card className="rounded-lg border border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Substitution Frequency</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Users className="size-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">Substitution data not available</p>
                <p className="text-xs mt-1">Per-player substitution frequency requires a dedicated data source (e.g., API-Sports player statistics with sub_on/sub_off fields).</p>
                <StatusBadge variant="dataclass" value="UNAVAILABLE" className="mt-2" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Player Similarity Finder */}
        <TabsContent value="similar">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="rounded-lg border border-border bg-card lg:col-span-1">
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
            <Card className="rounded-lg border border-border bg-card lg:col-span-2">
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
                          <div className="flex items-center gap-1 justify-end">
                            <span className="text-lg font-bold text-primary">{similarity}%</span>
                            <StatusBadge variant="dataclass" value="DERIVED" />
                          </div>
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
          <Card className="rounded-lg border border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" /> Player Form (Recent Matches)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <TrendingUp className="size-8 text-muted-foreground/50 mb-3" />
                <p className="text-sm font-medium text-foreground">Form Rating Data</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">Per-match rating history is not available from the current data source.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      )}

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
                <Button variant="ghost" size="icon" onClick={() => setSelectedPlayer(null)} aria-label="Close player detail">
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
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <FlagIcon nationality={selectedPlayer.nationality} size={16} />
                    <span className="text-xs text-muted-foreground">{selectedPlayer.nationality} · Age {selectedPlayer.age}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Rating', value: selectedPlayer.rating != null && selectedPlayer.rating > 0 ? selectedPlayer.rating.toFixed(1) : 'N/A', color: selectedPlayer.rating != null && selectedPlayer.rating > 0 ? getRatingColor(selectedPlayer.rating) : 'text-muted-foreground' },
                  { label: 'Goals', value: selectedPlayer.goals, color: 'text-primary' },
                  { label: 'Assists', value: selectedPlayer.assists, color: 'text-primary' },
                  { label: 'Appearances', value: selectedPlayer.appearances || '-', color: 'text-foreground' },
                  { label: 'Minutes', value: selectedPlayer.minutesPlayed || '-', color: 'text-foreground' },
                  { label: 'Market Value', value: selectedPlayer.marketValue ? `€${selectedPlayer.marketValue}M` : '-', color: 'text-primary' },
                ].map(item => (
                  <Card key={item.label} className="rounded-lg border border-border bg-card">
                    <CardContent className="p-3 text-center">
                      <div className="text-[10px] text-muted-foreground">{item.label}</div>
                      <div className={cn('text-xl font-bold', item.color)}>{item.value}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="h-48 flex items-center justify-center">
                <DataState type="empty" message="Attribute radar unavailable — no advanced per-player metrics source." />
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