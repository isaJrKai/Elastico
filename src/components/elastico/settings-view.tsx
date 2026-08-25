'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useElasticoStore, type Team } from '@/store/use-elastico-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  Settings,
  User,
  Palette,
  Bell,
  Shield,
  Heart,
  Keyboard,
  Save,
  Download,
  Trash2,
  Loader2,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeft,
  Minimize2,
  Maximize2,
  Search,
  LayoutDashboard,
  Swords,
  MessageSquare,
  Newspaper,
  Trophy,
  Target,
  Star,
  Plus,
  X,
  Check,
  Monitor,
  Smartphone,
  Globe,
  Cpu,
  Wifi,
  WifiOff,
  CheckCircle2,
  XCircle,
  Info,
  Radio,
  Zap,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePWA } from '@/hooks/use-pwa'
import { SectionHeader, DataState } from '@/components/elastico/primitives'

// ── Timezones ─────────────────────────────────────────────────────────────────

const timezones = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Istanbul',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
]

// ── Languages ─────────────────────────────────────────────────────────────────

const languages = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'pt', label: 'Português' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ar', label: 'العربية' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
]

// ── Keyboard Shortcuts ────────────────────────────────────────────────────────

const keyboardShortcuts = [
  { keys: '⌘K', description: 'Search / Command Palette', icon: Search },
  { keys: '⌘D', description: 'Dashboard', icon: LayoutDashboard },
  { keys: '⌘M', description: 'Live Matches', icon: Swords },
  { keys: '⌘C', description: 'AI Chat', icon: MessageSquare },
  { keys: '⌘N', description: 'News Feed', icon: Newspaper },
  { keys: '⌘T', description: 'Tournament', icon: Trophy },
  { keys: '⌘P', description: 'Predictions', icon: Target },
  { keys: '⌘S', description: 'Settings', icon: Settings },
  { keys: '⌘B', description: 'Toggle Sidebar', icon: PanelLeftClose },
  { keys: '⌘/', description: 'Show Shortcuts', icon: Keyboard },
]

// ── Settings Section ────────────────────────────────────────────────────────────

function SettingsSection({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description?: string
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15">
        <Icon className="size-4.5 text-primary" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  )
}

// ── NVIDIA API Status Badge ────────────────────────────────────────────────────

