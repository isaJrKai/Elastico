/**
 * GET /api/system/env-check
 *
 * Restricted operational diagnostic. Never expose secret prefixes, lengths,
 * or infrastructure metadata to anonymous callers.
 */
import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getProviderStatus } from '@/lib/ai-gateway'

export const runtime = 'nodejs'

const AI_KEYS = [
  { name: 'GROQ_API_KEY', label: 'Groq' },
  { name: 'CEREBRAS_API_KEY', label: 'Cerebras' },
  { name: 'GOOGLE_AI_API_KEY', label: 'Google Gemini' },
  { name: 'OPENROUTER_API_KEY', label: 'OpenRouter' },
  { name: 'NVIDIA_API_KEY', label: 'NVIDIA' },
  { name: 'MISTRAL_API_KEY', label: 'Mistral' },
  { name: 'GITHUB_TOKEN', label: 'GitHub Models' },
] as const

const DATA_KEYS = [
  { name: 'API_SPORTS_KEY', label: 'API-Sports' },
  { name: 'FOOTBALL_DATA_API_KEY', label: 'football-data.org' },
  { name: 'THE_ODDS_API_KEY', label: 'TheOdds API' },
  { name: 'NEWSDATA_API_KEY', label: 'NewsData.io' },
  { name: 'THE_SPORTS_DB_KEY', label: 'TheSportsDB' },
] as const

const OTHER_KEYS = [
  { name: 'DATABASE_URL', label: 'Database URL' },
  { name: 'DIRECT_URL', label: 'Direct URL (Neon)' },
  { name: 'JWT_SECRET', label: 'JWT Secret' },
  { name: 'DISCORD_WEBHOOK_URL', label: 'Discord Webhook' },
] as const

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.ENV_CHECK_TOKEN
  const header = request.headers.get('authorization') || ''
  const provided = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!expected || !provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

function keyStatus(envKey: string): { configured: boolean } {
  return { configured: Boolean(process.env[envKey]) }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    // Conceal the existence of this operational endpoint from anonymous callers.
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const aiProviders = getProviderStatus()
  const aiKeys = AI_KEYS.map(k => ({
    envVar: k.name,
    label: k.label,
    configured: keyStatus(k.name).configured,
  }))
  const dataKeys = DATA_KEYS.map(k => ({
    envVar: k.name,
    label: k.label,
    configured: keyStatus(k.name).configured,
  }))
  const otherKeys = OTHER_KEYS.map(k => ({
    envVar: k.name,
    label: k.label,
    configured: keyStatus(k.name).configured,
  }))

  const configuredAiCount = aiKeys.filter(k => k.configured).length
  const configuredDataCount = dataKeys.filter(k => k.configured).length

  return NextResponse.json({
    summary: {
      aiProvidersConfigured: configuredAiCount,
      dataProvidersConfigured: configuredDataCount,
      aiReady: configuredAiCount > 0,
      databaseReady: Boolean(process.env.DATABASE_URL),
    },
    aiKeys,
    dataKeys,
    otherKeys,
    gatewayProviders: aiProviders,
    timestamp: new Date().toISOString(),
  })
}
