'use client'
import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { useElasticoStore, type View } from '@/store/use-elastico-store'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent
} from '@/components/ui/dialog'
import {
  LayoutDashboard, Trophy, Swords, Newspaper, MessageSquare, Settings,
  Shield, Bell, CreditCard, BarChart3, Target, Users, Search, ArrowRight,
  Crosshair, GitCompareArrows, Brain, Activity, Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Command palette items — mirrors sidebar workflow groups ─────────────

const viewItems: { view: View; label: string; icon: React.ElementType; category: string; shortcut: string }[] = [
  // Intelligence (core match-day)
  { view: 'dashboard',         label: 'Dashboard',         icon: LayoutDashboard,   category: 'Intelligence', shortcut: '⌘D' },
  { view: 'matches',           label: 'Live Matches',      icon: Swords,            category: 'Intelligence', shortcut: '⌘M' },
  { view: 'match-detail',      label: 'Match Analysis',    icon: Crosshair,         category: 'Intelligence', shortcut: '' },
  // Analysis (deep-dive tools)
  { view: 'tactical',          label: 'Tactical',          icon: Target,            category: 'Analysis',     shortcut: '⌘T' },
  { view: 'players',           label: 'Players',           icon: Users,             category: 'Analysis',     shortcut: '' },
  { view: 'compare',           label: 'Compare',           icon: GitCompareArrows,  category: 'Analysis',     shortcut: '' },
  { view: 'predictions',       label: 'Predictions',       icon: Target,            category: 'Analysis',     shortcut: '⌘P' },
  { view: 'prediction-engine', label: 'Pred. Engine',      icon: Brain,             category: 'Analysis',     shortcut: '' },
  // Leagues (competition context)
  { view: 'tournament',        label: 'Standings',         icon: Trophy,            category: 'Leagues',      shortcut: '⌘S' },
  { view: 'leaderboard',       label: 'Leaderboard',       icon: BarChart3,         category: 'Leagues',      shortcut: '⌘L' },
  // Tools (utilities)
  { view: 'ai-chat',           label: 'AI Chat',           icon: MessageSquare,     category: 'Tools',        shortcut: '⌘C' },
  { view: 'news',              label: 'News',              icon: Newspaper,         category: 'Tools',        shortcut: '⌘N' },
  { view: 'export',            label: 'Export',            icon: Download,          category: 'Tools',        shortcut: '' },
  // System (app management)
  { view: 'settings',          label: 'Settings',          icon: Settings,          category: 'System',       shortcut: '⌘,' },
  { view: 'notifications',     label: 'Notifications',     icon: Bell,              category: 'System',       shortcut: '⌘B' },
  { view: 'subscription',      label: 'Subscription',      icon: CreditCard,        category: 'System',       shortcut: '' },
  { view: 'profile',           label: 'Profile',           icon: Users,             category: 'System',       shortcut: '' },
  // Admin (role-restricted)
  { view: 'admin',             label: 'Admin Panel',       icon: Shield,            category: 'Admin',        shortcut: '' },
  { view: 'system-monitor',    label: 'System Monitor',    icon: Activity,          category: 'Admin',        shortcut: '' },
]

// ── Component ────────────────────────────────────────────────────────────

export default function CommandPalette() {
  const commandPaletteOpen = useElasticoStore(s => s.commandPaletteOpen)
  const setCommandPaletteOpen = useElasticoStore(s => s.setCommandPaletteOpen)
  const setView = useElasticoStore(s => s.setView)
  const matches = useElasticoStore(s => s.matches)
  const selectMatch = useElasticoStore(s => s.selectMatch)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Reset state on open/close
  useEffect(() => {
    if (commandPaletteOpen) { setQuery(''); setActiveIndex(0) }
  }, [commandPaletteOpen])

  // Reset selection on query change
  useEffect(() => { setActiveIndex(0) }, [query])

  const handleSelect = useCallback((item: any) => {
    if (item.view) setView(item.view)
    else if (item.matchId) selectMatch(item.matchId)
    setCommandPaletteOpen(false)
  }, [setView, selectMatch, setCommandPaletteOpen])

  // Global keyboard listener for ⌘K and Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(!commandPaletteOpen)
      }
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [commandPaletteOpen, setCommandPaletteOpen])

  // Fuzzy match against team names for match search
  const matchResults = query.length > 1
    ? matches
        .filter(m => {
          const ht = m.homeTeam?.name?.toLowerCase() || ''
          const at = m.awayTeam?.name?.toLowerCase() || ''
          return ht.includes(query.toLowerCase()) || at.includes(query.toLowerCase())
        })
        .slice(0, 5)
        .map(m => ({
          id: `match-${m.id}`,
          label: `${m.homeTeam?.name || 'TBD'} vs ${m.awayTeam?.name || 'TBD'}`,
          icon: Swords,
          category: 'Matches',
          matchId: m.id,
          meta: `${m.stage} ${m.status === 'live' ? 'LIVE' : m.status === 'upcoming' ? 'Upcoming' : 'Finished'}`,
        }))
    : []

  // Filter nav items by query, or show all when no query
  const navResults = query.length > 0
    ? viewItems.filter(v => v.label.toLowerCase().includes(query.toLowerCase()))
    : viewItems

  const results = [
    ...navResults.map(v => ({ id: `nav-${v.view}`, label: v.label, icon: v.icon, category: v.category, view: v.view, meta: v.shortcut })),
    ...matchResults,
  ]

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault()
      handleSelect(results[activeIndex])
    }
  }, [activeIndex, results, handleSelect])

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return
    const active = listRef.current.querySelector('[aria-selected="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // ── Render a single result row ───────────────────────────────────────
  const renderItem = (item: any, idx: number) => (
    <button
      key={item.id}
      role="option"
      aria-selected={activeIndex === idx}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left group',
        activeIndex === idx ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
      )}
      onClick={() => handleSelect(item)}
      onMouseEnter={() => setActiveIndex(idx)}
    >
      <item.icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
      <span className="flex-1">{item.label}</span>
      <div className="flex items-center gap-2">
        {item.meta && <span className="text-xs text-muted-foreground">{item.meta}</span>}
        <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
      </div>
    </button>
  )

  // ── Render grouped list (no query) ───────────────────────────────────
  const renderGrouped = () => {
    let lastCat = ''
    return results.map((item, idx) => {
      const showCat = item.category !== lastCat
      lastCat = item.category
      return (
        <Fragment key={item.id}>
          {showCat && (
            <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              {item.category}
            </p>
          )}
          {renderItem(item, idx)}
        </Fragment>
      )
    })
  }

  return (
    <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 bg-popover border-border" onOpenAutoFocus={(e) => { e.preventDefault(); }}>
        {/* Search input */}
        <div className="flex items-center border-b border-border/50 px-4">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Search matches, navigate, or type a command..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-0 focus-visible:ring-0 h-12 bg-transparent px-0"
            autoFocus
          />
          <kbd className="pointer-events-none ml-2 inline-flex h-5 select-none items-center gap-1 rounded border border-border/50 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="max-h-[300px] overflow-y-auto px-2 py-2" role="listbox">
          {results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No results found.</p>
          ) : query.length === 0 ? (
            renderGrouped()
          ) : (
            results.map((item, idx) => renderItem(item, idx))
          )}
        </div>

        {/* Footer hints */}
        <div className="border-t border-border/50 px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>⌘K Toggle</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
