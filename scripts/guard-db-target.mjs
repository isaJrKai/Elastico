#!/usr/bin/env node

const mode = process.argv[2] ?? 'local'
const rawUrl = process.env.DATABASE_URL

function refuse(message) {
  console.error(`Database safety guard: ${message}`)
  process.exit(1)
}

if (!rawUrl) refuse('DATABASE_URL is required')

let databaseHost
try {
  databaseHost = new URL(rawUrl).hostname.toLowerCase()
} catch {
  refuse('DATABASE_URL is not a valid URL')
}

const localHosts = new Set(['localhost', '127.0.0.1', '::1', 'postgres', 'db'])
const isLocal = localHosts.has(databaseHost)

if (mode === 'local') {
  if (!isLocal) {
    refuse(`refusing a local-only database command against remote host "${databaseHost}". Use a reviewed migration workflow for remote databases.`)
  }
  console.log(`Database safety guard: local target "${databaseHost}" accepted.`)
  process.exit(0)
}

if (mode === 'deploy') {
  if (!isLocal && process.env.ELASTICO_ALLOW_REMOTE_DB_MUTATIONS !== 'true') {
    refuse('remote migrations require ELASTICO_ALLOW_REMOTE_DB_MUTATIONS=true')
  }
  if (process.env.NODE_ENV === 'production' && process.env.ELASTICO_ALLOW_PRODUCTION_DB_MUTATIONS !== 'true') {
    refuse('production database mutations require ELASTICO_ALLOW_PRODUCTION_DB_MUTATIONS=true')
  }
  console.log(`Database safety guard: ${isLocal ? 'local' : 'remote'} migration target accepted.`)
  process.exit(0)
}

refuse(`unknown guard mode "${mode}"`)
