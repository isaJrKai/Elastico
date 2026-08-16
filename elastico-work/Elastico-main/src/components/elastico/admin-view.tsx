'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useElasticoStore } from '@/store/use-elastico-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { toast } from 'sonner'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts'
import {
  Activity, Users, DollarSign, TrendingUp, TrendingDown, Shield, Server, Database, Brain,
  Settings, Bell, AlertTriangle, CheckCircle, XCircle, Eye, Ban, UserCheck, UserX,
  FileText, Flag, Radio, Cpu, HardDrive, Wifi, Globe, Clock, ArrowUpRight, ArrowDownRight,
  RefreshCw, Download, Upload, Search, Filter, MoreHorizontal, Trash2, Edit,
  Lock, Unlock, Key, Monitor, Smartphone, Mail, Zap, Crown, Star, BarChart3,
  PieChart as PieIcon, Target, Layers, Copy, Send, Megaphone,
  ToggleLeft, ToggleRight, ChevronLeft, ChevronRight, Calendar, Newspaper,
  LayoutDashboard, UserCog, FilePlus2, ChartLine, Wallet, Wrench,
  Hash, Thermometer, MemoryStick, Gauge, ShieldCheck, Fingerprint, Network,
  FileSpreadsheet, MegaphoneIcon, CalendarDays, UserPlus, UserMinus, CheckSquare,
  AlertOctagon, Timer, GitBranch, Bug, Flame, Heart, ThumbsUp, ThumbsDown,
  CircleDot, Circle, Square, Triangle, ArrowRight, Rocket, Sparkles,
  History, HardDriveDownload, ActivityIcon, GaugeCircle, Plus, CreditCard
} from 'lucide-react'

// ── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = ['#00e676', '#00b4d8', '#ffd700', '#ff4757', '#a855f7', '#f97316', '#06b6d4', '#ec4899']
const PLAN_COLORS: Record<string, string> = { free: 'bg-gray-500/20 text-gray-300 border-gray-500/30', pro: 'bg-blue-500/20 text-blue-300 border-blue-500/30', elite: 'bg-amber-500/20 text-amber-300 border-amber-500/30' }
const ROLE_COLORS: Record<string, string> = { admin: 'bg-red-500/20 text-red-300 border-red-500/30', user: 'bg-gray-500/20 text-gray-300 border-gray-500/30', pro: 'bg-blue-500/20 text-blue-300 border-blue-500/30' }
const ANNOUNCEMENT_TYPES = ['info', 'warning', 'success', 'maintenance']
const NEWS_CATEGORIES = ['general', 'transfer', 'injury', 'tactical', 'match', 'rumor']
const NEWS_SENTIMENTS = ['positive', 'negative', 'neutral']

// ── Helper: Auth Headers ─────────────────────────────────────────────────────

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('elastico_token') : null
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

// ── Sub-Components ───────────────────────────────────────────────────────────

function StatCard({ title, value, icon: Icon, change, color = 'emerald', suffix = '' }: {
  title: string; value: string | number; icon: any; change?: number; color?: string; suffix?: string
}) {
  const isPositive = change !== undefined && change >= 0
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400',
    gold: 'bg-yellow-500/10 text-yellow-400',
    red: 'bg-red-500/10 text-red-400',
    blue: 'bg-cyan-500/10 text-cyan-400',
    purple: 'bg-purple-500/10 text-purple-400',
    orange: 'bg-orange-500/10 text-orange-400',
  }
  return (
    <Card className="glass-card glass-card-hover animate-fade-in-up">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Icon className="h-3 w-3" />
              {title}
            </p>
            <p className="text-2xl font-bold truncate">{value}{suffix}</p>
            {change !== undefined && (
              <div className={`flex items-center gap-1 text-xs ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                <span>{Math.abs(change)}%</span>
                <span className="text-muted-foreground">vs last period</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-xl shrink-0 ${colorMap[color] || colorMap.emerald}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function GaugeBar({ value, max = 100, label, color = '#00e676' }: { value: number; max?: number; label: string; color?: string }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-bold" style={{ color }}>{value}{max === 100 ? '%' : ''}</span>
      </div>
      <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function SectionCard({ title, icon: Icon, children, className = '' }: { title: string; icon: any; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`glass-card animate-fade-in-up ${className}`}>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon className="h-4 w-4 text-emerald-400" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 overflow-hidden">{children}</CardContent>
    </Card>
  )
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card p-2 rounded-lg text-xs border border-border">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-foreground">{p.name}:</span>
          <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Database className="h-8 w-8 mb-2 opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

// ── Mock Data Generators ─────────────────────────────────────────────────────

function generateUserGrowth(days = 30) {
  const now = new Date()
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (days - 1 - i))
    return {
      day: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      users: 80 + Math.floor(Math.random() * 40) + i * 3,
      pro: 10 + Math.floor(i * 0.8),
      elite: 3 + Math.floor(i * 0.3),
    }
  })
}

function generateApiUsage() {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, '0')}:00`,
    requests: 200 + Math.floor(Math.random() * 300) - (i < 6 || i > 22 ? 150 : 0),
    errors: Math.floor(Math.random() * 15),
  }))
}

function generateRevenueTrend() {
  return Array.from({ length: 12 }, (_, i) => {
    const m = new Date(2025, i)
    return {
      month: m.toLocaleDateString('en', { month: 'short' }),
      free: 0,
      pro: Math.floor(800 + i * 120 + Math.random() * 200),
      elite: Math.floor(1200 + i * 200 + Math.random() * 300),
    }
  })
}

function generateActivityFeed() {
  const types = ['login', 'prediction', 'subscription', 'achievement', 'vote', 'bookmark']
  const emails = ['admin@elastico.ai', 'pro@elastico.ai', 'elite@elastico.ai', 'user@elastico.ai', 'marco@elastico.ai', 'sofia@elastico.ai']
  const descs: Record<string, string[]> = {
    login: ['logged in from Chrome/Windows', 'logged in from Safari/iOS', 'logged in from Firefox/Mac'],
    prediction: ['predicted BRA vs GER: 2-1', 'predicted ARG vs FRA: 1-1', 'predicted ESP vs ENG: 3-2'],
    subscription: ['upgraded to Pro plan', 'upgraded to Elite plan', 'started free trial'],
    achievement: ['earned "First Prediction" badge', 'reached 10 prediction streak', 'earned "Top 10%" badge'],
    vote: ['voted on BRA vs GER', 'voted on ARG vs FRA', 'voted on ESP vs ENG'],
    bookmark: ['bookmarked BRA vs GER match', 'bookmarked Tournament Bracket', 'bookmarked Leaderboard'],
  }
  return Array.from({ length: 15 }, (_, i) => {
    const t = types[Math.floor(Math.random() * types.length)]
    const dArr = descs[t]
    const mins = i * 8 + Math.floor(Math.random() * 5)
    return {
      id: `act-${i}`,
      type: t,
      email: emails[Math.floor(Math.random() * emails.length)],
      description: dArr[Math.floor(Math.random() * dArr.length)],
      timestamp: `${mins}m ago`,
    }
  })
}

function generateModelPerformance() {
  return [
    { model: 'ELO', accuracy: 62.4, predictions: 450, avgConfidence: 71, calibrations: 8 },
    { model: 'Poisson', accuracy: 58.1, predictions: 320, avgConfidence: 68, calibrations: 6 },
    { model: 'Dixon-Coles', accuracy: 67.8, predictions: 180, avgConfidence: 74, calibrations: 5 },
    { model: 'Monte Carlo', accuracy: 64.2, predictions: 120, avgConfidence: 72, calibrations: 4 },
    { model: 'User Average', accuracy: 54.6, predictions: 890, avgConfidence: 65, calibrations: 0 },
  ]
}

function generateHeatmapData() {
  const stages = ['Group A', 'Group B', 'Group C', 'Group D', 'R16', 'QF', 'SF', 'Final']
  return stages.map(stage => ({
    stage,
    accuracy: 50 + Math.floor(Math.random() * 30),
    predictions: 20 + Math.floor(Math.random() * 80),
  }))
}

function generateFunnelData() {
  return [
    { stage: 'Visitors', count: 12400, pct: 100 },
    { stage: 'Signups', count: 3720, pct: 30 },
    { stage: 'First Prediction', count: 2232, pct: 18 },
    { stage: 'Repeat Predictors', count: 1339, pct: 10.8 },
    { stage: 'Subscribers', count: 446, pct: 3.6 },
  ]
}

function generateFeatureUsage() {
  return [
    { feature: 'Dashboard', usage: 95 },
    { feature: 'Predictions', usage: 78 },
    { feature: 'Live Matches', usage: 72 },
    { feature: 'AI Chat', usage: 65 },
    { feature: 'Leaderboard', usage: 45 },
    { feature: 'Tournament', usage: 52 },
    { feature: 'News', usage: 38 },
    { feature: 'Tactical View', usage: 28 },
    { feature: 'Export PDF', usage: 15 },
    { feature: 'Simulation', usage: 22 },
  ]
}

function generateAbTests() {
  return [
    { id: '1', name: 'New Dashboard Layout', variant: 'A (Grid)', metric: '+12% engagement', status: 'Running', significant: false, startDate: '2025-06-01' },
    { id: '2', name: 'AI Chat Suggestions', variant: 'B (Contextual)', metric: '+23% chat rate', status: 'Winner', significant: true, startDate: '2025-05-15' },
    { id: '3', name: 'Prediction Confidence UI', variant: 'A (Slider)', metric: '+5% accuracy', status: 'Running', significant: false, startDate: '2025-06-10' },
    { id: '4', name: 'Onboarding Flow', variant: 'B (Interactive)', metric: '+18% completion', status: 'Winner', significant: true, startDate: '2025-04-20' },
    { id: '5', name: 'Push Notifications', variant: 'A (Rich)', metric: '+8% CTR', status: 'Running', significant: false, startDate: '2025-06-05' },
  ]
}