function NvidiaApiStatusBadge({ token }: { token?: string }) {
  const [status, setStatus] = React.useState<'loading' | 'connected' | 'disconnected'>('loading')

  React.useEffect(() => {
    // Use the dedicated GET status endpoint instead of POST
    fetch('/api/chat')
      .then((res) => res.json())
      .then((data) => {
        const providers = Array.isArray(data.providers) ? data.providers : []
        const proProvider = providers.find((p: { name?: string; configured?: boolean }) => p.name === 'pro')
        if (proProvider?.configured) {
          setStatus('connected')
        } else {
          setStatus('disconnected')
        }
      })
      .catch(() => setStatus('disconnected'))
  }, [])

  if (status === 'loading') {
    return (
      <Badge variant="outline" className="gap-1.5 text-xs border-border">
        <Loader2 className="size-3 animate-spin text-muted-foreground" />
        Checking...
      </Badge>
    )
  }

  if (status === 'connected') {
    return (
      <Badge variant="outline" className="gap-1.5 text-xs border-emerald-500/30 text-emerald-400 bg-emerald-500/5">
        <CheckCircle2 className="size-3" />
        Connected
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="gap-1.5 text-xs border-amber-500/30 text-amber-400 bg-amber-500/5">
      <XCircle className="size-3" />
      Not Configured
    </Badge>
  )
}

// ── Model Row ──────────────────────────────────────────────────────────────────

function ModelRow({
  name,
  model,
  description,
  icon: Icon,
  recommended = false,
  offline = false,
}: {
  name: string
  model: string
  description: string
  icon: React.ElementType
  recommended?: boolean
  offline?: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/20 p-3 transition-colors hover:bg-secondary/40">
      <div className={cn(
        'flex size-8 items-center justify-center rounded-lg',
        offline ? 'bg-muted' : 'bg-primary/10',
      )}>
        <Icon className={cn('size-4', offline ? 'text-muted-foreground' : 'text-primary')} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-foreground">{name}</p>
          {recommended && (
            <Badge className="h-4 px-1.5 text-[9px] bg-primary/15 text-primary border-primary/20 hover:bg-primary/20">
              Recommended
            </Badge>
          )}
          {offline && (
            <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-border text-muted-foreground">
              Offline
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate">{description}</p>
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/60 truncate">{model}</p>
      </div>
    </div>
  )
}

// ── Bandwidth & Offline Section ────────────────────────────────────────────────

function BandwidthSection() {
  const [bandwidth, setBandwidth] = useState<{ totalKB: number; requests: number; avgBytesPerRequest: number } | null>(null)
  const { isOffline, isRegistered, isStandalone, clearCache } = usePWA()

  useEffect(() => {
    // Poll bandwidth tracker every 2 seconds
    const load = async () => {
      try {
        const mod = await import('@/lib/compressed-data-stream')
        setBandwidth(mod.BandwidthTracker.summary())
      } catch {}
    }
    load()
    const interval = setInterval(load, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Card className="glass-card border-border">
      <CardHeader className="pb-4">
        <SettingsSection icon={Radio}
          title="Bandwidth & Offline"
          description="PWA caching & data usage monitoring"
        />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* PWA Status Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatusPill
            label="Network"
            value={isOffline ? 'Offline' : 'Online'}
            active={!isOffline}
            icon={isOffline ? WifiOff : Wifi}
          />
          <StatusPill
            label="App Cached"
            value={isRegistered ? 'Yes' : 'No'}
            active={isRegistered}
            icon={Smartphone}
          />
          <StatusPill
            label="Standalone"
            value={isStandalone ? 'Yes' : 'No'}
            active={isStandalone}
            icon={Monitor}
          />
          <StatusPill
            label="Data Used"
            value={bandwidth ? `${bandwidth.totalKB.toFixed(1)} KB` : '—'}
            active={bandwidth ? bandwidth.totalKB < 100 : true}
            icon={Zap}
          />
        </div>

        {/* Bandwidth Details */}
        {bandwidth && (
          <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">API Requests</span>
              <span className="font-mono text-foreground">{bandwidth.requests}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Avg per Request</span>
              <span className="font-mono text-foreground">{bandwidth.avgBytesPerRequest} B</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Today</span>
              <span className={cn(
                'font-mono font-medium',
                bandwidth.totalKB < 50 ? 'text-emerald-400' : (bandwidth.totalKB ?? 0) < 200 ? 'text-amber-400' : 'text-red-400'
              )}>
                {(bandwidth.totalKB ?? 0).toFixed(1)} KB
              </span>
            </div>
          </div>
        )}

        {/* Compression Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { label: 'Null Stripping', desc: 'Removes 30-60% empty fields' },
            { label: 'Key Compaction', desc: '2-char keys in compact mode' },
            { label: 'Service Worker', desc: '0 MB data on app reopen' },
            { label: 'Diff Updates', desc: 'Only changed data sent' },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-2.5 rounded-md border border-border bg-secondary/20 px-3 py-2">
              <CheckCircle2 className="size-3.5 text-primary shrink-0" />
              <div>
                <p className="text-xs font-medium text-foreground">{f.label}</p>
                <p className="text-[10px] text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Clear Cache Button */}
        {isRegistered && (
          <Button
            variant="outline"
            size="sm"
            className="w-full border-border text-xs"
            onClick={async () => {
              await clearCache()
              toast.success('Cache Cleared', { description: 'App will re-download fresh data on next load.' })
            }}
          >
            <Trash2 className="size-3.5 mr-2" />
            Clear Offline Cache & Re-download
          </Button>
        )}

        <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <Info className="mt-0.5 size-4 shrink-0 text-primary/70" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            After the first visit, ELASTICO caches itself (~5 MB) to your device storage.
            Subsequent opens load instantly from your phone — using <strong className="text-foreground">0 MB mobile data</strong>.
            Live match updates use compressed diff payloads under 5 KB per cycle.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusPill({ label, value, active, icon: Icon }: { label: string; value: string; active: boolean; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-secondary/30 p-3 text-center">
      <Icon className={cn('size-4', active ? 'text-primary' : 'text-muted-foreground')} />
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={cn('text-xs font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>{value}</span>
    </div>
  )
}

// ── Settings View Component ───────────────────────────────────────────────────

export default function SettingsView() {
  const user = useElasticoStore(s => s.user)
  const setSidebarOpen = useElasticoStore(s => s.setSidebarOpen)
  const sidebarOpen = useElasticoStore(s => s.sidebarOpen)
  const token = useElasticoStore(s => s.token)
  const { theme, setTheme } = useTheme()

  // ── View State ────────────────────────────────────────────────────────
  const [viewState, setViewState] = useState<'loading' | 'empty' | 'error' | 'success'>('loading')

  useEffect(() => {
    // Settings is always available — immediate success once store hydrates
    const timer = setTimeout(() => setViewState('success'), 100)
    return () => clearTimeout(timer)
  }, [])

  // ── Profile State ─────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(user?.displayName || user?.name || '')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [language, setLanguage] = useState('en')

  // ── Appearance State ──────────────────────────────────────────────────────
  const [compactMode, setCompactMode] = useState(false)

  // ── Notification State ────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState({
    goals: true,
    cards: true,
    kickoff: true,
    predictionResults: true,
    system: false,
    news: true,
    sound: true,
    push: false,
  })

  // ── Security State ────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.twoFactorEnabled || false)

  // ── Favorite Teams ────────────────────────────────────────────────────────
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>(() => {
    try {
      return user?.favoriteTeams ? JSON.parse(user.favoriteTeams) : []
    } catch {
      return []
    }
  })
  const [availableTeams, setAvailableTeams] = useState<Team[]>([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [teamSearch, setTeamSearch] = useState('')

  // ── Fetch Teams ───────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchTeams = async () => {
      setTeamsLoading(true)
      try {
        const res = await fetch('/api/teams')
        if (res.ok) {
          const data = await res.json()
          setAvailableTeams(data.teams || [])
        }
      } catch {
        // Silent error
      } finally {
        setTeamsLoading(false)
      }
    }
    fetchTeams()
  }, [])

  // ── Save Profile ─────────────────────────────────────────────────────────

  const handleSaveProfile = useCallback(() => {
    toast.info('Coming soon', {
      description: 'Profile editing with server-side persistence is planned for a future update.',
    })
  }, [])

  // ── Change Password ───────────────────────────────────────────────────────

  const handleChangePassword = useCallback(() => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Error', {
        description: 'Please fill in all password fields.',
      })
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Error', {
        description: 'New passwords do not match.',
      })
      return
    }
    if (newPassword.length < 8) {
      toast.error('Error', {
        description: 'Password must be at least 8 characters.',
      })
      return
    }

    toast.info('Coming soon', {
      description: 'Password changes require a backend auth endpoint which is planned for a future update.',
    })
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }, [currentPassword, newPassword, confirmPassword])

  // ── Toggle Favorite Team ──────────────────────────────────────────────────

  const toggleFavoriteTeam = useCallback((teamId: string) => {
    setFavoriteTeams((prev) =>
      prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId],
    )
  }, [])

  // ── Export Data ───────────────────────────────────────────────────────────

  const handleExportData = useCallback(() => {
    const data = {
      user,
      favoriteTeams,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'elastico-data-export.json'
    a.click()
    URL.revokeObjectURL(url)

    toast.success('Data exported', {
      description: 'Your data has been downloaded.',
    })
  }, [user, favoriteTeams])

  // ── Delete Account ────────────────────────────────────────────────────────

  const handleDeleteAccount = useCallback(() => {
    toast('Account deletion requested', {
      description: 'This is a demo — your account was not deleted.',
    })
  }, [])

  // ── Filter Teams for Search ───────────────────────────────────────────────

  const filteredTeams = availableTeams.filter((team) =>
    team.name.toLowerCase().includes(teamSearch.toLowerCase()),
  )

  // ── LOADING STATE ──────────────────────────────────────────────────────
  if (viewState === 'loading') {
    return (
      <div className="flex h-full flex-col gap-6 overflow-y-auto pb-8">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15">
            <Settings className="size-5 text-primary animate-pulse" />
          </div>
          <p className="text-xs text-muted-foreground">Manage your account and preferences</p>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="glass-card-premium card-hover-lift rounded-xl border-border">
            <CardContent className="p-6 space-y-3">
              <div className="h-4 w-32 rounded bg-muted/50 animate-pulse" />
              <div className="h-3 w-full rounded bg-muted/30 animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-muted/30 animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // ── ERROR STATE ────────────────────────────────────────────────────────
  if (viewState === 'error') {
    return (
      <div className="flex h-full flex-col gap-6 overflow-y-auto pb-8">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15">
            <Settings className="size-5 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground">Manage your account and preferences</p>
        </div>
        <Card className="glass-card-premium card-hover-lift rounded-xl border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertCircle className="size-12 text-red-400" />
            <p className="text-sm text-muted-foreground">Failed to load settings</p>
            <Button variant="outline" size="sm" className="mt-2 border-border text-xs" onClick={() => setViewState('success')}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── SUCCESS STATE ──────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto pb-8">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15">
          <Settings className="size-5 text-primary" />
        </div>
        <div>
<p className="text-xs text-muted-foreground">
            Manage your account and preferences
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── 1. Profile Section ───────────────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Card className="glass-card border-border">
        <CardHeader className="pb-4">
          <SettingsSection
            icon={User}
            title="Profile"
            description="Update your personal information"
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-xs text-muted-foreground">
                Display Name
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter display name"
                className="h-9 border-border bg-secondary/50 text-sm"
              />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location" className="text-xs text-muted-foreground">
                Location
              </Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, Country"
                className="h-9 border-border bg-secondary/50 text-sm"
              />
            </div>

            {/* Timezone */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="h-9 border-border bg-secondary/50 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz} className="text-sm">
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Language */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="h-9 border-border bg-secondary/50 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value} className="text-sm">
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio" className="text-xs text-muted-foreground">
              Bio
            </Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              rows={3}
              className="border-border bg-secondary/50 text-sm resize-none"
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveProfile}
              className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 text-sm"
            >
              <Save className="mr-2 size-4" />
              Save Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── 2. Appearance Section ────────────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Card className="glass-card border-border">
        <CardHeader className="pb-4">
          <SettingsSection
            icon={Palette}
            title="Appearance"
            description="Customize how ELASTICO looks"
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Theme Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? (
                <Moon className="size-4 text-primary" />
              ) : (
                <Sun className="size-4 text-primary" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">Theme</p>
                <p className="text-xs text-muted-foreground">
                  Toggle between dark and light mode
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 p-1">
              <button
                onClick={() => setTheme('dark')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                  theme === 'dark'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Moon className="size-3.5" />
                Dark
              </button>
              <button
                onClick={() => setTheme('light')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                  theme === 'light'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Sun className="size-3.5" />
                Light
              </button>
            </div>
          </div>

          <Separator className="opacity-50" />

          {/* Sidebar Collapsed Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {sidebarOpen ? (
                <PanelLeft className="size-4 text-primary" />
              ) : (
                <PanelLeftClose className="size-4 text-primary" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">Sidebar</p>
                <p className="text-xs text-muted-foreground">
                  Show or collapse the navigation sidebar
                </p>
              </div>
            </div>
            <Switch
              checked={sidebarOpen}
              onCheckedChange={setSidebarOpen}
            />
          </div>

          <Separator className="opacity-50" />

          {/* Compact Mode Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {compactMode ? (
                <Minimize2 className="size-4 text-primary" />
              ) : (
                <Maximize2 className="size-4 text-primary" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">Compact Mode</p>
                <p className="text-xs text-muted-foreground">
                  Reduce spacing and card sizes
                </p>
              </div>
            </div>
            <Switch
              checked={compactMode}
              onCheckedChange={setCompactMode}
            />
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── 3. Notifications Section ─────────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Card className="glass-card border-border">
        <CardHeader className="pb-4">
          <SettingsSection
            icon={Bell}
            title="Notifications"
            description="Choose what you want to be notified about"
          />
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            {
              key: 'goals' as const,
              label: 'Goals',
              desc: 'Get notified when a goal is scored in a match you follow',
            },
            {
              key: 'cards' as const,
              label: 'Cards',
              desc: 'Yellow and red card notifications',
            },
            {
              key: 'kickoff' as const,
              label: 'Kickoff',
              desc: 'Match start reminders',
            },
            {
              key: 'predictionResults' as const,
              label: 'Prediction Results',
              desc: 'When your predictions are evaluated',
            },
            {
              key: 'system' as const,
              label: 'System',
              desc: 'Platform updates and announcements',
            },
            {
              key: 'news' as const,
              label: 'News',
              desc: 'Breaking football news',
            },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                checked={notifications[item.key]}
                onCheckedChange={(checked) =>
                  setNotifications((prev) => ({ ...prev, [item.key]: checked }))
                }
              />
            </div>
          ))}

          <Separator className="my-2 opacity-50" />

          {/* Sound Toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-foreground">Sound</p>
              <p className="text-xs text-muted-foreground">
                Play sounds for notifications
              </p>
            </div>
            <Switch
              checked={notifications.sound}
              onCheckedChange={(checked) =>
                setNotifications((prev) => ({ ...prev, sound: checked }))
              }
            />
          </div>

          {/* Push Notification Toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-foreground">
                Push Notifications
              </p>
              <p className="text-xs text-muted-foreground">
                Receive push notifications in your browser
              </p>
            </div>
            <Switch
              checked={notifications.push}
              onCheckedChange={(checked) =>
                setNotifications((prev) => ({ ...prev, push: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── 4. Privacy & Security Section ────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Card className="glass-card border-border">
        <CardHeader className="pb-4">
          <SettingsSection
            icon={Shield}
            title="Privacy & Security"
            description="Manage your account security settings"
          />
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Change Password */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Change Password</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="currentPw" className="text-xs text-muted-foreground">
                  Current Password
                </Label>
                <Input
                  id="currentPw"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-9 border-border bg-secondary/50 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newPw" className="text-xs text-muted-foreground">
                  New Password
                </Label>
                <Input
                  id="newPw"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-9 border-border bg-secondary/50 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPw" className="text-xs text-muted-foreground">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPw"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-9 border-border bg-secondary/50 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleChangePassword}
                variant="outline"
                className="h-8 border-border text-xs text-muted-foreground hover:text-foreground"
              >
                Update Password
              </Button>
            </div>
          </div>

          <Separator className="opacity-50" />

          {/* Two-Factor Authentication */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Two-Factor Authentication
              </p>
              <p className="text-xs text-muted-foreground">
                Add an extra layer of security to your account
              </p>
            </div>
            <Switch
              checked={twoFactorEnabled}
              onCheckedChange={setTwoFactorEnabled}
            />
          </div>

          <Separator className="opacity-50" />

          {/* Active Sessions */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Active Sessions</p>
            <div className="space-y-2">
              {[
                {
                  device: 'Chrome on macOS',
                  icon: Monitor,
                  location: 'San Francisco, US',
                  current: true,
                },
                {
                  device: 'Safari on iPhone',
                  icon: Smartphone,
                  location: 'San Francisco, US',
                  current: false,
                },
              ].map((session, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <session.icon className="size-4 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-foreground">
                          {session.device}
                        </p>
                        {session.current && (
                          <Badge className="h-4 bg-primary/15 px-1.5 text-[9px] font-semibold text-primary border-primary/30">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {session.location} · Active now
                      </p>
                    </div>
                  </div>
                  {!session.current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[10px] text-muted-foreground hover:text-destructive"
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Separator className="opacity-50" />

          {/* Data Export & Delete */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Data & Account</p>
              <p className="text-xs text-muted-foreground">
                Export your data or delete your account
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleExportData}
                className="h-9 border-border text-xs text-muted-foreground hover:text-foreground"
              >
                <Download className="mr-2 size-3.5" />
                Export Data
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="h-9 text-xs"
                  >
                    <Trash2 className="mr-2 size-3.5" />
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="glass-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-foreground">
                      Are you sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. All your data including
                      predictions, favorites, and profile information will be
                      permanently deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-border bg-secondary text-muted-foreground hover:text-foreground">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      Delete Account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── 5. Favorite Teams Section ────────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Card className="glass-card border-border">
        <CardHeader className="pb-4">
          <SettingsSection
            icon={Heart}
            title="Favorite Teams"
            description="Select teams you want to follow"
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Favorites */}
          {favoriteTeams.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Your Favorites
              </p>
              <div className="flex flex-wrap gap-2">
                {favoriteTeams.map((teamId) => {
                  const team = availableTeams.find((t) => t.id === teamId)
                  return (
                    <Badge
                      key={teamId}
                      className="flex items-center gap-1.5 h-7 px-3 bg-primary/10 text-primary border-primary/30 cursor-pointer hover:bg-primary/20 transition-colors"
                      onClick={() => toggleFavoriteTeam(teamId)}
                    >
                      <Star className="size-3 fill-primary text-primary" />
                      {team?.name || 'Unknown Team'}
                      <X className="size-3 opacity-60" />
                    </Badge>
                  )
                })}
              </div>
            </div>
          )}

          <Separator className="opacity-50" />

          {/* Team Search */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Add Teams
            </p>
            <Input
              value={teamSearch}
              onChange={(e) => setTeamSearch(e.target.value)}
              placeholder="Search for a team..."
              className="h-9 border-border bg-secondary/50 text-sm placeholder:text-muted-foreground/60"
            />
          </div>

          {/* Team Grid */}
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border/50">
            {teamsLoading ? (
              <div className="grid grid-cols-1 gap-1 p-2 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 animate-pulse rounded-md bg-secondary/50"
                  />
                ))}
              </div>
            ) : filteredTeams.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-xs text-muted-foreground">No teams found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1 p-2 sm:grid-cols-2">
                {filteredTeams.map((team) => {
                  const isFav = favoriteTeams.includes(team.id)
                  return (
                    <button
                      key={team.id}
                      onClick={() => toggleFavoriteTeam(team.id)}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-xs transition-all',
                        isFav
                          ? 'bg-primary/10 text-primary border border-primary/30'
                          : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground border border-transparent',
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="size-5 shrink-0 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                          style={{ backgroundColor: team.primaryColor }}
                        >
                          {team.code.slice(0, 2)}
                        </div>
                        <span className="truncate">{team.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] opacity-60">
                          ELO {team.eloRating}
                        </span>
                        {isFav && (
                          <Check className="size-3.5 text-primary" />
                        )}
                        {!isFav && (
                          <Plus className="size-3.5 opacity-40" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── 6. Keyboard Shortcuts Section ────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Card className="glass-card border-border">
        <CardHeader className="pb-4">
          <SettingsSection
            icon={Keyboard}
            title="Keyboard Shortcuts"
            description="Navigate faster with keyboard shortcuts"
          />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {keyboardShortcuts.map((shortcut) => (
              <div
                key={shortcut.keys}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary/50"
              >
                <div className="flex items-center gap-2.5">
                  <shortcut.icon className="size-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {shortcut.description}
                  </span>
                </div>
                <kbd className="rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {shortcut.keys}
                </kbd>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 8. Bandwidth & Offline (PWA) */}
      <BandwidthSection />

      {/* 9. AI and NVIDIA Settings */}
      <Card className="glass-card border-border">
        <CardHeader className="pb-4">
          <SettingsSection
            icon={Cpu}
            title="AI & NVIDIA Integration"
            description="Configure the AI analysis engine"
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <Cpu className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">NVIDIA NIM API</p>
                  <p className="text-xs text-muted-foreground">Powers real-time LLM football analysis</p>
                </div>
              </div>
              <NvidiaApiStatusBadge token={token || undefined} />
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Available AI Models</h4>
            <div className="space-y-2">
              <ModelRow name="ELASTICO Pro" model="Configured via NVIDIA_NIM_MODEL_ID" description="Highest quality — uses the model specified by your NVIDIA NIM configuration" icon={Cpu} recommended />
              <ModelRow name="ELASTICO Fast" model="Configured via NVIDIA_NIM_MODEL_ID" description="Lower latency — configure a smaller model in NVIDIA_NIM_MODEL_ID to use this tier" icon={Cpu} />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-foreground">Prediction Backend</p>
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Active</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              3-model ensemble (ELO + Poisson + Dixon-Coles) via /api/predictions/compute.
              Stochastic simulation (Merton Jump-Diffusion + GARCH) available via
              Prediction Engine view when real bookmaker odds are provided.
            </p>
          </div>
          <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Info className="mt-0.5 size-4 shrink-0 text-primary/70" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              To use NVIDIA-powered AI, set the <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[10px] text-foreground">NVIDIA_API_KEY</code> environment variable.
              Without it, AI chat responses fall back to template-based analysis.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
