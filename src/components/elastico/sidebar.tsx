/*
 * ELASTICO Sidebar — Workflow-grouped navigation (Phase 3 refined)
 *
 * Navigation organized by football intelligence workflow:
 *   INTELLIGENCE — core match-day (dashboard, live, match detail)
 *   ANALYSIS     — deep-dive tools (tactical, players, compare, predictions, engine)
 *   LEAGUES      — competition context (standings, leaderboard)
 *   TOOLS        — utilities (AI chat, news, export, social)
 *   SYSTEM       — app management (settings, notifications, subscription, achievements, admin, monitor)
 *
 * Design rules:
 *   - Active: 3px left bar in sidebar-primary
 *   - Collapsed: icon-only with tooltips, 60px wide (15 × 4px grid)
 *   - Expanded: 256px wide (64 × 4px grid)
 *   - Mobile: 280px slide-over with backdrop
 *   - Max 7 items per section
 *   - All sizes from ELASTICO design system tokens
 */

'use client'

import { useEffect, useCallback } from 'react'
import {
  LayoutDashboard,
  Swords,
  Newspaper,
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
  Command,
  GitCompareArrows,
  Download,
  MessageCircle,
  Brain,
  Activity,
  Trophy,
  MessageSquare,
  Crosshair,
  TrendingUp,
  Award,
  UsersRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useElasticoStore, type View } from '@/store/use-elastico-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

interface NavItem {
  icon: React.ElementType
  label: string
  view: View
  badge?: 'live' | 'soon'
  adminOnly?: boolean
}

interface NavGroup {
  id: string
  label: string
  items: NavItem[]
}

// ── Sidebar Layout Tokens ──────────────────────────────────────────────────
// Aligned to 4px grid. Expanded = 64 units. Collapsed = 15 units.

const SIDEBAR = {
  expandedW: 'w-[256px]',
  collapsedW: 'w-[60px]',
  mobileW: 'w-[280px]',
  headerH: 'h-14',          // 56px = 14 × 4px
  iconSize: 'size-[18px]',   // nav icon size
  collapsedIcon: 'size-5',   // slightly larger when icon-only
  logoBox: 'size-8',          // 32px logo container
  avatarSize: 'size-8',       // 32px user avatar
} as const

// ── Navigation Groups (workflow-based) ─────────────────────────────────────

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'intelligence',
    label: 'Intelligence',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard',     view: 'dashboard' },
      { icon: Swords,         label: 'Live Matches',   view: 'matches', badge: 'live' },
      { icon: Crosshair,      label: 'Match Analysis', view: 'match-detail' },
    ],
  },
  {
    id: 'analysis',
    label: 'Analysis',
    items: [
      { icon: Target,           label: 'Tactical',     view: 'tactical' },
      { icon: Users,            label: 'Players',      view: 'players' },
      { icon: GitCompareArrows, label: 'Compare',      view: 'compare' },
      { icon: TrendingUp,       label: 'Predictions',  view: 'predictions' },
      { icon: Brain,            label: 'Pred. Engine', view: 'prediction-engine' },
    ],
  },
  {
    id: 'leagues',
    label: 'Leagues',
    items: [
      { icon: Trophy,    label: 'Standings',   view: 'tournament' },
      { icon: BarChart3, label: 'Leaderboard', view: 'leaderboard' },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    items: [
      { icon: MessageSquare, label: 'AI Chat',   view: 'ai-chat' },
      { icon: Newspaper,     label: 'News',       view: 'news' },
      { icon: UsersRound,    label: 'Social',     view: 'social' },
      { icon: Download,      label: 'Export',     view: 'export' },
    ],
  },
]

const SYSTEM_ITEMS: NavItem[] = [
  { icon: Settings,  label: 'Settings',       view: 'settings' },
  { icon: Bell,      label: 'Notifications',  view: 'notifications' },
  { icon: Award,     label: 'Achievements',    view: 'achievements' },
  { icon: CreditCard,label: 'Subscription',    view: 'subscription' },
  { icon: Shield,    label: 'Admin Panel',     view: 'admin',        adminOnly: true },
  { icon: Activity,  label: 'System Monitor', view: 'system-monitor', adminOnly: true },
]

// ── Section Label ─────────────────────────────────────────────────────────
// Uses TYPE.micro (10px) from design system

function SectionLabel({ children, collapsed }: { children: string; collapsed: boolean }) {
  if (collapsed) return null
  return (
    <div className="px-3 pt-5 pb-1.5">
      <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/50">
        {children}
      </span>
    </div>
  )
}

// ── Plan Badge ────────────────────────────────────────────────────────────

const planStyles: Record<string, string> = {
  free:  'bg-muted text-muted-foreground border-border',
  pro:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  elite: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
}

