// ELASTICO — TimesFM 2.5 In-Context Conditioning Engine
// Probabilistic goal projection via NVIDIA NIM TimesFM with covariate conditioning

import { NextResponse } from 'next/server'
import http from 'http'
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

    const req = http.request(options, (res) => {
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

// ── Mock Fallback Projection ───────────────────────────────────────────────────

function mockProjection(coreHistory: number[], recentIndicators: number[]): number {
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

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth
    const identifier = auth.user.id
    const rl = rateLimit(`timesfm:${identifier}`, 5, 60_000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limited', retryAfterMs: rl.retryAfterMs }, { status: 429 })
    }

    const body = await request.json()
    const { coreHistory, recentIndicators } = body

    if (!coreHistory || !Array.isArray(coreHistory) || coreHistory.length === 0) {
      return NextResponse.json(
        { error: 'coreHistory is required (array of numbers representing goal trends)' },
        { status: 400 }
      )
    }

    const indicators: number[] = Array.isArray(recentIndicators) ? recentIndicators : []

    // Normalize coreHistory to exactly 64 values
    const normalizedHistory = normalizeToLookback(coreHistory, LOOKBACK_SIZE)
    const covariateDescription = buildCovariateDescription(indicators)

    // Check if NVIDIA API key is available
    const apiKey = process.env.NVIDIA_API_KEY
    const isKeyConfigured = !!apiKey && apiKey !== 'nvapi-PLACEHOLDER_USER_MUST_REPLACE'

    if (!isKeyConfigured) {
      // Fallback to mock calculation
      const conditionedProjection = mockProjection(normalizedHistory, indicators)
      return NextResponse.json({
        success: true,
        conditionedProjection,
        rawResponse: 'Mock fallback — NVIDIA_API_KEY not configured',
        model: 'mock-fallback',
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
        // Both models failed — use mock
        const conditionedProjection = mockProjection(normalizedHistory, indicators)
        return NextResponse.json({
          success: true,
          conditionedProjection,
          rawResponse: `Both NVIDIA models failed: ${errMsg}. Used mock fallback.`,
          model: 'mock-fallback',
          lookbackUsed: normalizedHistory.length,
          indicatorsCount: indicators.length,
        })
      }
    }

    // Parse the numeric projection from the response
    const projectionMatch = rawResponse.match(/(\d+\.?\d*)/)
    const conditionedProjection = projectionMatch
      ? Math.max(0, parseFloat(projectionMatch[1]))
      : mockProjection(normalizedHistory, indicators)

    return NextResponse.json({
      success: true,
      conditionedProjection,
      rawResponse: rawResponse.trim(),
      model: usedModel,
      lookbackUsed: normalizedHistory.length,
      indicatorsCount: indicators.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `TimesFM conditioning failed: ${message}` }, { status: 500 })
  }
}