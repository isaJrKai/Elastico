'use client'
import { useEffect, useCallback, useState, useRef } from 'react'
import { useElasticoStore } from '@/store/use-elastico-store'
import { Toaster } from '@/components/ui/sonner'
import { Sidebar } from '@/components/elastico/sidebar'
import { Header } from '@/components/elastico/header'
import CommandPalette from '@/components/elastico/command-palette'
import LoginView from '@/components/elastico/login-view'
import DashboardView from '@/components/elastico/dashboard-view'
import { MatchesView } from '@/components/elastico/matches-view'
import { MatchDetailView } from '@/components/elastico/match-detail-view'
import PredictionsView from '@/components/elastico/predictions-view'
import TournamentView from '@/components/elastico/tournament-view'
import LeaderboardView from '@/components/elastico/leaderboard-view'
import { ChatView } from '@/components/elastico/chat-view'
import { NewsView } from '@/components/elastico/news-view'
import AdminView from '@/components/elastico/admin-view'
import { SettingsView } from '@/components/elastico/settings-view'
import NotificationsView from '@/components/elastico/notifications-view'
import SubscriptionView from '@/components/elastico/subscription-view'
import TacticalView from '@/components/elastico/tactical-view'
import { PlayerView } from '@/components/elastico/player-view'
import { CompareView } from '@/components/elastico/compare-view'
import { AchievementsView } from '@/components/elastico/achievements-view'
import { ExportView } from '@/components/elastico/export-view'
import { SocialView } from '@/components/elastico/social-view'
import PredictionEngineView from '@/components/elastico/prediction-engine-view'
import SystemMonitorView from '@/components/elastico/system-monitor-view'
import { OfflineIndicator } from '@/components/elastico/offline-indicator'
import { ErrorBoundary } from '@/components/elastico/error-boundary'

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
  checkAndSetupRef.current = checkAndSetup
  useEffect(() => {
    checkAndSetupRef.current()
    const interval = setInterval(() => checkAndSetupRef.current(), 8000) // poll every 8s
    return () => clearInterval(interval)
  }, [])

  const isNeedsDatabase = status === 'needs_database'

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 aurora-bg noise-overlay">
      <div className="relative z-[1] max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-4xl font-black tracking-tighter text-white mb-2">ELASTICO</div>
          <p className="text-sm text-zinc-500">AI-Powered Football Analytics</p>
        </div>

        <div className="glass-card-premium rounded-2xl p-8">
          {isNeedsDatabase ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
              </div>
              <h2 className="text-lg font-semibold text-white text-center mb-2">Database Not Connected</h2>
              <p className="text-sm text-zinc-400 text-center mb-6">
                Go to your Vercel project → <strong className="text-zinc-200">Storage</strong> → <strong className="text-zinc-200">Create Database</strong> → <strong className="text-zinc-200">Postgres (Neon)</strong>
              </p>
              <div className="bg-zinc-800/50 rounded-xl p-4 text-xs text-zinc-400 space-y-1">
                <p>1. Open Vercel → elastico → <strong className="text-zinc-300">Storage</strong></p>
                <p>2. Click <strong className="text-zinc-300">Create Database</strong></p>
                <p>3. Select <strong className="text-zinc-300">Postgres (Neon)</strong></p>
                <p>4. Click <strong className="text-zinc-300">Create</strong></p>
                <p className="text-emerald-400 pt-1">← This page will auto-detect and set up everything</p>
              </div>
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-zinc-500">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Waiting for database connection...
              </div>
            </>
          ) : settingUp || status === 'checking' ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-zinc-300">{message || 'Checking database...'}</p>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>
              </div>
              <p className="text-sm text-amber-300 mb-1">{message || 'Connection issue'}</p>
              <p className="text-xs text-zinc-500 mb-4">Auto-retrying every 8 seconds...</p>
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
  const [dbReady, setDbReady] = useState<'checking' | 'ready' | 'down'>('checking') // three-state: checking, ready, down
  const isAuthenticated = useElasticoStore(s => s.isAuthenticated)
  const currentView = useElasticoStore(s => s.currentView)

  const fetchMatches = useElasticoStore(s => s.fetchMatches)
  const fetchTeams = useElasticoStore(s => s.fetchTeams)
  const fetchNews = useElasticoStore(s => s.fetchNews)
  const fetchNotifications = useElasticoStore(s => s.fetchNotifications)
  const fetchLiveScores = useElasticoStore(s => s.fetchLiveScores)
  const zoomLevel = useElasticoStore(s => s.zoomLevel)

  // Initial data fetch
  useEffect(() => {
    if (isAuthenticated) {
      fetchMatches()
      fetchTeams()
      fetchNews()
      fetchNotifications()
      fetchLiveScores() // Fetch live scores from ESPN
    }
  }, [isAuthenticated, fetchMatches, fetchTeams, fetchNews, fetchNotifications, fetchLiveScores])

  // Auto-refresh live scores every 5 minutes (not aggressive)
  useEffect(() => {
    if (!isAuthenticated) return
    const interval = setInterval(() => { fetchLiveScores() }, 300000)
    return () => clearInterval(interval)
  }, [isAuthenticated, fetchLiveScores])

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

  // Auto-refresh match data every 5 minutes (database-friendly)
  useEffect(() => {
    if (!isAuthenticated) return
    const interval = setInterval(() => { fetchMatches() }, 300000)
    return () => clearInterval(interval)
  }, [isAuthenticated, fetchMatches])

  // Check database on mount — determine state
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