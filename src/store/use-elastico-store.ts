'use client'

import { create } from 'zustand'

// ── Types ────────────────────────────────────────────────────────────────────

export type View =
  | 'login'
  | 'dashboard'
  | 'matches'
  | 'match-detail'
  | 'predictions'
  | 'leaderboard'
  | 'news'
  | 'tournament'
  | 'admin'
  | 'settings'
  | 'subscription'
  | 'notifications'
  | 'profile'
  | 'ai-chat'
  | 'tactical'
  | 'players'
  | 'compare'
  | 'achievements'
  | 'export'
  | 'social'
  | 'prediction-engine'
  | 'system-monitor'

export interface User {
  id: string
  email: string
  name: string | null
  displayName: string | null
  avatarUrl: string | null
  role: string
  plan: string
  predictionAccuracy: number
  predictionStreak: number
  bestStreak: number
  totalPredictions: number
  correctPredictions: number
  achievements: string
  favoriteTeams: string
  twoFactorEnabled: boolean
  lastLoginAt: string | null
  loginCount: number
}

export interface Match {
  id: string
  homeTeamId: string
  awayTeamId: string
  competition: string
  stage: string
  group: string | null
  date: string | null
  status: string
  homeScore: number
  awayScore: number
  homeXg: number | null
  awayXg: number | null
  homeXgSource: string | null
  awayXgSource: string | null
  homeXgTruthClass: string | null
  awayXgTruthClass: string | null
  possessionHome: number
  shotsHome: number
  shotsAway: number
  shotsOnTargetHome: number
  shotsOnTargetAway: number
  cornersHome: number
  cornersAway: number
  venue: string | null
  weather: string | null
  temperature: number | null
  homeWinProb: number | null
  drawProb: number | null
  awayWinProb: number | null
  homeEloBefore: number | null
  awayEloBefore: number | null
  isSimulated: boolean
  homeTeam?: Team
  awayTeam?: Team
  events?: MatchEvent[]
  _count?: { predictions: number; votes: number; bookmarks: number }
}

export interface Team {
  id: string
  name: string
  code: string
  primaryColor: string
  secondaryColor: string
  eloRating: number
  form: string
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  group: string | null
  rank: number | null
  coachName: string | null
  style: string | null
  xgPerGame: number | null
  xgaPerGame: number | null
  xgTruthClass: string | null  // 'REAL', 'DERIVED', 'PROXY', 'MISSING', null
  xgSource: string | null     // 'understat', 'proxy', null
  xgFreshness: string | null  // 'FRESH', 'CURRENT', 'SEASON', 'STALE'
  possession: number
  passAccuracy: number
  pressIntensity: number
  logo?: string
  players?: Player[]
}

export interface Player {
  id: string
  name: string
  number: number
  position: string
  goals: number
  assists: number
  yellowCards: number
  redCards: number
  rating: number
  marketValue: number | null
  age: number | null
}

export interface MatchEvent {
  id: string
  minute: number
  type: string
  team: string
  playerName: string
  description: string | null
}

