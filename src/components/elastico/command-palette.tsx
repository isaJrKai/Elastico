'use client'
import { useState, useEffect, useCallback } from 'react'
import { useElasticoStore, type View } from '@/store/use-elastico-store'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import {
  LayoutDashboard, Trophy, Swords, Newspaper, MessageSquare, Settings,
  Shield, Bell, CreditCard, BarChart3, Target, Users, Search, ArrowRight
} from 'lucide-react'

const viewItems: { view: View; label: string; icon: any; category: string; shortcut: string }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, category: 'Navigation', shortcut: '⌘D' },
  { view: 'matches', label: 'Live Matches', icon: Swords, category: 'Navigation', shortcut: '⌘M' },
  { view: 'predictions', label: 'Predictions', icon: Target, category: 'Navigation', shortcut: '⌘P' },
  { view: 'tournament', label: 'Tournament Bracket', icon: Trophy, category: 'Navigation', shortcut: '⌘T' },
  { view: 'leaderboard', label: 'Leaderboard', icon: BarChart3, category: 'Navigation', shortcut: '⌘L' },
  { view: 'ai-chat', label: 'AI Chat', icon: MessageSquare, category: 'Navigation', shortcut: '⌘C' },
  { view: 'news', label: 'News Feed', icon: Newspaper, category: 'Navigation', shortcut: '⌘N' },
  { view: 'settings', label: 'Settings', icon: Settings, category: 'Navigation', shortcut: '⌘,' },
  { view: 'notifications', label: 'Notifications', icon: Bell, category: 'Navigation', shortcut: '⌘B' },
  { view: 'subscription', label: 'Subscription', icon: CreditCard, category: 'Navigation', shortcut: '' },
  { view: 'admin', label: 'Admin Panel', icon: Shield, category: 'Admin', shortcut: '' },
  { view: 'profile', label: 'Profile', icon: Users, category: 'Navigation', shortcut: '' },
]

export default function CommandPalette() {
  const commandPaletteOpen = useElasticoStore(s => s.commandPaletteOpen)
  const setCommandPaletteOpen = useElasticoStore(s => s.setCommandPaletteOpen)
  const setView = useElasticoStore(s => s.setView)
  const matches = useElasticoStore(s => s.matches)
  const selectMatch = useElasticoStore(s => s.selectMatch)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (commandPaletteOpen) setQuery('')
  }, [commandPaletteOpen])

  const handleSelect = useCallback((item: any) => {
    if (item.view) setView(item.view)
    else if (item.matchId) selectMatch(item.matchId)
    setCommandPaletteOpen(false)
  }, [setView, selectMatch, setCommandPaletteOpen])

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
          meta: `${m.stage} ${m.status === 'live' ? '🔴 LIVE' : m.status === 'upcoming' ? 'Upcoming' : 'Finished'}`,
        }))
    : []

  const navResults = query.length > 0
    ? viewItems.filter(v => v.label.toLowerCase().includes(query.toLowerCase()))
    : viewItems

  const results = [...navResults.map(v => ({ id: `nav-${v.view}`, label: v.label, icon: v.icon, category: v.category, view: v.view, meta: v.shortcut })), ...matchResults]

  return (
    <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 bg-background/95 backdrop-blur-xl border-border/50">
        <div className="flex items-center border-b border-border/50 px-4">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Search matches, navigate, or type a command..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="border-0 focus-visible:ring-0 h-12 bg-transparent px-0"
            autoFocus
          />
          <kbd className="pointer-events-none ml-2 inline-flex h-5 select-none items-center gap-1 rounded border border-border/50 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-[300px] overflow-y-auto px-2 py-2">
          {results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No results found.</p>
          ) : (
            <>
              {query.length === 0 && (
                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Navigation</p>
              )}
              {results.map(item => (
                <button
                  key={item.id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-accent/50 transition-colors text-left group"
                  onClick={() => handleSelect(item)}
                >
                  <item.icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                  <span className="flex-1">{item.label}</span>
                  <div className="flex items-center gap-2">
                    {item.meta && <span className="text-xs text-muted-foreground">{item.meta}</span>}
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
        <div className="border-t border-border/50 px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>⌘K Toggle</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}