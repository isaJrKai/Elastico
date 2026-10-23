import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const guardScript = path.resolve(process.cwd(), 'scripts/guard-db-target.mjs')

function runGuard(mode: 'local' | 'deploy', overrides: Record<string, string | undefined>) {
  const env: NodeJS.ProcessEnv = { ...process.env, ...overrides }
  if (!('ELASTICO_ALLOW_REMOTE_DB_MUTATIONS' in overrides)) delete env.ELASTICO_ALLOW_REMOTE_DB_MUTATIONS
  if (!('ELASTICO_ALLOW_PRODUCTION_DB_MUTATIONS' in overrides)) delete env.ELASTICO_ALLOW_PRODUCTION_DB_MUTATIONS
  return spawnSync(process.execPath, [guardScript, mode], {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
  })
}

describe('database mutation target guard', () => {
  it('allows local-only mutations against localhost', () => {
    const result = runGuard('local', {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/elastico',
      NODE_ENV: 'development',
    })
    assert.equal(result.status, 0, result.stderr)
  })

  it('blocks local-only mutations against remote databases even when remote opt-in is set', () => {
    const result = runGuard('local', {
      DATABASE_URL: 'postgresql://test:test@db.example.invalid/elastico',
      NODE_ENV: 'development',
      ELASTICO_ALLOW_REMOTE_DB_MUTATIONS: 'true',
    })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /local-only database command/)
  })

  it('allows a production-mode migration against the local test database', () => {
    const result = runGuard('deploy', {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/elastico',
      NODE_ENV: 'production',
    })
    assert.equal(result.status, 0, result.stderr)
  })

  it('requires explicit opt-in for remote deployment migrations', () => {
    const result = runGuard('deploy', {
      DATABASE_URL: 'postgresql://test:test@db.example.invalid/elastico',
      NODE_ENV: 'development',
    })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /ELASTICO_ALLOW_REMOTE_DB_MUTATIONS=true/)
  })

  it('allows remote deployment migrations only with explicit opt-in', () => {
    const result = runGuard('deploy', {
      DATABASE_URL: 'postgresql://test:test@db.example.invalid/elastico',
      NODE_ENV: 'development',
      ELASTICO_ALLOW_REMOTE_DB_MUTATIONS: 'true',
    })
    assert.equal(result.status, 0, result.stderr)
  })

  it('requires a second explicit opt-in for production database mutations', () => {
    const remoteUrl = 'postgresql://test:test@db.example.invalid/elastico'
    const result = runGuard('deploy', {
      DATABASE_URL: remoteUrl,
      NODE_ENV: 'production',
      ELASTICO_ALLOW_REMOTE_DB_MUTATIONS: 'true',
    })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /ELASTICO_ALLOW_PRODUCTION_DB_MUTATIONS=true/)
  })


  it('loads a local DATABASE_URL from .env before guarding the target', () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'elastico-db-guard-'))
    try {
      writeFileSync(
        path.join(tempDir, '.env'),
        'DATABASE_URL=postgresql://test:test@localhost:5432/elastico\\n',
        'utf8',
      )
      const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'development' }
      delete env.DATABASE_URL
      delete env.ELASTICO_ALLOW_REMOTE_DB_MUTATIONS
      delete env.ELASTICO_ALLOW_PRODUCTION_DB_MUTATIONS
      const result = spawnSync(process.execPath, [guardScript, 'local'], {
        cwd: tempDir,
        env,
        encoding: 'utf8',
      })
      assert.equal(result.status, 0, result.stderr)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('blocks missing or malformed database URLs', () => {
    assert.notEqual(runGuard('local', { DATABASE_URL: '', NODE_ENV: 'development' }).status, 0)
    assert.notEqual(runGuard('local', { DATABASE_URL: 'not-a-url', NODE_ENV: 'development' }).status, 0)
  })
})
