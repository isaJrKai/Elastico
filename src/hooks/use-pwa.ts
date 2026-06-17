/**
 * ELASTICO — usePWA Hook
 *
 * Handles:
 *   1. Service Worker registration & lifecycle
 *   2. PWA install prompt (beforeinstallprompt event)
 *   3. Online/offline status detection
 *   4. Cache version management
 *
 * Once the SW is registered on first visit (e.g. iPhone 6s Safari),
 * the entire ~5 MB app is cached to device storage.
 * Subsequent opens: 0 MB mobile data — loads instantly from phone memory.
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PWAState {
  /** Whether the service worker is registered and active */
  isRegistered: boolean
  /** Whether the browser is currently offline */
  isOffline: boolean
  /** Whether a PWA install prompt is available */
  canInstall: boolean
  /** Whether the app is running as an installed PWA (standalone mode) */
  isStandalone: boolean
  /** Service worker registration status */
  swStatus: 'idle' | 'registering' | 'active' | 'error'
}

export function usePWA() {
  const [state, setState] = useState<PWAState>({
    isRegistered: false,
    isOffline: false,
    canInstall: false,
    isStandalone: false,
    swStatus: 'idle',
  })

  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  // ── Detect standalone mode ────────────────────────────────────────────────
  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    setState((s) => ({ ...s, isStandalone }))
  }, [])

  // ── Online/Offline detection ─────────────────────────────────────────────
  useEffect(() => {
    const handleOnline = () => setState((s) => ({ ...s, isOffline: false }))
    const handleOffline = () => setState((s) => ({ ...s, isOffline: true }))

    setState((s) => ({ ...s, isOffline: !navigator.onLine }))

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // ── PWA Install Prompt ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      setState((s) => ({ ...s, canInstall: true }))
    }

    window.addEventListener('beforeinstallprompt', handler)

    window.addEventListener('appinstalled', () => {
      deferredPrompt.current = null
      setState((s) => ({ ...s, canInstall: false }))
    })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // ── Register Service Worker ─────────────────────────────────────────────
  // DISABLED: Service worker registration is temporarily disabled to resolve
  // cache-related client-side errors. The old broken SW is auto-unregistered
  // via layout.tsx <script> tag. Re-enable once SW is stable.
  useEffect(() => {
    console.log('[PWA] Service Worker registration disabled (cache fix)')
  }, [])

  // ── Actions ─────────────────────────────────────────────────────────────

  /** Show the native install prompt */
  const promptInstall = useCallback(async () => {
    if (!deferredPrompt.current) return false
    await deferredPrompt.current.prompt()
    const result = await deferredPrompt.current.userChoice
    deferredPrompt.current = null
    setState((s) => ({ ...s, canInstall: false }))
    return result.outcome === 'accepted'
  }, [])

  /** Clear all service worker caches (forces fresh download) */
  const clearCache = useCallback(async () => {
    if (!navigator.serviceWorker.controller) return
    const channel = new MessageChannel()
    navigator.serviceWorker.controller.postMessage(
      { type: 'CLEAR_CACHE' },
      [channel.port2]
    )
    return new Promise<void>((resolve) => {
      channel.port1.onmessage = (e) => {
        if (e.data.type === 'CACHE_CLEARED') resolve()
      }
      // Timeout fallback
      setTimeout(resolve, 3000)
    })
  }, [])

  /** Unregister the service worker entirely */
  const unregister = useCallback(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration) {
      await registration.unregister()
      setState({ isRegistered: false, isOffline: !navigator.onLine, canInstall: false, isStandalone: false, swStatus: 'idle' })
    }
  }, [])

  return {
    ...state,
    promptInstall,
    clearCache,
    unregister,
  }
}