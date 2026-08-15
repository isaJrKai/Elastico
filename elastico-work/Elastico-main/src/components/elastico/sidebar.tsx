'use client'

import { useEffect, useCallback, useState } from 'react'
import {
  LayoutDashboard,
  Trophy,
  Swords,
  Newspaper,
  MessageSquare,
  Settings,
  Shield,
  Bell,
  CreditCard,
  BarChart3,
  Target,
  Users,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Zap,
  Search,
  Command,
  GitCompareArrows,
  Award,
  Download,
  MessageCircle,
  Brain,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useElasticoStore, type View } from '@/store/use-elastico-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

// ── Navigation Item Type ─────────────────────────────────────────────────────

interface NavItem {
  icon: React.ElementType
  label: string
  view: View
  badge?: string
  badgeCount?: number
  adminOnly?: boolean
}

// ── Main Navigation Items ────────────────────────────────────────────────────

const mainNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', view: 'dashboard' },
  { icon: Swords, label: 'Matches', view: 'matches', badge: 'live' },
  { icon: Target, label: 'Predictions', view: 'predictions' },
  { icon: Trophy, label: 'Tournament', view: 'tournament' },
  { icon: BarChart3, label: 'Leaderboard', view: 'leaderboard' },
  { icon: MessageSquare, label: 'AI Chat', view: 'ai-chat' },
  { icon: Newspaper, label: 'News', view: 'news' },
]

const extraNavItems: NavItem[] = [
  { icon: Brain, label: 'Prediction Engine', view: 'prediction-engine' },
  { icon: Target, label: 'Tactical', view: 'tactical' },
  { icon: Users, label: 'Players', view: 'players' },
  { icon: GitCompareArrows, label: 'Compare', view: 'compare' },
  { icon: Award, label: 'Achievements', view: 'achievements' },
  { icon: Download, label: 'Export', view: 'export' },
  { icon: MessageCircle, label: 'Social', view: 'social' },
  { icon: Shield, label: 'System Monitor', view: 'system-monitor', adminOnly: true },
]


// ── Bottom Navigation Items ──────────────────────────────────────────────────

interface BottomNavItem {
  icon: React.ElementType
  label: string
  view: View
  badgeCount?: number
  adminOnly?: boolean
}

const bottomNavItems: BottomNavItem[] = [
  { icon: Settings, label: 'Settings', view: 'settings' },
  { icon: Bell, label: 'Notifications', view: 'notifications', badgeCount: 0 },
  { icon: CreditCard, label: 'Subscription', view: 'subscription' },
  { icon: Shield, label: 'Admin Panel', view: 'admin', adminOnly: true },
]

// ── Plan Badge Config ───────────────────────────────────────────────────────