export interface NewsItem {
  id: string
  title: string
  summary: string | null
  content: string | null
  source: string | null
  category: string
  isBreaking: boolean
  sentiment: string | null
  publishedAt: string | null
  reactions: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface Notification {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

// ── Store Interface ──────────────────────────────────────────────────────────

interface ElasticoStore {
  // Auth
  user: User | null
  token: string | null
  isAuthenticated: boolean

  // Navigation
  currentView: View
  selectedMatchId: string | null
  sidebarOpen: boolean
  commandPaletteOpen: boolean

  // Data
  matches: Match[]
  teams: Team[]
  news: NewsItem[]
  notifications: Notification[]
  chatMessages: ChatMessage[]
  liveMatches: any[]
  isLiveLoading: boolean

  // Errors
  errors: Record<string, string>

  // UI State
  isLoading: boolean
  loadingMessage: string
  theme: 'dark' | 'light'
  zoomLevel: number

  // Actions - Auth
  setUser: (user: User | null, token: string | null) => void
  logout: () => void

  // Actions - Navigation
  setView: (view: View) => void
  selectMatch: (matchId: string | null) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  toggleCommandPalette: () => void
  setCommandPaletteOpen: (open: boolean) => void

  // Actions - Data
  setMatches: (matches: Match[]) => void
  setTeams: (teams: Team[]) => void
  setNews: (news: NewsItem[]) => void
  setNotifications: (notifications: Notification[]) => void
  addChatMessage: (message: ChatMessage) => void
  updateChatMessage: (id: string, updates: Partial<ChatMessage>) => void
  clearChat: () => void

  // Actions - UI
  setLoading: (loading: boolean, message?: string) => void
  setTheme: (theme: 'dark' | 'light') => void
  setZoomLevel: (level: number) => void

  // Actions - Errors
  clearError: (key: string) => void

  // Actions - Real-time updates
  updateMatch: (match: Partial<Match> & { id: string }) => void
  addNotification: (notification: Notification) => void
  markNotificationRead: (id: string) => void

  // Actions - Data Fetching
  fetchMatches: () => Promise<void>
  fetchTeams: () => Promise<void>
  fetchNews: () => Promise<void>
  fetchNotifications: () => Promise<void>
  fetchAnnouncements: () => Promise<void>
  fetchLiveScores: (league?: string) => Promise<void>
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useElasticoStore = create<ElasticoStore>()((set, get) => ({
  // ── Initial State ─────────────────────────────────────────────────────────

  // Auth
  user: null,
  token: null,
  isAuthenticated: false,

  // Navigation
  currentView: 'login',
  selectedMatchId: null,
  sidebarOpen: true,
  commandPaletteOpen: false,

  // Data
  matches: [],
  teams: [],
  news: [],
  notifications: [],
  chatMessages: [],
  liveMatches: [],
  isLiveLoading: false,

  // Errors
  errors: {},

  // UI State
  isLoading: false,
  loadingMessage: '',
  theme: 'dark',
  zoomLevel: typeof window !== 'undefined' ? Number(localStorage.getItem('elastico_zoom') || 100) : 100,

  // ── Actions — Auth ────────────────────────────────────────────────────────

  setUser: (user, token) =>
    set({
      user,
      token,
      isAuthenticated: user !== null && token !== null,
    }),

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('elastico_token')
      localStorage.removeItem('elastico_user')
    }
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      currentView: 'login',
      selectedMatchId: null,
      matches: [],
      teams: [],
      news: [],
      notifications: [],
      chatMessages: [],
      isLoading: false,
      loadingMessage: '',
    })
  },

  // ── Actions — Navigation ──────────────────────────────────────────────────

  setView: (view) => set({ currentView: view }),

  selectMatch: (matchId) =>
    set({
      selectedMatchId: matchId,
      currentView: matchId ? 'match-detail' : get().currentView,
    }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  toggleCommandPalette: () =>
    set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),

  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  // ── Actions — Data ────────────────────────────────────────────────────────

  setMatches: (matches) => set({ matches }),

  setTeams: (teams) => set({ teams }),

  setNews: (news) => set({ news }),

  setNotifications: (notifications) => set({ notifications }),

  addChatMessage: (message) =>
    set((state) => ({ chatMessages: [...state.chatMessages, message] })),

  updateChatMessage: (id, updates) =>
    set((state) => ({
      chatMessages: state.chatMessages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg,
      ),
    })),

  clearChat: () => set({ chatMessages: [] }),

  clearError: (key) =>
    set((state) => {
      const { [key]: _, ...rest } = state.errors
      return { errors: rest }
    }),

  // ── Actions — UI ──────────────────────────────────────────────────────────

  setLoading: (loading, message = '') =>
    set({ isLoading: loading, loadingMessage: message }),

  setTheme: (theme) => set({ theme }),

  setZoomLevel: (level) => {
    const clamped = Math.min(150, Math.max(50, level))
    if (typeof window !== 'undefined') localStorage.setItem('elastico_zoom', String(clamped))
    set({ zoomLevel: clamped })
  },

  // ── Actions — Real-time Updates ───────────────────────────────────────────

