'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useElasticoStore, type Notification } from '@/store/use-elastico-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/hooks/use-toast'
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Circle,
  Goal,
  Clock,
  TriangleAlert,
  Brain,
  Info,
  Star,
  ChevronRight,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'unread' | 'goals' | 'cards' | 'system' | 'predictions'

interface FilterTabConfig {
  id: FilterTab
  label: string
  icon: React.ElementType
}

// ── Constants ──────────────────────────────────────────────────────────────────

const FILTER_TABS: FilterTabConfig[] = [
  { id: 'all', label: 'All', icon: Bell },
  { id: 'unread', label: 'Unread', icon: Circle },
  { id: 'goals', label: 'Goals', icon: Goal },
  { id: 'cards', label: 'Cards', icon: TriangleAlert },
  { id: 'system', label: 'System', icon: Info },
  { id: 'predictions', label: 'Predictions', icon: Brain },
]

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'mock-1',
    type: 'goal',
    title: 'Goal Alert: Haaland Scores!',
    message:
      'Erling Haaland scored in the 67th minute for Man City vs Arsenal. xG: 0.42 — a clinical finish.',
    isRead: false,
    createdAt: '2026-06-18T05:30:00.000Z',
  },
  {
    id: 'mock-2',
    type: 'card',
    title: 'Red Card Shown',
    message:
      'Rodri received a straight red card in the 34th minute (Man City vs Arsenal). Man City now down to 10 men.',
    isRead: false,
    createdAt: '2026-06-18T05:07:00.000Z',
  },
  {
    id: 'mock-3',
    type: 'prediction',
    title: 'Prediction Result: Liverpool vs Chelsea',
    message:
      'Your prediction was correct! Liverpool 2-1 Chelsea. Your accuracy is now 78% this month.',
    isRead: false,
    createdAt: '2026-06-18T03:40:00.000Z',
  },
  {
    id: 'mock-4',
    type: 'system',
    title: 'New Feature: Dixon-Coles Model',
    message:
      'The Dixon-Coles simulation model is now available for Pro and Elite subscribers. Upgrade to unlock advanced match predictions.',
    isRead: true,
    createdAt: '2026-06-18T00:40:00.000Z',
  },
  {
    id: 'mock-5',
    type: 'goal',
    title: 'Goal Alert: Mbappé Hat-trick!',
    message:
      'Kylian Mbappé completed his hat-trick in the 82nd minute for Real Madrid vs Barcelona. xG: 1.12 across 3 shots.',
    isRead: true,
    createdAt: '2026-06-17T21:30:00.000Z',
  },
  {
    id: 'mock-6',
    type: 'card',
    title: 'Yellow Card Accumulation Warning',
    message:
      'Your tracked player Bruno Fernandes (Man Utd) has 4 yellow cards this season — 1 away from a suspension.',
    isRead: false,
    createdAt: '2026-06-17T05:30:00.000Z',
  },
  {
    id: 'mock-7',
    type: 'prediction',
    title: 'Upcoming Match Prediction Window',
    message:
      'Bayern Munich vs Dortmund kicks off in 2 hours. Submit your prediction now and earn accuracy points.',
    isRead: true,
    createdAt: '2026-06-16T23:30:00.000Z',
  },
  {
    id: 'mock-8',
    type: 'system',
    title: 'Weekly Leaderboard Updated',
    message:
      'You moved up 5 spots to #12 on the global leaderboard this week. Keep predicting to climb higher!',
    isRead: false,
    createdAt: '2026-06-16T05:30:00.000Z',
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function getNotificationIcon(type: string) {
  switch (type) {
    case 'goal':
      return Goal
    case 'card':
      return TriangleAlert
    case 'prediction':
      return Brain
    case 'system':
    default:
      return Info
  }
}

function getNotificationColor(type: string) {
  switch (type) {
    case 'goal':
      return 'text-emerald-400 bg-emerald-500/15'
    case 'card':
      return 'text-amber-400 bg-amber-500/15'
    case 'prediction':
      return 'text-violet-400 bg-violet-500/15'
    case 'system':
      return 'text-sky-400 bg-sky-500/15'
    default:
      return 'text-muted-foreground bg-muted/50'
  }
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function matchesFilter(notification: Notification, tab: FilterTab): boolean {
  if (tab === 'all') return true
  if (tab === 'unread') return !notification.isRead
  return notification.type === tab
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function NotificationsView() {
  const notifications = useElasticoStore(s => s.notifications)
  const setNotifications = useElasticoStore(s => s.setNotifications)
  const markNotificationRead = useElasticoStore(s => s.markNotificationRead)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [isLoading, setIsLoading] = useState(true)

  // ── Fetch notifications ────────────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setNotifications(data)
        } else {
          // Mock when API returns empty
          setNotifications(MOCK_NOTIFICATIONS)
        }
      } else {
        setNotifications(MOCK_NOTIFICATIONS)
      }
    } catch {
      setNotifications(MOCK_NOTIFICATIONS)
    } finally {
      setIsLoading(false)
    }
  }, [setNotifications])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // ── Mark single as read ────────────────────────────────────────────────────

  const handleMarkRead = useCallback(
    async (id: string) => {
      const notification = notifications.find((n) => n.id === id)
      if (notification?.isRead) return

      try {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
      } catch {
        // Silently handle — still update locally
      }
      markNotificationRead(id)
    },
    [notifications, markNotificationRead],
  )

  // ── Mark all as read ───────────────────────────────────────────────────────

  const handleMarkAllRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id)
    if (unreadIds.length === 0) return

    try {
      await Promise.all(
        unreadIds.map((id) =>
          fetch('/api/notifications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          }),
        ),
      )
    } catch {
      // Silently handle
    }
    unreadIds.forEach((id) => markNotificationRead(id))
    toast({
      title: 'All caught up!',
      description: `${unreadIds.length} notification${unreadIds.length > 1 ? 's' : ''} marked as read.`,
    })
  }, [notifications, markNotificationRead])

  // ── Derived state ──────────────────────────────────────────────────────────

  const filtered = notifications.filter((n) => matchesFilter(n, activeTab))
  const unreadCount = notifications.filter((n) => !n.isRead).length

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15">
            <Bell className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Notifications</h2>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                : 'You&apos;re all caught up'}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={unreadCount === 0}
          onClick={handleMarkAllRead}
        >
          <CheckCheck className="mr-2 h-4 w-4" />
          Mark All Read
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="glass-card flex flex-wrap gap-1 rounded-xl p-1.5">
        {FILTER_TABS.map((tab) => {
          const count =
            tab.id === 'all'
              ? notifications.length
              : tab.id === 'unread'
                ? unreadCount
                : notifications.filter((n) => matchesFilter(n, tab.id)).length

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-emerald-500/20 text-emerald-400 shadow-sm'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              {count > 0 && (
                <span
                  className={`text-xs tabular-nums ${
                    activeTab === tab.id ? 'text-emerald-300' : 'text-muted-foreground/70'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Notification List */}
      <Card className="glass-card overflow-hidden rounded-xl">
        {isLoading ? (
          <CardContent className="space-y-1 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 p-3">
                <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </CardContent>
        ) : filtered.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
              <BellOff className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-muted-foreground">No notifications</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground/70">
              {activeTab === 'all'
                ? 'Notifications about goals, cards, predictions, and system updates will appear here.'
                : `No ${activeTab} notifications right now.`}
            </p>
          </CardContent>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map((notification) => {
              const Icon = getNotificationIcon(notification.type)
              const iconColor = getNotificationColor(notification.type)

              return (
                <button
                  key={notification.id}
                  onClick={() => handleMarkRead(notification.id)}
                  className={`group flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-white/[0.03] ${
                    !notification.isRead ? 'bg-emerald-500/[0.03]' : ''
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${iconColor}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm leading-snug ${
                          !notification.isRead
                            ? 'font-semibold text-foreground'
                            : 'font-medium text-muted-foreground'
                        }`}
                      >
                        {notification.title}
                      </p>
                      <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-transparent transition-colors group-hover:text-muted-foreground/50" />
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground/80 line-clamp-2">
                      {notification.message}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Clock className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-xs text-muted-foreground/50">
                        {relativeTime(notification.createdAt)}
                      </span>
                      {!notification.isRead && (
                        <>
                          <span className="text-muted-foreground/30">·</span>
                          <Badge
                            variant="secondary"
                            className="h-4 w-4 rounded-full p-0 bg-emerald-500/20 text-emerald-400 border-0"
                          >
                            <span className="sr-only">Unread</span>
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
