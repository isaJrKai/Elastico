'use client'
import { useEffect, useCallback, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useElasticoStore } from '@/store/use-elastico-store'
import { Toaster } from '@/components/ui/sonner'
import { Sidebar } from '@/components/elastico/sidebar'
import { Header } from '@/components/elastico/header'
import CommandPalette from '@/components/elastico/command-palette'
import LoginView from '@/components/elastico/login-view'
import { OfflineIndicator } from '@/components/elastico/offline-indicator'
import { ErrorBoundary } from '@/components/elastico/error-boundary'

// Lazy-load heavy view components — only the active view gets bundled
const DashboardView = dynamic(() => import('@/components/elastico/dashboard-view'), { loading: ViewSkeleton })
const MatchesView = dynamic(() => import('@/components/elastico/matches-view').then(m => ({ default: () => <m.MatchesView /> })), { loading: ViewSkeleton })
const MatchDetailView = dynamic(() => import('@/components/elastico/match-detail-view'), { loading: ViewSkeleton })
const PredictionsView = dynamic(() => import('@/components/elastico/predictions-view'), { loading: ViewSkeleton })
const TournamentView = dynamic(() => import('@/components/elastico/tournament-view'), { loading: ViewSkeleton })
const LeaderboardView = dynamic(() => import('@/components/elastico/leaderboard-view'), { loading: ViewSkeleton })
const ChatView = dynamic(() => import('@/components/elastico/chat-view').then(m => ({ default: () => <m.ChatView /> })), { loading: ViewSkeleton })
const NewsView = dynamic(() => import('@/components/elastico/news-view').then(m => ({ default: () => <m.NewsView /> })), { loading: ViewSkeleton })
const AdminView = dynamic(() => import('@/components/elastico/admin-view'), { loading: ViewSkeleton })
const SettingsView = dynamic(() => import('@/components/elastico/settings-view').then(m => ({ default: () => <m.SettingsView /> })), { loading: ViewSkeleton })
const NotificationsView = dynamic(() => import('@/components/elastico/notifications-view'), { loading: ViewSkeleton })
const SubscriptionView = dynamic(() => import('@/components/elastico/subscription-view'), { loading: ViewSkeleton })
const TacticalView = dynamic(() => import('@/components/elastico/tactical-view'), { loading: ViewSkeleton })
const PlayerView = dynamic(() => import('@/components/elastico/player-view').then(m => ({ default: () => <m.PlayerView /> })), { loading: ViewSkeleton })
const CompareView = dynamic(() => import('@/components/elastico/compare-view').then(m => ({ default: () => <m.CompareView /> })), { loading: ViewSkeleton })
const AchievementsView = dynamic(() => import('@/components/elastico/achievements-view').then(m => ({ default: () => <m.AchievementsView /> })), { loading: ViewSkeleton })
const ExportView = dynamic(() => import('@/components/elastico/export-view').then(m => ({ default: () => <m.ExportView /> })), { loading: ViewSkeleton })
const SocialView = dynamic(() => import('@/components/elastico/social-view').then(m => ({ default: () => <m.SocialView /> })), { loading: ViewSkeleton })
const PredictionEngineView = dynamic(() => import('@/components/elastico/prediction-engine-view'), { loading: ViewSkeleton })
const SystemMonitorView = dynamic(() => import('@/components/elastico/system-monitor-view'), { loading: ViewSkeleton })

function ViewSkeleton() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  )
}

