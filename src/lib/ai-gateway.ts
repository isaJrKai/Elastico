/**
 * ELASTICO — Multi-Provider AI Gateway
 *
 * Routes AI calls through Vercel's US/EU servers, bypassing geo-restrictions.
 * All API calls are server-side only — the user's location never matters.
 *
 * ⚠️  SECURITY: All API keys MUST be set via environment variables.
 *     Never hardcode secrets in source code. This file is server-only
 *     and keys are never sent to the browser.
 *
 * Priority order (7 providers):
 * 1. Google Gemini (best quality, 1M context)
 * 2. Groq (ultra-fast, ~200ms)
 * 3. Cerebras (insanely fast, ~2K tokens/sec)
 * 4. Mistral (huge daily token limit)
 * 5. NVIDIA (if key available)
 * 6. GitHub Models (GPT-4o-mini free)
 * 7. OpenRouter (last resort, free models)
 *
 * Automatic failover: if #1 fails, tries #2, then #3, etc.
 */

/**
 * Resolve an API key from environment variables only.
 * Set keys in .env (local) or Vercel Environment Variables (production).
 */
export function resolveKey(envKey: string): string {
  const envVal = process.env[envKey]
  if (envVal && envVal.length > 5) return envVal
  return ''
}

// ── Provider Configs ──────────────────────────────────────────────────────────

interface Provider {
  name: string
  baseUrl: string
  model: string
  maxTokens: number
  envKey: string
  headers: (key: string) => Record<string, string>
}

const PROVIDERS: Provider[] = [
  {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.5-flash',
    maxTokens: 4096,
    envKey: 'GOOGLE_AI_API_KEY',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    maxTokens: 4096,
    envKey: 'GROQ_API_KEY',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  {
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1/chat/completions',
    model: 'llama-4-scout-17b-16e-instruct',
    maxTokens: 4096,
    envKey: 'CEREBRAS_API_KEY',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  {
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-small-latest',
    maxTokens: 4096,
    envKey: 'MISTRAL_API_KEY',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  {
    name: 'NVIDIA',
    baseUrl: 'https://integrate.api.nvidia.com/v1/chat/completions',
    model: 'meta/llama-3.3-70b-instruct',
    maxTokens: 4096,
    envKey: 'NVIDIA_API_KEY',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  {
    name: 'GitHub Models',
    baseUrl: 'https://models.github.ai/inference/chat/completions',
    model: 'openai/gpt-4o-mini',
    maxTokens: 4096,
    envKey: 'GITHUB_TOKEN',
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }),
  },
  {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'google/gemma-4-26b-a4b-it:free',
    maxTokens: 2048,
    envKey: 'OPENROUTER_API_KEY',
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://elastico-elastico.vercel.app',
      'X-Title': 'ELASTICO',
    }),
  },
]

// ── Active Provider Tracker ──────────────────────────────────────────────────

/** Track which providers are currently in cooldown (429 / 5xx) */
const cooldowns = new Map<string, number>() // provider name → timestamp

function isCoolingDown(providerName: string): boolean {
  const until = cooldowns.get(providerName) || 0
  return Date.now() < until
}

function markCooldown(providerName: string, seconds = 60) {
  cooldowns.set(providerName, Date.now() + seconds * 1000)
}

// ── Core AI Call ─────────────────────────────────────────────────────────────

interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiResult {
  text: string
  provider: string
  model: string
  latencyMs: number
  tokensUsed?: { prompt: number; completion: number }
}

/**
 * Call an AI provider with automatic failover across all configured providers.
 * Tries each provider in priority order, skipping those in cooldown.
 */
