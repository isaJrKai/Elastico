'use client'
import { useEffect, useState } from 'react'
import { ScrollReveal } from '@/components/design-system/animations/scroll-reveal'
import { GlassmorphCard } from '@/components/design-system/animations/glassmorphic-card'
import { InteractiveChart } from '@/components/design-system/data-viz/interactive-chart'
import { LiveCounter } from '@/components/design-system/data-viz/live-counter'

interface FederationStats {
  success: boolean
  federation: {
    status: string
    connected_repos: string
    languages_supported: string[]
    function_families: number
    total_functions: number
  }
  performance: {
    average_discovery_time: string
    max_parallel_repos: number
    cache_hit_rate: string
  }
}

export default function FederationDashboard() {
  const [stats, setStats] = useState<FederationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/federation/stats')
        const data = await response.json()
        setStats(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch stats')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-white mt-4">Initializing Federation System...</p>
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
        <div className="text-center text-red-400">
          <p>Error: {error || 'Failed to load federation stats'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      {/* Header */}
      <ScrollReveal direction="up">
        <div className="max-w-7xl mx-auto mb-12">
          <h1 className="text-5xl font-bold text-white mb-2">🌐 Elastico Federation System</h1>
          <p className="text-xl text-blue-200">Connected to 20,000+ GitHub Repositories</p>
        </div>
      </ScrollReveal>

      {/* Stats Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {/* Connected Repos */}
        <ScrollReveal delay={0.1}>
          <GlassmorphCard>
            <div className="text-center">
              <p className="text-blue-300 text-sm font-semibold mb-2">CONNECTED REPOSITORIES</p>
              <p className="text-4xl font-bold text-white mb-2">{stats.federation.connected_repos}</p>
              <p className="text-xs text-blue-200">Across all supported languages</p>
            </div>
          </GlassmorphCard>
        </ScrollReveal>

        {/* Functions */}
        <ScrollReveal delay={0.2}>
          <GlassmorphCard>
            <div className="text-center">
              <p className="text-emerald-300 text-sm font-semibold mb-2">ECLECTIC FUNCTIONS</p>
              <p className="text-4xl font-bold text-white mb-2">{stats.federation.total_functions}</p>
              <p className="text-xs text-emerald-200">{stats.federation.function_families} families</p>
            </div>
          </GlassmorphCard>
        </ScrollReveal>

        {/* Status */}
        <ScrollReveal delay={0.3}>
          <GlassmorphCard>
            <div className="text-center">
              <p className="text-purple-300 text-sm font-semibold mb-2">SYSTEM STATUS</p>
              <p className="text-4xl font-bold text-white mb-2">🟢 {stats.federation.status.toUpperCase()}</p>
              <p className="text-xs text-purple-200">All systems operational</p>
            </div>
          </GlassmorphCard>
        </ScrollReveal>
      </div>

      {/* Performance Metrics */}
      <ScrollReveal delay={0.4}>
        <div className="max-w-7xl mx-auto mb-12">
          <GlassmorphCard>
            <h2 className="text-2xl font-bold text-white mb-8">⚡ Performance Metrics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <p className="text-blue-300 text-sm font-semibold mb-2">Discovery Speed</p>
                <p className="text-3xl font-bold text-white">{stats.performance.average_discovery_time}</p>
                <p className="text-xs text-blue-200 mt-1">Average per repository</p>
              </div>
              <div>
                <p className="text-emerald-300 text-sm font-semibold mb-2">Parallel Capacity</p>
                <p className="text-3xl font-bold text-white">{stats.performance.max_parallel_repos}</p>
                <p className="text-xs text-emerald-200 mt-1">Concurrent repositories</p>
              </div>
              <div>
                <p className="text-purple-300 text-sm font-semibold mb-2">Cache Efficiency</p>
                <p className="text-3xl font-bold text-white">{stats.performance.cache_hit_rate}</p>
                <p className="text-xs text-purple-200 mt-1">Hit rate</p>
              </div>
            </div>
          </GlassmorphCard>
        </div>
      </ScrollReveal>

      {/* Supported Languages */}
      <ScrollReveal delay={0.5}>
        <div className="max-w-7xl mx-auto mb-12">
          <GlassmorphCard>
            <h2 className="text-2xl font-bold text-white mb-6">🗣️ Supported Languages</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {stats.federation.languages_supported.map((lang, i) => (
                <div
                  key={i}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-3 text-center hover:bg-white/10 transition-colors"
                >
                  <p className="text-white font-semibold text-sm">{lang}</p>
                </div>
              ))}
            </div>
          </GlassmorphCard>
        </div>
      </ScrollReveal>

      {/* Function Families */}
      <ScrollReveal delay={0.6}>
        <div className="max-w-7xl mx-auto">
          <GlassmorphCard>
            <h2 className="text-2xl font-bold text-white mb-6">🔧 Function Families</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { name: 'Animations', icon: '✨', count: 3 },
                { name: 'Data Processing', icon: '📊', count: 7 },
                { name: 'Validation', icon: '✅', count: 4 },
                { name: 'String Utils', icon: '📝', count: 6 },
                { name: 'Date Utils', icon: '📅', count: 4 },
                { name: 'Object Utils', icon: '📦', count: 4 },
                { name: 'Array Utils', icon: '📐', count: 4 },
                { name: 'Math Utils', icon: '🧮', count: 5 },
                { name: 'Functional', icon: '⚙️', count: 3 },
              ].map((family, i) => (
                <div
                  key={i}
                  className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-4 text-center hover:border-white/40 transition-colors"
                >
                  <p className="text-3xl mb-2">{family.icon}</p>
                  <p className="text-white font-semibold text-sm mb-1">{family.name}</p>
                  <p className="text-blue-300 text-xs font-bold">{family.count} functions</p>
                </div>
              ))}
            </div>
          </GlassmorphCard>
        </div>
      </ScrollReveal>

      {/* Footer */}
      <div className="max-w-7xl mx-auto mt-12 text-center text-blue-200 text-sm">
        <p>🚀 Federation System initialized and ready to connect with 20,000+ repositories</p>
        <p className="mt-2 text-xs text-blue-300">Last updated: {new Date().toLocaleString()}</p>
      </div>
    </div>
  )
}
