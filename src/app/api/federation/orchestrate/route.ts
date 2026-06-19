import { NextRequest, NextResponse } from 'next/server'
import { MultiRepoOrchestrator } from '@/lib/federation/multi-repo-orchestrator'
import { GitHubDiscovery } from '@/lib/federation/github-discovery'
import { RepositoryMapper } from '@/lib/federation/repository-mapper'

const githubToken = process.env.GITHUB_TOKEN
const discovery = new GitHubDiscovery(githubToken!)
const mapper = new RepositoryMapper()
const orchestrator = new MultiRepoOrchestrator({
  maxParallelRepos: 20,
  timeout: 30000,
  retryAttempts: 2,
  cacheEnabled: true,
})

/**
 * POST /api/federation/orchestrate
 * Execute parallel tasks across multiple repositories
 * Body: {
 *   language: 'typescript',
 *   limit: 100,
 *   tasks: ['analyze', 'fetch-functions', 'test-compatibility']
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { language = 'typescript', limit = 50, tasks = ['analyze'] } = await request.json()

    console.log(
      `🎼 Orchestrating ${limit} repositories with tasks: ${tasks.join(', ')}...`
    )

    // Step 1: Discover repositories
    const repositories = await discovery.discoverRepositories(language, 50, limit)

    // Step 2: Prepare tasks
    const taskList = tasks.map((action: string) => ({
      repoKey: '',
      action: action as 'analyze' | 'fetch-functions' | 'test-compatibility' | 'extract-utilities',
    }))

    // Step 3: Execute orchestration
    const startTime = Date.now()
    const result = await orchestrator.executeTasks(repositories, taskList)
    const duration = Date.now() - startTime

    // Step 4: Analyze capabilities
    const withCapabilities = repositories.map(repo => ({
      ...repo,
      capabilities: mapper.analyzeCapabilities(repo),
    }))

    return NextResponse.json({
      success: true,
      orchestration: {
        taskId: result.taskId,
        status: result.status,
        repositoriesProcessed: limit,
        tasksExecuted: tasks.length,
        duration: `${duration}ms`,
      },
      repositories: withCapabilities.slice(0, 10), // Return top 10
      stats: {
        totalRepositories: repositories.length,
        topLanguage: language,
        averageScore: (repositories.reduce((sum, r) => sum + r.score, 0) / repositories.length).toFixed(2),
      },
      timestamp: new Date(),
    })
  } catch (error) {
    console.error('Orchestration error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
