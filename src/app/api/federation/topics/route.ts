import { NextRequest, NextResponse } from 'next/server'
import { GitHubDiscovery } from '@/lib/federation/github-discovery'
import { RepositoryMapper } from '@/lib/federation/repository-mapper'

const githubToken = process.env.GITHUB_TOKEN
const discovery = new GitHubDiscovery(githubToken!)
const mapper = new RepositoryMapper()

/**
 * GET /api/federation/topics
 * Find repositories by topic
 * Query: topic=animation, limit=50
 */
export async function GET(request: NextRequest) {
  try {
    const topic = request.nextUrl.searchParams.get('topic')
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50')

    if (!topic) {
      return NextResponse.json(
        { success: false, error: 'Topic parameter required' },
        { status: 400 }
      )
    }

    console.log(`🏷️ Finding repositories for topic: ${topic}...`)

    const repositories = await discovery.findByTopic(topic, limit)

    const categorized = repositories.map(repo => ({
      ...repo,
      capabilities: mapper.analyzeCapabilities(repo),
      capabilities_summary: mapper
        .analyzeCapabilities(repo)
        .map(c => ({ type: c.type, score: c.score })),
    }))

    return NextResponse.json({
      success: true,
      topic,
      count: repositories.length,
      repositories: categorized,
      timestamp: new Date(),
    })
  } catch (error) {
    console.error('Topic search error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
