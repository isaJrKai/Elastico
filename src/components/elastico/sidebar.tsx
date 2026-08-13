'use client'

import { useEffect, useCallback } from 'react'
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
  Command,
  GitCompareArrows,
  Award,
  Download,
  MessageCircle,
  Brain,
  Activity,
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
  badge?: string
  badgeCount?: number
  adminOnly?: boolean
}

// ── Navigation Items ──────────────────────────────────────────────────────

const mainNav: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', view: 'dashboard' },
  { icon: Swords, label: 'Live Matches', view: 'matches', badge: 'live' },
  { icon: Target, label: 'Predictions', view: 'predictions' },
  { icon: Trophy, label: 'Standings', view: 'tournament' },
  { icon: BarChart3, label: 'Leaderboard', view: 'leaderboard' },
  { icon: MessageSquare, label: 'AI Chat', view: 'ai-chat' },
  { icon: Newspaper, label: 'News', view: 'news' },
]

const analysisNav: NavItem[] = [
  { icon: Brain, label: 'Prediction Engine', view: 'prediction-engine' },
  { icon: Target, label: 'Tactical', view: 'tactical', badge: 'soon' },
  { icon: Users, label: 'Players', view: 'players' },
  { icon: GitCompareArrows, label: 'Compare', view: 'compare' },
  { icon: Award, label: 'Achievements', view: 'achievements', badge: 'soon' },
  { icon: Download, label: 'Export', view: 'export' },
  { icon: MessageCircle, label: 'Social', view: 'social', badge: 'soon' },
]

const bottomNav: NavItem[] = [
  { icon: Settings, label: 'Settings', view: 'settings' },
  { icon: Bell, label: 'Notifications', view: 'notifications', badgeCount: 0 },
  { icon: CreditCard, label: 'Subscription', view: 'subscription' },
  { icon: Shield, label: 'Admin Panel', view: 'admin', adminOnly: true },
  { icon: Activity, label: 'System Monitor', view: 'system-monitor', adminOnly: true },
]

// ── Section Label ─────────────────────────────────────────────────────────

function SectionLabel({ children, collapsed }: { children: string; collapsed: boolean }) {
  if (collapsed) return null
  return (
    <div className="px-3 pt-4 pb-1.5">
      <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/60">
        {children}
      </span>
    </div>
  )
}

// ── Plan Badge ────────────────────────────────────────────────────────────

const planStyles: Record<string, string> = {
  free: 'bg-muted text-muted-foreground border-border',
  pro: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
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

  const renderNav = (items: NavItem[], section?: string) => (
    <>
      {section && <SectionLabel collapsed={collapsed}>{section}</SectionLabel>}
      <ul className="flex flex-col gap-0.5 px-2" role="list">
        {items.map(item => {
          if (item.adminOnly && user?.role !== 'admin') return null
          const active = currentView === item.view
          const Icon = item.icon

          const btn = (
            <button
              key={item.view}
              onClick={() => handleNav(item.view)}
              className={cn(
                'group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200',
                'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'bg-sidebar-accent text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                collapsed && !isMobile && 'justify-center px-0',
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
              )}
              <Icon className={cn(
                'size-[18px] shrink-0 transition-colors',
                active ? 'text-sidebar-primary' : 'text-muted-foreground group-hover:text-sidebar-foreground',
              )} />
              {(!collapsed || isMobile) && (
                <>
                  <span className="truncate">{item.label}</span>
                  {item.badge === 'soon' && (
                    <Badge variant="secondary" className="ml-auto h-5 rounded-full px-1.5 text-[9px] font-semibold bg-muted text-muted-foreground border-border">
                      Soon
                    </Badge>
                  )}
                  {item.badge === 'live' && liveCount > 0 && (
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-red-500" />
                      </span>
                      <Badge variant="secondary" className="h-5 min-w-5 rounded-full px-1.5 text-[10px] font-bold bg-red-500/15 text-red-400 border-red-500/30">
                        {liveCount}
                      </Badge>
                    </span>
                  )}
                  {item.view === 'notifications' && unreadCount > 0 && (
                    <Badge variant="secondary" className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-[10px] font-bold bg-primary/15 text-primary border-primary/30">
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
        })}
      </ul>
    </>
  )

  return (
    <>
      {isMobile && isOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={handleOverlay} aria-hidden="true" />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-50 flex h-screen flex-col border-r border-border transition-all duration-300 ease-in-out',
          'bg-sidebar',
          'md:relative md:z-0',
          isMobile && (isOpen ? 'translate-x-0' : '-translate-x-full'),
          !isMobile && (isOpen ? 'w-[260px]' : 'w-[64px]'),
          isMobile && 'w-[280px]',
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 px-4 border-b border-border">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
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
              className={cn('ml-auto size-7 shrink-0 text-muted-foreground hover:text-foreground', collapsed && 'ml-0 mx-auto')}
              onClick={() => setSidebarOpen(!isOpen)}
              aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {isOpen ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
            </Button>
          )}
        </div>

        {/* Scrollable nav area */}
        <div className="flex-1 overflow-y-auto py-2">
          {renderNav(mainNav, 'Main')}
          <div className="mx-3 my-2 h-px bg-white/[0.06]" />
          {renderNav(analysisNav, 'Analysis')}
          <div className="mx-3 my-2 h-px bg-white/[0.06]" />
          {renderNav(bottomNav, 'System')}
        </div>

        {/* Command palette shortcut */}
        <div className="border-t border-border px-2 py-2">
          <Button
            variant="ghost"
            className={cn(
              'w-full text-sm transition-colors',
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

        {/* User profile */}
        {user && (
          <div className={cn(
            'flex items-center gap-2.5 border-t border-border px-3 py-3',
            collapsed && !isMobile && 'justify-center px-2',
          )}>
            <Avatar className="size-8 shrink-0">
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
                    className={cn('w-fit h-4 rounded px-1.5 text-[9px] font-semibold leading-none', planStyles[user.plan?.toLowerCase()] || planStyles.free)}
                  >
                    {(user.plan || 'Free').toUpperCase()}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" className="size-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={logout} aria-label="Logout">
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