const planBadgeConfig: Record<string, { className: string }> = {
  free: {
    className: 'bg-muted text-muted-foreground border-border',
  },
  pro: {
    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  elite: {
    className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  },
}

// ── Sidebar Component ────────────────────────────────────────────────────────

export function Sidebar() {
  const user = useElasticoStore(s => s.user)
  const currentView = useElasticoStore(s => s.currentView)
  const sidebarOpen = useElasticoStore(s => s.sidebarOpen)
  const setSidebarOpen = useElasticoStore(s => s.setSidebarOpen)
  const setView = useElasticoStore(s => s.setView)
  const logout = useElasticoStore(s => s.logout)
  const matches = useElasticoStore(s => s.matches)
  const notifications = useElasticoStore(s => s.notifications)
  const toggleCommandPalette = useElasticoStore(s => s.toggleCommandPalette)

  const isMobile = useIsMobile()

  // Count live matches (status === 'live')
  const liveMatchCount = matches.filter((m) => m.status === 'live').length

  // Count unread notifications
  const unreadCount = notifications.filter((n) => !n.isRead).length

  // Close sidebar on mobile when an item is clicked
  const handleNavClick = useCallback(
    (view: View) => {
      setView(view)
      if (isMobile) {
        setSidebarOpen(false)
      }
    },
    [setView, isMobile, setSidebarOpen],
  )

  // Auto-close sidebar on mobile when overlay is clicked
  const handleOverlayClick = useCallback(() => {
    if (isMobile) {
      setSidebarOpen(false)
    }
  }, [isMobile, setSidebarOpen])

  // Close sidebar when switching to mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false)
    }
  }, [isMobile, setSidebarOpen])

  const [analysisOpen, setAnalysisOpen] = useState(() => {
    const view = useElasticoStore.getState().currentView
    return ['prediction-engine', 'tactical', 'players', 'compare', 'achievements', 'export', 'social', 'system-monitor'].includes(view)
  })

  // Auto-open analysis when navigating to an analysis view
  useEffect(() => {
    if (['prediction-engine', 'tactical', 'players', 'compare', 'achievements', 'export', 'social', 'system-monitor'].includes(currentView)) {
      setAnalysisOpen(true)
    }
  }, [currentView])

  const isOpen = sidebarOpen
  const isCollapsed = !isOpen

  return (
    <>
      {/* ── Mobile Overlay ────────────────────────────────────────────────── */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar Panel ────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 flex h-screen flex-col border-r transition-all duration-300 ease-in-out',
          'glass-card border-border',
          // Desktop: transform-based collapse
          'md:relative md:z-0',
          // Mobile: overlay positioning
          isMobile && (isOpen ? 'translate-x-0' : '-translate-x-full'),
          // Desktop: width based on collapse state
          !isMobile && (isOpen ? 'w-[240px]' : 'w-[64px]'),
          isMobile && 'w-[280px]',
        )}
      >
        {/* ── Logo Area ────────────────────────────────────────────────────── */}
        <div className="flex h-14 items-center gap-2 px-3">
          <Zap className="size-6 shrink-0 text-primary" />
          {(!isCollapsed || isMobile) && (
            <span className="gradient-text animate-elastico-glow text-lg font-bold tracking-tight whitespace-nowrap">
              ⚽ ELASTICO
            </span>
          )}
          {/* Collapse toggle (desktop only) */}
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'ml-auto size-7 shrink-0',
                isCollapsed && 'ml-0 mx-auto',
              )}
              onClick={() => setSidebarOpen(!isOpen)}
              aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {isOpen ? (
                <ChevronLeft className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </Button>
          )}
        </div>

        <Separator className="opacity-50" />

        {/* ── Main Navigation ───────────────────────────────────────────────── */}
        <nav className="overflow-y-auto px-2 py-3" aria-label="Main navigation">
          <ul className="flex flex-col gap-1" role="list">
            {mainNavItems.map((item) => {
              const isActive = currentView === item.view
              const Icon = item.icon

              const button = (
                <button
                  key={item.view}
                  onClick={() => handleNavClick(item.view)}
                  className={cn(
                    'group relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-200',
                    'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'bg-primary/10 text-primary shadow-sm shadow-primary/5'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    isCollapsed && !isMobile && 'justify-center px-0',
                  )}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                  )}

                  <Icon
                    className={cn(
                      'size-[18px] shrink-0 transition-colors',
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                    )}
                  />

                  {(!isCollapsed || isMobile) && (
                    <>
                      <span className="truncate">{item.label}</span>

                      {/* Live match badge */}
                      {item.badge === 'live' && liveMatchCount > 0 && (
                        <span className="ml-auto flex items-center gap-1.5">
                          <span className="relative flex size-2">
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex size-2 rounded-full bg-red-500" />
                          </span>
                          <Badge
                            variant="secondary"
                            className="h-5 min-w-5 rounded-full px-1.5 text-[10px] font-bold bg-red-500/15 text-red-400 border-red-500/30"
                          >
                            {liveMatchCount}
                          </Badge>
                        </span>
                      )}
                    </>
                  )}

                  {/* Collapsed live indicator dot */}
                  {item.badge === 'live' && liveMatchCount > 0 && isCollapsed && !isMobile && (
                    <span className="absolute -top-0.5 -right-0.5 flex size-2.5">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-red-500 border-2 border-background" />
                    </span>
                  )}
                </button>
              )

              // Wrap with tooltip when collapsed (desktop)
              if (isCollapsed && !isMobile) {
                return (
                  <Tooltip key={item.view}>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      <p>{item.label}</p>
                      {item.badge === 'live' && liveMatchCount > 0 && (
                        <span className="text-red-400 ml-1">
                          ({liveMatchCount} live)
                        </span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                )
              }

              return button
            })}
          </ul>
        </nav>

        <Separator className="opacity-50" />

        {/* ── Analysis Navigation (collapsible) ────────────────────────────── */}
        <nav className="px-2 py-1" aria-label="Analysis navigation">
          <button
            onClick={() => setAnalysisOpen(!analysisOpen)}
            className={cn(
              'group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground transition-colors',
              isCollapsed && !isMobile && 'justify-center px-0',
            )}
          >
            {(!isCollapsed || isMobile) && (
              <>
                <span>Analysis Tools</span>
                <svg
                  className={cn('ml-auto size-3.5 transition-transform duration-200', analysisOpen && 'rotate-180')}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
            {isCollapsed && !isMobile && <Brain className="size-[18px] text-muted-foreground/50" />}
          </button>
          {analysisOpen && (
            <ul className="flex flex-col gap-1 mt-1" role="list">
            {extraNavItems.map((item) => {
              // Hide admin-only items for non-admins
              if (item.adminOnly && user?.role !== 'admin') return null

              const isActive = currentView === item.view
              const Icon = item.icon

              const button = (
                <button
                  key={item.view}
                  onClick={() => handleNavClick(item.view)}
                  className={cn(
                    'group relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-200',
                    'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'bg-primary/10 text-primary shadow-sm shadow-primary/5'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    isCollapsed && !isMobile && 'justify-center px-0',
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                  )}
                  <Icon
                    className={cn(
                      'size-[18px] shrink-0 transition-colors',
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                    )}
                  />
                  {(!isCollapsed || isMobile) && (
                    <span className="truncate">{item.label}</span>
                  )}
                </button>
              )

              if (isCollapsed && !isMobile) {
                return (
                  <Tooltip key={item.view}>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      <p>{item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                )
              }

              return button
            })}
          </ul>
          )}
        </nav>

        <Separator className="opacity-50" />

        {/* ── Bottom Navigation ────────────────────────────────────────────── */}
        <nav className="px-2 py-3" aria-label="Secondary navigation">
          <ul className="flex flex-col gap-1" role="list">
            {bottomNavItems.map((item) => {
              // Hide admin-only items for non-admins
              if (item.adminOnly && user?.role !== 'admin') return null

              const isActive = currentView === item.view
              const Icon = item.icon

              // Compute badge count dynamically
              const badgeNum =
                item.view === 'notifications' ? unreadCount : item.badgeCount

              const button = (
                <button
                  key={item.view}
                  onClick={() => handleNavClick(item.view)}
                  className={cn(
                    'group relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-200',
                    'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'bg-primary/10 text-primary shadow-sm shadow-primary/5'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    isCollapsed && !isMobile && 'justify-center px-0',
                  )}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                  )}

                  <Icon
                    className={cn(
                      'size-[18px] shrink-0 transition-colors',
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                    )}
                  />

                  {(!isCollapsed || isMobile) && (
                    <>
                      <span className="truncate">{item.label}</span>

                      {/* Unread notification badge */}
                      {item.view === 'notifications' && unreadCount > 0 && (
                        <Badge
                          variant="secondary"
                          className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-[10px] font-bold bg-primary/15 text-primary border-primary/30"
                        >
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </Badge>
                      )}
                    </>
                  )}

                  {/* Collapsed notification dot */}
                  {item.view === 'notifications' && unreadCount > 0 && isCollapsed && !isMobile && (
                    <span className="absolute -top-0.5 -right-0.5 flex size-2.5">
                      <span className="relative inline-flex size-2.5 rounded-full bg-primary border-2 border-background" />
                    </span>
                  )}
                </button>
              )

              // Wrap with tooltip when collapsed (desktop)
              if (isCollapsed && !isMobile) {
                return (
                  <Tooltip key={item.view}>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      <p>{item.label}</p>
                      {item.view === 'notifications' && unreadCount > 0 && (
                        <span className="text-primary ml-1">
                          ({unreadCount})
                        </span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                )
              }

              return button
            })}
          </ul>
        </nav>

        <Separator className="opacity-50" />

        {/* ── User Profile ─────────────────────────────────────────────────── */}
        {user && (
          <div
            className={cn(
              'flex items-center gap-2.5 px-3 py-3 transition-all duration-200',
              isCollapsed && !isMobile && 'justify-center px-2',
            )}
          >
            <Avatar className="size-8 shrink-0">
              <AvatarImage src={user.avatarUrl || undefined} alt={user.displayName || user.name || ''} />
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                {getInitials(user.displayName || user.name || user.email)}
              </AvatarFallback>
            </Avatar>

            {(!isCollapsed || isMobile) && (
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium leading-tight">
                  {user.displayName || user.name || 'User'}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'w-fit h-5 rounded-md px-1.5 text-[10px] font-semibold leading-none',
                    planBadgeConfig[user.plan?.toLowerCase()]?.className || planBadgeConfig.free.className,
                  )}
                >
                  {(user.plan || 'Free').toUpperCase()}
                </Badge>
              </div>
            )}

            {(!isCollapsed || isMobile) && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto size-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={logout}
                aria-label="Logout"
              >
                <LogOut className="size-4" />
              </Button>
            )}

            {/* Collapsed logout */}
            {isCollapsed && !isMobile && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={logout}
                    aria-label="Logout"
                  >
                    <LogOut className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p>Logout</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}

        {/* ── Command Palette Shortcut (collapsed) ─────────────────────────── */}
        {isCollapsed && !isMobile && (
          <div className="px-2 pb-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full justify-center text-muted-foreground hover:text-foreground"
                  onClick={toggleCommandPalette}
                >
                  <Command className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                <p>Command Palette</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* ── Command Palette Shortcut (expanded) ──────────────────────────── */}
        {(!isCollapsed || isMobile) && (
          <div className="px-2 pb-3">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2.5 text-muted-foreground hover:text-foreground text-sm"
              onClick={toggleCommandPalette}
            >
              <Command className="size-4" />
              <span>Search</span>
              <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                ⌘K
              </kbd>
            </Button>
          </div>
        )}
      </aside>
    </>
  )
}

// ── Helper: Get initials from name ───────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
