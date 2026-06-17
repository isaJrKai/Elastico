'use client'
import { useEffect, useCallback } from 'react'
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

export default function Home() {
  const isAuthenticated = useElasticoStore(s => s.isAuthenticated)
  const currentView = useElasticoStore(s => s.currentView)
  const sidebarOpen = useElasticoStore(s => s.sidebarOpen)

  const fetchMatches = useElasticoStore(s => s.fetchMatches)
  const fetchTeams = useElasticoStore(s => s.fetchTeams)
  const fetchNews = useElasticoStore(s => s.fetchNews)
  const fetchNotifications = useElasticoStore(s => s.fetchNotifications)

  // Initial data fetch
  useEffect(() => {
    if (isAuthenticated) {
      fetchMatches()
      fetchTeams()
      fetchNews()
      fetchNotifications()
    }
  }, [isAuthenticated, fetchMatches, fetchTeams, fetchNews, fetchNotifications])

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

  // Auto-refresh live data
  useEffect(() => {
    if (!isAuthenticated) return
    const interval = setInterval(() => { fetchMatches() }, 30000)
    return () => clearInterval(interval)
  }, [isAuthenticated, fetchMatches])

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
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${sidebarOpen ? 'md:ml-[240px]' : 'md:ml-[64px]'}`}>
        <Header />
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {renderView()}
        </main>
        <footer className="border-t border-border/30 px-6 py-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>© 2026 ELASTICO — AI-Powered Analytics Platform</span>
          <span className="hidden sm:inline">Powered by ELO · Poisson · Dixon-Coles · Merton Jump-Diffusion · GARCH · Kelly Criterion · NVIDIA AI</span>
        </footer>
      </div>
      <CommandPalette />
      <Toaster />
      <OfflineIndicator />
    </div>
  )
}