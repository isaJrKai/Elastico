// ELASTICO — BiologicalPlateletAgent (Veronica) Self-Healing System
// Diagnoses broken code via NVIDIA NIM and quarantines patches with syntax verification
// Enhanced with ImmuneSystemOrchestrator antibody patching lifecycle

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/rbac'
import { writeFile, unlink } from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import http from 'http'
import path from 'path'
import crypto from 'crypto'

const execAsync = promisify(exec)

// ── Constants ──────────────────────────────────────────────────────────────────

const NVIDIA_NIM_HOST = 'integrate.api.nvidia.com'
const NVIDIA_NIM_PATH = '/v1/chat/completions'
const VERONICA_MODEL = 'meta/llama-3.1-405b-instruct'

// ── NVIDIA NIM Call via raw http module ────────────────────────────────────────

function callNvidiaNim(systemPrompt: string, userPrompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.NVIDIA_API_KEY
    if (!apiKey || apiKey === 'nvapi-PLACEHOLDER_USER_MUST_REPLACE') {
      return reject(new Error('NVIDIA_API_KEY not configured'))
    }

    const payload = JSON.stringify({
      model: VERONICA_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 4096,
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

// ── Clean Markdown Wrapping ────────────────────────────────────────────────────

function cleanMarkdownWrapping(code: string): string {
  let cleaned = code.trim()

  // Remove ```language and ``` wrapping
  const fencedBlockRegex = /^```(?:typescript|javascript|python|js|ts|py)?\s*\n([\s\S]*?)\n```\s*$/
  const match = cleaned.match(fencedBlockRegex)
  if (match) {
    cleaned = match[1].trim()
  }

  return cleaned
}

// ── Diagnose Action ────────────────────────────────────────────────────────────

async function handleDiagnose(brokenCode: string, errorTraceback: string, filename: string) {
  const systemPrompt = `You are Veronica, ELASTICO's Biological Platelet Agent — a self-healing code repair system. 
When given broken code and an error traceback, you MUST return ONLY the complete fixed code with no explanation, no markdown formatting, and no comments about what you changed. 
Return the entire file content ready to be written to disk.`

  const userPrompt = `Fix the following broken code. Return ONLY the complete corrected file content.

File: ${filename}

--- ERROR TRACEBACK ---
${errorTraceback}

--- BROKEN CODE ---
${brokenCode}

--- FIXED CODE ---`

  const fixCode = await callNvidiaNim(systemPrompt, userPrompt)
  return cleanMarkdownWrapping(fixCode)
}

// ── Quarantine Test Action ─────────────────────────────────────────────────────

async function handleQuarantineTest(patchCode: string, filename: string): Promise<{ passed: boolean; error?: string }> {
  // Determine language from file extension
  const ext = path.extname(filename).toLowerCase()
  let checkCommand: string

  if (ext === '.ts' || ext === '.js') {
    checkCommand = 'node --check'
  } else if (ext === '.py') {
    checkCommand = 'python -m py_compile'
  } else {
    return {
      passed: false,
      error: `Unsupported file extension: ${ext}. Only .ts, .js, .py are supported.`,
    }
  }

  // Write to temp sandbox file
  const sandboxDir = '/tmp/elastico-veronica-sandbox'
  const sandboxFilename = `${crypto.randomBytes(8).toString('hex')}${ext}`
  const sandboxPath = path.join(sandboxDir, sandboxFilename)

  try {
    await writeFile(sandboxPath, patchCode, 'utf-8')

    // Run syntax check
    const { stderr } = await execAsync(`${checkCommand} "${sandboxPath}"`)

    if (stderr) {
      return {
        passed: false,
        error: stderr.trim(),
      }
    }

    return { passed: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    // py_compile writes to stderr but throws too; node --check writes to stderr
    return {
      passed: false,
      error: message,
    }
  } finally {
    // Cleanup sandbox file
    try {
      await unlink(sandboxPath)
    } catch {
      // Ignore cleanup failures
    }
  }
}

// ── POST Handler ───────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()
    const { action, brokenCode, errorTraceback, filename, patchCode } = body

    if (!action) {
      return NextResponse.json({ error: 'Missing required field: action' }, { status: 400 })
    }

    switch (action) {
      case 'diagnose': {
        if (!brokenCode || !filename) {
          return NextResponse.json(
            { error: 'diagnose requires: brokenCode, filename' },
            { status: 400 }
          )
        }

        const fixCode = await handleDiagnose(
          brokenCode,
          errorTraceback || 'No traceback provided',
          filename
        )

        return NextResponse.json({
          success: true,
          action: 'diagnose',
          filename,
          model: VERONICA_MODEL,
          fixCode,
        })
      }

      case 'quarantine_test': {
        if (!patchCode || !filename) {
          return NextResponse.json(
            { error: 'quarantine_test requires: patchCode, filename' },
            { status: 400 }
          )
        }

        const result = await handleQuarantineTest(patchCode, filename)

        return NextResponse.json({
          success: true,
          action: 'quarantine_test',
          filename,
          ...result,
        })
      }

      // ── ImmuneSystemOrchestrator: Antibody Patching Lifecycle ──────────────
      case 'antibody_patch': {
        if (!brokenCode || !filename) {
          return NextResponse.json(
            { error: 'antibody_patch requires: brokenCode, filename' },
            { status: 400 }
          )
        }

        // Step 1: Synthesize antibody (call NVIDIA to generate fix)
        const synthesizedPatch = await handleDiagnose(brokenCode, errorTraceback || 'No traceback', filename)

        // Step 2: Quarantine & test the patch
        const testResult = await handleQuarantineTest(synthesizedPatch, filename)

        if (testResult.passed) {
          // Step 3: Hot-swap — write healed code to disk
          // SECURITY: Only allow writing to files within the project directory
          const projectRoot = process.cwd()
          const targetPath = path.resolve(projectRoot, filename)
          if (!targetPath.startsWith(projectRoot)) {
            return NextResponse.json({ error: 'Path traversal blocked' }, { status: 403 })
          }
          await writeFile(targetPath, synthesizedPatch, 'utf-8')

          return NextResponse.json({
            success: true,
            action: 'antibody_patch',
            filename,
            healed: true,
            patchCode: synthesizedPatch,
            testResult: { passed: true },
          })
        } else {
          return NextResponse.json({
            success: true,
            action: 'antibody_patch',
            filename,
            healed: false,
            patchCode: synthesizedPatch,
            testResult,
          })
        }
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Use: diagnose, quarantine_test, antibody_patch` },
          { status: 400 }
        )
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Veronica heal failed: ${message}` }, { status: 500 })
  }
}