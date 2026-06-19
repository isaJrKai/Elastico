'use client'
import type { RepositoryProfile } from './github-discovery'

interface RepositoryCapability {
  type: 'animation' | 'data-processing' | 'validation' | 'ui' | 'api' | 'security' | 'analytics' | 'testing'
  score: number
  keywords: string[]
}

interface AdapterConfig {
  repoUrl: string
  functions: string[]
  exports: string[]
  dependencies: string[]
}

/**
 * Maps repositories to capabilities and creates adapters
 */
export class RepositoryMapper {
  private capabilities: Map<string, RepositoryCapability[]> = new Map()
  private adapters: Map<string, AdapterConfig> = new Map()

  /**
   * Analyze repository and determine capabilities
   */
  analyzeCapabilities(repo: RepositoryProfile): RepositoryCapability[] {
    const capabilities: RepositoryCapability[] = []

    // Check description and topics for capability hints
    const text = `${repo.description} ${repo.topics.join(' ')}`.toLowerCase()

    // Animation capability
    if (
      text.includes('animation') ||
      text.includes('framer') ||
      text.includes('motion') ||
      text.includes('transition')
    ) {
      capabilities.push({
        type: 'animation',
        score: this.calculateCapabilityScore(repo, ['animation', 'motion', 'framer']),
        keywords: ['framer-motion', 'animation', 'easing'],
      })
    }

    // Data processing
    if (
      text.includes('data') ||
      text.includes('processing') ||
      text.includes('transform') ||
      text.includes('stream')
    ) {
      capabilities.push({
        type: 'data-processing',
        score: this.calculateCapabilityScore(repo, ['data', 'processing', 'stream']),
        keywords: ['map', 'filter', 'reduce', 'transform'],
      })
    }

    // Validation
    if (
      text.includes('validation') ||
      text.includes('validator') ||
      text.includes('schema') ||
      text.includes('zod')
    ) {
      capabilities.push({
        type: 'validation',
        score: this.calculateCapabilityScore(repo, ['validation', 'schema', 'zod']),
        keywords: ['validate', 'schema', 'zod'],
      })
    }

    // UI components
    if (
      text.includes('ui') ||
      text.includes('component') ||
      text.includes('react') ||
      text.includes('button')
    ) {
      capabilities.push({
        type: 'ui',
        score: this.calculateCapabilityScore(repo, ['ui', 'component', 'react']),
        keywords: ['button', 'card', 'input', 'dropdown'],
      })
    }

    // API utilities
    if (
      text.includes('api') ||
      text.includes('fetch') ||
      text.includes('rest') ||
      text.includes('graphql')
    ) {
      capabilities.push({
        type: 'api',
        score: this.calculateCapabilityScore(repo, ['api', 'fetch', 'graphql']),
        keywords: ['fetch', 'axios', 'request', 'api'],
      })
    }

    // Security
    if (
      text.includes('security') ||
      text.includes('auth') ||
      text.includes('encryption') ||
      text.includes('jwt')
    ) {
      capabilities.push({
        type: 'security',
        score: this.calculateCapabilityScore(repo, ['security', 'auth', 'jwt']),
        keywords: ['auth', 'encryption', 'jwt', 'security'],
      })
    }

    // Analytics
    if (
      text.includes('analytics') ||
      text.includes('tracking') ||
      text.includes('metrics') ||
      text.includes('telemetry')
    ) {
      capabilities.push({
        type: 'analytics',
        score: this.calculateCapabilityScore(repo, ['analytics', 'tracking', 'metrics']),
        keywords: ['track', 'event', 'metric', 'analytics'],
      })
    }

    // Testing
    if (
      text.includes('test') ||
      text.includes('jest') ||
      text.includes('vitest') ||
      text.includes('e2e')
    ) {
      capabilities.push({
        type: 'testing',
        score: this.calculateCapabilityScore(repo, ['test', 'jest', 'vitest']),
        keywords: ['test', 'jest', 'vitest', 'e2e'],
      })
    }

    this.capabilities.set(`${repo.owner}/${repo.repo}`, capabilities)
    return capabilities
  }

  /**
   * Calculate capability score
   */
  private calculateCapabilityScore(
    repo: RepositoryProfile,
    keywords: string[]
  ): number {
    let score = repo.score // Start with repository relevance score

    // Bonus for matching topics
    const matchingTopics = repo.topics.filter(t =>
      keywords.some(k => t.toLowerCase().includes(k))
    )
    score += matchingTopics.length * 5

    return Math.min(100, score)
  }

  /**
   * Create adapter configuration
   */
  createAdapter(
    repo: RepositoryProfile,
    functions: string[],
    exports: string[]
  ): AdapterConfig {
    const config: AdapterConfig = {
      repoUrl: repo.url,
      functions,
      exports,
      dependencies: this.extractDependencies(repo),
    }

    this.adapters.set(`${repo.owner}/${repo.repo}`, config)
    return config
  }

  /**
   * Extract dependencies from repository
   */
  private extractDependencies(repo: RepositoryProfile): string[] {
    const commonDeps = [
      'framer-motion',
      'react',
      'next',
      'typescript',
      'zod',
      'axios',
      'lodash',
      'date-fns',
      'recharts',
      'jest',
      'vitest',
    ]

    return commonDeps.filter(dep =>
      repo.description.toLowerCase().includes(dep) ||
      repo.topics.some(t => t.toLowerCase().includes(dep))
    )
  }

  /**
   * Find best repositories for capability
   */
  findBestRepositories(
    capabilityType: RepositoryCapability['type'],
    limit: number = 10
  ): Array<{ repo: RepositoryProfile; capability: RepositoryCapability }> {
    const results: Array<{ repo: RepositoryProfile; capability: RepositoryCapability }> = []

    for (const [repoKey, capabilities] of this.capabilities.entries()) {
      const matching = capabilities.find(cap => cap.type === capabilityType)
      if (matching) {
        results.push({ repo: this.getRepositoryInfo(repoKey), capability: matching })
      }
    }

    return results.sort((a, b) => b.capability.score - a.capability.score).slice(0, limit)
  }

  /**
   * Get repository info (placeholder - would fetch from discovery)
   */
  private getRepositoryInfo(repoKey: string): RepositoryProfile {
    const [owner, repo] = repoKey.split('/')
    return {
      owner,
      repo,
      url: `https://github.com/${repoKey}`,
      stars: 0,
      language: 'TypeScript',
      description: '',
      topics: [],
      score: 0,
    }
  }

  /**
   * Get adapter for repository
   */
  getAdapter(owner: string, repo: string): AdapterConfig | undefined {
    return this.adapters.get(`${owner}/${repo}`)
  }

  /**
   * Get all capabilities
   */
  getAllCapabilities(): Map<string, RepositoryCapability[]> {
    return this.capabilities
  }
}
