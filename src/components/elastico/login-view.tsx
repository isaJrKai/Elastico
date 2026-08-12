'use client'

import { useState, useEffect, useCallback } from 'react'
import { useElasticoStore } from '@/store/use-elastico-store'
import {
  Zap, Mail, Lock, User, Eye, EyeOff, Loader2,
  ShieldCheck, Trophy, Crown, UserCheck, Megaphone, X, ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card, CardContent, CardHeader, CardDescription, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

interface Announcement { id: string; title: string; message: string; isBreaking: boolean; createdAt: string }

interface DemoAccount {
  label: string; email: string; password: string; icon: React.ReactNode; color: string; hoverColor: string; plan: string
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { label: 'Admin', email: 'admin@elastico.ai', password: '', icon: <ShieldCheck className="size-3.5" />, color: 'text-red-400', hoverColor: 'hover:border-red-500/40 hover:text-red-300', plan: 'admin' },
  { label: 'Pro', email: 'pro@elastico.ai', password: '', icon: <Crown className="size-3.5" />, color: 'text-amber-400', hoverColor: 'hover:border-amber-500/40 hover:text-amber-300', plan: 'pro' },
  { label: 'Elite', email: 'elite@elastico.ai', password: '', icon: <Trophy className="size-3.5" />, color: 'text-emerald-400', hoverColor: 'hover:border-emerald-500/40 hover:text-emerald-300', plan: 'elite' },
  { label: 'Free', email: 'user@elastico.ai', password: '', icon: <UserCheck className="size-3.5" />, color: 'text-sky-400', hoverColor: 'hover:border-sky-500/40 hover:text-sky-300', plan: 'free' },
]

// ═══════════════════════════════════════════════════════════════════════════════

export default function LoginView() {
  const setUser = useElasticoStore(s => s.setUser)
  const setView = useElasticoStore(s => s.setView)

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [showRegConfirm, setShowRegConfirm] = useState(false)
  const [regLoading, setRegLoading] = useState(false)
  const [regError, setRegError] = useState('')

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<Set<string>>(new Set())
  const [logoAnim, setLogoAnim] = useState(false)

  useEffect(() => { setLogoAnim(true) }, [])
  useEffect(() => {
    fetch('/api/admin/announcements').then(r => r.json()).then(d => { if (Array.isArray(d)) setAnnouncements(d) }).catch(() => {})
  }, [])

  const dismissAnnouncement = useCallback((id: string) => { setDismissedAnnouncements(prev => new Set(prev).add(id)) }, [])
  const visibleAnnouncements = announcements.filter(a => !dismissedAnnouncements.has(a.id))

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoginError(''); setLoginLoading(true)
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: loginEmail, password: loginPassword }) })
      const data = await res.json()
      if (!res.ok) { setLoginError(data.error || data.message || 'Login failed.'); return }
      if (data.token) localStorage.setItem('elastico_token', data.token)
      if (data.user) localStorage.setItem('elastico_user', JSON.stringify(data.user))
      setUser(data.user, data.token); setView('dashboard')
    } catch { setLoginError('Network error.') } finally { setLoginLoading(false) }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setRegError('')
    if (!regName.trim()) { setRegError('Name is required.'); return }
    if (regPassword !== regConfirmPassword) { setRegError('Passwords do not match.'); return }
    if (regPassword.length < 6) { setRegError('Password must be at least 6 characters.'); return }
    setRegLoading(true)
    try {
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: regName, email: regEmail, password: regPassword }) })
      const data = await res.json()
      if (!res.ok) { setRegError(data.error || data.message || 'Registration failed.'); return }
      if (data.token) localStorage.setItem('elastico_token', data.token)
      if (data.user) localStorage.setItem('elastico_user', JSON.stringify(data.user))
      setUser(data.user, data.token); setView('dashboard')
    } catch { setRegError('Network error.') } finally { setRegLoading(false) }
  }

  const fillDemo = async (account: DemoAccount) => {
    setLoginEmail(account.email); setLoginError('')
    // Demo login via server-side endpoint (no password in client bundle)
    setLoginLoading(true)
    try {
      const res = await fetch('/api/auth/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: account.email, role: account.plan }) })
      const data = await res.json()
      if (!res.ok) { setLoginLoading(false); setLoginError(data.error || 'Demo unavailable'); return }
      if (data.token) localStorage.setItem('elastico_token', data.token)
      if (data.user) localStorage.setItem('elastico_user', JSON.stringify(data.user))
      setUser(data.user, data.token); setView('dashboard')
    } catch { setLoginError('Network error.') } finally { setLoginLoading(false) }
  }
  const handleSocialLogin = (provider: string) => { toast({ title: `${provider} login`, description: 'Coming soon!', variant: 'default' }) }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background aurora-bg noise-overlay px-4 py-8">
      {/* Background Effects */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute left-1/4 top-1/4 size-[500px] rounded-full bg-[#00e676]/[0.12] blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 size-[400px] rounded-full bg-[#00b4d8]/[0.10] blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] rounded-full bg-[#a855f7]/[0.06] blur-[150px]" />
        <div className="absolute inset-0 opacity-[0.04] z-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-5">
        {/* Announcements */}
        {visibleAnnouncements.length > 0 && (
          <div className="w-full space-y-2">
            {visibleAnnouncements.map(a => (
              <div key={a.id} className={cn('relative flex items-start gap-3 rounded-lg border p-3 pr-9 text-sm backdrop-blur-sm animate-slide-in-left', a.isBreaking ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-[#00e676]/20 bg-[#00e676]/5 text-[#00e676]/90')}>
                <Megaphone className="mt-0.5 size-4 shrink-0" />
                <div className="min-w-0"><span className="font-semibold">{a.isBreaking ? '⚡ ' : ''}{a.title}</span><p className="mt-0.5 text-xs opacity-80">{a.message}</p></div>
                <button onClick={() => dismissAnnouncement(a.id)} className="absolute right-2 top-2 rounded-sm p-0.5 opacity-60 hover:opacity-100"><X className="size-3.5" /></button>
              </div>
            ))}
          </div>
        )}

        {/* Animated Logo */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className={cn('relative mb-1 transition-all duration-700', logoAnim ? 'scale-100 opacity-100' : 'scale-50 opacity-0')}>
            <div className="relative flex size-16 items-center justify-center rounded-2xl border border-[#00e676]/20 bg-gradient-to-br from-[#00e676]/15 to-[#00bfa5]/10 shadow-lg shadow-[#00e676]/10">
              <span className="text-3xl" role="img" aria-label="football">⚽</span>
              <div className="absolute -inset-3 -z-10 rounded-3xl bg-[#00e676]/5 blur-xl animate-pulse" />
            </div>
          </div>
          <h1 className={cn('text-4xl font-extrabold tracking-tighter sm:text-5xl text-gradient-primary transition-all duration-700 delay-200', logoAnim ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0')}>
            ELASTICO
          </h1>
          <p className={cn('flex items-center gap-1.5 text-[13px] font-medium tracking-wide text-muted-foreground transition-all duration-700 delay-300', logoAnim ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0')}>
            <Zap className="size-3 text-[#00e676]" />AI-Powered Football Analytics
          </p>
        </div>

        {/* Auth Card with animated gradient border */}
        <Card className="relative z-[1] w-full overflow-hidden rounded-2xl shadow-2xl shadow-[#00e676]/[0.05] !bg-transparent glass-card-premium">
          {/* Animated gradient border glow */}
          <div className="absolute inset-0 rounded-2xl p-[1px] pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(0,230,118,0.25), transparent 40%, transparent 60%, rgba(0,180,216,0.2))' }} />

          <div className="relative z-10">
            <Tabs defaultValue="login" className="w-full">
              <CardHeader className="pb-0 bg-transparent">
                <TabsList className="mx-auto grid w-full grid-cols-2 bg-white/5 p-1 rounded-xl">
                  <TabsTrigger value="login" className="text-[13px] font-semibold data-[state=active]:bg-[#00e676]/15 data-[state=active]:text-[#00e676] transition-all rounded-lg">Sign In</TabsTrigger>
                  <TabsTrigger value="register" className="text-[13px] font-semibold data-[state=active]:bg-[#00e676]/15 data-[state=active]:text-[#00e676] transition-all rounded-lg">Create Account</TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent className="pt-4 bg-transparent">
                {/* Login Tab */}
                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    {loginError && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{loginError}</div>}

                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="text-xs font-medium text-muted-foreground"><Mail className="mr-1.5 inline size-3" />Email</Label>
                      <Input id="login-email" type="email" placeholder="you@example.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required autoComplete="email" className="border-white/10 bg-white/5 text-foreground placeholder:text-muted-foreground/50 focus-visible:border-[#00e676]/50 focus-visible:ring-[#00e676]/20" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="login-password" className="text-xs font-medium text-muted-foreground"><Lock className="mr-1.5 inline size-3" />Password</Label>
                        <button type="button" className="text-[11px] font-medium text-primary/60 hover:text-primary transition-colors">Forgot password?</button>
                      </div>
                      <div className="relative">
                        <Input id="login-password" type={showLoginPassword ? 'text' : 'password'} placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required autoComplete="current-password" className="border-white/10 bg-white/5 pr-10 text-foreground placeholder:text-muted-foreground/50 focus-visible:border-[#00e676]/50 focus-visible:ring-[#00e676]/20" />
                        <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground" tabIndex={-1}>
                          {showLoginPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Remember me */}
                    <div className="flex items-center gap-2">
                      <Checkbox id="remember" checked={rememberMe} onCheckedChange={(v) => setRememberMe(v === true)} className="border-white/20 data-[state=checked]:bg-[#00e676] data-[state=checked]:border-[#00e676]" />
                      <Label htmlFor="remember" className="text-xs text-muted-foreground cursor-pointer">Remember me</Label>
                    </div>

                    <Button type="submit" disabled={loginLoading || !loginEmail || !loginPassword} className="h-10 w-full bg-[#00e676] text-sm font-semibold text-black shadow-lg shadow-[#00e676]/20 transition-all hover:bg-[#00c864] hover:shadow-[#00e676]/30 active:scale-[0.98] disabled:opacity-50">
                      {loginLoading ? <><Loader2 className="size-4 animate-spin" />Signing in...</> : <>Sign in<ChevronRight className="size-4" /></>}
                    </Button>
                  </form>

                  {/* Social Login */}
                  <div className="mt-5 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground/70"><div className="h-px flex-1 bg-border/50" /><span>or continue with</span><div className="h-px flex-1 bg-border/50" /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" variant="outline" className="h-9 border-border/50 bg-white/[0.02] hover:bg-white/[0.05] text-xs gap-2" onClick={() => handleSocialLogin('Google')}>
                        <svg className="size-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                        Google
                      </Button>
                      <Button type="button" variant="outline" className="h-9 border-border/50 bg-white/[0.02] hover:bg-white/[0.05] text-xs gap-2" onClick={() => handleSocialLogin('GitHub')}>
                        <svg className="size-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                        GitHub
                      </Button>
                    </div>
                  </div>

                  {/* Demo Accounts */}
                  <div className="mt-5 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground/70"><div className="h-px flex-1 bg-border/50" /><span>Click to Enter Instantly</span><div className="h-px flex-1 bg-border/50" /></div>
                    <div className="grid grid-cols-4 gap-2">
                      {DEMO_ACCOUNTS.map(account => (
                        <button key={account.label} type="button" onClick={() => fillDemo(account)} disabled={loginLoading} className={cn('flex flex-col items-center gap-1.5 rounded-xl border border-white/5 bg-white/[0.03] px-2 py-3 text-xs transition-all active:scale-95 hover:bg-white/[0.06] hover:border-white/10', account.hoverColor)}>
                          <span className={account.color}>{account.icon}</span>
                          <span className="text-muted-foreground/80 font-medium">{account.label}</span>
                          <Badge variant="outline" className="text-[8px] h-3 px-1 border-border/50 text-muted-foreground">{account.plan}</Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* Register Tab */}
                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    {regError && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{regError}</div>}
                    <div className="space-y-2">
                      <Label htmlFor="reg-name" className="text-xs font-medium text-muted-foreground"><User className="mr-1.5 inline size-3" />Full Name</Label>
                      <Input id="reg-name" type="text" placeholder="John Doe" value={regName} onChange={(e) => setRegName(e.target.value)} required autoComplete="name" className="border-white/10 bg-white/5 text-foreground placeholder:text-muted-foreground/50 focus-visible:border-[#00e676]/50 focus-visible:ring-[#00e676]/20" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-email" className="text-xs font-medium text-muted-foreground"><Mail className="mr-1.5 inline size-3" />Email</Label>
                      <Input id="reg-email" type="email" placeholder="you@example.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required autoComplete="email" className="border-white/10 bg-white/5 text-foreground placeholder:text-muted-foreground/50 focus-visible:border-[#00e676]/50 focus-visible:ring-[#00e676]/20" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-password" className="text-xs font-medium text-muted-foreground"><Lock className="mr-1.5 inline size-3" />Password</Label>
                      <div className="relative">
                        <Input id="reg-password" type={showRegPassword ? 'text' : 'password'} placeholder="Min. 6 characters" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required autoComplete="new-password" className="border-white/10 bg-white/5 pr-10 text-foreground placeholder:text-muted-foreground/50 focus-visible:border-[#00e676]/50 focus-visible:ring-[#00e676]/20" />
                        <button type="button" onClick={() => setShowRegPassword(!showRegPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground" tabIndex={-1}>{showRegPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-confirm" className="text-xs font-medium text-muted-foreground"><Lock className="mr-1.5 inline size-3" />Confirm Password</Label>
                      <div className="relative">
                        <Input id="reg-confirm" type={showRegConfirm ? 'text' : 'password'} placeholder="Re-enter your password" value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} required autoComplete="new-password" className="border-white/10 bg-white/5 pr-10 text-foreground placeholder:text-muted-foreground/50 focus-visible:border-[#00e676]/50 focus-visible:ring-[#00e676]/20" />
                        <button type="button" onClick={() => setShowRegConfirm(!showRegConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground" tabIndex={-1}>{showRegConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                      </div>
                    </div>
                    <Button type="submit" disabled={regLoading || !regName || !regEmail || !regPassword || !regConfirmPassword} className="h-10 w-full bg-[#00e676] text-sm font-semibold text-black shadow-lg shadow-[#00e676]/20 transition-all hover:bg-[#00c864] hover:shadow-[#00e676]/30 active:scale-[0.98] disabled:opacity-50">
                      {regLoading ? <><Loader2 className="size-4 animate-spin" />Creating account...</> : <>Create account<ChevronRight className="size-4" /></>}
                    </Button>
                  </form>
                </TabsContent>
              </CardContent>
            </Tabs>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground/50">© {new Date().getFullYear()} ELASTICO · Premium Football Intelligence</p>
          <p className="text-[10px] text-muted-foreground/30">
            <a href="#" className="hover:text-muted-foreground transition-colors">Terms of Service</a>
            {' · '}
            <a href="#" className="hover:text-muted-foreground transition-colors">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  )
}