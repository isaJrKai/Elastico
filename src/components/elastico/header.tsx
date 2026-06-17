'use client'

import { useCallback } from 'react'
import {
  Search,
  Bell,
  Menu,
  User as UserIcon,
  Settings,
  LogOut,
  Zap,
  Crown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useElasticoStore } from '@/store/use-elastico-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

// ── View Title Map ──────────────────────────────────────────────────────────

const viewTitleMap: Record<string, string> = {
  dashboard: 'Dashboard',
  matches: 'Live Matches',
  'match-detail': 'Match Details',
  predictions: 'Predictions',
  tournament: 'Tournament',
  leaderboard: 'Leaderboard',
  'ai-chat': 'AI Chat',
  news: 'News',
  admin: 'Admin Panel',
  settings: 'Settings',
  subscription: 'Subscription',
  notifications: 'Notifications',
  profile: 'Profile',
  tactical: 'Tactical Analysis',
  login: 'Welcome',
}

// ── Plan Color Config ─────────────────────────────────────────────────────────

const planStyles: Record<string, { badge: string; icon: string }> = {
  free: {
    badge: 'bg-muted text-muted-foreground border-border',
    icon: 'text-muted-foreground',
  },
  pro: {
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: 'text-emerald-400',
  },
  elite: {
    badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    icon: 'text-yellow-400',
  },
}

// ── Header Component ─────────────────────────────────────────────────────────

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

  // Count live matches
  const liveMatchCount = matches.filter((m) => m.status === 'live').length

  // Count unread notifications
  const unreadCount = notifications.filter((n) => !n.isRead).length

  // Page title
  const pageTitle = viewTitleMap[currentView] || 'ELASTICO'

  // Current plan
  const plan = user?.plan?.toLowerCase() || 'free'
  const planStyle = planStyles[plan] || planStyles.free

  // Handle search input focus → open command palette
  const handleSearchFocus = useCallback(() => {
    toggleCommandPalette()
  }, [toggleCommandPalette])

  // Toggle mobile sidebar
  const handleMobileMenu = useCallback(() => {
    setSidebarOpen(!sidebarOpen)
  }, [setSidebarOpen, sidebarOpen])

  // Get user initials
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-14 items-center gap-3 px-4 border-b transition-all duration-300',
        'glass-card border-border',
        // Account for sidebar width on desktop
        !isMobile && 'md:px-6',
      )}
    >
      {/* ── Mobile Menu Button ───────────────────────────────────────────────── */}
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={handleMobileMenu}
          aria-label="Toggle menu"
        >
          <Menu className="size-5" />
        </Button>
      )}

      {/* ── Page Title ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {!isMobile && currentView !== 'login' && (
          <Zap className="size-4 text-primary" />
        )}
        <h1 className="text-lg font-semibold tracking-tight truncate">
          {currentView === 'login' ? (
            <span className="gradient-text">⚽ ELASTICO</span>
          ) : (
            pageTitle
          )}
        </h1>
      </div>

      {/* ── Spacer ────────────────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Right Section ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* ── Live Match Indicator ───────────────────────────────────────────── */}
        {liveMatchCount > 0 && (
          <div className="flex items-center gap-2 rounded-full bg-red-500/10 border border-red-500/20 px-3 py-1">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-red-500" />
            </span>
            <span className="text-xs font-bold text-red-400 tracking-wide">
              {liveMatchCount} LIVE
            </span>
          </div>
        )}

        {/* ── Search Bar ─────────────────────────────────────────────────────── */}
        <div className="hidden sm:block relative">
          <Button
            variant="outline"
            className="h-8 gap-2 rounded-lg border-border bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground px-3 text-sm w-[220px] lg:w-[280px] justify-start cursor-pointer"
            onClick={toggleCommandPalette}
            aria-label="Search"
          >
            <Search className="size-3.5 shrink-0" />
            <span className="truncate text-muted-foreground">Search...</span>
            <kbd className="ml-auto hidden lg:inline-flex rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              ⌘K
            </kbd>
          </Button>
        </div>

        {/* ── Mobile Search Button ─────────────────────────────────────────── */}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={toggleCommandPalette}
            aria-label="Search"
          >
            <Search className="size-5" />
          </Button>
        )}

        {/* ── Plan Badge ────────────────────────────────────────────────────── */}
        {user && currentView !== 'login' && (
          <Badge
            variant="outline"
            className={cn(
              'hidden md:inline-flex h-6 rounded-md px-2 text-[10px] font-bold tracking-wider uppercase gap-1',
              planStyle.badge,
            )}
          >
            {plan === 'elite' ? (
              <Crown className="size-3" />
            ) : plan === 'pro' ? (
              <Zap className="size-3" />
            ) : null}
            {user.plan || 'Free'}
          </Badge>
        )}

        {/* ── Notification Bell ─────────────────────────────────────────────── */}
        {user && currentView !== 'login' && (
          <Button
            variant="ghost"
            size="icon"
            className="relative shrink-0"
            onClick={() => setView('notifications')}
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          >
            <Bell className="size-[18px]" />
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

        {/* ── User Avatar Dropdown ──────────────────────────────────────────── */}
        {user && currentView !== 'login' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative size-8 rounded-full p-0 hover:ring-2 hover:ring-primary/30 transition-all"
                aria-label="User menu"
              >
                <Avatar className="size-8">
                  <AvatarImage
                    src={user.avatarUrl || undefined}
                    alt={user.displayName || user.name || ''}
                  />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                    {getInitials(user.displayName || user.name || user.email)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="w-56 glass-card border-border"
              sideOffset={8}
            >
              {/* ── User Info ────────────────────────────────────────────────── */}
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1.5 py-1">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-9">
                      <AvatarImage
                        src={user.avatarUrl || undefined}
                        alt={user.displayName || user.name || ''}
                      />
                      <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                        {getInitials(user.displayName || user.name || user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <p className="text-sm font-medium leading-tight">
                        {user.displayName || user.name || 'User'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'w-fit h-5 rounded-md px-1.5 text-[10px] font-bold tracking-wider uppercase gap-1',
                      planStyle.badge,
                    )}
                  >
                    {plan === 'elite' ? (
                      <Crown className="size-3" />
                    ) : plan === 'pro' ? (
                      <Zap className="size-3" />
                    ) : null}
                    {user.plan || 'Free'} Plan
                  </Badge>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              {/* ── Actions ─────────────────────────────────────────────────── */}
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => setView('profile')}
                  className="cursor-pointer"
                >
                  <UserIcon className="size-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setView('settings')}
                  className="cursor-pointer"
                >
                  <Settings className="size-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setView('subscription')}
                  className="cursor-pointer"
                >
                  <Crown className="size-4" />
                  Subscription
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              {/* ── Logout ────────────────────────────────────────────────────── */}
              <DropdownMenuItem
                variant="destructive"
                onClick={logout}
                className="cursor-pointer"
              >
                <LogOut className="size-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
