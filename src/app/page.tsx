'use client'
import { useEffect, useCallback, lazy, Suspense } from 'react'
import { useElasticoStore } from '@/store/use-elastico-store'
import { Toaster } from '@/components/ui/sonner'
import { Sidebar } from '@/components/elastico/sidebar'
import { Header } from '@/components/elastico/header'
import CommandPalette from '@/components/elastico/command-palette'
import { OfflineIndicator } from '@/components/elastico/offline-indicator'
import { ErrorBoundary } from '@/components/elastico/error-boundary'

// ── Lazy-loaded views — only loaded when navigated to ─────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lazyLoad = (importFn: () => Promise<any>) =>
  lazy(() => importFn().then(m => ({ default: m.default })))

const LoginView = lazyLoad(() => import('@/components/elastico/login-view'))
const DashboardView = lazyLoad(() => import('@/components/elastico/dashboard-view'))
const MatchesView = lazyLoad(() => import('@/components/elastico/matches-view'))
const MatchDetailView = lazyLoad(() => import('@/components/elastico/match-detail-view'))
const PredictionsView = lazyLoad(() => import('@/components/elastico/predictions-view'))
const TournamentView = lazyLoad(() => import('@/components/elastico/tournament-view'))
const LeaderboardView = lazyLoad(() => import('@/components/elastico/leaderboard-view'))
const ChatView = lazyLoad(() => import('@/components/elastico/chat-view'))
const NewsView = lazyLoad(() => import('@/components/elastico/news-view'))
const AdminView = lazyLoad(() => import('@/components/elastico/admin-view'))
const SettingsView = lazyLoad(() => import('@/components/elastico/settings-view'))
const NotificationsView = lazyLoad(() => import('@/components/elastico/notifications-view'))
const SubscriptionView = lazyLoad(() => import('@/components/elastico/subscription-view'))
const TacticalView = lazyLoad(() => import('@/components/elastico/tactical-view'))
const PlayerView = lazyLoad(() => import('@/components/elastico/player-view'))
const CompareView = lazyLoad(() => import('@/components/elastico/compare-view'))
const AchievementsView = lazyLoad(() => import('@/components/elastico/achievements-view'))
const ExportView = lazyLoad(() => import('@/components/elastico/export-view'))
const SocialView = lazyLoad(() => import('@/components/elastico/social-view'))
const PredictionEngineView = lazyLoad(() => import('@/components/elastico/prediction-engine-view'))
const SystemMonitorView = lazyLoad(() => import('@/components/elastico/system-monitor-view'))

// ── View-level loading skeleton ─────────────────────────────────────────────
function ViewSkeleton() {
  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted/50 rounded-lg" />
        ))}
      </div>
      <div className="h-64 bg-muted/50 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-48 bg-muted/50 rounded-lg" />
        <div className="h-48 bg-muted/50 rounded-lg" />
      </div>
    </div>
  )
}