// ── Sidebar ───────────────────────────────────────────────────────────────

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

  const liveCount = matches.filter(m => m.status === 'live').length
  const unreadCount = notifications.filter(n => !n.isRead).length

  const handleNav = useCallback((view: View) => {
    setView(view)
    if (isMobile) setSidebarOpen(false)
  }, [setView, isMobile, setSidebarOpen])

  const handleOverlay = useCallback(() => {
    if (isMobile) setSidebarOpen(false)
  }, [isMobile, setSidebarOpen])

  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
  }, [isMobile, setSidebarOpen])

  const isOpen = sidebarOpen
  const collapsed = !isOpen

  // ── Nav item renderer ──────────────────────────────────────────────────
  const renderNavItem = (item: NavItem) => {
    if (item.adminOnly && user?.role !== 'admin') return null
    const active = currentView === item.view
    const Icon = item.icon

    const btn = (
      <button
        key={item.view}
        onClick={() => handleNav(item.view)}
        className={cn(
          'group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors duration-150',
          'outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active
            ? 'bg-sidebar-accent text-sidebar-primary-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
          collapsed && !isMobile && 'justify-center px-0',
        )}
      >
        {/* Active left indicator — 3px bar */}
        {active && (
          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
        )}
        <Icon className={cn(
          'shrink-0 transition-colors',
          collapsed && !isMobile ? SIDEBAR.collapsedIcon : SIDEBAR.iconSize,
          active ? 'text-sidebar-primary' : 'text-muted-foreground group-hover:text-sidebar-foreground',
        )} />
        {(!collapsed || isMobile) && (
          <>
            <span className="truncate">{item.label}</span>
            {item.badge === 'soon' && (
              <Badge variant="secondary" className="ml-auto h-4.5 rounded-full px-1.5 text-[9px] font-semibold bg-muted text-muted-foreground border-border">
                Soon
              </Badge>
            )}
            {item.badge === 'live' && liveCount > 0 && (
              <span className="ml-auto flex items-center gap-1.5">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-red-500" />
                </span>
                <Badge variant="secondary" className="h-4.5 min-w-5 rounded-full px-1.5 text-[10px] font-bold bg-red-500/15 text-red-400 border-red-500/30">
                  {liveCount}
                </Badge>
              </span>
            )}
            {item.view === 'notifications' && unreadCount > 0 && (
              <Badge variant="secondary" className="ml-auto h-4.5 min-w-5 rounded-full px-1.5 text-[10px] font-bold bg-primary/15 text-primary border-primary/30">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </>
        )}
      </button>
    )

    if (collapsed && !isMobile) {
      return (
        <Tooltip key={item.view}>
          <TooltipTrigger asChild>{btn}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}><p>{item.label}</p></TooltipContent>
        </Tooltip>
      )
    }
    return btn
  }

  // ── Group renderer ─────────────────────────────────────────────────────
  const renderGroup = (group: NavGroup) => (
    <div key={group.id}>
      <SectionLabel collapsed={collapsed}>{group.label}</SectionLabel>
      <ul className="flex flex-col gap-0.5 px-2" role="list">
        {group.items.map(renderNavItem)}
      </ul>
    </div>
  )

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={handleOverlay}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-50 flex h-screen flex-col border-r border-border transition-all duration-300 ease-in-out',
          'bg-sidebar',
          'md:relative md:z-0',
          // Mobile: slide in/out
          isMobile && (isOpen ? 'translate-x-0' : '-translate-x-full'),
          isMobile && SIDEBAR.mobileW,
          // Desktop: collapsed or expanded
          !isMobile && (isOpen ? SIDEBAR.expandedW : SIDEBAR.collapsedW),
        )}
      >
        {/* ── Logo ──────────────────────────────────────────────────── */}
        <div className={cn('flex items-center gap-2.5 px-4 border-b border-border', SIDEBAR.headerH)}>
          <div className={cn('flex items-center justify-center rounded-lg bg-primary/10', SIDEBAR.logoBox)}>
            <Zap className="size-4 text-primary" />
          </div>
          {(!collapsed || isMobile) && (
            <span className="text-base font-bold tracking-tight text-sidebar-primary-foreground whitespace-nowrap">
              ELASTICO
            </span>
          )}
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'ml-auto size-7 shrink-0 text-muted-foreground hover:text-foreground',
                collapsed && 'ml-0 mx-auto',
              )}
              onClick={() => setSidebarOpen(!isOpen)}
              aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {isOpen ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
            </Button>
          )}
        </div>

        {/* ── Scrollable nav area ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto py-1">
          {NAV_GROUPS.map(renderGroup)}

          {/* System separator */}
          <div className="mx-3 my-2 h-px bg-white/[0.06]" />
          <SectionLabel collapsed={collapsed}>System</SectionLabel>
          <ul className="flex flex-col gap-0.5 px-2" role="list">
            {SYSTEM_ITEMS.map(renderNavItem)}
          </ul>
        </div>

        {/* ── Command palette shortcut ───────────────────────────────── */}
        <div className="border-t border-border px-2 py-2">
          <Button
            variant="ghost"
            className={cn(
              'w-full text-[13px] transition-colors',
              collapsed && !isMobile
                ? 'justify-center text-muted-foreground hover:text-foreground'
                : 'justify-start gap-2.5 text-muted-foreground hover:text-foreground',
            )}
            onClick={toggleCommandPalette}
          >
            <Command className="size-4" />
            {(!collapsed || isMobile) && (
              <>
                <span>Search</span>
                <kbd className="ml-auto rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                  ⌘K
                </kbd>
              </>
            )}
          </Button>
        </div>

        {/* ── User profile ───────────────────────────────────────────── */}
        {user && (
          <div className={cn(
            'flex items-center gap-2.5 border-t border-border px-3 py-3',
            collapsed && !isMobile && 'justify-center px-2',
          )}>
            <Avatar className={cn('shrink-0', SIDEBAR.avatarSize)}>
              <AvatarImage src={user.avatarUrl || undefined} alt={user.displayName || user.name || ''} />
              <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                {getInitials(user.displayName || user.name || user.email)}
              </AvatarFallback>
            </Avatar>
            {(!collapsed || isMobile) && (
              <>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium leading-tight text-sidebar-primary-foreground">
                    {user.displayName || user.name || 'User'}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'w-fit h-4 rounded px-1.5 text-[9px] font-semibold leading-none',
                      planStyles[user.plan?.toLowerCase()] || planStyles.free,
                    )}
                  >
                    {(user.plan || 'Free').toUpperCase()}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={logout}
                  aria-label="Logout"
                >
                  <LogOut className="size-3.5" />
                </Button>
              </>
            )}
          </div>
        )}
      </aside>
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