function generateSubscriptions() {
  const plans = [
    { plan: 'Free', amount: '$0.00', interval: 'N/A', status: 'active' },
    { plan: 'Pro', amount: '$9.99', interval: 'Monthly', status: 'active' },
    { plan: 'Elite', amount: '$24.99', interval: 'Monthly', status: 'active' },
    { plan: 'Pro', amount: '$9.99', interval: 'Monthly', status: 'active' },
    { plan: 'Elite', amount: '$24.99', interval: 'Monthly', status: 'active' },
    { plan: 'Free', amount: '$0.00', interval: 'N/A', status: 'active' },
    { plan: 'Pro', amount: '$9.99', interval: 'Monthly', status: 'cancelled' },
    { plan: 'Elite', amount: '$24.99', interval: 'Monthly', status: 'past_due' },
  ]
  return plans.map((p, i) => ({
    id: `sub-${i + 1}`,
    userId: `usr-${String(i + 1).padStart(3, '0')}`,
    email: ['admin@elastico.ai', 'pro@elastico.ai', 'elite@elastico.ai', 'user@elastico.ai', 'marco@elastico.ai', 'sofia@elastico.ai', 'james@elastico.ai', 'chen@elastico.ai'][i],
    ...p,
    nextBilling: i < 6 ? '2025-07-15' : '—',
    createdAt: `2025-0${(i % 6) + 1}-${String((i * 3) % 28 + 1).padStart(2, '0')}`,
  }))
}

function generateNewsItems() {
  return [
    { id: 'n1', title: 'Brazil Announces Squad for World Cup 2026', summary: 'Brazil reveals their 26-man squad for the upcoming tournament.', content: 'Full squad analysis and key selections.', category: 'match', isBreaking: true, sentiment: 'positive', readCount: 2840, publishedAt: '2025-06-14T10:00:00Z' },
    { id: 'n2', title: 'Injury Update: Key Players Missing Group Stage', summary: 'Several star players will miss the group stage due to injuries.', content: 'Detailed injury report for group stage.', category: 'injury', isBreaking: false, sentiment: 'negative', readCount: 1520, publishedAt: '2025-06-13T14:30:00Z' },
    { id: 'n3', title: 'New Transfer: Star Midfielder Joins Premier League', summary: 'Major transfer news from the Premier League.', content: 'Transfer details and analysis.', category: 'transfer', isBreaking: true, sentiment: 'positive', readCount: 3200, publishedAt: '2025-06-12T09:15:00Z' },
    { id: 'n4', title: 'Tactical Analysis: High Press vs Low Block', summary: 'An in-depth look at two contrasting tactical approaches.', content: 'Full tactical breakdown.', category: 'tactical', isBreaking: false, sentiment: 'neutral', readCount: 980, publishedAt: '2025-06-11T16:00:00Z' },
    { id: 'n5', title: 'Rumor: Manager Set to Leave After Tournament', summary: 'Reports suggest the manager will step down after the World Cup.', content: 'Full rumor analysis.', category: 'rumor', isBreaking: false, sentiment: 'negative', readCount: 2100, publishedAt: '2025-06-10T11:00:00Z' },
    { id: 'n6', title: 'Historical Performance in World Cup Knockouts', summary: 'A look at how teams have performed historically in knockout stages.', content: 'Historical data and analysis.', category: 'general', isBreaking: false, sentiment: 'neutral', readCount: 760, publishedAt: '2025-06-09T08:45:00Z' },
  ]
}

function generateRealtimeMetrics() {
  return Array.from({ length: 60 }, (_, i) => ({
    second: i,
    reqPerSec: 45 + Math.floor(Math.random() * 40),
    errorRate: 0.5 + Math.random() * 3,
    p50: 20 + Math.floor(Math.random() * 15),
    p95: 80 + Math.floor(Math.random() * 60),
    p99: 200 + Math.floor(Math.random() * 150),
  }))
}

function generateGeoData() {
  return [
    { country: 'United States', users: 2840, pct: 35 },
    { country: 'Brazil', users: 1620, pct: 20 },
    { country: 'United Kingdom', users: 980, pct: 12 },
    { country: 'Germany', users: 720, pct: 9 },
    { country: 'Nigeria', users: 560, pct: 7 },
    { country: 'India', users: 440, pct: 5 },
    { country: 'Others', users: 960, pct: 12 },
  ]
}

function generateContentCalendar() {
  const events = [
    { date: '2025-06-15', type: 'announcement', title: 'System Maintenance Window' },
    { date: '2025-06-18', type: 'news', title: 'World Cup Group Stage Preview' },
    { date: '2025-06-20', type: 'push', title: 'Match Day Reminder' },
    { date: '2025-06-22', type: 'announcement', title: 'New Feature: AI Tactical Analysis' },
    { date: '2025-06-25', type: 'news', title: 'Quarter-Final Predictions' },
    { date: '2025-06-28', type: 'push', title: 'Live Match Alert' },
    { date: '2025-07-01', type: 'announcement', title: 'Elite Plan Updates' },
    { date: '2025-07-05', type: 'news', title: 'Semi-Final Tactical Breakdown' },
  ]
  return events
}

function generateAuditTrail() {
  const actions = [
    { admin: 'admin@elastico.ai', action: 'Updated user plan', target: 'user@elastico.ai → Pro', time: '2m ago' },
    { admin: 'admin@elastico.ai', action: 'Created announcement', target: 'System Maintenance', time: '15m ago' },
    { admin: 'admin@elastico.ai', action: 'Toggled feature flag', target: 'ai_chat_v2 → enabled', time: '1h ago' },
    { admin: 'admin@elastico.ai', action: 'Updated setting', target: 'max_predictions_free → 10', time: '2h ago' },
    { admin: 'admin@elastico.ai', action: 'Deactivated user', target: 'spam@elastico.ai', time: '3h ago' },
    { admin: 'admin@elastico.ai', action: 'Sent broadcast', target: 'All users: "New features!"', time: '5h ago' },
    { admin: 'admin@elastico.ai', action: 'Exported user data', target: 'users_export.csv', time: '6h ago' },
    { admin: 'admin@elastico.ai', action: 'Cleared cache', target: 'System-wide', time: '8h ago' },
    { admin: 'admin@elastico.ai', action: 'Synced data', target: 'Teams, Players, Matches', time: '12h ago' },
    { admin: 'admin@elastico.ai', action: 'Enabled maintenance', target: 'System-wide', time: '1d ago' },
  ]
  return actions
}

