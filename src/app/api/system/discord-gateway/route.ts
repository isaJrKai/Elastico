// ELASTICO — Discord Command Gateway
// Receives commands and routes to internal ELASTICO endpoints.
// Replaces Telegram gateway — Discord webhooks are free, no per-message charges.

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/rbac'

// ── Discord Webhook Dispatch ─────────────────────────────────────────────────

async function sendDiscordMessage(webhookUrl: string, message: string): Promise<void> {
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: message,
      username: 'ELASTICO Bot',
    }),
  })
}

// ── Internal Endpoint Caller ─────────────────────────────────────────────────

async function callInternalEndpoint(path: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const url = new URL(path, baseUrl)

  const res = await fetch(url.toString(), {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) throw new Error(`Endpoint returned ${res.status}`)
  return res.json() as Promise<Record<string, unknown>>
}

// ── Command Handlers ─────────────────────────────────────────────────────────

async function handleStatus(): Promise<string> {
  const parts: string[] = ['**ELASTICO System Status**\n']

  try {
    await callInternalEndpoint('/api/system/self-audit', { action: 'scraper_fidelity', data: { df: [] } })
    parts.push('Self-Audit: reachable')
  } catch (err) {
    parts.push(`Self-Audit: ${err instanceof Error ? err.message : 'down'}`)
  }

  try {
    await callInternalEndpoint('/api/system/saim-security', { action: 'audit' })
    parts.push('SAIM Security: reachable')
  } catch (err) {
    parts.push(`SAIM Security: ${err instanceof Error ? err.message : 'down'}`)
  }

  try {
    await callInternalEndpoint('/api/system/veronica-heal', {
      action: 'diagnose', brokenCode: 'function test() { return 1 }', filename: 'health.ts',
    })
    parts.push('Veronica Heal: reachable')
  } catch (err) {
    parts.push(`Veronica Heal: ${err instanceof Error ? err.message : 'down'}`)
  }

  parts.push(`\n${new Date().toISOString()}`)
  return parts.join('\n')
}

async function handleAudit(): Promise<string> {
  try {
    const result = await callInternalEndpoint('/api/system/self-audit', {
      action: 'scraper_fidelity', data: { df: [] },
    })
    return `**Audit Result**\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``
  } catch (err) {
    return `Audit failed: ${err instanceof Error ? err.message : 'Unknown'}`
  }
}

async function handleIntegrity(): Promise<string> {
  try {
    const result = await callInternalEndpoint('/api/system/saim-security', { action: 'audit' })
    return `**SAIM Integrity**\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``
  } catch (err) {
    return `Integrity failed: ${err instanceof Error ? err.message : 'Unknown'}`
  }
}

async function handleHeal(): Promise<string> {
  try {
    const result = await callInternalEndpoint('/api/system/veronica-heal', {
      action: 'quarantine_test', patchCode: 'function ok() { return true }', filename: 'health.ts',
    })
    return `**Veronica Scan**\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``
  } catch (err) {
    return `Veronica scan failed: ${err instanceof Error ? err.message : 'Unknown'}`
  }
}

function handleHelp(): string {
  return [
    '**ELASTICO Discord Commands**', '',
    '`status` — System health',
    '`audit` — Run self-audit',
    '`integrity` — SAIM file integrity',
    '`heal` — Veronica diagnostic',
    '`help` — This message',
  ].join('\n')
}

// ── Command Router ────────────────────────────────────────────────────────────

async function routeCommand(text: string): Promise<string> {
  const cmd = text.trim().toLowerCase()
  if (cmd === 'status') return handleStatus()
  if (cmd === 'audit') return handleAudit()
  if (cmd === 'integrity') return handleIntegrity()
  if (cmd === 'heal') return handleHeal()
  if (cmd === 'help') return handleHelp()
  return `Unknown: \`${text.trim()}\`. Type \`help\`.`
}

// ── GET: Health check ─────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    status: 'active',
    gateway: 'discord',
    commands: ['status', 'audit', 'integrity', 'heal', 'help'],
  })
}

// ── POST: Receive command ─────────────────────────────────────────────────────

export async function POST(request: Request) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()
    const commandText = body?.content || body?.data?.name || ''

    if (!commandText) {
      return NextResponse.json({ error: 'No command. Send: help' }, { status: 400 })
    }

    const responseText = await routeCommand(commandText)

    const replyUrl = body?.webhook_url || body?.response_url
    if (replyUrl && typeof replyUrl === 'string') {
      await sendDiscordMessage(replyUrl, responseText)
      return NextResponse.json({ success: true, command: commandText, replied: true })
    }

    return NextResponse.json({ success: true, command: commandText, response: responseText })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Discord Gateway] Error: ${message}`)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}