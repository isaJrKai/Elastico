/*
 * ELASTICO Header — Minimal context bar (Phase 3 refined)
 *
 * Shows only what's needed at a glance:
 *   - Mobile: hamburger + title
 *   - Desktop: title, live indicator, search, notifications, user menu
 *
 * Design tokens applied:
 *   - Title: 15px semibold (between TYPE.h3 and TYPE.body)
 *   - KBD: TYPE.monoSm (11px mono)
 *   - Live pill: uses MATCH_STATUS.live colors concept
 *   - Height: 48px (12 × 4px grid)
 */

'use client'

import {
  Search, Bell, Menu, User as UserIcon, Settings, LogOut, Zap, Crown, Sun, Moon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useElasticoStore } from '@/store/use-elastico-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

// ── Header Layout Tokens ───────────────────────────────────────────────────
// Height: 48px = 12 × 4px grid

const HEADER = {
  height: 'h-12',           // 48px
  iconBtn: 'size-[18px]',   // action icon size
  avatar: 'size-8',          // 32px avatar in dropdown
  bellSize: 'size-[18px]',   // notification bell
} as const

// ── View titles (no abbreviations) ───────────────────────────────────────

const viewTitles: Record<string, string> = {
  dashboard:          'Dashboard',
  matches:            'Live Matches',
  'match-detail':     'Match Analysis',
  predictions:        'Predictions',
  tournament:         'Standings',
  leaderboard:        'Leaderboard',
  'ai-chat':          'AI Chat',
  news:               'News',
  admin:              'Admin Panel',
  settings:           'Settings',
  subscription:       'Subscription',
  notifications:      'Notifications',
  profile:            'Profile',
  tactical:           'Tactical Analysis',
  login:              'Welcome',
  'prediction-engine':'Prediction Engine',
  players:            'Players',
  compare:            'Compare',
  achievements:       'Achievements',
  export:             'Export',
  social:             'Social',
  'system-monitor':   'System Monitor',
}

// ── Plan badge styles ─────────────────────────────────────────────────────

const planBadgeCls: Record<string, string> = {
  free:  'bg-secondary text-muted-foreground border-border',
  pro:   'bg-primary/15 text-primary border-primary/30',
  elite: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
}

// ── Header Component ──────────────────────────────────────────────────────

export function Header() {
  const user = useElasticoStore(s => s.user)
  const currentView = useElasticoStore(s => s.currentView)
  const matches = useElasticoStore(s => s.matches)
  const notifications = useElasticoStore(s => s.notifications)
  const sidebarOpen = useElasticoStore(s => s.sidebarOpen)
  const setSidebarOpen = useElasticoStore(s => s.setSidebarOpen)
  const setView = useElasticoStore(s => s.setView)
  const logout = useElasticoStore(s => s.logout)
  const toggleCommandPalette = useElasticoStore(s => s.toggleCommandPalette)
  const isMobile = useIsMobile()
  const { theme, setTheme } = useTheme()

  const liveCount = matches.filter(m => m.status === 'live').length
  const unreadCount = notifications.filter(n => !n.isRead).length
  const title = viewTitles[currentView] || 'ELASTICO'
  const plan = user?.plan?.toLowerCase() || 'free'
  const badgeCls = planBadgeCls[plan] || planBadgeCls.free

  const getInitials = (name: string) => {
    const p = name.trim().split(/\s+/)
    return p.length === 1 ? p[0].substring(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
  }

  return (
    <header className={cn(
      'sticky top-0 z-30 flex items-center gap-3 px-4 border-b border-border bg-background/80 backdrop-blur-xl md:px-6',
      HEADER.height,
    )}>
      {/* Mobile hamburger */}
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle menu"
        >
          <Menu className="size-5" />
        </Button>
      )}

      {/* View title — 15px between TYPE.h3(16px) and TYPE.body(14px) */}
      <h1 className="text-[15px] font-semibold text-foreground tracking-tight truncate">
        {title}
      </h1>

      <div className="flex-1" />

      {/* Right-side actions */}
      <div className="flex items-center gap-2">
        {/* Live indicator pill */}
        {liveCount > 0 && (
          <div className="flex items-center gap-2 rounded-full bg-red-500/10 border border-red-500/20 px-3 py-1">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-red-500" />
            </span>
            <span className="text-[11px] font-bold text-red-400 tracking-wide">{liveCount} LIVE</span>
          </div>
        )}

        {/* Search — desktop */}
        <div className="hidden sm:block">
          <Button
            variant="outline"
            className="h-8 gap-2 rounded-lg border-border bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground px-3 text-[13px] max-w-[180px] lg:max-w-[220px] justify-start cursor-pointer"
            onClick={toggleCommandPalette}
          >
            <Search className="size-3.5 shrink-0" />
            <span className="truncate">Search...</span>
            {/* KBD uses monoSm pattern: 10px mono */}
            <kbd className="ml-auto hidden lg:inline-flex rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              ⌘K
            </kbd>
          </Button>
        </div>

        {/* Search — mobile */}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground"
            onClick={toggleCommandPalette}
            aria-label="Search"
          >
            <Search className="size-5" />
          </Button>
        )}

        {/* Notifications bell */}
        {user && currentView !== 'login' && (
          <Button
            variant="ghost"
            size="icon"
            className="relative shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setView('notifications')}
            aria-label="Notifications"
          >
            <Bell className={HEADER.bellSize} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex size-4.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-50" />
                <span className="relative inline-flex size-[18px] items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {unreadCount > 99 ? '99' : unreadCount}
                </span>
              </span>
            )}
          </Button>
        )}

        {/* Theme toggle */}
        {user && currentView !== 'login' && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className={HEADER.iconBtn} /> : <Moon className={HEADER.iconBtn} />}
          </Button>
        )}

        {/* User dropdown */}
        {user && currentView !== 'login' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative size-8 rounded-full p-0 hover:ring-2 hover:ring-primary/30 transition-colors"
                aria-label="User menu"
              >
                <Avatar className={HEADER.avatar}>
                  <AvatarImage src={user.avatarUrl || undefined} alt={user.displayName || user.name || ''} />
                  <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                    {getInitials(user.displayName || user.name || user.email)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover border-border rounded-lg" sideOffset={8}>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1.5 py-1">
                  <div className="flex items-center gap-2.5">
                    <Avatar className={cn(HEADER.avatar, 'size-9')}>
                      <AvatarImage src={user.avatarUrl || undefined} alt={user.displayName || user.name || ''} />
                      <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                        {getInitials(user.displayName || user.name || user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <p className="text-sm font-medium leading-tight text-popover-foreground">
                        {user.displayName || user.name || 'User'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'w-fit h-5 rounded-md px-1.5 text-[10px] font-bold tracking-wider uppercase gap-1',
                      badgeCls,
                    )}
                  >
                    {plan === 'elite' ? <Crown className="size-3" /> : plan === 'pro' ? <Zap className="size-3" /> : null}
                    {user.plan || 'Free'} Plan
                  </Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setView('profile')} className="cursor-pointer text-muted-foreground focus:text-popover-foreground focus:bg-accent">
                  <UserIcon className="size-4 mr-2" />Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setView('settings')} className="cursor-pointer text-muted-foreground focus:text-popover-foreground focus:bg-accent">
                  <Settings className="size-4 mr-2" />Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setView('subscription')} className="cursor-pointer text-muted-foreground focus:text-popover-foreground focus:bg-accent">
                  <Crown className="size-4 mr-2" />Subscription
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem variant="destructive" onClick={logout} className="cursor-pointer">
                <LogOut className="size-4 mr-2" />Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