function SetupView({ onReady }: { onReady: () => void }) {
  const [status, setStatus] = useState<string>('checking')
  const [message, setMessage] = useState('')
  const [settingUp, setSettingUp] = useState(false)

  const checkAndSetup = async () => {
    try {
      const res = await fetch('/api/setup')
      const data = await res.json()

      if (data.status === 'ready') {
        onReady()
        return
      }

      if (data.status === 'needs_setup' || data.status === 'needs_seed') {
        setMessage('Creating tables and seeding data...')
        setSettingUp(true)
        try {
          const setupRes = await fetch('/api/setup', { method: 'POST' })
          const setupData = await setupRes.json()
          if (setupData.status === 'success' || setupData.status === 'already_seeded') {
            onReady()
            return
          }
          setMessage(setupData.message || 'Setup failed')
          setStatus('error')
        } catch {
          setMessage('Failed to run setup')
          setStatus('error')
        }
        return
      }

      setStatus(data.status)
      setMessage(data.message)
    } catch {
      setStatus('error')
      setMessage('Service temporarily unavailable — database is waking up')
    }
  }

  const checkAndSetupRef = useRef(checkAndSetup)
  const clearedRef = useRef(false)
  checkAndSetupRef.current = checkAndSetup
  useEffect(() => {
    checkAndSetupRef.current().then(() => {
      if (clearedRef.current) return
      clearedRef.current = true
    })
    // Retry only once after 10 seconds if first attempt failed — no infinite polling
    const timeout = setTimeout(() => {
      if (clearedRef.current) return
      checkAndSetupRef.current().then(() => { clearedRef.current = true })
    }, 10000)
    return () => clearTimeout(timeout)
  }, [])

  const isNeedsDatabase = status === 'needs_database'

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 aurora-bg noise-overlay">
      <div className="relative z-[1] max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-4xl font-black tracking-tighter text-foreground mb-2">ELASTICO</div>
          <p className="text-sm text-muted-foreground">AI-Powered Football Analytics</p>
        </div>

        <div className="glass-card-premium rounded-2xl p-8">
          {isNeedsDatabase ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
              </div>
              <h2 className="text-lg font-semibold text-foreground text-center mb-2">Database Not Connected</h2>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Go to your Vercel project → <strong className="text-foreground">Storage</strong> → <strong className="text-foreground">Create Database</strong> → <strong className="text-foreground">Postgres (Neon)</strong>
              </p>
              <div className="bg-secondary rounded-xl p-4 text-xs text-muted-foreground space-y-1">
                <p>1. Open Vercel → elastico → <strong className="text-foreground">Storage</strong></p>
                <p>2. Click <strong className="text-foreground">Create Database</strong></p>
                <p>3. Select <strong className="text-foreground">Postgres (Neon)</strong></p>
                <p>4. Click <strong className="text-foreground">Create</strong></p>
                <p className="text-primary pt-1">← This page will auto-detect and set up everything</p>
              </div>
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Waiting for database connection...
              </div>
            </>
          ) : settingUp || status === 'checking' ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-foreground">{message || 'Checking database...'}</p>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>
              </div>
              <p className="text-sm text-amber-600 dark:text-amber-300 mb-1">{message || 'Connection issue'}</p>
              <p className="text-xs text-muted-foreground mb-4">Retrying shortly...</p>
              <button
                onClick={checkAndSetup}
                className="px-4 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg text-sm text-primary transition-colors"
              >
                Retry Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const [dbReady, setDbReady] = useState<'checking' | 'ready' | 'down'>('checking') // three-state: checking, ready, down
  const isAuthenticated = useElasticoStore(s => s.isAuthenticated)
  const currentView = useElasticoStore(s => s.currentView)

  const fetchMatches = useElasticoStore(s => s.fetchMatches)
  const fetchTeams = useElasticoStore(s => s.fetchTeams)
  const fetchNews = useElasticoStore(s => s.fetchNews)
  const fetchNotifications = useElasticoStore(s => s.fetchNotifications)
  const fetchLiveScores = useElasticoStore(s => s.fetchLiveScores)
  const zoomLevel = useElasticoStore(s => s.zoomLevel)

  // Initial data fetch — runs ONCE when user authenticates.
  // Store actions are stable zustand references so this won't re-fire.
  // No auto-refresh intervals — data fetched once on login, user refreshes manually.
  const hasFetchedRef = useRef(false)
  useEffect(() => {
    if (isAuthenticated && !hasFetchedRef.current) {
      hasFetchedRef.current = true
      fetchMatches()
      fetchTeams()
      fetchNews()
      fetchNotifications()
      fetchLiveScores()
    }
  }, [isAuthenticated, fetchMatches, fetchTeams, fetchNews, fetchNotifications, fetchLiveScores])

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isAuthenticated) return
    const store = useElasticoStore.getState()
    const cmd = e.metaKey || e.ctrlKey

    if (cmd && e.key === 'd') { e.preventDefault(); store.setView('dashboard') }
    if (cmd && e.key === 'm') { e.preventDefault(); store.setView('matches') }
    if (cmd && e.key === 'p') { e.preventDefault(); store.setView('predictions') }
    if (cmd && e.key === 't') { e.preventDefault(); store.setView('tournament') }
    if (cmd && e.key === 'l') { e.preventDefault(); store.setView('leaderboard') }
    if (cmd && e.key === 'c') { e.preventDefault(); store.setView('ai-chat') }
    if (cmd && e.key === 'n') { e.preventDefault(); store.setView('news') }
    if (cmd && e.key === ',') { e.preventDefault(); store.setView('settings') }
    if (cmd && e.key === 'b') { e.preventDefault(); store.setView('notifications') }
    if (cmd && (e.key === '=' || e.key === '+')) { e.preventDefault(); store.setZoomLevel(store.zoomLevel + 10) }
    if (cmd && e.key === '-') { e.preventDefault(); store.setZoomLevel(store.zoomLevel - 10) }
    if (cmd && e.key === '0') { e.preventDefault(); store.setZoomLevel(100) }
  }, [isAuthenticated])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Restore session
  useEffect(() => {
    const token = localStorage.getItem('elastico_token')
    const userStr = localStorage.getItem('elastico_user')
    if (token && userStr) {
      try {
        JSON.parse(userStr) // validate it's valid JSON
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


  // Check database on mount — single check, no retry loop
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') { setDbReady('ready'); return }
    fetch('/api/setup')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        setDbReady(data.status === 'ready' ? 'ready' : 'down')
      })
      .catch(() => {
        setDbReady('down')
      })
  }, [])

  // Database is down — show reconnect screen
  if (dbReady === 'down' || dbReady === 'checking') {
    return <SetupView onReady={() => setDbReady('ready')} />
  }

  // Not authenticated - show login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <LoginView />
        <Toaster />
      </div>
    )
  }

  // Authenticated - show main app
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
    <div className="min-h-screen bg-background flex aurora-bg noise-overlay">
      <div className="relative z-[1]"><Sidebar /></div>
      <div className="relative z-[1] flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300">
        <Header />
        <div className="flex-1 overflow-auto">
          <main className="p-4 md:p-6">
            <ErrorBoundary>{renderView()}</ErrorBoundary>
          </main>
          <footer className="border-t border-border/30 px-6 py-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>© 2026 ELASTICO — AI-Powered Analytics Platform</span>
            <span className="hidden sm:inline">Powered by ELO · Poisson · Dixon-Coles · Merton Jump-Diffusion · GARCH · Kelly Criterion · NVIDIA AI</span>
          </footer>
        </div>
      </div>
      <CommandPalette />
      <Toaster />
      <OfflineIndicator />
    </div>
  )
}