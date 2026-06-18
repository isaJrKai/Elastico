// ELASTICO — Secure Adversarial Isolation Matrix (SAIM) API
// File integrity auditing via SHA-256 hashing and Discord alerting

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/rbac'
import { readdir, readFile } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

// ── Discord Alert Dispatch ────────────────────────────────────────────────────

async function dispatchDiscordAlert(message: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) return

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `🛡️ **SAIM Security Alert**\n${message}`,
        username: 'ELASTICO SAIM',
      }),
    })
  } catch {
    // Silently fail — security alerts are non-blocking
  }
}

// ── File Discovery ─────────────────────────────────────────────────────────────

const CRITICAL_DIRECTORIES = [
  'src/app/api',
  'src/lib',
]

interface FileEntry {
  path: string
  hash: string
}

async function discoverCriticalFiles(): Promise<string[]> {
  const projectRoot = process.cwd()
  const files: string[] = []

  for (const dir of CRITICAL_DIRECTORIES) {
    const fullPath = path.join(projectRoot, dir)
    try {
      await collectFilesRecursive(fullPath, files, projectRoot)
    } catch {
      // Directory may not exist — skip
    }
  }

  return files
}

async function collectFilesRecursive(dirPath: string, files: string[], rootPath: string): Promise<void> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      await collectFilesRecursive(fullPath, files, rootPath)
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
      files.push(path.relative(rootPath, fullPath))
    }
  }
}

// ── Hash Calculation ───────────────────────────────────────────────────────────

async function calculateFileHash(absolutePath: string): Promise<string> {
  const content = await readFile(absolutePath, 'utf-8')
  return crypto.createHash('sha256').update(content).digest('hex')
}

async function hashAllFiles(): Promise<FileEntry[]> {
  const projectRoot = process.cwd()
  const filePaths = await discoverCriticalFiles()
  const results: FileEntry[] = []

  for (const relPath of filePaths) {
    try {
      const absPath = path.join(projectRoot, relPath)
      const hash = await calculateFileHash(absPath)
      results.push({ path: relPath, hash })
    } catch {
      // Skip files that can't be read
    }
  }

  return results
}

// ── Audit Action ───────────────────────────────────────────────────────────────

async function handleAudit() {
  const files = await hashAllFiles()
  return {
    files,
    timestamp: new Date().toISOString(),
    fileCount: files.length,
  }
}

// ── Verify Action ──────────────────────────────────────────────────────────────

interface ExpectedHash {
  path: string
  hash: string
}

interface Violation {
  path: string
  expected: string
  actual: string
}

async function handleVerify(expectedHashes: ExpectedHash[]) {
  const projectRoot = process.cwd()
  const violations: Violation[] = []
  const violationsSummary: string[] = []

  for (const entry of expectedHashes) {
    try {
      const absPath = path.join(projectRoot, entry.path)
      const actualHash = await calculateFileHash(absPath)

      if (actualHash !== entry.hash) {
        violations.push({
          path: entry.path,
          expected: entry.hash,
          actual: actualHash,
        })
        violationsSummary.push(`⚠️ ${entry.path}: hash mismatch`)
      }
    } catch {
      // File no longer exists or can't be read — treat as violation
      violations.push({
        path: entry.path,
        expected: entry.hash,
        actual: 'FILE_MISSING_OR_UNREADABLE',
      })
      violationsSummary.push(`🚫 ${entry.path}: file missing or unreadable`)
    }
  }

  const integrity = violations.length === 0

  // Dispatch Discord alert on integrity failure
  if (!integrity) {
    const alertMsg = violationsSummary.join('\n')
    await dispatchDiscordAlert(
      `**INTEGRITY VIOLATION DETECTED**\n${violations.length} file(s) modified:\n\n${alertMsg}`
    )
  }

  return {
    integrity,
    violations,
    checkedCount: expectedHashes.length,
    timestamp: new Date().toISOString(),
  }
}

// ── POST Handler ───────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()
    const { action, expectedHashes } = body

    if (!action) {
      return NextResponse.json({ error: 'Missing required field: action' }, { status: 400 })
    }

    switch (action) {
      case 'audit': {
        const result = await handleAudit()
        return NextResponse.json({ success: true, action: 'audit', ...result })
      }

      case 'verify': {
        if (!expectedHashes || !Array.isArray(expectedHashes) || expectedHashes.length === 0) {
          return NextResponse.json(
            { error: 'verify requires: expectedHashes (array of {path, hash})' },
            { status: 400 }
          )
        }

        const result = await handleVerify(expectedHashes)
        return NextResponse.json({ success: true, action: 'verify', ...result })
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Use: audit, verify` },
          { status: 400 }
        )
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `SAIM security check failed: ${message}` }, { status: 500 })
  }
}