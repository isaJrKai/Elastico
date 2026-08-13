'use client'
import { useEffect, useCallback, useState, useRef, lazy, Suspense } from 'react'
import { useElasticoStore } from '@/store/use-elastico-store'
import { Toaster } from '@/components/ui/sonner'
// import { Sidebar } from '@/components/elastico/sidebar'
// import { Header } from '@/components/elastico/header'
// import CommandPalette from '@/components/elastico/command-palette'
// import { OfflineIndicator } from '@/components/elastico/offline-indicator'
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
      setMessage('Service temporarily unavailable')
    }
  }

  const checkAndSetupRef = useRef(checkAndSetup)
  checkAndSetupRef.current = checkAndSetup
  useEffect(() => {
    checkAndSetupRef.current()
    const interval = setInterval(() => checkAndSetupRef.current(), 8000)
    return () => clearInterval(interval)
  }, [])

  const isNeedsDatabase = status === 'needs_database'

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-4xl font-black tracking-tighter text-foreground mb-2">ELASTICO</div>
          <p className="text-sm text-muted-foreground">AI-Powered Football Analytics</p>
        </div>

        <div className="bg-card/80 backdrop-blur-xl border border-border rounded-xl p-8">
          {isNeedsDatabase ? (
            <>
              <div className="w-16 h-16 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
              </div>
              <h2 className="text-lg font-semibold text-foreground text-center mb-2">Database Not Connected</h2>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Go to your Vercel project, then <strong className="text-zinc-200">Storage</strong>, then <strong className="text-zinc-200">Create Database</strong>, then <strong className="text-zinc-200">Postgres (Neon)</strong>
              </p>
              <div className="bg-secondary rounded-lg p-4 text-xs text-muted-foreground space-y-1">
                <p>1. Open Vercel project Settings</p>
                <p>2. Click <strong className="text-foreground">Create Database</strong></p>
                <p>3. Select <strong className="text-foreground">Postgres (Neon)</strong></p>
                <p>4. Click <strong className="text-foreground">Create</strong></p>
                <p className="text-primary pt-1">This page will auto-detect and set up everything</p>
              </div>
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Waiting for database connection...
              </div>
            </>
          ) : settingUp || status === 'checking' ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-foreground">{message || 'Checking database...'}</p>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>
              </div>
              <p className="text-sm text-amber-500 mb-1">{message || 'Connection issue'}</p>
              <p className="text-xs text-muted-foreground mb-4">Auto-retrying every 8 seconds...</p>
              <button
                onClick={checkAndSetup}
                className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg text-sm text-emerald-400 transition-colors"
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
  const [dbReady, setDbReady] = useState<'checking' | 'ready' | 'down'>('checking')
  const isAuthenticated = useElasticoStore(s => s.isAuthenticated)
  const currentView = useElasticoStore(s => s.currentView)
  const sidebarOpen = useElasticoStore(s => s.sidebarOpen)

  const fetchMatches = useElasticoStore(s => s.fetchMatches)
  const fetchTeams = useElasticoStore(s => s.fetchTeams)
  const fetchNews = useElasticoStore(s => s.fetchNews)
  const fetchNotifications = useElasticoStore(s => s.fetchNotifications)
  const fetchLiveScores = useElasticoStore(s => s.fetchLiveScores)

  // Initial data fetch — ESPN immediately, DB data only if authenticated
  // NOTE: DB data disabled temporarily to isolate React #310 crash
  useEffect(() => {
    // if (isAuthenticated) {
    //   fetchMatches()
    //   fetchTeams()
    //   fetchNews()
    //   fetchNotifications()
    // }
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
    if (cmd && e.key === 't') { e.preventDefault(); store.setView('tournament') }
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

  // Check database on mount — non-blocking; proceed even if DB is down
  // ESPN data fetches don't require a database
  useEffect(() => {
    fetch('/api/setup')
      .then(r => r.json())
      .then(data => {
        if (data.status === 'ready') setDbReady('ready')
        else setDbReady('down')
      })
      .catch(() => setDbReady('down'))
  }, [])

  // Fetch ESPN live scores immediately (no auth needed)
  useEffect(() => {
    fetchLiveScores()
  }, [fetchLiveScores])

  // Auto-refresh ESPN live scores every 60s
  useEffect(() => {
    const interval = setInterval(() => { fetchLiveScores() }, 60000)
    return () => clearInterval(interval)
  }, [fetchLiveScores])

  // Not authenticated — show login (but still allow ESPN views if DB is down)
  if (!isAuthenticated && dbReady !== 'down') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Suspense fallback={<ViewSkeleton />}>
          <LoginView />
        </Suspense>
        <Toaster />
      </div>
    )
  }

  // DB is down — auto-login as demo user so ESPN views work
  useEffect(() => {
    if (dbReady === 'down' && !isAuthenticated) {
      const demoUser = {
        id: 'demo-no-db',
        email: 'demo@elastico.app',
        name: 'Demo User',
        displayName: null,
        avatarUrl: null,
        role: 'user',
        plan: 'free',
        predictionAccuracy: 0,
        predictionStreak: 0,
        bestStreak: 0,
        totalPredictions: 0,
        correctPredictions: 0,
        achievements: '[]',
        favoriteTeams: '[]',
        twoFactorEnabled: false,
        lastLoginAt: null,
        loginCount: 0,
      }
      const store = useElasticoStore.getState()
      store.setUser(demoUser, 'demo-no-db-token')
      localStorage.setItem('elastico_token', 'demo-no-db-token')
      localStorage.setItem('elastico_user', JSON.stringify(demoUser))
    }
  }, [dbReady, isAuthenticated])

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
      {/* Sidebar — TEMPORARILY DISABLED */}
      <div className="shrink-0 w-0" />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header — TEMPORARILY DISABLED */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <main className="w-full max-w-[1600px] mx-auto px-6 md:px-8 py-6">
            <ErrorBoundary>
              <Suspense fallback={<ViewSkeleton />}>
                {renderView()}
              </Suspense>
            </ErrorBoundary>
          </main>
          <footer className="shrink-0 border-t border-border px-6 md:px-8 py-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>2026 ELASTICO</span>
            <span className="hidden sm:inline truncate">ELO / Poisson / Dixon-Coles / Merton Jump-Diffusion / GARCH / Kelly Criterion</span>
          </footer>
        </div>
      </div>

      {/* CommandPalette/OfflineIndicator — TEMPORARILY DISABLED */}
      <Toaster />
    </div>
  )
}