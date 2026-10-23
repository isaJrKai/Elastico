'use client'

import { useState, useEffect, useCallback } from 'react'
import { useElasticoStore } from '@/store/use-elastico-store'
import {
  Zap, Mail, Lock, User, Eye, EyeOff, Loader2,
  Megaphone, X, ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

interface Announcement { id: string; title: string; message: string; isBreaking: boolean; createdAt: string }

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
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [logoAnim, setLogoAnim] = useState(false)

  useEffect(() => { setLogoAnim(true) }, [])
  useEffect(() => {
    fetch('/api/admin/announcements').then(r => r.json()).then(d => { if (Array.isArray(d)) setAnnouncements(d) }).catch((err) => { console.warn('[LoginView] Failed to fetch announcements:', err) })
  }, [])

  const dismiss = useCallback((id: string) => { setDismissed(prev => new Set(prev).add(id)) }, [])
  const visible = announcements.filter(a => !dismissed.has(a.id))

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoginError(''); setLoginLoading(true)
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: loginEmail, password: loginPassword }) })
      const data = await res.json()
      if (!res.ok) { setLoginError(data.error || data.message || 'Login failed.'); return }
      // Remove credentials from the previous localStorage-token auth flow.
      localStorage.removeItem('elastico_token')
      localStorage.removeItem('elastico_user')
      setUser(data.user, null); setView('dashboard')
    } catch { setLoginError('Network error.') } finally { setLoginLoading(false) }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setRegError('')
    if (!regName.trim()) { setRegError('Name is required.'); return }
    if (regPassword !== regConfirmPassword) { setRegError('Passwords do not match.'); return }
    if (regPassword.length < 12) { setRegError('Password must be at least 12 characters.'); return }
    setRegLoading(true)
    try {
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: regName, email: regEmail, password: regPassword }) })
      const data = await res.json()
      if (!res.ok) { setRegError(data.error || data.message || 'Registration failed.'); return }
      // Remove credentials from the previous localStorage-token auth flow.
      localStorage.removeItem('elastico_token')
      localStorage.removeItem('elastico_user')
      setUser(data.user, null); setView('dashboard')
    } catch { setRegError('Network error.') } finally { setRegLoading(false) }
  }

  const handleSocialLogin = (provider: string) => { toast.info(`${provider} login`, { description: 'Coming soon!' }) }

  const inputCls = 'border-border bg-secondary/50 text-foreground placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:ring-primary/20 h-10 rounded-lg'

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8">
      {/* Background texture — subtle warm gradient, no orbs */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-emerald-950/20" />
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-5">
        {/* Announcements */}
        {visible.length > 0 && (
          <div className="w-full space-y-2">
            {visible.map(a => (
              <div key={a.id} className={cn(
                'relative flex items-start gap-3 rounded-lg border p-3 pr-9 text-sm backdrop-blur-sm animate-slide-in-left',
                a.isBreaking ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-primary/20 bg-primary/5 text-primary/90',
              )}>
                <Megaphone className="mt-0.5 size-4 shrink-0" />
                <div className="min-w-0"><span className="font-semibold">{a.title}</span><p className="mt-0.5 text-xs opacity-80">{a.message}</p></div>
                <button onClick={() => dismiss(a.id)} className="absolute right-2 top-2 rounded-sm p-0.5 opacity-60 hover:opacity-100"><X className="size-3.5" /></button>
              </div>
            ))}
          </div>
        )}

        {/* Logo */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className={cn('relative mb-1 transition-all duration-700', logoAnim ? 'scale-100 opacity-100' : 'scale-50 opacity-0')}>
            <div className="flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
              <Zap className="size-7 text-primary" />
            </div>
          </div>
          <h1 className={cn('text-4xl font-extrabold tracking-tighter sm:text-5xl text-foreground transition-all duration-700 delay-200', logoAnim ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0')}>
            ELASTICO
          </h1>
          <p className={cn('text-[13px] font-medium tracking-wide text-muted-foreground transition-all duration-700 delay-300', logoAnim ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0')}>
            Football Analytics
          </p>
        </div>

        {/* Auth Card */}
        <Card className="relative z-[1] w-full overflow-hidden rounded-lg border-border bg-card">
          <Tabs defaultValue="login" className="w-full">
            <CardHeader className="pb-0">
              <TabsList className="mx-auto grid w-full grid-cols-2 bg-secondary/50 p-1 rounded-lg">
                <TabsTrigger value="login" className="text-[13px] font-semibold data-[state=active]:bg-primary/15 data-[state=active]:text-primary text-muted-foreground transition-colors rounded-md">Sign In</TabsTrigger>
                <TabsTrigger value="register" className="text-[13px] font-semibold data-[state=active]:bg-primary/15 data-[state=active]:text-primary text-muted-foreground transition-colors rounded-md">Create Account</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-4">
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  {loginError && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{loginError}</div>}

                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-xs font-medium text-muted-foreground"><Mail className="mr-1.5 inline size-3" />Email</Label>
                    <Input id="login-email" type="email" placeholder="you@example.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required autoComplete="email" className={inputCls} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password" className="text-xs font-medium text-muted-foreground"><Lock className="mr-1.5 inline size-3" />Password</Label>
                      <button type="button" disabled className="text-[11px] font-medium text-primary/60 hover:text-primary transition-colors opacity-50 cursor-not-allowed">Forgot password?</button>
                    </div>
                    <div className="relative">
                      <Input id="login-password" type={showLoginPassword ? 'text' : 'password'} placeholder="Enter your password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required autoComplete="current-password" className={cn(inputCls, 'pr-10')} />
                      <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-secondary-foreground" tabIndex={-1}>
                        {showLoginPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox id="remember" checked={rememberMe} onCheckedChange={(v) => setRememberMe(v === true)} className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                    <Label htmlFor="remember" className="text-xs text-muted-foreground cursor-pointer">Remember me</Label>
                  </div>

                  <Button type="submit" disabled={loginLoading || !loginEmail || !loginPassword} className="h-10 w-full bg-primary text-sm font-semibold text-primary-foreground rounded-lg transition-colors hover:bg-primary/90 disabled:opacity-50">
                    {loginLoading ? <><Loader2 className="size-4 animate-spin" />Signing in...</> : <>Sign in<ChevronRight className="size-4" /></>}
                  </Button>
                </form>


              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  {regError && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{regError}</div>}
                  <div className="space-y-2">
                    <Label htmlFor="reg-name" className="text-xs font-medium text-muted-foreground"><User className="mr-1.5 inline size-3" />Full Name</Label>
                    <Input id="reg-name" type="text" placeholder="John Doe" value={regName} onChange={(e) => setRegName(e.target.value)} required autoComplete="name" className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email" className="text-xs font-medium text-muted-foreground"><Mail className="mr-1.5 inline size-3" />Email</Label>
                    <Input id="reg-email" type="email" placeholder="you@example.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required autoComplete="email" className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password" className="text-xs font-medium text-muted-foreground"><Lock className="mr-1.5 inline size-3" />Password</Label>
                    <div className="relative">
                      <Input id="reg-password" type={showRegPassword ? 'text' : 'password'} placeholder="Min. 12 characters" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required autoComplete="new-password" className={cn(inputCls, 'pr-10')} />
                      <button type="button" onClick={() => setShowRegPassword(!showRegPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-secondary-foreground" tabIndex={-1}>{showRegPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-confirm" className="text-xs font-medium text-muted-foreground"><Lock className="mr-1.5 inline size-3" />Confirm Password</Label>
                    <div className="relative">
                      <Input id="reg-confirm" type={showRegConfirm ? 'text' : 'password'} placeholder="Re-enter your password" value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} required autoComplete="new-password" className={cn(inputCls, 'pr-10')} />
                      <button type="button" onClick={() => setShowRegConfirm(!showRegConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-secondary-foreground" tabIndex={-1}>{showRegConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                    </div>
                  </div>
                  <Button type="submit" disabled={regLoading || !regName || !regEmail || !regPassword || !regConfirmPassword} className="h-10 w-full bg-primary text-sm font-semibold text-primary-foreground rounded-lg transition-colors hover:bg-primary/90 disabled:opacity-50">
                    {regLoading ? <><Loader2 className="size-4 animate-spin" />Creating account...</> : <>Create account<ChevronRight className="size-4" /></>}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} ELASTICO</p>
          <p className="text-[10px] text-muted-foreground/60">
            <span className="text-muted-foreground">Terms of Service</span>
            {' · '}
            <span className="text-muted-foreground">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  )
}