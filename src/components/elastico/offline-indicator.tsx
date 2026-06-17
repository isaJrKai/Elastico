'use client'

import { usePWA } from '@/hooks/use-pwa'
import { WifiOff, Download, RefreshCw, CheckCircle2, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'

/**
 * ELASTICO — Offline Indicator & PWA Install Banner
 *
 * Shows:
 *   1. Offline indicator bar when network drops (with cached-data notice)
 *   2. PWA install prompt (first visit, non-standalone)
 *   3. Cache status badge (after SW is active)
 */

export function OfflineIndicator() {
  const { isOffline, canInstall, isRegistered, isStandalone, promptInstall, swStatus } = usePWA()
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Show install banner on first visit after SW registers
  useEffect(() => {
    if (canInstall && !isStandalone && !dismissed) {
      const timer = setTimeout(() => setShowInstallBanner(true), 5000)
      return () => clearTimeout(timer)
    }
  }, [canInstall, isStandalone, dismissed])

  const handleInstall = async () => {
    const accepted = await promptInstall()
    if (accepted) setShowInstallBanner(false)
  }

  if (isOffline) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-amber-500/10 border-t border-amber-500/30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-amber-400 text-sm">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span className="font-medium">You're offline</span>
            <span className="hidden sm:inline text-amber-400/70">
              — Showing cached data, 0 MB used
            </span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 text-xs font-medium text-amber-300 hover:text-amber-200 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  // PWA Install Banner (only on first visit, non-standalone)
  if (showInstallBanner && canInstall && !isStandalone) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-emerald-500/10 border-t border-emerald-500/30 backdrop-blur-md animate-in slide-in-from-bottom duration-500">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Smartphone className="h-4.5 w-4.5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-emerald-300">
                Install ELASTICO
              </p>
              <p className="text-xs text-emerald-400/60 hidden sm:block">
                Save to home screen — loads instantly, uses 0 MB data on reopen
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground hover:text-foreground h-8 px-3"
              onClick={() => { setShowInstallBanner(false); setDismissed(true) }}
            >
              Not now
            </Button>
            <Button
              size="sm"
              className="text-xs h-8 px-4 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold"
              onClick={handleInstall}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Install
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Cache status badge (shown briefly after SW activates, then fades)
  if (isRegistered && !isStandalone && !isOffline && !canInstall && swStatus === 'active') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        <div className="max-w-7xl mx-auto px-4 py-2 flex justify-end">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400/70 text-xs animate-in fade-in slide-in-from-bottom-2 duration-700">
            <CheckCircle2 className="h-3 w-3" />
            <span>App cached — works offline</span>
          </div>
        </div>
      </div>
    )
  }

  return null
}