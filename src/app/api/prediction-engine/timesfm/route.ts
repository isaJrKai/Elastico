// ELASTICO — Experimental conditioned-goal forecast endpoint.
// Requests the configured TimesFM model ID through NVIDIA NIM and may fall back to an LLM or local baseline.

import { NextResponse } from 'next/server'
import https from 'https'
import { authenticateRequest } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

// ── Constants ──────────────────────────────────────────────────────────────────

const LOOKBACK_SIZE = 64
const NVIDIA_NIM_HOST = 'integrate.api.nvidia.com'
const NVIDIA_NIM_PATH = '/v1/chat/completions'
const TIMESFM_MODEL = 'google/timesfm-2.0-default'
const FALLBACK_MODEL = 'nvidia/llama-3.1-70b-instruct'

// ── NVIDIA NIM Call via raw http module ────────────────────────────────────────

function callNvidiaNim(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.NVIDIA_API_KEY
    if (!apiKey || apiKey === 'nvapi-PLACEHOLDER_USER_MUST_REPLACE') {
      return reject(new Error('NVIDIA_API_KEY not configured'))
    }

    const payload = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    })

    const options = {
      hostname: NVIDIA_NIM_HOST,
      path: NVIDIA_NIM_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (parsed.choices && parsed.choices[0]?.message?.content) {
            resolve(parsed.choices[0].message.content)
          } else if (parsed.error) {
            reject(new Error(parsed.error.message || 'NVIDIA API error'))
          } else {
            reject(new Error('Unexpected NVIDIA response format'))
          }
        } catch {
          reject(new Error(`Failed to parse NVIDIA response: ${data.slice(0, 200)}`))
        }
      })
    })

    req.on('error', (err) => {
      reject(new Error(`NVIDIA API connection failed: ${err.message}`))
    })

    req.setTimeout(60000, () => {
      req.destroy()
      reject(new Error('NVIDIA API request timed out'))
    })

    req.write(payload)
    req.end()
  })
}

// ── Local Statistical Baseline ───────────────────────────────────────────────────

function baselineProjection(coreHistory: number[], recentIndicators: number[]): number {
  // Simple weighted moving average with recent indicator influence
  const recentWeight = 0.4
  const historicalWeight = 0.6

  const histMean = coreHistory.reduce((a, b) => a + b, 0) / coreHistory.length
  const indicatorMean = recentIndicators.length > 0
    ? recentIndicators.reduce((a, b) => a + b, 0) / recentIndicators.length
    : histMean

  // Recent trend (last 8 games slope)
  const recentSlice = coreHistory.slice(-8)
  const xMean = (recentSlice.length - 1) / 2
  const yMean = recentSlice.reduce((a, b) => a + b, 0) / recentSlice.length
  let numerator = 0
  let denominator = 0
  for (let i = 0; i < recentSlice.length; i++) {
    numerator += (i - xMean) * (recentSlice[i] - yMean)
    denominator += (i - xMean) ** 2
  }
  const slope = denominator !== 0 ? numerator / denominator : 0

  const projection = historicalWeight * histMean + recentWeight * indicatorMean + slope * 0.3
  return Math.max(0, Math.round(projection * 1000) / 1000)
}

// ── Pad/Truncate to Lookback Size ──────────────────────────────────────────────

function normalizeToLookback(data: number[], size: number): number[] {
  if (data.length >= size) {
    return data.slice(-size)
  }
  // Pad with mean of existing data
  const mean = data.reduce((a, b) => a + b, 0) / data.length
  const padCount = size - data.length
  return Array(padCount).fill(mean).concat(data)
}

// ── Build Covariate Matrix Description ─────────────────────────────────────────

function buildCovariateDescription(indicators: number[]): string {
  if (indicators.length === 0) return 'No conditioning variables provided.'

  const labels = [
    'Recent Form (goals/game)',
    'Odds Shift Magnitude',
    'xG Differential',
    'ELO Rank Change',
    'Possession Delta',
    'Shot Volume Trend',
    'Pressing Intensity',
    'Defensive Solidity',
  ]

  const lines = indicators.slice(0, labels.length).map((val, i) => {
    const label = labels[i] || `Indicator ${i + 1}`
    return `  ${label}: ${val.toFixed(4)}`
  })

  return `Conditioning Variables (Covariates):\n${lines.join('\n')}`
}

