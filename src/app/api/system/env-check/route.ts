/**
 * GET /api/system/env-check
 *
 * Returns which API keys are configured in the current environment.
 * This is the ONLY endpoint that exposes key presence (never key values).
 * Intended for post-deploy verification on Vercel.
 *
 * Security: returns only boolean configured/not-configured + key prefix.
 * Actual key values are NEVER sent to the client.
 */
import { NextResponse } from 'next/server'
import { getProviderStatus } from '@/lib/ai-gateway'

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

function keyStatus(envKey: string): { configured: boolean; prefix: string } {
  const val = process.env[envKey]
  if (!val || val.length === 0) return { configured: false, prefix: '' }
  // Show first 4 chars + length to help identify which key it is
  const prefix = val.length > 4 ? `${val.slice(0, 4)}... (${val.length} chars)` : `${val.slice(0, 2)}... (${val.length} chars)`
  return { configured: true, prefix }
}

export async function GET() {
  const aiProviders = getProviderStatus()

  const aiKeys = AI_KEYS.map(k => {
    const status = keyStatus(k.name)
    return {
      envVar: k.name,
      label: k.label,
      configured: status.configured,
      prefix: status.prefix,
    }
  })

  const dataKeys = DATA_KEYS.map(k => {
    const status = keyStatus(k.name)
    return {
      envVar: k.name,
      label: k.label,
      configured: status.configured,
      prefix: status.prefix,
    }
  })

  const otherKeys = OTHER_KEYS.map(k => {
    const status = keyStatus(k.name)
    return {
      envVar: k.name,
      label: k.label,
      configured: status.configured,
      prefix: status.prefix,
    }
  })

  const configuredAiCount = aiKeys.filter(k => k.configured).length
  const configuredDataCount = dataKeys.filter(k => k.configured).length

  return NextResponse.json({
    environment: process.env.NODE_ENV || 'unknown',
    vercel: !!process.env.VERCEL,
    region: process.env.VERCEL_REGION || 'local',
    summary: {
      aiProvidersConfigured: configuredAiCount,
      dataProvidersConfigured: configuredDataCount,
      aiReady: configuredAiCount > 0,
      databaseReady: !!process.env.DATABASE_URL,
    },
    aiKeys,
    dataKeys,
    otherKeys,
    gatewayProviders: aiProviders,
    timestamp: new Date().toISOString(),
  })
}
