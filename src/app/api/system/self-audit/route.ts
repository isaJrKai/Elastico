// ELASTICO — Self-Auditing Troubleshooter API
// Implements automated data quality audits: scraper fidelity, data drift, market convergence

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/rbac'

// ── Constants ──────────────────────────────────────────────────────────────────

const CLV_THRESHOLD = 0.015
const FIDELITY_THRESHOLD = 0.95

// ── Discord Webhook Dispatch ───────────────────────────────────────────────────

async function dispatchDiscordAlert(message: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) return

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `🔴 **ELASTICO Self-Audit Alert**\n${message}`,
        username: 'ELASTICO Auditor',
      }),
    })
  } catch {
    // Silently fail — audit alerts are non-blocking
  }
}

// ── Scraper Fidelity Check ─────────────────────────────────────────────────────

interface ScraperFidelityData {
  df: Array<{ home_goals: number; away_goals: number }>
}

function checkScraperFidelity(data: ScraperFidelityData) {
  const { df } = data

  if (!df || df.length === 0) {
    return {
      passed: false,
      alert: {
        severity: 'CRITICAL',
        issue: 'Empty dataset received from scraper',
        details: 'The scraper returned zero match records. Possible source outage, authentication failure, or schema change at the data provider.',
      },
    }
  }

  const uniqueHomeGoals = new Set(df.map((r) => r.home_goals))
  if (uniqueHomeGoals.size <= 1 && df.length > 10) {
    return {
      passed: false,
      alert: {
        severity: 'WARNING',
        issue: 'Synthetic fallback detected',
        details: `Only ${uniqueHomeGoals.size} unique home_goals value(s) across ${df.length} records. This pattern is consistent with synthetic or placeholder data rather than real match results.`,
      },
    }
  }

  return { passed: true }
}

// ── Data Drift Detection ───────────────────────────────────────────────────────

interface DataDriftData {
  chronological_goals: number[]
}

function checkDataDrift(data: DataDriftData) {
  const { chronological_goals } = data

  if (!chronological_goals || chronological_goals.length < 4) {
    return {
      status: 'INSUFFICIENT_DATA',
      suggested_lookback: 64,
    }
  }

  const mid = Math.floor(chronological_goals.length / 2)
  const firstHalf = chronological_goals.slice(0, mid)
  const secondHalf = chronological_goals.slice(mid)

  const meanFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
  const meanSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
  const meanDelta = Math.abs(meanSecond - meanFirst)

  if (meanDelta > 0.75) {
    // Drift detected — suggest reducing lookback window
    const suggestedLookback = Math.max(16, Math.min(64, Math.floor(mid * 0.75)))
    return {
      status: 'DRIFT_DETECTED',
      suggested_lookback: suggestedLookback,
      meanDelta: Math.round(meanDelta * 1000) / 1000,
      meanFirst: Math.round(meanFirst * 1000) / 1000,
      meanSecond: Math.round(meanSecond * 1000) / 1000,
    }
  }

  return {
    status: 'STABLE',
    suggested_lookback: chronological_goals.length,
    meanDelta: Math.round(meanDelta * 1000) / 1000,
  }
}

// ── Market Convergence (CLV Edge Decay) Check ─────────────────────────────────

interface MarketConvergenceData {
  historical_clv_tracking: number[]
}

function checkMarketConvergence(data: MarketConvergenceData) {
  const { historical_clv_tracking } = data

  if (!historical_clv_tracking || historical_clv_tracking.length === 0) {
    return {
      passed: false,
      meanClvEdge: 0,
      count: 0,
      alert: {
        severity: 'CRITICAL',
        issue: 'No CLV tracking data available',
        details: 'Cannot assess market convergence without historical CLV data.',
      },
    }
  }

  const last30 = historical_clv_tracking.slice(-30)
  const meanClvEdge = last30.reduce((a, b) => a + b, 0) / last30.length

  if (meanClvEdge < CLV_THRESHOLD) {
    return {
      passed: false,
      meanClvEdge: Math.round(meanClvEdge * 10000) / 10000,
      count: last30.length,
      alert: {
        severity: 'WARNING',
        issue: 'EDGE DECAYED',
        details: `Mean CLV edge (${(meanClvEdge * 100).toFixed(2)}%) is below threshold (${(CLV_THRESHOLD * 100).toFixed(2)}%). Model edge is decaying — consider retraining or adjusting feature set.`,
      },
    }
  }

  return {
    passed: true,
    meanClvEdge: Math.round(meanClvEdge * 10000) / 10000,
    count: last30.length,
  }
}

// ── POST Handler ───────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()
    const { action, data } = body

    if (!action || !data) {
      return NextResponse.json(
        { error: 'Missing required fields: action and data' },
        { status: 400 }
      )
    }

    let result: Record<string, unknown>

    switch (action) {
      case 'scraper_fidelity': {
        result = checkScraperFidelity(data as ScraperFidelityData)
        // Fire Discord alert on failure
        if (!result.passed && result.alert) {
          const alert = result.alert as { severity: string; issue: string; details: string }
          await dispatchDiscordAlert(
            `[${alert.severity}] ${alert.issue}\n${alert.details}`
          )
        }
        break
      }

      case 'data_drift': {
        result = checkDataDrift(data as DataDriftData)
        if ((result.status as string) === 'DRIFT_DETECTED') {
          const { meanDelta, meanFirst, meanSecond } = result as {
            meanDelta: number
            meanFirst: number
            meanSecond: number
          }
          await dispatchDiscordAlert(
            `[DRIFT_DETECTED] Goal mean shifted from ${meanFirst} to ${meanSecond} (Δ=${meanDelta}). Suggested lookback: ${result.suggested_lookback}`
          )
        }
        break
      }

      case 'market_convergence': {
        result = checkMarketConvergence(data as MarketConvergenceData)
        if (!result.passed && result.alert) {
          const alert = result.alert as { severity: string; issue: string; details: string }
          await dispatchDiscordAlert(
            `[${alert.severity}] ${alert.issue}\n${alert.details}`
          )
        }
        break
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Use: scraper_fidelity, data_drift, market_convergence` },
          { status: 400 }
        )
    }

    return NextResponse.json({ success: true, action, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Self-audit failed: ${message}` }, { status: 500 })
  }
}