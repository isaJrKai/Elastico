'use client'
import { Octokit } from '@octokit/rest'

interface RepositoryProfile {
  owner: string
  repo: string
  url: string
  stars: number
  language: string
  description: string
  topics: string[]
  score: number // relevance score 0-100
}

interface FunctionSignature {
  name: string
  params: string[]
  returnType: string
  description?: string
  tags: string[]
}

/**
 * GitHub Repository Discovery Engine
 * Finds and analyzes 20K+ repositories for integration
 */
export class GitHubDiscovery {
  private octokit: Octokit
  private cache: Map<string, RepositoryProfile[]> = new Map()

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token })
  }

  /**
   * Discover repositories matching criteria
   * Targets: TypeScript, Next.js, React, Node.js projects
   */
  async discoverRepositories(
    language: string = 'typescript',
    minStars: number = 50,
    limit: number = 20000
  ): Promise<RepositoryProfile[]> {
    const cacheKey = `${language}-${minStars}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const query = `language:${language} stars:>=${minStars} sort:stars-desc`
    const repositories: RepositoryProfile[] = []

    try {
      // Paginated search
      for (let page = 1; page <= Math.ceil(limit / 100); page++) {
        const { data } = await this.octokit.search.repos({
          q: query,
          sort: 'stars',
          order: 'desc',
          per_page: 100,
          page,
        })

        for (const repo of data.items.slice(0, limit - repositories.length)) {
          const profile = await this.analyzeRepository(repo.owner.login, repo.name)
          repositories.push(profile)

          if (repositories.length >= limit) break
        }

        if (repositories.length >= limit) break
      }

      this.cache.set(cacheKey, repositories)
      return repositories
    } catch (error) {
      console.error('GitHub discovery error:', error)
      return []
    }
  }

  /**
   * Analyze individual repository
   */
  private async analyzeRepository(
    owner: string,
    repo: string
  ): Promise<RepositoryProfile> {
    try {
      const { data } = await this.octokit.repos.get({ owner, repo })

      const score = this.calculateRelevanceScore({
        stars: data.stargazers_count,
        forks: data.forks_count,
        language: data.language,
        hasTests: data.topics?.includes('testing') ?? false,
        isActive: new Date(data.updated_at).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000,
      })

      return {
        owner,
        repo,
        url: data.html_url,
        stars: data.stargazers_count,
        language: data.language || 'unknown',
        description: data.description || '',
        topics: data.topics || [],
        score,
      }
    } catch (error) {
      console.error(`Failed to analyze ${owner}/${repo}:`, error)
      return {
        owner,
        repo,
        url: `https://github.com/${owner}/${repo}`,
        stars: 0,
        language: 'unknown',
        description: '',
        topics: [],
        score: 0,
      }
    }
  }

  /**
   * Calculate relevance score (0-100)
   */
  private calculateRelevanceScore(metrics: {
    stars: number
    forks: number
    language: string
    hasTests: boolean
    isActive: boolean
  }): number {
    let score = 0

    // Stars: up to 40 points
    score += Math.min(40, (metrics.stars / 1000) * 40)

    // Forks: up to 20 points
    score += Math.min(20, (metrics.forks / 500) * 20)

    // Active: 15 points
    if (metrics.isActive) score += 15

    // Has tests: 15 points
    if (metrics.hasTests) score += 15

    // Language bonus
    if (['TypeScript', 'JavaScript'].includes(metrics.language)) score += 10

    return Math.min(100, score)
  }

  /**
   * Find repositories by topic/category
   */
  async findByTopic(topic: string, limit: number = 100): Promise<RepositoryProfile[]> {
    const query = `topic:${topic} stars:>50`
    const repositories: RepositoryProfile[] = []

    try {
      const { data } = await this.octokit.search.repos({
        q: query,
        sort: 'stars',
        order: 'desc',
        per_page: limit,
      })

      for (const repo of data.items.slice(0, limit)) {
        const profile = await this.analyzeRepository(repo.owner.login, repo.name)
        repositories.push(profile)
      }

      return repositories
    } catch (error) {
      console.error('Topic search error:', error)
      return []
    }
  }

  /**
   * Find trending repositories
   */
  async findTrending(language: string = 'typescript', timeframe: 'week' | 'month' | 'year' = 'month'): Promise<RepositoryProfile[]> {
    const daysAgo = timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : 365
    const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const query = `language:${language} created:>=${date} sort:stars-desc`
    const repositories: RepositoryProfile[] = []

    try {
      const { data } = await this.octokit.search.repos({
        q: query,
        per_page: 30,
      })

      for (const repo of data.items) {
        const profile = await this.analyzeRepository(repo.owner.login, repo.name)
        repositories.push(profile)
      }

      return repositories
    } catch (error) {
      console.error('Trending search error:', error)
      return []
    }
  }
}

/**
 * Function Registry for discovered repositories
 */
