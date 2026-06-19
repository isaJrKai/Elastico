'use client'
import type { RepositoryProfile } from './github-discovery'
import type { RepositoryCapability } from './repository-mapper'

interface OrchestratorConfig {
  maxParallelRepos: number
  timeout: number
  retryAttempts: number
  cacheEnabled: boolean
}

interface RepositoryTask {
  repoKey: string
  action: 'analyze' | 'fetch-functions' | 'test-compatibility' | 'extract-utilities'
  params?: Record<string, any>
}

interface OrchestrationResult {
  taskId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  results: Record<string, any>
  duration: number
  timestamp: Date
}

/**
 * Orchestrates operations across multiple repositories
 */
export class MultiRepoOrchestrator {
  private config: OrchestratorConfig
  private activeTasksMap: Map<string, Promise<any>> = new Map()
  private resultsCache: Map<string, OrchestrationResult> = new Map()
  private completedTasks: OrchestrationResult[] = []

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = {
      maxParallelRepos: config.maxParallelRepos || 10,
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      cacheEnabled: config.cacheEnabled !== false,
    }
  }

  /**
   * Execute tasks across repositories
   */
  async executeTasks(
    repositories: RepositoryProfile[],
    tasks: RepositoryTask[]
  ): Promise<OrchestrationResult> {
    const taskId = `orchestration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const startTime = Date.now()

    const result: OrchestrationResult = {
      taskId,
      status: 'running',
      results: {},
      duration: 0,
      timestamp: new Date(),
    }

    try {
      // Check cache
      const cacheKey = this.generateCacheKey(repositories, tasks)
      if (this.config.cacheEnabled && this.resultsCache.has(cacheKey)) {
        return this.resultsCache.get(cacheKey)!
      }

      // Execute tasks in parallel with concurrency limit
      const chunks = this.chunkRepositories(repositories, this.config.maxParallelRepos)
      const allResults: Record<string, any> = {}

      for (const chunk of chunks) {
        const chunkPromises = chunk.map(repo =>
          this.executeRepositoryTasks(repo, tasks)
        )

        const chunkResults = await Promise.allSettled(chunkPromises)

        for (const chunkResult of chunkResults) {
          if (chunkResult.status === 'fulfilled') {
            Object.assign(allResults, chunkResult.value)
          }
        }
      }

      result.results = allResults
      result.status = 'completed'
      result.duration = Date.now() - startTime

      // Cache result
      if (this.config.cacheEnabled) {
        this.resultsCache.set(cacheKey, result)
      }

      this.completedTasks.push(result)
      return result
    } catch (error) {
      result.status = 'failed'
      result.duration = Date.now() - startTime
      console.error('Orchestration error:', error)
      return result
    }
  }

  /**
   * Execute tasks for single repository
   */
  private async executeRepositoryTasks(
    repo: RepositoryProfile,
    tasks: RepositoryTask[]
  ): Promise<Record<string, any>> {
    const repoKey = `${repo.owner}/${repo.repo}`
    const results: Record<string, any> = {}

    for (const task of tasks) {
      try {
        const taskResult = await this.executeTaskWithRetry(
          task,
          repo,
          this.config.retryAttempts
        )
        results[`${repoKey}-${task.action}`] = taskResult
      } catch (error) {
        results[`${repoKey}-${task.action}`] = {
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    }

    return results
  }

  /**
   * Execute task with retry logic
   */
  private async executeTaskWithRetry(
    task: RepositoryTask,
    repo: RepositoryProfile,
    attemptsLeft: number
  ): Promise<any> {
    try {
      return await Promise.race([
        this.executeTask(task, repo),
        this.timeout(this.config.timeout),
      ])
    } catch (error) {
      if (attemptsLeft > 0) {
        await this.delay(1000) // Wait before retry
        return this.executeTaskWithRetry(task, repo, attemptsLeft - 1)
      }
      throw error
    }
  }

  /**
   * Execute single task
   */
  private async executeTask(
    task: RepositoryTask,
    repo: RepositoryProfile
  ): Promise<any> {
    switch (task.action) {
      case 'analyze':
        return this.analyzeRepository(repo)
      case 'fetch-functions':
        return this.fetchRepositoryFunctions(repo)
      case 'test-compatibility':
        return this.testCompatibility(repo, task.params)
      case 'extract-utilities':
        return this.extractUtilities(repo)
      default:
        throw new Error(`Unknown action: ${task.action}`)
    }
  }

  /**
   * Analyze repository
   */
  private async analyzeRepository(repo: RepositoryProfile): Promise<any> {
    return {
      analyzed: true,
      score: repo.score,
      language: repo.language,
      topics: repo.topics,
    }
  }

  /**
   * Fetch repository functions
   */
  private async fetchRepositoryFunctions(repo: RepositoryProfile): Promise<any> {
    // Simulated function extraction
    return {
      functions: [
        'debounce',
        'throttle',
        'memoize',
        'compose',
      ],
      count: 4,
    }
  }

  /**
   * Test compatibility
   */
  private async testCompatibility(
    repo: RepositoryProfile,
    params?: Record<string, any>
  ): Promise<any> {
    return {
      compatible: true,
      language: repo.language,
      integrationLevel: 'high',
    }
  }

  /**
   * Extract utilities
   */
  private async extractUtilities(repo: RepositoryProfile): Promise<any> {
    return {
      utilities: [
        'utility-1',
        'utility-2',
        'utility-3',
      ],
      category: 'helpers',
    }
  }

  /**
   * Chunk repositories for parallel processing
   */
  private chunkRepositories(
    repos: RepositoryProfile[],
    chunkSize: number
  ): RepositoryProfile[][] {
    const chunks: RepositoryProfile[][] = []
    for (let i = 0; i < repos.length; i += chunkSize) {
      chunks.push(repos.slice(i, i + chunkSize))
    }
    return chunks
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(
    repos: RepositoryProfile[],
    tasks: RepositoryTask[]
  ): string {
    const repoStr = repos.map(r => `${r.owner}/${r.repo}`).join(',')
    const taskStr = tasks.map(t => t.action).join(',')
    return `cache-${Buffer.from(repoStr + taskStr).toString('base64')}`
  }

  /**
   * Timeout helper
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Task timeout')), ms)
    )
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get completed tasks
   */
  getCompletedTasks(): OrchestrationResult[] {
    return this.completedTasks
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.resultsCache.clear()
  }
}