export async function callAi(
  messages: AiMessage[],
  options?: {
    preferProvider?: string
    maxTokens?: number
    temperature?: number
    stream?: boolean
  }
): Promise<AiResult> {
  const maxTokens = options?.maxTokens || 4096
  const temperature = options?.temperature ?? 0.7

  // Build ordered provider list
  let providers = [...PROVIDERS]

  // If a preferred provider is specified, try it first
  if (options?.preferProvider) {
    const preferred = providers.find(p => p.name === options.preferProvider)
    if (preferred) {
      providers = [preferred, ...providers.filter(p => p.name !== options.preferProvider)]
    }
  }

  // Filter to only those with API keys configured via environment variables
  const available = providers.filter(p => {
    const key = resolveKey(p.envKey)
    return !!key && key.length > 5
  })

  if (available.length === 0) {
    return {
      text: '',
      provider: 'none',
      model: 'none',
      latencyMs: 0,
    }
  }

  // Try each provider with failover
  const errors: string[] = []
  for (const provider of available) {
    if (isCoolingDown(provider.name)) {
      errors.push(`${provider.name}: cooling down`)
      continue
    }

    const apiKey = resolveKey(provider.envKey)
    const start = Date.now()

    try {
      const body: Record<string, unknown> = {
        model: provider.model,
        messages,
        max_tokens: maxTokens,
        temperature,
      }

      const resp = await fetch(provider.baseUrl, {
        method: 'POST',
        headers: provider.headers(apiKey),
        body: JSON.stringify(body),
      })

      if (resp.status === 429) {
        markCooldown(provider.name, 120)
        errors.push(`${provider.name}: rate limited (429)`)
        continue
      }

      if (!resp.ok) {
        const errText = await resp.text().catch(() => 'unknown')
        // Geo-block or auth error — longer cooldown
        if (resp.status === 403 || resp.status === 401) {
          markCooldown(provider.name, 300)
        }
        errors.push(`${provider.name}: ${resp.status} ${errText.slice(0, 100)}`)
        continue
      }

      const data = await resp.json()
      const text = data.choices?.[0]?.message?.content || ''
      const usage = data.usage

      if (!text) {
        errors.push(`${provider.name}: empty response`)
        continue
      }

      console.log(`[AI Gateway] ${provider.name}/${provider.model} — ${Date.now() - start}ms`)

      return {
        text,
        provider: provider.name,
        model: provider.model,
        latencyMs: Date.now() - start,
        tokensUsed: usage ? {
          prompt: usage.prompt_tokens || 0,
          completion: usage.completion_tokens || 0,
        } : undefined,
      }
    } catch (err) {
      errors.push(`${provider.name}: ${err instanceof Error ? err.message : 'fetch failed'}`)
      continue
    }
  }

  // All providers failed
  console.error(`[AI Gateway] All providers failed:`, errors)
  return {
    text: '',
    provider: 'failed',
    model: 'none',
    latencyMs: 0,
  }
}

/**
 * Streaming AI call with failover.
 * Returns a ReadableStream of text chunks.
 */
export async function callAiStream(
  messages: AiMessage[],
  options?: {
    preferProvider?: string
    maxTokens?: number
    temperature?: number
  }
): Promise<{ stream: ReadableStream<Uint8Array>; provider: string; model: string } | null> {
  const maxTokens = options?.maxTokens || 4096
  const temperature = options?.temperature ?? 0.7

  let providers = [...PROVIDERS]
  if (options?.preferProvider) {
    const preferred = providers.find(p => p.name === options.preferProvider)
    if (preferred) {
      providers = [preferred, ...providers.filter(p => p.name !== options.preferProvider)]
    }
  }

  const available = providers.filter(p => {
    const key = resolveKey(p.envKey)
    return !!key && key.length > 5
  })

  if (available.length === 0) return null

  const errors: string[] = []
  for (const provider of available) {
    if (isCoolingDown(provider.name)) continue

    const apiKey = resolveKey(provider.envKey)
    const body: Record<string, unknown> = {
      model: provider.model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: true,
    }

    try {
      const resp = await fetch(provider.baseUrl, {
        method: 'POST',
        headers: provider.headers(apiKey),
        body: JSON.stringify(body),
      })

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) markCooldown(provider.name, 120)
        if (resp.status === 403 || resp.status === 401) markCooldown(provider.name, 300)
        errors.push(`${provider.name}: ${resp.status}`)
        continue
      }

      const decoder = new TextDecoder()
      const encoder = new TextEncoder()

      const transformStream = new TransformStream<Uint8Array, Uint8Array>({
        async transform(chunk, controller) {
          const text = decoder.decode(chunk, { stream: true })
          const lines = text.split('\n')
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data: ')) continue
            const data = trimmed.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content
              if (content) controller.enqueue(encoder.encode(content))
            } catch { /* skip */ }
          }
        },
      })

      return {
        stream: resp.body.pipeThrough(transformStream),
        provider: provider.name,
        model: provider.model,
      }
    } catch (err) {
      errors.push(`${provider.name}: ${err instanceof Error ? err.message : 'fetch failed'}`)
      continue
    }
  }

  console.error('[AI Gateway] All streaming providers failed:', errors)
  return null
}

/**
 * Get status of all configured AI providers.
 * Checks environment variables only.
 */
export function getProviderStatus(): Array<{
  name: string
  model: string
  configured: boolean
  coolingDown: boolean
  source: string
}> {
  return PROVIDERS.map(p => {
    const envVal = process.env[p.envKey]
    const hasEnv = !!envVal && envVal.length > 5
    return {
      name: p.name,
      model: p.model,
      configured: hasEnv,
      coolingDown: isCoolingDown(p.name),
      source: hasEnv ? 'env' : 'none',
    }
  })
}