  updateMatch: (updatedMatch) =>
    set((state) => ({
      matches: state.matches.map((match) =>
        match.id === updatedMatch.id ? { ...match, ...updatedMatch } : match,
      ),
    })),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
    })),

  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      ),
    })),

  // ── Actions — Data Fetching ─────────────────────────────────────────────

  fetchMatches: async () => {
    try {
      const token = get().token
      const headers: Record<string, string> = { 'Accept-Encoding': 'gzip, deflate' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch('/api/matches', { headers })
      if (res.ok) {
        const data = await res.json()
        const raw = Array.isArray(data) ? data : data.matches || []
        // Sanitize: Prisma may return empty objects {} for null Date fields.
        // These crash React if rendered directly (error #310).
        const matches = raw.map((m: any) => ({
          ...m,
          date: (m.date && typeof m.date === 'object' && !m.date.getTime) ? null : m.date,
          createdAt: (m.createdAt && typeof m.createdAt === 'object' && !m.createdAt.getTime) ? null : m.createdAt,
          updatedAt: (m.updatedAt && typeof m.updatedAt === 'object' && !m.updatedAt.getTime) ? null : m.updatedAt,
        }))
        // Track bandwidth
        const payloadBytes = res.headers.get('X-Payload-Bytes')
        if (payloadBytes) {
          try { (
            await import('@/lib/compressed-data-stream')
          ).BandwidthTracker.log(parseInt(payloadBytes, 10), '/api/matches') } catch {}
        }
        set({ matches })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      console.error('Failed to fetch matches:', e)
      set((state) => ({ errors: { ...state.errors, fetchMatches: msg } }))
    }
  },

  fetchTeams: async () => {
    try {
      const res = await fetch('/api/teams', { headers: { 'Accept-Encoding': 'gzip, deflate' } })
      if (res.ok) {
        const data = await res.json()
        const teams = Array.isArray(data) ? data : data.teams || []
        const payloadBytes = res.headers.get('X-Payload-Bytes')
        if (payloadBytes) {
          try { (await import('@/lib/compressed-data-stream')).BandwidthTracker.log(parseInt(payloadBytes, 10), '/api/teams') } catch {}
        }
        set({ teams })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      console.error('Failed to fetch teams:', e)
      set((state) => ({ errors: { ...state.errors, fetchTeams: msg } }))
    }
  },

  fetchNews: async () => {
    try {
      const res = await fetch('/api/news?limit=30', { headers: { 'Accept-Encoding': 'gzip, deflate' } })
      if (res.ok) {
        const data = await res.json()
        const news = Array.isArray(data) ? data : data.news || []
        const payloadBytes = res.headers.get('X-Payload-Bytes')
        if (payloadBytes) {
          try { (await import('@/lib/compressed-data-stream')).BandwidthTracker.log(parseInt(payloadBytes, 10), '/api/news') } catch {}
        }
        set({ news })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      console.error('Failed to fetch news:', e)
      set((state) => ({ errors: { ...state.errors, fetchNews: msg } }))
    }
  },

  fetchNotifications: async () => {
    try {
      const token = get().token
      if (!token) return
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}`, 'Accept-Encoding': 'gzip, deflate' },
      })
      if (res.ok) {
        const data = await res.json()
        const notifications = Array.isArray(data) ? data : data.notifications || []
        const payloadBytes = res.headers.get('X-Payload-Bytes')
        if (payloadBytes) {
          try { (await import('@/lib/compressed-data-stream')).BandwidthTracker.log(parseInt(payloadBytes, 10), '/api/notifications') } catch {}
        }
        set({ notifications })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      console.error('Failed to fetch notifications:', e)
      set((state) => ({ errors: { ...state.errors, fetchNotifications: msg } }))
    }
  },

  fetchAnnouncements: async () => {
    try {
      const res = await fetch('/api/admin/announcements')
      if (res.ok) {
        const data = await res.json()
      }
    } catch (e) { /* silent */ }
  },

  fetchLiveScores: async (league?: string) => {
    set({ isLiveLoading: true })
    try {
      const url = league ? `/api/live?league=${league}` : '/api/live'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        // Sanitize: ensure team fields are safe objects (never render raw)
        const matches = (data.matches || []).map((m: any) => ({
          ...m,
          // Keep team objects but guarantee .name exists for safe rendering
          homeTeam: m.homeTeam && typeof m.homeTeam === 'object'
            ? { name: String(m.homeTeam.name || 'Home'), ...m.homeTeam }
            : m.homeTeam,
          awayTeam: m.awayTeam && typeof m.awayTeam === 'object'
            ? { name: String(m.awayTeam.name || 'Away'), ...m.awayTeam }
            : m.awayTeam,
        }))
        set({ liveMatches: matches, isLiveLoading: false })
      } else {
        set({ isLiveLoading: false })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      console.error('Failed to fetch live scores:', e)
      set((state) => ({ isLiveLoading: false, errors: { ...state.errors, fetchLiveScores: msg } }))
    }
  },
}))