export class FunctionRegistry {
  private registry: Map<string, FunctionSignature[]> = new Map()
  private repositories: RepositoryProfile[] = []

  constructor() {
    this.initializeCommonFunctions()
  }

  /**
   * Initialize with common function patterns from popular repos
   */
  private initializeCommonFunctions(): void {
    // Animation utilities
    this.registerFunctionFamily('animations', [
      {
        name: 'easeInOutCubic',
        params: ['t: number', 'duration: number'],
        returnType: 'number',
        description: 'Easing function for smooth animations',
        tags: ['animation', 'easing'],
      },
      {
        name: 'interpolate',
        params: ['start: number', 'end: number', 'progress: number'],
        returnType: 'number',
        description: 'Interpolate between two values',
        tags: ['animation', 'math'],
      },
    ])

    // Data processing
    this.registerFunctionFamily('data', [
      {
        name: 'debounce',
        params: ['fn: Function', 'wait: number'],
        returnType: 'Function',
        description: 'Debounce function calls',
        tags: ['utility', 'performance'],
      },
      {
        name: 'memoize',
        params: ['fn: Function', 'options?: object'],
        returnType: 'Function',
        description: 'Memoize function results',
        tags: ['caching', 'performance'],
      },
      {
        name: 'groupBy',
        params: ['array: any[]', 'key: string'],
        returnType: 'object',
        description: 'Group array items by key',
        tags: ['data', 'array'],
      },
    ])

    // Validation
    this.registerFunctionFamily('validation', [
      {
        name: 'validateEmail',
        params: ['email: string'],
        returnType: 'boolean',
        description: 'Validate email format',
        tags: ['validation', 'email'],
      },
      {
        name: 'validateURL',
        params: ['url: string'],
        returnType: 'boolean',
        description: 'Validate URL format',
        tags: ['validation', 'url'],
      },
    ])

    // React/Hooks
    this.registerFunctionFamily('hooks', [
      {
        name: 'useLocalStorage',
        params: ['key: string', 'initialValue: any'],
        returnType: '[any, Function]',
        description: 'React hook for local storage',
        tags: ['react', 'storage'],
      },
      {
        name: 'useFetch',
        params: ['url: string', 'options?: object'],
        returnType: '{data, loading, error}',
        description: 'React hook for fetching data',
        tags: ['react', 'async'],
      },
    ])

    // API utilities
    this.registerFunctionFamily('api', [
      {
        name: 'retryFetch',
        params: ['url: string', 'options?: object', 'retries?: number'],
        returnType: 'Promise<Response>',
        description: 'Fetch with retry logic',
        tags: ['api', 'async'],
      },
      {
        name: 'cacheRequest',
        params: ['url: string', 'ttl?: number'],
        returnType: 'Promise<any>',
        description: 'Cached API requests',
        tags: ['api', 'caching'],
      },
    ])

    // String utilities
    this.registerFunctionFamily('string', [
      {
        name: 'slugify',
        params: ['text: string'],
        returnType: 'string',
        description: 'Convert text to URL-friendly slug',
        tags: ['string', 'url'],
      },
      {
        name: 'camelCase',
        params: ['str: string'],
        returnType: 'string',
        description: 'Convert to camelCase',
        tags: ['string', 'formatting'],
      },
    ])

    // Date utilities
    this.registerFunctionFamily('date', [
      {
        name: 'formatDate',
        params: ['date: Date', 'format: string'],
        returnType: 'string',
        description: 'Format date with custom format',
        tags: ['date', 'formatting'],
      },
      {
        name: 'parseDate',
        params: ['dateString: string'],
        returnType: 'Date',
        description: 'Parse date string',
        tags: ['date', 'parsing'],
      },
    ])
  }

  /**
   * Register function family
   */
  private registerFunctionFamily(family: string, functions: FunctionSignature[]): void {
    this.registry.set(family, functions)
  }

  /**
   * Get functions by family
   */
  getFunctionFamily(family: string): FunctionSignature[] {
    return this.registry.get(family) || []
  }

  /**
   * Get functions by tag
   */
  getFunctionsByTag(tag: string): FunctionSignature[] {
    const results: FunctionSignature[] = []
    for (const functions of this.registry.values()) {
      results.push(...functions.filter(fn => fn.tags.includes(tag)))
    }
    return results
  }

  /**
   * Search functions
   */
  search(query: string): FunctionSignature[] {
    const results: FunctionSignature[] = []
    const lowerQuery = query.toLowerCase()

    for (const functions of this.registry.values()) {
      results.push(
        ...functions.filter(
          fn =>
            fn.name.toLowerCase().includes(lowerQuery) ||
            fn.description?.toLowerCase().includes(lowerQuery) ||
            fn.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        )
      )
    }

    return results
  }

  /**
   * Get all functions
   */
  getAll(): Map<string, FunctionSignature[]> {
    return this.registry
  }
}
