import { NextRequest, NextResponse } from 'next/server'
import { RepositoryMapper } from '@/lib/federation/repository-mapper'
import { GitHubDiscovery } from '@/lib/federation/github-discovery'

const githubToken = process.env.GITHUB_TOKEN
const discovery = new GitHubDiscovery(githubToken!)
const mapper = new RepositoryMapper()

/**
 * GET /api/federation/capabilities
 * Get capability analysis for repositories
 * Query: language=typescript, limit=20
 */
export async function GET(request: NextRequest) {
  try {
    const language = request.nextUrl.searchParams.get('language') || 'typescript'
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20')
    const capabilityType = request.nextUrl.searchParams.get('type')

    console.log(`📊 Analyzing capabilities for ${language} repositories...`)

    // Discover repositories
    const repositories = await discovery.discoverRepositories(language, 50, limit)

    // Analyze capabilities
    const analyzed = repositories.map(repo => {
      const capabilities = mapper.analyzeCapabilities(repo)
      return {
        repo: `${repo.owner}/${repo.repo}`,
        url: repo.url,
        score: repo.score,
        capabilities: capabilities.map(c => ({
          type: c.type,
          score: c.score,
          keywords: c.keywords,
        })),
      }
    })

    // Filter by capability type if specified
    let filtered = analyzed
    if (capabilityType) {
      filtered = analyzed.filter(item =>
        item.capabilities.some(c => c.type === capabilityType)
      )
    }

    // Group by capability
    const grouped = {} as Record<string, any[]>
    for (const item of filtered) {
      for (const cap of item.capabilities) {
        if (!grouped[cap.type]) {
          grouped[cap.type] = []
        }
        grouped[cap.type].push({
          repo: item.repo,
          score: cap.score,
        })
      }
    }

    // Sort by score
    for (const key in grouped) {
      grouped[key].sort((a, b) => b.score - a.score)
    }

    return NextResponse.json({
      success: true,
      language,
      repositoriesAnalyzed: repositories.length,
      capabilityTypes: Object.keys(grouped),
      capabilities: grouped,
      topRepositories: filtered.slice(0, 5),
      timestamp: new Date(),
    })
  } catch (error) {
    console.error('Capability analysis error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