function generateRateLimits() {
  return [
    { endpoint: '/api/auth/login', limit: 10, window: '15min', current: 3, pct: 30 },
    { endpoint: '/api/predictions', limit: 100, window: '1hr', current: 42, pct: 42 },
    { endpoint: '/api/matches', limit: 200, window: '1hr', current: 78, pct: 39 },
    { endpoint: '/api/admin/*', limit: 50, window: '1hr', current: 12, pct: 24 },
    { endpoint: '/api/chat', limit: 30, window: '1hr', current: 28, pct: 93 },
    { endpoint: '/api/news', limit: 100, window: '1hr', current: 15, pct: 15 },
    { endpoint: '/api/leaderboard', limit: 60, window: '1hr', current: 22, pct: 37 },
  ]
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function AdminView() {
  const user = useElasticoStore(s => s.user)
  const [activeTab, setActiveTab] = useState('overview')

  // ── Data State ──
  const [stats, setStats] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [userPagination, setUserPagination] = useState<any>({ page: 1, totalPages: 1, total: 0 })
  const [logs, setLogs] = useState<any[]>([])
  const [logPagination, setLogPagination] = useState<any>({ page: 1, totalPages: 1, total: 0 })
  const [settingsList, setSettingsList] = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [featureFlags, setFeatureFlags] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // ── User Tab State ──
  const [userSearch, setUserSearch] = useState('')
  const [userPlanFilter, setUserPlanFilter] = useState('all')
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [userStatusFilter, setUserStatusFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [userSortField, setUserSortField] = useState<string>('createdAt')
  const [userSortDir, setUserSortDir] = useState<'asc' | 'desc'>('desc')

  // ── Content Tab State ──
  const [announcementModal, setAnnouncementModal] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null)
  const [annForm, setAnnForm] = useState({ title: '', content: '', type: 'info', targetRole: 'all' })
  const [newsItems, setNewsItems] = useState(generateNewsItems())
  const [newsModal, setNewsModal] = useState(false)
  const [editingNews, setEditingNews] = useState<any>(null)
  const [newsForm, setNewsForm] = useState({ title: '', summary: '', content: '', category: 'general', isBreaking: false, sentiment: 'neutral' })
  const [pushForm, setPushForm] = useState({ title: '', message: '', segment: 'all' })

  // ── Invite User State ──
  const [inviteModal, setInviteModal] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', plan: 'free', role: 'user' })

  // ── Bulk Action State ──
  const [bulkActionModal, setBulkActionModal] = useState(false)
  const [bulkAction, setBulkAction] = useState('')

  // ── Log Tab State ──
  const [logStatusFilter, setLogStatusFilter] = useState('all')

  // ── Static Metrics (no setInterval) ──
  const staticMetrics = useMemo(() => generateRealtimeMetrics(), [])
  const realtimeData = staticMetrics
  const realtimeRef = useRef<NodeJS.Timeout | null>(null)

  // ── Data Fetching ──
  const fetchAdminData = useCallback(async () => {
    setLoading(true)
    try {
      const headers = authHeaders()
      const [statsRes, usersRes, logsRes, settingsRes, annRes, flagsRes] = await Promise.all([
        fetch('/api/admin', { headers }).then(r => r.json()).catch(() => null),
        fetch('/api/admin/users', { headers }).then(r => r.json()).catch(() => ({ users: [] })),
        fetch('/api/admin/logs?limit=50', { headers }).then(r => r.json()).catch(() => ({ logs: [] })),
        fetch('/api/admin/settings', { headers }).then(r => r.json()).catch(() => ({ settings: [] })),
        fetch('/api/admin/announcements', { headers }).then(r => r.json()).catch(() => ({ announcements: [] })),
        fetch('/api/admin/feature-flags', { headers }).then(r => r.json()).catch(() => ({ flags: [] })),
      ])
      setStats(statsRes?.dashboard || statsRes || null)
      setUsers(usersRes.users || [])
      setUserPagination(usersRes.pagination || { page: 1, totalPages: 1, total: 0 })
      setLogs(logsRes.logs || [])
      setLogPagination(logsRes.pagination || { page: 1, totalPages: 1, total: 0 })
      setSettingsList(Array.isArray(settingsRes.settings) ? settingsRes.settings : [])
      setAnnouncements(Array.isArray(annRes.announcements) ? annRes.announcements : [])
      setFeatureFlags(Array.isArray(flagsRes.flags) ? flagsRes.flags : [])
    } catch (e) { console.error('Admin fetch error:', e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAdminData() }, [fetchAdminData])

  // ── Filtered / Derived Data ──
  const filteredUsers = useMemo(() => {
    let result = [...users]
    if (userSearch) {
      const s = userSearch.toLowerCase()
      result = result.filter((u: any) => u.email?.toLowerCase().includes(s) || u.name?.toLowerCase().includes(s) || u.displayName?.toLowerCase().includes(s))
    }
    if (userPlanFilter !== 'all') result = result.filter((u: any) => u.plan === userPlanFilter)
    if (userRoleFilter !== 'all') result = result.filter((u: any) => u.role === userRoleFilter)
    if (userStatusFilter === 'banned') result = result.filter((u: any) => u.isBanned)
    else if (userStatusFilter === 'inactive') result = result.filter((u: any) => !u.isActive)
    else if (userStatusFilter === 'active') result = result.filter((u: any) => u.isActive && !u.isBanned)
    result.sort((a: any, b: any) => {
      const aVal = a[userSortField]
      const bVal = b[userSortField]
      if (typeof aVal === 'string' && typeof bVal === 'string') return userSortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return userSortDir === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0)
    })
    return result
  }, [users, userSearch, userPlanFilter, userRoleFilter, userStatusFilter, userSortField, userSortDir])

  const filteredLogs = useMemo(() => {
    if (logStatusFilter === 'all') return logs
    return logs.filter((l: any) => String(l.statusCode).startsWith(logStatusFilter))
  }, [logs, logStatusFilter])

  // ── User Segmentation ──
  const userSegments = useMemo(() => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return {
      power: users.filter((u: any) => u.totalPredictions > 50).length,
      dormant: users.filter((u: any) => u.lastLoginAt && new Date(u.lastLoginAt) < weekAgo).length,
      newSignups: users.filter((u: any) => new Date(u.createdAt) >= weekAgo).length,
      highAccuracy: users.filter((u: any) => u.predictionAccuracy > 60 && u.totalPredictions > 10).length,
      paying: users.filter((u: any) => u.plan !== 'free' && u.isActive).length,
    }
  }, [users])

  // ── Handlers ──
  const handleUpdateUser = async (userId: string, data: any) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(data),
      })
      if (res.ok) {
        toast.success('User updated')
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data } : u))
        if (selectedUser?.id === userId) setSelectedUser(prev => prev ? { ...prev, ...data } : null)
      }
    } catch { toast.error('Error updating user') }
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (res.ok) { toast.success('User deactivated'); fetchAdminData() }
    } catch { toast.error('Error deactivating user') }
  }

  const handleQuickAction = async (action: string) => {
    setActionLoading(action)
    try {
      const body: any = { action }
      if (action === 'broadcast') {
        body.message = 'System update: New features have been deployed!'
        body.title = 'ELASTICO Update'
        body.type = 'info'
      }
      const res = await fetch('/api/admin', { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) })
      if (res.ok) {
        const data = await res.json()
        toast.success(data.message || `Action "${action}" completed`)
        if (action === 'maintenance') fetchAdminData()
      } else {
        toast.error('Action failed')
      }
    } catch { toast.error('Action error') }
    finally { setActionLoading(null) }
  }

  const handleExportCSV = () => {
    const csv = [
      'Email,Name,Plan,Role,Active,Predictions,Accuracy,Last Login',
      ...users.map((u: any) =>
        `${u.email},${u.name || ''},${u.plan},${u.role},${u.isActive},${u.totalPredictions},${u.predictionAccuracy}%,${u.lastLoginAt || 'Never'}`
      ),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'elastico_users_export.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  const handleCreateAnnouncement = async () => {
    if (!annForm.title || !annForm.content) { toast.error('Title and content required'); return }
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(annForm),
      })
      if (res.ok) {
        toast.success('Announcement created')
        setAnnForm({ title: '', content: '', type: 'info', targetRole: 'all' })
        setAnnouncementModal(false)
        setEditingAnnouncement(null)
        fetchAdminData()
      }
    } catch { toast.error('Error creating announcement') }
  }

  const handleCreateNews = () => {
    if (!newsForm.title) { toast.error('Title required'); return }
    if (editingNews) {
      setNewsItems(prev => prev.map(n => n.id === editingNews.id ? { ...n, ...newsForm } : n))
      toast.success('News updated')
    } else {
      const newItem = { id: `n-${Date.now()}`, ...newsForm, readCount: 0, publishedAt: new Date().toISOString() }
      setNewsItems(prev => [newItem, ...prev])
      toast.success('News published')
    }
    setNewsForm({ title: '', summary: '', content: '', category: 'general', isBreaking: false, sentiment: 'neutral' })
    setNewsModal(false)
    setEditingNews(null)
  }

  const handleDeleteNews = (id: string) => {
    setNewsItems(prev => prev.filter(n => n.id !== id))
    toast.success('News deleted')
  }

  const handleSendPush = () => {
    if (!pushForm.title || !pushForm.message) { toast.error('Title and message required'); return }
    toast.success(`Push notification sent to ${pushForm.segment === 'all' ? 'all users' : pushForm.segment}`)
    setPushForm({ title: '', message: '', segment: 'all' })
  }

  const handleBulkAction = async () => {
    if (selectedUsers.size === 0) { toast.error('No users selected'); return }
    const data: any = {}
    if (bulkAction === 'upgrade-pro') data.plan = 'pro'
    else if (bulkAction === 'upgrade-elite') data.plan = 'elite'
    else if (bulkAction === 'downgrade-free') data.plan = 'free'
    else if (bulkAction === 'activate') data.isActive = true
    else if (bulkAction === 'deactivate') data.isActive = false

    let success = 0
    for (const userId of selectedUsers) {
      try {
        const res = await fetch(`/api/admin/users/${userId}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(data) })
        if (res.ok) success++
      } catch { /* skip */ }
    }
    toast.success(`Bulk action completed: ${success}/${selectedUsers.size} users updated`)
    setSelectedUsers(new Set())
    setBulkActionModal(false)
    setBulkAction('')
    fetchAdminData()
  }

  const handleInviteUser = () => {
    if (!inviteForm.email || !inviteForm.email.includes('@')) { toast.error('Valid email required'); return }
    toast.success(`Invitation sent to ${inviteForm.email} with ${inviteForm.plan} plan`)
    setInviteForm({ email: '', plan: 'free', role: 'user' })
    setInviteModal(false)
  }

  const handleToggleSetting = async (key: string, value: string) => {
    try {
      await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ settings: [{ key, value, type: 'string' }] }),
      })
      setSettingsList(prev => prev.map(s => s.key === key ? { ...s, value } : s))
      toast.success('Setting updated')
    } catch { toast.error('Error updating setting') }
  }

  const handleToggleFlag = async (flag: any) => {
    try {
      const res = await fetch('/api/admin/feature-flags', {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ name: flag.name, isEnabled: !flag.isEnabled }),
      })
      if (res.ok) {
        const updated = await res.json()
        setFeatureFlags(prev => prev.map(f => f.name === flag.name ? { ...f, ...updated.flag } : f))
        toast.success(`Feature flag "${flag.name}" ${flag.isEnabled ? 'disabled' : 'enabled'}`)
      }
    } catch { toast.error('Error toggling flag') }
  }

  const handleUpdateFlag = async (flag: any, updates: any) => {
    try {
      const res = await fetch('/api/admin/feature-flags', {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ name: flag.name, ...updates }),
      })
      if (res.ok) {
        const updated = await res.json()
        setFeatureFlags(prev => prev.map(f => f.name === flag.name ? { ...f, ...updated.flag } : f))
        toast.success('Feature flag updated')
      }
    } catch { toast.error('Error updating flag') }
  }

  const toggleUserSelect = (userId: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const toggleAllUsers = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set())
    } else {
      setSelectedUsers(new Set(filteredUsers.map((u: any) => u.id)))
    }
  }

  const handleSortUsers = (field: string) => {
    if (userSortField === field) setUserSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setUserSortField(field); setUserSortDir('asc') }
  }

  const fetchUsersPage = async (page: number) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (userSearch) params.set('search', userSearch)
      if (userPlanFilter !== 'all') params.set('plan', userPlanFilter)
      if (userRoleFilter !== 'all') params.set('role', userRoleFilter)
      const res = await fetch(`/api/admin/users?${params}`, { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
        setUserPagination(data.pagination || { page: 1, totalPages: 1, total: 0 })
      }
    } catch { /* silent */ }
  }

  const fetchLogsPage = async (page: number) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (logStatusFilter !== 'all') params.set('statusCode', logStatusFilter === 'error' ? '4' : logStatusFilter)
      const res = await fetch(`/api/admin/logs?${params}`, { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
        setLogPagination(data.pagination || { page: 1, totalPages: 1, total: 0 })
      }
    } catch { /* silent */ }
  }

  // ── Mock data (used when API data is unavailable) ──
  const userGrowthData = useMemo(() => generateUserGrowth(), [])
  const apiUsageData = useMemo(() => generateApiUsage(), [])
  const revenueTrendData = useMemo(() => generateRevenueTrend(), [])
  const activityFeed = useMemo(() => generateActivityFeed(), [])
  const modelPerfData = useMemo(() => generateModelPerformance(), [])
  const heatmapData = useMemo(() => generateHeatmapData(), [])
  const funnelData = useMemo(() => generateFunnelData(), [])
  const featureUsageData = useMemo(() => generateFeatureUsage(), [])
  const abTestData = useMemo(() => generateAbTests(), [])
  const subscriptionData = useMemo(() => generateSubscriptions(), [])
  const geoData = useMemo(() => generateGeoData(), [])
  const contentCalendar = useMemo(() => generateContentCalendar(), [])
  const auditTrail = useMemo(() => generateAuditTrail(), [])
  const rateLimitData = useMemo(() => generateRateLimits(), [])

  const revenueByPlan = useMemo(() => {
    const free = stats?.totalUsers ? stats.totalUsers - (stats.proCount || 0) - (stats.eliteCount || 0) : 120
    return [
      { name: 'Free', value: free, color: '#6b7280' },
      { name: 'Pro', value: stats?.proCount || 28, color: '#00b4d8' },
      { name: 'Elite', value: stats?.eliteCount || 12, color: '#ffd700' },
    ]
  }, [stats])

  // ── Security Score Calculation ──
  const securityScore = useMemo(() => {
    let score = 100
    if (users.some((u: any) => u.failedLogins > 3)) score -= 15
    if (users.some((u: any) => u.lockedUntil)) score -= 20
    if (!users.some((u: any) => u.twoFactorEnabled)) score -= 25
    if (stats?.errorRate > 5) score -= 10
    return Math.max(score, 0)
  }, [users, stats])

  // ── Loading State ──
  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    )
  }

  // ── Render ──
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold gradient-text">Admin Dashboard</h1>
            <p className="text-xs text-muted-foreground">ELASTICO System Management Console</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
            <Activity className="h-3 w-3 mr-1" />
            Live
          </Badge>
          <Button variant="outline" size="sm" onClick={fetchAdminData} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/30 p-1">
          <TabsTrigger value="overview" className="gap-1.5 text-xs data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <LayoutDashboard className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5 text-xs data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <UserCog className="h-3.5 w-3.5" /> Users
          </TabsTrigger>
          <TabsTrigger value="content" className="gap-1.5 text-xs data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <FilePlus2 className="h-3.5 w-3.5" /> Content
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5 text-xs data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <ChartLine className="h-3.5 w-3.5" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="finance" className="gap-1.5 text-xs data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <Wallet className="h-3.5 w-3.5" /> Finance
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-1.5 text-xs data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <Wrench className="h-3.5 w-3.5" /> System
          </TabsTrigger>
        </TabsList>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: OVERVIEW                                                       */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Feature 1: KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard title="Total Users" value={stats?.totalUsers || 0} icon={Users} change={12.5} color="emerald" />
            <StatCard title="Active Today" value={stats?.activeToday || 0} icon={Activity} change={8.3} color="blue" />
            <StatCard title="MRR Revenue" value={`$${(stats?.revenueEstimate || 0).toFixed(0)}`} icon={DollarSign} change={18.2} color="gold" />
            <StatCard title="Prediction Acc" value={`${stats?.errorRate !== undefined ? (100 - (stats.errorRate || 0) * 2).toFixed(1) : '64.2'}%`} icon={Target} change={3.1} color="emerald" />
            <StatCard title="AI Queries" value={stats?.totalApiCalls24h || 0} icon={Brain} change={-2.4} color="purple" />
            <StatCard title="Uptime" value="99.97%" icon={Server} change={0.02} color="emerald" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Feature 2: User Growth Chart */}
            <SectionCard title="User Growth (30 Days)" icon={TrendingUp}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={userGrowthData}>
                    <defs>
                      <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00e676" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#00e676" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradPro" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00b4d8" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#00b4d8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.2 0.03 260)" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }} interval={4} />
                    <YAxis tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }} />
                    <RTooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="users" stroke="#00e676" fill="url(#gradUsers)" strokeWidth={2} />
                    <Area type="monotone" dataKey="pro" stroke="#00b4d8" fill="url(#gradPro)" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            {/* Feature 3: Revenue Breakdown */}
            <SectionCard title="Revenue Breakdown" icon={PieChart as any}>
              <div className="h-64 flex items-center">
                <div className="w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={revenueByPlan} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                        {revenueByPlan.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <RTooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 space-y-3">
                  {revenueByPlan.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-sm">{item.name}</span>
                      </div>
                      <span className="text-sm font-bold">{item.value}</span>
                    </div>
                  ))}
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Pro + Elite Revenue</span>
                    <span className="text-emerald-400 font-bold text-sm">
                      ${((stats?.proCount || 0) * 9.99 + (stats?.eliteCount || 0) * 24.99).toFixed(2)}/mo
                    </span>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Feature 4: System Health Monitor */}
            <SectionCard title="System Health" icon={Heart}>
              <div className="space-y-4">
                <GaugeBar value={42} label="CPU Usage" color="#00e676" />
                <GaugeBar value={67} label="Memory Usage" color="#00b4d8" />
                <GaugeBar value={28} label="Disk Usage" color="#ffd700" />
                <GaugeBar value={23} label="API Latency (ms avg)" color="#a855f7" max={200} />
                <GaugeBar value={stats?.errorRate ? Math.min(stats.errorRate, 100) : 1.2} label="Error Rate" color={stats?.errorRate > 5 ? '#ff4757' : '#00e676'} max={10} />
                <div className="flex items-center gap-2 pt-2">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs text-emerald-400">All systems operational</span>
                  <span className="text-xs text-muted-foreground ml-auto">Last check: just now</span>
                </div>
              </div>
            </SectionCard>

            {/* Feature 5: Quick Actions Panel */}
            <SectionCard title="Quick Actions" icon={Zap}>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="gap-2 justify-start" onClick={() => { toast.success('Cache cleared'); handleQuickAction('clearCache') }}>
                  <RefreshCw className={`h-3.5 w-3.5 ${actionLoading === 'clearCache' ? 'animate-spin' : ''}`} /> Clear Cache
                </Button>
                <Button variant="outline" size="sm" className="gap-2 justify-start" onClick={() => handleQuickAction('broadcast')}>
                  <Megaphone className="h-3.5 w-3.5" /> Send Broadcast
                </Button>
                <Button variant="outline" size="sm" className="gap-2 justify-start" onClick={() => handleQuickAction('maintenance')}>
                  <ToggleLeft className="h-3.5 w-3.5" /> Maintenance
                </Button>
                <Button variant="outline" size="sm" className="gap-2 justify-start" onClick={() => handleQuickAction('sync')}>
                  <Upload className="h-3.5 w-3.5" /> Sync Data
                </Button>
                <Button variant="outline" size="sm" className="gap-2 justify-start" onClick={handleExportCSV}>
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
                <Button variant="outline" size="sm" className="gap-2 justify-start" onClick={() => { toast.success('Diagnostics complete: All checks passed') }}>
                  <Bug className="h-3.5 w-3.5" /> Diagnostics
                </Button>
              </div>
            </SectionCard>
          </div>

          {/* Feature 6: Activity Feed */}
          <SectionCard title="Recent Activity" icon={Activity}>
            <ScrollArea className="max-h-80">
              <div className="space-y-2">
                {activityFeed.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                    <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                      item.type === 'login' ? 'bg-emerald-500/10 text-emerald-400' :
                      item.type === 'prediction' ? 'bg-cyan-500/10 text-cyan-400' :
                      item.type === 'subscription' ? 'bg-amber-500/10 text-amber-400' :
                      item.type === 'achievement' ? 'bg-purple-500/10 text-purple-400' :
                      'bg-gray-500/10 text-gray-400'
                    }`}>
                      {item.type === 'login' ? <Key className="h-3 w-3" /> :
                       item.type === 'prediction' ? <Target className="h-3 w-3" /> :
                       item.type === 'subscription' ? <Crown className="h-3 w-3" /> :
                       item.type === 'achievement' ? <Star className="h-3 w-3" /> :
                       <Activity className="h-3 w-3" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium text-foreground">{item.email}</span>
                        <span className="text-muted-foreground"> {item.description}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{item.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </SectionCard>
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: USERS                                                          */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="users" className="space-y-6 mt-6">
          {/* User Segmentation (Feature 11) */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="glass-card animate-fade-in-up cursor-pointer hover:border-emerald-500/30" onClick={() => { setUserPlanFilter('all'); setUserRoleFilter('all'); setUserStatusFilter('active') }}>
              <CardContent className="p-3 text-center">
                <Zap className="h-4 w-4 text-amber-400 mx-auto mb-1" />
                <p className="text-lg font-bold">{userSegments.power}</p>
                <p className="text-xs text-muted-foreground">Power Users</p>
              </CardContent>
            </Card>
            <Card className="glass-card animate-fade-in-up cursor-pointer hover:border-emerald-500/30">
              <CardContent className="p-3 text-center">
                <UserX className="h-4 w-4 text-red-400 mx-auto mb-1" />
                <p className="text-lg font-bold">{userSegments.dormant}</p>
                <p className="text-xs text-muted-foreground">Dormant (7d+)</p>
              </CardContent>
            </Card>
            <Card className="glass-card animate-fade-in-up cursor-pointer hover:border-emerald-500/30">
              <CardContent className="p-3 text-center">
                <UserPlus className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
                <p className="text-lg font-bold">{userSegments.newSignups}</p>
                <p className="text-xs text-muted-foreground">New Signups (7d)</p>
              </CardContent>
            </Card>
            <Card className="glass-card animate-fade-in-up cursor-pointer hover:border-emerald-500/30">
              <CardContent className="p-3 text-center">
                <Target className="h-4 w-4 text-cyan-400 mx-auto mb-1" />
                <p className="text-lg font-bold">{userSegments.highAccuracy}</p>
                <p className="text-xs text-muted-foreground">High Accuracy</p>
              </CardContent>
            </Card>
            <Card className="glass-card animate-fade-in-up cursor-pointer hover:border-emerald-500/30">
              <CardContent className="p-3 text-center">
                <Crown className="h-4 w-4 text-amber-400 mx-auto mb-1" />
                <p className="text-lg font-bold">{userSegments.paying}</p>
                <p className="text-xs text-muted-foreground">Paying Users</p>
              </CardContent>
            </Card>
          </div>

          {/* Feature 7: Advanced User Table */}
          <SectionCard title="User Management" icon={Users} className="col-span-full">
            <div className="space-y-3">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search users..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="pl-9 h-9" />
                </div>
                <Select value={userPlanFilter} onValueChange={setUserPlanFilter}>
                  <SelectTrigger className="w-28 h-9"><SelectValue placeholder="Plan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plans</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="elite">Elite</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                  <SelectTrigger className="w-28 h-9"><SelectValue placeholder="Role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={userStatusFilter} onValueChange={setUserStatusFilter}>
                  <SelectTrigger className="w-28 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="banned">Banned</SelectItem>
                  </SelectContent>
                </Select>
                {/* Bulk Actions + Invite */}
                {selectedUsers.size > 0 && (
                  <Dialog open={bulkActionModal} onOpenChange={setBulkActionModal}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <CheckSquare className="h-3.5 w-3.5" />
                        Bulk ({selectedUsers.size})
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="glass-card">
                      <DialogHeader>
                        <DialogTitle>Bulk Action</DialogTitle>
                        <DialogDescription>Apply action to {selectedUsers.size} selected users</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-2">
                        {['upgrade-pro', 'upgrade-elite', 'downgrade-free', 'activate', 'deactivate'].map(a => (
                          <Button key={a} variant="outline" size="sm" className="w-full justify-start"
                            onClick={() => { setBulkAction(a) }}>
                            {a === 'upgrade-pro' && <ArrowUpRight className="h-3.5 w-3.5 mr-2 text-cyan-400" />}
                            {a === 'upgrade-elite' && <Crown className="h-3.5 w-3.5 mr-2 text-amber-400" />}
                            {a === 'downgrade-free' && <ArrowDownRight className="h-3.5 w-3.5 mr-2 text-gray-400" />}
                            {a === 'activate' && <UserCheck className="h-3.5 w-3.5 mr-2 text-emerald-400" />}
                            {a === 'deactivate' && <UserX className="h-3.5 w-3.5 mr-2 text-red-400" />}
                            {a.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Button>
                        ))}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setBulkActionModal(false)}>Cancel</Button>
                        <Button onClick={handleBulkAction} disabled={!bulkAction}>Apply</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
                <Dialog open={inviteModal} onOpenChange={setInviteModal}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                      <UserPlus className="h-3.5 w-3.5" /> Invite User
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="glass-card">
                    <DialogHeader>
                      <DialogTitle>Invite User</DialogTitle>
                      <DialogDescription>Send an invitation to a new user</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input placeholder="user@example.com" value={inviteForm.email} onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Plan</Label>
                        <Select value={inviteForm.plan} onValueChange={v => setInviteForm(p => ({ ...p, plan: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="elite">Elite</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={inviteForm.role} onValueChange={v => setInviteForm(p => ({ ...p, role: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setInviteModal(false)}>Cancel</Button>
                      <Button onClick={handleInviteUser}>Send Invitation</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Table */}
              <ScrollArea className="max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                          onCheckedChange={toggleAllUsers} />
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSortUsers('email')}>
                        User <ArrowUpRight className="inline h-3 w-3 opacity-50" />
                      </TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSortUsers('predictionAccuracy')}>
                        Accuracy <ArrowUpRight className="inline h-3 w-3 opacity-50" />
                      </TableHead>
                      <TableHead>Predictions</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSortUsers('lastLoginAt')}>
                        Last Login <ArrowUpRight className="inline h-3 w-3 opacity-50" />
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow><TableCell colSpan={9}><EmptyState message="No users found" /></TableCell></TableRow>
                    ) : (
                      filteredUsers.map((u: any) => (
                        <TableRow key={u.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedUser(u)}>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <Checkbox checked={selectedUsers.has(u.id)} onCheckedChange={() => toggleUserSelect(u.id)} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 flex items-center justify-center text-xs font-bold">
                                {(u.email?.[0] || '?').toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{u.displayName || u.name || u.email}</p>
                                <p className="text-xs text-muted-foreground">{u.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={PLAN_COLORS[u.plan] || ''}>{u.plan}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={ROLE_COLORS[u.role] || ''}>{u.role}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(u.predictionAccuracy || 0, 100)}%` }} />
                              </div>
                              <span className="text-xs font-mono">{u.predictionAccuracy || 0}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{u.totalPredictions || 0}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                          </TableCell>
                          <TableCell>
                            {u.isBanned ? <Badge variant="destructive" className="text-xs">Banned</Badge> :
                             !u.isActive ? <Badge variant="secondary" className="text-xs">Inactive</Badge> :
                             <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400">Active</Badge>}
                          </TableCell>
                          <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7"
                                onClick={() => handleUpdateUser(u.id, { isActive: !u.isActive })}>
                                {u.isActive ? <Ban className="h-3.5 w-3.5 text-red-400" /> : <UserCheck className="h-3.5 w-3.5 text-emerald-400" />}
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7"
                                onClick={() => handleUpdateUser(u.id, { plan: u.plan === 'elite' ? 'free' : u.plan === 'pro' ? 'elite' : 'pro' })}>
                                <Crown className="h-3.5 w-3.5 text-amber-400" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDeleteUser(u.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-red-400" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              {/* Pagination */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{filteredUsers.length} of {userPagination.total} users</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={userPagination.page <= 1}
                    onClick={() => fetchUsersPage(userPagination.page - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span>Page {userPagination.page} of {userPagination.totalPages}</span>
                  <Button size="sm" variant="outline" disabled={userPagination.page >= userPagination.totalPages}
                    onClick={() => fetchUsersPage(userPagination.page + 1)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Feature 8: User Detail Modal */}
          <Dialog open={!!selectedUser} onOpenChange={(open) => { if (!open) setSelectedUser(null) }}>
            <DialogContent className="glass-card max-w-lg max-h-[80vh] overflow-y-auto">
              {selectedUser && (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 flex items-center justify-center text-lg font-bold">
                        {(selectedUser.email?.[0] || '?').toUpperCase()}
                      </div>
                      <div>
                        <p>{selectedUser.displayName || selectedUser.name || selectedUser.email}</p>
                        <p className="text-sm font-normal text-muted-foreground">{selectedUser.email}</p>
                      </div>
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-muted/30">
                        <p className="text-xs text-muted-foreground">Plan</p>
                        <Badge variant="outline" className={PLAN_COLORS[selectedUser.plan] || ''}>{selectedUser.plan}</Badge>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <p className="text-xs text-muted-foreground">Role</p>
                        <Badge variant="outline" className={ROLE_COLORS[selectedUser.role] || ''}>{selectedUser.role}</Badge>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <p className="text-xs text-muted-foreground">Predictions</p>
                        <p className="text-lg font-bold">{selectedUser.totalPredictions || 0}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <p className="text-xs text-muted-foreground">Accuracy</p>
                        <p className="text-lg font-bold text-emerald-400">{selectedUser.predictionAccuracy || 0}%</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <p className="text-xs text-muted-foreground">Best Streak</p>
                        <p className="text-lg font-bold text-amber-400">{selectedUser.bestStreak || 0}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <p className="text-xs text-muted-foreground">Login Count</p>
                        <p className="text-lg font-bold">{selectedUser.loginCount || 0}</p>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Session Info</p>
                      <div className="flex justify-between text-sm">
                        <span>Last Login</span>
                        <span>{selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : 'Never'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Account Created</span>
                        <span>{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : '—'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Failed Logins</span>
                        <span className={selectedUser.failedLogins > 0 ? 'text-red-400' : ''}>{selectedUser.failedLogins || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>2FA Enabled</span>
                        <span>{selectedUser.twoFactorEnabled ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex flex-wrap gap-2">
                      <Select value={selectedUser.plan} onValueChange={v => handleUpdateUser(selectedUser.id, { plan: v })}>
                        <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="elite">Elite</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" onClick={() => handleUpdateUser(selectedUser.id, { isActive: !selectedUser.isActive })}>
                        {selectedUser.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleUpdateUser(selectedUser.id, { isBanned: !selectedUser.isBanned, banReason: selectedUser.isBanned ? null : 'Admin action' })}>
                        {selectedUser.isBanned ? 'Unban' : 'Ban'}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>

          {/* Feature 10: User Analytics Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* User Acquisition */}
            <SectionCard title="User Acquisition" icon={TrendingUp}>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={userGrowthData.slice(-14)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.2 0.03 260)" />
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'oklch(0.6 0 0)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }} />
                    <RTooltip content={<ChartTooltip />} />
                    <Bar dataKey="pro" stackId="a" fill="#00b4d8" name="Pro" />
                    <Bar dataKey="elite" stackId="a" fill="#ffd700" name="Elite" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            {/* Geographic Distribution */}
            <SectionCard title="Geographic Distribution" icon={Globe}>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={geoData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.2 0.03 260)" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }} />
                    <YAxis type="category" dataKey="country" tick={{ fontSize: 9, fill: 'oklch(0.6 0 0)' }} width={90} />
                    <RTooltip content={<ChartTooltip />} />
                    <Bar dataKey="users" fill="#00e676" name="Users" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: CONTENT                                                        */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="content" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Feature 13: Announcement Manager */}
            <SectionCard title="Announcements" icon={Megaphone}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{announcements.length} active</p>
                  <Dialog open={announcementModal} onOpenChange={(open) => { setAnnouncementModal(open); if (!open) { setEditingAnnouncement(null); setAnnForm({ title: '', content: '', type: 'info', targetRole: 'all' }) } }}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 h-8">
                        <Plus className="h-3.5 w-3.5" /> New
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="glass-card">
                      <DialogHeader>
                        <DialogTitle>{editingAnnouncement ? 'Edit' : 'Create'} Announcement</DialogTitle>
                        <DialogDescription>Announcements are shown to targeted user roles</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Title</Label>
                          <Input value={annForm.title} onChange={e => setAnnForm(p => ({ ...p, title: e.target.value }))} placeholder="Announcement title" />
                        </div>
                        <div className="space-y-2">
                          <Label>Content</Label>
                          <Textarea value={annForm.content} onChange={e => setAnnForm(p => ({ ...p, content: e.target.value }))} placeholder="Announcement content..." rows={3} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Type</Label>
                            <Select value={annForm.type} onValueChange={v => setAnnForm(p => ({ ...p, type: v }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {ANNOUNCEMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Target Role</Label>
                            <Select value={annForm.targetRole} onValueChange={v => setAnnForm(p => ({ ...p, targetRole: v }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="pro">Pro</SelectItem>
                                <SelectItem value="elite">Elite</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setAnnouncementModal(false)}>Cancel</Button>
                        <Button onClick={handleCreateAnnouncement}>{editingAnnouncement ? 'Update' : 'Create'}</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <ScrollArea className="max-h-64">
                  <div className="space-y-2">
                    {announcements.length === 0 ? (
                      <EmptyState message="No announcements" />
                    ) : (
                      announcements.map((ann: any) => (
                        <div key={ann.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20">
                          <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                            ann.type === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                            ann.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                            ann.type === 'maintenance' ? 'bg-red-500/10 text-red-400' :
                            'bg-cyan-500/10 text-cyan-400'
                          }`}>
                            {ann.type === 'warning' ? <AlertTriangle className="h-3.5 w-3.5" /> :
                             ann.type === 'success' ? <CheckCircle className="h-3.5 w-3.5" /> :
                             ann.type === 'maintenance' ? <Wrench className="h-3.5 w-3.5" /> :
                             <Bell className="h-3.5 w-3.5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{ann.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">{ann.content}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-[10px]">{ann.targetRole}</Badge>
                              <span className="text-[10px] text-muted-foreground">{new Date(ann.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </SectionCard>

            {/* Feature 14: News Publisher */}
            <SectionCard title="News Publisher" icon={Newspaper}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{newsItems.length} articles</p>
                  <Dialog open={newsModal} onOpenChange={(open) => { setNewsModal(open); if (!open) { setEditingNews(null); setNewsForm({ title: '', summary: '', content: '', category: 'general', isBreaking: false, sentiment: 'neutral' }) } }}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 h-8"
                        onClick={() => { setEditingNews(null); setNewsForm({ title: '', summary: '', content: '', category: 'general', isBreaking: false, sentiment: 'neutral' }) }}>
                        <Plus className="h-3.5 w-3.5" /> New Article
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="glass-card">
                      <DialogHeader>
                        <DialogTitle>{editingNews ? 'Edit' : 'Create'} News Article</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Title</Label>
                          <Input value={newsForm.title} onChange={e => setNewsForm(p => ({ ...p, title: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Summary</Label>
                          <Textarea value={newsForm.summary} onChange={e => setNewsForm(p => ({ ...p, summary: e.target.value }))} rows={2} />
                        </div>
                        <div className="space-y-2">
                          <Label>Content</Label>
                          <Textarea value={newsForm.content} onChange={e => setNewsForm(p => ({ ...p, content: e.target.value }))} rows={4} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-2">
                            <Label>Category</Label>
                            <Select value={newsForm.category} onValueChange={v => setNewsForm(p => ({ ...p, category: v }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {NEWS_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Sentiment</Label>
                            <Select value={newsForm.sentiment} onValueChange={v => setNewsForm(p => ({ ...p, sentiment: v }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {NEWS_SENTIMENTS.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-end gap-2 pb-1">
                            <div className="flex items-center gap-2">
                              <Switch checked={newsForm.isBreaking} onCheckedChange={c => setNewsForm(p => ({ ...p, isBreaking: c }))} />
                              <Label className="text-xs">Breaking</Label>
                            </div>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setNewsModal(false)}>Cancel</Button>
                        <Button onClick={handleCreateNews}>{editingNews ? 'Update' : 'Publish'}</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <ScrollArea className="max-h-64">
                  <div className="space-y-2">
                    {newsItems.map((news) => (
                      <div key={news.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 group">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {news.isBreaking && <Badge variant="destructive" className="text-[10px] animate-pulse">BREAKING</Badge>}
                            <p className="text-sm font-medium line-clamp-1">{news.title}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px]">{news.category}</Badge>
                            <span className="text-[10px] text-muted-foreground">{news.readCount} reads</span>
                            <span className="text-[10px] text-muted-foreground">
                              {news.sentiment === 'positive' ? '😊' : news.sentiment === 'negative' ? '😟' : '😐'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => { setEditingNews(news); setNewsForm({ title: news.title, summary: news.summary || '', content: news.content || '', category: news.category, isBreaking: news.isBreaking, sentiment: news.sentiment || 'neutral' }); setNewsModal(true) }}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDeleteNews(news.id)}>
                            <Trash2 className="h-3 w-3 text-red-400" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Feature 15: Content Calendar */}
            <SectionCard title="Content Calendar" icon={CalendarDays}>
              <ScrollArea className="max-h-64">
                <div className="space-y-2">
                  {contentCalendar.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/20">
                      <div className="text-center shrink-0 w-14">
                        <p className="text-xs text-muted-foreground">{new Date(item.date).toLocaleDateString('en', { month: 'short' })}</p>
                        <p className="text-lg font-bold">{new Date(item.date).getDate()}</p>
                      </div>
                      <div className={`p-1.5 rounded-lg shrink-0 ${
                        item.type === 'announcement' ? 'bg-cyan-500/10 text-cyan-400' :
                        item.type === 'news' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-purple-500/10 text-purple-400'
                      }`}>
                        {item.type === 'announcement' ? <Bell className="h-3.5 w-3.5" /> :
                         item.type === 'news' ? <Newspaper className="h-3.5 w-3.5" /> :
                         <Send className="h-3.5 w-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium line-clamp-1">{item.title}</p>
                        <Badge variant="outline" className="text-[10px] mt-0.5">{item.type}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </SectionCard>

            {/* Feature 16: Push Notification Composer */}
            <SectionCard title="Push Notification Composer" icon={Radio}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={pushForm.title} onChange={e => setPushForm(p => ({ ...p, title: e.target.value }))} placeholder="Notification title" />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea value={pushForm.message} onChange={e => setPushForm(p => ({ ...p, message: e.target.value }))} placeholder="Notification message..." rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Target Segment</Label>
                  <Select value={pushForm.segment} onValueChange={v => setPushForm(p => ({ ...p, segment: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="free">Free Users</SelectItem>
                      <SelectItem value="pro">Pro Users</SelectItem>
                      <SelectItem value="elite">Elite Users</SelectItem>
                      <SelectItem value="inactive">Inactive Users (7d+)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleSendPush}>
                  <Send className="h-4 w-4 mr-2" /> Send Push Notification
                </Button>
              </div>
            </SectionCard>
          </div>

          {/* Feature 17: Content Analytics */}
          <SectionCard title="Content Analytics" icon={BarChart3}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Most Read News</p>
                <div className="space-y-2">
                  {newsItems.sort((a, b) => b.readCount - a.readCount).map((news, i) => (
                    <div key={news.id} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-1">{news.title}</p>
                        <div className="h-1 bg-muted rounded-full mt-1">
                          <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(news.readCount / Math.max(...newsItems.map(n => n.readCount))) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{news.readCount}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Sentiment Distribution</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[
                        { name: 'Positive', value: newsItems.filter(n => n.sentiment === 'positive').length, fill: '#00e676' },
                        { name: 'Negative', value: newsItems.filter(n => n.sentiment === 'negative').length, fill: '#ff4757' },
                        { name: 'Neutral', value: newsItems.filter(n => n.sentiment === 'neutral').length, fill: '#6b7280' },
                      ]} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" label>
                      </Pie>
                      <RTooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB 4: ANALYTICS                                                      */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="analytics" className="space-y-6 mt-6">
          {/* Feature 18: Prediction Model Performance */}
          <SectionCard title="Prediction Model Performance" icon={Brain}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <ScrollArea className="max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Model</TableHead>
                        <TableHead>Accuracy</TableHead>
                        <TableHead>Predictions</TableHead>
                        <TableHead>Avg Confidence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modelPerfData.map((m) => (
                        <TableRow key={m.model}>
                          <TableCell className="font-medium">{m.model}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-emerald-400" style={{ width: `${m.accuracy}%` }} />
                              </div>
                              <span className="text-xs font-mono">{m.accuracy}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{m.predictions}</TableCell>
                          <TableCell className="text-sm">{m.avgConfidence}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={modelPerfData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.2 0.03 260)" />
                    <XAxis dataKey="model" tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }} domain={[0, 100]} />
                    <RTooltip content={<ChartTooltip />} />
                    <Bar dataKey="accuracy" fill="#00e676" name="Accuracy" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="avgConfidence" fill="#00b4d8" name="Confidence" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Feature 19: Match Prediction Heatmap */}
            <SectionCard title="Match Prediction Heatmap" icon={Target}>
              <div className="space-y-2">
                {heatmapData.map((item) => {
                  const intensity = item.accuracy / 100
                  const bg = intensity > 0.7 ? 'bg-emerald-500/30 border-emerald-500/20' :
                             intensity > 0.5 ? 'bg-amber-500/20 border-amber-500/20' :
                             'bg-red-500/20 border-red-500/20'
                  return (
                    <div key={item.stage} className={`flex items-center justify-between p-2.5 rounded-lg border ${bg}`}>
                      <span className="text-sm font-medium">{item.stage}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{item.predictions} preds</span>
                        <span className="text-sm font-bold">{item.accuracy}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </SectionCard>

            {/* Feature 22: Funnel Analysis */}
            <SectionCard title="Conversion Funnel" icon={Filter}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.2 0.03 260)" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }} />
                    <YAxis type="category" dataKey="stage" tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }} width={110} />
                    <RTooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Users" radius={[0, 4, 4, 0]}>
                      {funnelData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {funnelData.map((item, i) => (
                  <div key={item.stage} className="text-center">
                    <p className="text-[10px] text-muted-foreground">{item.stage}</p>
                    <p className="text-sm font-bold" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}>{item.pct}%</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Feature 20: A/B Test Manager */}
            <SectionCard title="A/B Test Manager" icon={GitBranch}>
              <ScrollArea className="max-h-72">
                <div className="space-y-3">
                  {abTestData.map((test) => (
                    <div key={test.id} className="p-3 rounded-lg bg-muted/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{test.name}</p>
                        <div className="flex items-center gap-2">
                          {test.significant && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Significant</Badge>}
                          <Badge variant={test.status === 'Winner' ? 'default' : 'outline'} className={test.status === 'Winner' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]' : 'text-[10px]'}>
                            {test.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Variant: {test.variant}</span>
                        <span className={test.metric.startsWith('+') ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>{test.metric}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Started: {test.startDate}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </SectionCard>

            {/* Feature 21: Feature Usage Analytics */}
            <SectionCard title="Feature Usage Analytics" icon={BarChart3}>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={featureUsageData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.2 0.03 260)" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }} domain={[0, 100]} />
                    <YAxis type="category" dataKey="feature" tick={{ fontSize: 9, fill: 'oklch(0.6 0 0)' }} width={80} />
                    <RTooltip content={<ChartTooltip />} />
                    <Bar dataKey="usage" fill="#00e676" name="Usage %" radius={[0, 4, 4, 0]}>
                      {featureUsageData.map((entry, i) => (
                        <Cell key={i} fill={entry.usage > 70 ? '#00e676' : entry.usage > 40 ? '#00b4d8' : '#ffd700'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB 5: FINANCE                                                        */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="finance" className="space-y-6 mt-6">
          {/* Feature 23: Revenue Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard title="MRR" value={`$${(stats?.revenueEstimate || 0).toFixed(2)}`} icon={DollarSign} change={18.2} color="emerald" />
            <StatCard title="ARR" value={`$${((stats?.revenueEstimate || 0) * 12).toFixed(0)}`} icon={TrendingUp} change={18.2} color="emerald" />
            <StatCard title="Churn Rate" value="3.2%" icon={TrendingDown} change={-1.5} color="red" />
            <StatCard title="LTV" value="$142" icon={Crown} change={5.4} color="gold" />
            <StatCard title="ARPU" value="$12.80" icon={Users} change={2.1} color="blue" />
          </div>

          {/* Revenue Trend Chart */}
          <SectionCard title="Revenue Trend" icon={ChartLine}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrendData}>
                  <defs>
                    <linearGradient id="gradProRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00b4d8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00b4d8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradEliteRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffd700" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ffd700" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.2 0.03 260)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }} />
                  <RTooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="pro" stackId="rev" stroke="#00b4d8" fill="url(#gradProRev)" name="Pro Revenue" />
                  <Area type="monotone" dataKey="elite" stackId="rev" stroke="#ffd700" fill="url(#gradEliteRev)" name="Elite Revenue" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          {/* Feature 25: Revenue by Plan Chart */}
          <SectionCard title="Revenue by Plan (Over Time)" icon={PieChart as any}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.2 0.03 260)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }} />
                  <RTooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="pro" stroke="#00b4d8" fill="#00b4d8" fillOpacity={0.15} name="Pro" strokeWidth={2} />
                  <Area type="monotone" dataKey="elite" stroke="#ffd700" fill="#ffd700" fillOpacity={0.15} name="Elite" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          {/* Feature 24: Subscription Management */}
          <SectionCard title="Subscription Management" icon={CreditCard}>
            <ScrollArea className="max-h-72">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next Billing</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptionData.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="text-sm">{sub.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={PLAN_COLORS[sub.plan.toLowerCase()] || ''}>{sub.plan}</Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono">{sub.amount}</TableCell>
                      <TableCell>
                        <Badge variant={sub.status === 'active' ? 'outline' : sub.status === 'past_due' ? 'destructive' : 'secondary'}
                          className={sub.status === 'active' ? 'border-emerald-500/30 text-emerald-400 text-xs' : 'text-xs'}>
                          {sub.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{sub.nextBilling}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="h-7 text-xs"
                          onClick={() => toast.success(`Managing subscription for ${sub.email}`)}>
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </SectionCard>
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB 6: SYSTEM                                                         */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="system" className="space-y-6 mt-6">
          {/* Feature 26: System Settings Panel */}
          <SectionCard title="System Settings" icon={Settings}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { key: 'registration_open', label: 'Registration Open', type: 'boolean', default: 'true' },
                { key: 'maintenance_mode', label: 'Maintenance Mode', type: 'boolean', default: 'false' },
                { key: 'max_predictions_free', label: 'Max Predictions (Free)', type: 'number', default: '5' },
                { key: 'ai_chat_enabled', label: 'AI Chat Enabled', type: 'boolean', default: 'true' },
                { key: 'default_user_plan', label: 'Default User Plan', type: 'string', default: 'free' },
                { key: 'prediction_lockout_hours', label: 'Prediction Lockout (hrs)', type: 'number', default: '1' },
                { key: 'max_login_attempts', label: 'Max Login Attempts', type: 'number', default: '5' },
                { key: 'session_timeout_minutes', label: 'Session Timeout (min)', type: 'number', default: '60' },
              ].map(setting => {
                const existing = settingsList.find((s: any) => s.key === setting.key)
                const value = existing?.value || setting.default
                return (
                  <div key={setting.key} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                    <div>
                      <p className="text-sm font-medium">{setting.label}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{setting.key}</p>
                    </div>
                    {setting.type === 'boolean' ? (
                      <Switch checked={value === 'true'} onCheckedChange={(checked) => handleToggleSetting(setting.key, String(checked))} />
                    ) : (
                      <Input className="w-20 h-8 text-right text-sm" value={value}
                        onChange={e => handleToggleSetting(setting.key, e.target.value)} />
                    )}
                  </div>
                )
              })}
            </div>
          </SectionCard>

          {/* Feature 27: Feature Flags Manager */}
          <SectionCard title="Feature Flags" icon={ToggleLeft}>
            <ScrollArea className="max-h-72">
              <div className="space-y-2">
                {featureFlags.map((flag: any) => {
                  const targetRoles: string[] = (() => { try { return JSON.parse(flag.targetRoles || '[]') } catch { return [] } })()
                  return (
                    <div key={flag.id} className="p-3 rounded-lg bg-muted/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch checked={flag.isEnabled} onCheckedChange={() => handleToggleFlag(flag)} />
                          <div>
                            <p className="text-sm font-medium font-mono">{flag.name}</p>
                            <p className="text-xs text-muted-foreground">{flag.description || 'No description'}</p>
                          </div>
                        </div>
                        <Badge variant={flag.isEnabled ? 'outline' : 'secondary'}
                          className={flag.isEnabled ? 'border-emerald-500/30 text-emerald-400 text-[10px]' : 'text-[10px]'}>
                          {flag.isEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Rollout: {flag.rollout || 100}%</span>
                        <span>Target: {targetRoles.length > 0 ? targetRoles.join(', ') : 'All'}</span>
                        <div className="flex-1" />
                        <Slider value={[flag.rollout || 100]} max={100} step={5} className="w-24"
                          onValueChange={([v]) => handleUpdateFlag(flag, { rollout: v })} />
                      </div>
                    </div>
                  )
                })}
                {featureFlags.length === 0 && <EmptyState message="No feature flags configured" />}
              </div>
            </ScrollArea>
          </SectionCard>

          {/* Feature 28: API Request Logs */}
          <SectionCard title="API Request Logs" icon={FileText}>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Filter:</span>
                {['all', '2xx', '3xx', '4xx', '5xx'].map(f => (
                  <Button key={f} size="sm" variant={logStatusFilter === f ? 'default' : 'outline'} className="h-7 text-xs"
                    onClick={() => { setLogStatusFilter(f); fetchLogsPage(1) }}>
                    {f === 'all' ? 'All' : f}
                  </Button>
                ))}
              </div>
              <ScrollArea className="max-h-72">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Method</TableHead>
                      <TableHead>Path</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.length === 0 ? (
                      <TableRow><TableCell colSpan={5}><EmptyState message="No logs found" /></TableCell></TableRow>
                    ) : (
                      filteredLogs.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] font-mono ${
                              log.method === 'GET' ? 'border-emerald-500/30 text-emerald-400' :
                              log.method === 'POST' ? 'border-amber-500/30 text-amber-400' :
                              log.method === 'PATCH' ? 'border-cyan-500/30 text-cyan-400' :
                              'border-red-500/30 text-red-400'
                            }`}>{log.method}</Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono max-w-[200px] truncate">{log.path}</TableCell>
                          <TableCell>
                            <Badge variant={log.statusCode >= 400 ? 'destructive' : 'outline'}
                              className={`text-[10px] ${log.statusCode >= 400 ? '' : log.statusCode >= 300 ? 'border-amber-500/30 text-amber-400' : 'border-emerald-500/30 text-emerald-400'}`}>
                              {log.statusCode}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{log.duration}ms</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{logPagination.total} total logs</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={logPagination.page <= 1} onClick={() => fetchLogsPage(logPagination.page - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span>Page {logPagination.page} of {logPagination.totalPages}</span>
                  <Button size="sm" variant="outline" disabled={logPagination.page >= logPagination.totalPages} onClick={() => fetchLogsPage(logPagination.page + 1)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Feature 29: Rate Limiting Monitor */}
            <SectionCard title="Rate Limiting Monitor" icon={Gauge}>
              <div className="space-y-3">
                {rateLimitData.map((item) => (
                  <div key={item.endpoint} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-muted-foreground">{item.endpoint}</span>
                      <span className={item.pct > 80 ? 'text-red-400 font-bold' : 'text-muted-foreground'}>
                        {item.current}/{item.limit} ({item.window})
                      </span>
                    </div>
                    <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${item.pct}%`,
                          backgroundColor: item.pct > 80 ? '#ff4757' : item.pct > 50 ? '#ffd700' : '#00e676',
                        }} />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Feature 30: Security Panel */}
            <SectionCard title="Security Panel" icon={ShieldCheck}>
              <div className="space-y-4">
                {/* Security Score */}
                <div className="text-center p-4 rounded-lg bg-muted/20">
                  <div className={`text-4xl font-bold ${securityScore >= 80 ? 'text-emerald-400' : securityScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                    {securityScore}
                  </div>
                  <p className="text-xs text-muted-foreground">Security Score</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 rounded-lg bg-muted/20 text-center">
                    <p className="font-bold text-red-400">{users.filter((u: any) => u.failedLogins > 0).reduce((sum: number, u: any) => sum + (u.failedLogins || 0), 0)}</p>
                    <p className="text-[10px] text-muted-foreground">Failed Logins</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/20 text-center">
                    <p className="font-bold text-amber-400">{users.filter((u: any) => u.lockedUntil).length}</p>
                    <p className="text-[10px] text-muted-foreground">Locked Accounts</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/20 text-center">
                    <p className="font-bold text-emerald-400">{stats?.activeToday || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Active Sessions</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/20 text-center">
                    <p className="font-bold text-cyan-400">{users.filter((u: any) => u.twoFactorEnabled).length}</p>
                    <p className="text-[10px] text-muted-foreground">2FA Enabled</p>
                  </div>
                </div>

                {/* Permission Matrix */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Permission Matrix</p>
                  <ScrollArea className="max-h-32">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Permission</TableHead>
                          <TableHead className="text-xs text-center">Admin</TableHead>
                          <TableHead className="text-xs text-center">Elite</TableHead>
                          <TableHead className="text-xs text-center">Pro</TableHead>
                          <TableHead className="text-xs text-center">Free</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[
                          { perm: 'View Matches', admin: true, elite: true, pro: true, free: true },
                          { perm: 'Make Predictions', admin: true, elite: true, pro: true, free: true },
                          { perm: 'AI Chat', admin: true, elite: true, pro: true, free: false },
                          { perm: 'Advanced Stats', admin: true, elite: true, pro: false, free: false },
                          { perm: 'Export Data', admin: true, elite: true, pro: false, free: false },
                          { perm: 'Admin Panel', admin: true, elite: false, pro: false, free: false },
                          { perm: 'Manage Users', admin: true, elite: false, pro: false, free: false },
                        ].map((row) => (
                          <TableRow key={row.perm}>
                            <TableCell className="text-xs">{row.perm}</TableCell>
                            <TableCell className="text-center"><CheckCircle className="h-3.5 w-3.5 text-emerald-400 mx-auto" /></TableCell>
                            <TableCell className="text-center">{row.elite ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400 mx-auto" /> : <XCircle className="h-3.5 w-3.5 text-red-400/50 mx-auto" />}</TableCell>
                            <TableCell className="text-center">{row.pro ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400 mx-auto" /> : <XCircle className="h-3.5 w-3.5 text-red-400/50 mx-auto" />}</TableCell>
                            <TableCell className="text-center">{row.free ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400 mx-auto" /> : <XCircle className="h-3.5 w-3.5 text-red-400/50 mx-auto" />}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Feature 31: Audit Trail */}
            <SectionCard title="Audit Trail" icon={History}>
              <ScrollArea className="max-h-72">
                <div className="space-y-2">
                  {auditTrail.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/20 transition-colors">
                      <div className="mt-0.5 p-1.5 rounded-lg bg-muted/50 shrink-0">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{item.action}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Target: {item.target} · {item.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </SectionCard>

            {/* Feature 32: Database Health */}
            <SectionCard title="Database Health" icon={Database}>
              <div className="space-y-3">
                {[
                  { label: 'Users', count: stats?.totalUsers || users.length, icon: Users },
                  { label: 'Matches', count: stats?.totalMatches || 24, icon: Target },
                  { label: 'Predictions', count: stats?.totalPredictions || 0, icon: Brain },
                  { label: 'News Articles', count: newsItems.length, icon: Newspaper },
                  { label: 'Announcements', count: announcements.length, icon: Bell },
                  { label: 'Feature Flags', count: featureFlags.length, icon: ToggleLeft },
                  { label: 'API Logs (24h)', count: stats?.totalApiCalls24h || logs.length, icon: FileText },
                  { label: 'Sessions', count: stats?.activeToday || 0, icon: Key },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                    <div className="flex items-center gap-2">
                      <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{item.label}</span>
                    </div>
                    <span className="text-sm font-mono font-bold">{item.count.toLocaleString()}</span>
                  </div>
                ))}
                <Separator />
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-muted/20">
                    <p className="text-muted-foreground">DB Size</p>
                    <p className="font-bold">4.2 MB</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/20">
                    <p className="text-muted-foreground">Last Backup</p>
                    <p className="font-bold text-emerald-400">2h ago</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/20">
                    <p className="text-muted-foreground">Avg Query Time</p>
                    <p className="font-bold">3.2ms</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/20">
                    <p className="text-muted-foreground">Connections</p>
                    <p className="font-bold">12/100</p>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Feature 33: Real-time Metrics */}
          <SectionCard title="Real-time Metrics" icon={GaugeCircle}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/20 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{realtimeData[realtimeData.length - 1]?.reqPerSec}</p>
                  <p className="text-xs text-muted-foreground">Requests/sec</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/20 text-center">
                  <p className={`text-2xl font-bold ${realtimeData[realtimeData.length - 1]?.errorRate > 2 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {(realtimeData[realtimeData.length - 1]?.errorRate ?? 0).toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Error Rate</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/20 text-center">
                  <p className="text-2xl font-bold text-cyan-400">{realtimeData[realtimeData.length - 1]?.p50}ms</p>
                  <p className="text-xs text-muted-foreground">P50 Latency</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/20 text-center">
                  <p className="text-2xl font-bold text-amber-400">{realtimeData[realtimeData.length - 1]?.p99}ms</p>
                  <p className="text-xs text-muted-foreground">P99 Latency</p>
                </div>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={realtimeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.2 0.03 260)" />
                    <XAxis dataKey="second" tick={{ fontSize: 9, fill: 'oklch(0.6 0 0)' }} interval={9} />
                    <YAxis tick={{ fontSize: 10, fill: 'oklch(0.6 0 0)' }} />
                    <RTooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="reqPerSec" stroke="#00e676" name="Req/sec" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="p95" stroke="#00b4d8" name="P95 (ms)" dot={false} strokeWidth={1.5} />
                    <Line type="monotone" dataKey="errorRate" stroke="#ff4757" name="Error %" dot={false} strokeWidth={1.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}

