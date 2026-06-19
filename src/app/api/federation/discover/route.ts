import { NextRequest, NextResponse } from 'next/server'
import { GitHubDiscovery } from '@/lib/federation/github-discovery'
import { RepositoryMapper } from '@/lib/federation/repository-mapper'
import { MultiRepoOrchestrator } from '@/lib/federation/multi-repo-orchestrator'

const githubToken = process.env.GITHUB_TOKEN
const discovery = new GitHubDiscovery(githubToken!)
const mapper = new RepositoryMapper()
const orchestrator = new MultiRepoOrchestrator({
  maxParallelRepos: 20,
  timeout: 30000,
  retryAttempts: 3,
  cacheEnabled: true,
})

/**
 * GET /api/federation/discover
 * Discover repositories by language
 * Query: language=typescript, limit=1000, minStars=50
 */
export async function GET(request: NextRequest) {
  try {
    const language = request.nextUrl.searchParams.get('language') || 'typescript'
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '100')
    const minStars = parseInt(request.nextUrl.searchParams.get('minStars') || '50')

    console.log(`🔍 Discovering ${language} repositories (limit: ${limit}, minStars: ${minStars})...`)

    const repositories = await discovery.discoverRepositories(language, minStars, limit)

    // Analyze capabilities for discovered repositories
    const withCapabilities = repositories.map(repo => ({
      ...repo,
      capabilities: mapper.analyzeCapabilities(repo),
    }))

    return NextResponse.json({
      success: true,
      count: repositories.length,
      language,
      repositories: withCapabilities,
      timestamp: new Date(),
    })
  } catch (error) {
    console.error('Discovery error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/federation/discover
 * Deep analysis of trending repositories
 */
export async function POST(request: NextRequest) {
  try {
    const { language = 'typescript', timeframe = 'month' } = await request.json()

    console.log(`📈 Finding trending ${language} repositories (${timeframe})...`)

    const trending = await discovery.findTrending(
      language,
      timeframe as 'week' | 'month' | 'year'
    )

    const analyzed = trending.map(repo => ({
      ...repo,
      capabilities: mapper.analyzeCapabilities(repo),
    }))

    return NextResponse.json({
      success: true,
      count: trending.length,
      timeframe,
      repositories: analyzed,
      timestamp: new Date(),
    })
  } catch (error) {
    console.error('Trending search error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