// ── POST Handler ───────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth
  const apiKey = process.env.NVIDIA_API_KEY
  const configured = Boolean(apiKey && apiKey !== 'nvapi-PLACEHOLDER_USER_MUST_REPLACE')
  return NextResponse.json({ configured, provider: 'NVIDIA NIM', requestedModel: TIMESFM_MODEL })
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth
    const identifier = auth.user.id
    const rl = rateLimit(`timesfm:${identifier}`, 5, 60_000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limited', retryAfterMs: rl.retryAfterMs }, { status: 429 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 })
    }
    const { coreHistory, recentIndicators } = body as { coreHistory?: unknown; recentIndicators?: unknown }

    if (!Array.isArray(coreHistory) || coreHistory.length === 0 || coreHistory.length > LOOKBACK_SIZE) {
      return NextResponse.json(
        { error: `coreHistory must contain between 1 and ${LOOKBACK_SIZE} recent match goal totals` },
        { status: 400 }
      )
    }
    if (!coreHistory.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 20)) {
      return NextResponse.json({ error: 'coreHistory values must be finite goal totals between 0 and 20' }, { status: 400 })
    }
    if (recentIndicators !== undefined && (!Array.isArray(recentIndicators) || recentIndicators.length > 8
      || !recentIndicators.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1000))) {
      return NextResponse.json({ error: 'recentIndicators must contain up to 8 finite numeric values within ±1000' }, { status: 400 })
    }
    const indicators: number[] = Array.isArray(recentIndicators) ? recentIndicators as number[] : []

    // Status endpoint reports configuration only; it does not expose the secret or claim the provider is reachable.
    

    // Normalize coreHistory to exactly 64 values
    const normalizedHistory = normalizeToLookback(coreHistory, LOOKBACK_SIZE)
    const covariateDescription = buildCovariateDescription(indicators)

    // Check if NVIDIA API key is available
    const apiKey = process.env.NVIDIA_API_KEY
    const isKeyConfigured = !!apiKey && apiKey !== 'nvapi-PLACEHOLDER_USER_MUST_REPLACE'

    if (!isKeyConfigured) {
      // This is a transparent local baseline, not a TimesFM model forecast.
      const conditionedProjection = baselineProjection(normalizedHistory, indicators)
      return NextResponse.json({
        success: true,
        conditionedProjection,
        rawResponse: 'NVIDIA_API_KEY is not configured; using a weighted moving-average baseline, not TimesFM.',
        model: 'weighted-moving-average-baseline',
        forecastType: 'baseline',
        isModelForecast: false,
        lookbackUsed: normalizedHistory.length,
        indicatorsCount: indicators.length,
      })
    }

    // Build the structured prompt
    const systemPrompt = `You are the ELASTICO TimesFM 2.5 In-Context Conditioning Engine. You receive historical goal data and recent conditioning indicators for a football match prediction. You must output a single number: the projected total goals for the next match as a probability-weighted decimal (e.g., 2.45). Output ONLY the number, nothing else.`

    const historyStr = normalizedHistory
      .map((val, i) => `  Game ${i + 1}: ${val}`)
      .join('\n')

    const userPrompt = `Historical Goal Data (64-game lookback, chronologically ordered):
${historyStr}

${covariateDescription}

Based on the time series pattern and conditioning variables, project the expected total goals for the next match. Output a single decimal number only.`

    // Try TimesFM model first, fallback to LLaMA
    let rawResponse: string
    let usedModel: string

    try {
      rawResponse = await callNvidiaNim(TIMESFM_MODEL, systemPrompt, userPrompt)
      usedModel = TIMESFM_MODEL
    } catch {
      // Fallback to LLaMA model
      try {
        rawResponse = await callNvidiaNim(FALLBACK_MODEL, systemPrompt, userPrompt)
        usedModel = FALLBACK_MODEL
      } catch (fallbackErr) {
        const errMsg = fallbackErr instanceof Error ? fallbackErr.message : 'Unknown error'
        // Both provider models failed; return an explicitly labeled local baseline.
        const conditionedProjection = baselineProjection(normalizedHistory, indicators)
        return NextResponse.json({
          success: true,
          conditionedProjection,
          rawResponse: `Both NVIDIA models failed: ${errMsg}. Used a weighted moving-average baseline instead.`,
          model: 'weighted-moving-average-baseline',
          forecastType: 'baseline',
          isModelForecast: false,
          lookbackUsed: normalizedHistory.length,
          indicatorsCount: indicators.length,
        })
      }
    }

    // Never disguise an invalid model response as a successful forecast.
    const projectionMatch = rawResponse.trim().match(/^\s*(\d+(?:\.\d+)?)\s*$/)
    if (!projectionMatch) {
      return NextResponse.json({
        error: 'Forecast provider returned a non-numeric response. No forecast was produced.',
        model: usedModel,
      }, { status: 502 })
    }
    const parsedProjection = Number(projectionMatch[1])
    if (!Number.isFinite(parsedProjection) || parsedProjection < 0 || parsedProjection > 20) {
      return NextResponse.json({
        error: 'Forecast provider returned a value outside the supported 0–20 goal range. No forecast was produced.',
        model: usedModel,
      }, { status: 502 })
    }
    const conditionedProjection = Math.round(parsedProjection * 1000) / 1000

    return NextResponse.json({
      success: true,
      conditionedProjection,
      rawResponse: rawResponse.trim(),
      model: usedModel,
      forecastType: 'provider-model',
      isModelForecast: true,
      lookbackUsed: normalizedHistory.length,
      indicatorsCount: indicators.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `TimesFM conditioning failed: ${message}` }, { status: 500 })
  }
}