export default function Home() {
  const isAuthenticated = useElasticoStore(s => s.isAuthenticated)
  const currentView = useElasticoStore(s => s.currentView)
  const sidebarOpen = useElasticoStore(s => s.sidebarOpen)
  const fetchMatches = useElasticoStore(s => s.fetchMatches)
  const fetchTeams = useElasticoStore(s => s.fetchTeams)
  const fetchNews = useElasticoStore(s => s.fetchNews)
  const fetchNotifications = useElasticoStore(s => s.fetchNotifications)
  const fetchLiveScores = useElasticoStore(s => s.fetchLiveScores)

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem('elastico_token')
    const userStr = localStorage.getItem('elastico_user')
    if (token && userStr) {
      try {
        JSON.parse(userStr)
        fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => { if (r.ok) return r.json(); throw new Error('Invalid token') })
          .then(data => {
            const store = useElasticoStore.getState()
            store.setUser(data.user || data, token)
          })
          .catch(() => {
            localStorage.removeItem('elastico_token')
            localStorage.removeItem('elastico_user')
          })
      } catch {
        localStorage.removeItem('elastico_token')
        localStorage.removeItem('elastico_user')
      }
    }
  }, [])

  // Trigger initial data sync (populates DB from ESPN/API-Sports)
  // Note: sync endpoint requires authentication in production
  useEffect(() => {
    if (isAuthenticated) {
      fetch('/api/sync', { method: 'POST' }).catch(() => {})
    }
  }, [isAuthenticated])

  // Fetch ESPN live scores immediately (no auth needed)
  useEffect(() => {
    fetchLiveScores()
  }, [fetchLiveScores])

  // Auto-refresh ESPN live scores every 60s
  useEffect(() => {
    const interval = setInterval(() => { fetchLiveScores() }, 60000)
    return () => clearInterval(interval)
  }, [fetchLiveScores])

  // After auth, fetch DB data
  useEffect(() => {
    if (isAuthenticated) {
      fetchMatches()
      fetchTeams()
      fetchNews()
      fetchNotifications()
    }
  }, [isAuthenticated, fetchMatches, fetchTeams, fetchNews, fetchNotifications])

  // Auto-refresh matches every 30s
  useEffect(() => {
    if (!isAuthenticated) return
    const interval = setInterval(() => { fetchMatches() }, 30000)
    return () => clearInterval(interval)
  }, [isAuthenticated, fetchMatches])

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isAuthenticated) return
    const store = useElasticoStore.getState()
    const cmd = e.metaKey || e.ctrlKey
    if (cmd && e.key === 'd') { e.preventDefault(); store.setView('dashboard') }
    if (cmd && e.key === 'm') { e.preventDefault(); store.setView('matches') }
    if (cmd && e.key === 'p') { e.preventDefault(); store.setView('predictions') }
    if (cmd && e.key === 't') { e.preventDefault(); store.setView('tactical') }
    if (cmd && e.key === 's') { e.preventDefault(); store.setView('tournament') }
    if (cmd && e.key === 'l') { e.preventDefault(); store.setView('leaderboard') }
    if (cmd && e.key === 'c') { e.preventDefault(); store.setView('ai-chat') }
    if (cmd && e.key === 'n') { e.preventDefault(); store.setView('news') }
    if (cmd && e.key === ',') { e.preventDefault(); store.setView('settings') }
    if (cmd && e.key === 'b') { e.preventDefault(); store.setView('notifications') }
  }, [isAuthenticated])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Not authenticated — show login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Suspense fallback={<ViewSkeleton />}>
          <LoginView />
        </Suspense>
        <Toaster />
      </div>
    )
  }

  // Authenticated — render current view with lazy loading
  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <DashboardView />
      case 'matches': return <MatchesView />
      case 'match-detail': return <MatchDetailView />
      case 'predictions': return <PredictionsView />
      case 'tournament': return <TournamentView />
      case 'leaderboard': return <LeaderboardView />
      case 'ai-chat': return <ChatView />
      case 'news': return <NewsView />
      case 'admin': return <AdminView />
      case 'settings': return <SettingsView />
      case 'notifications': return <NotificationsView />
      case 'subscription': return <SubscriptionView />
      case 'tactical': return <TacticalView />
      case 'players': return <PlayerView />
      case 'compare': return <CompareView />
      case 'achievements': return <AchievementsView />
      case 'export': return <ExportView />
      case 'social': return <SocialView />
      case 'prediction-engine': return <PredictionEngineView />
      case 'system-monitor': return <SystemMonitorView />
      case 'profile': return <SettingsView />
      default: return <DashboardView />
    }
  }

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      <div className="shrink-0"><Sidebar /></div>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <main className="w-full max-w-[1600px] mx-auto px-6 md:px-8 py-6">
            <ErrorBoundary>
              <Suspense fallback={<ViewSkeleton />}>
                {renderView()}
              </Suspense>
            </ErrorBoundary>
          </main>
          <footer className="shrink-0 border-t border-border px-6 md:px-8 py-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-mono tabular-nums">2026 ELASTICO</span>
            <div className="hidden sm:flex items-center gap-4">
              <span className="truncate">ELO / Poisson / Dixon-Coles</span>
              <span className="text-muted-foreground/40">|</span>
              <span className="text-muted-foreground/60">Data: ESPN · football-data.org</span>
            </div>
          </footer>
        </div>
      </div>
      <CommandPalette />
      <Toaster />
      <OfflineIndicator />
    </div>
  )
}
