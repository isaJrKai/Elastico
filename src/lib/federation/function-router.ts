'use client'
import type { FunctionSignature } from './github-discovery'

interface FunctionCall {
  family: string
  name: string
  params: Record<string, any>
  context?: Record<string, any>
}

interface FunctionResult {
  success: boolean
  data?: any
  error?: string
  executionTime: number
  source: string
}

/**
 * Dynamic function router for discovered functions
 */
export class FunctionRouter {
  private functionMap: Map<string, Function> = new Map()
  private executionHistory: FunctionResult[] = []

  /**
   * Register function
   */
  registerFunction(
    family: string,
    name: string,
    fn: Function,
    metadata?: Partial<FunctionSignature>
  ): void {
    const key = `${family}:${name}`
    this.functionMap.set(key, fn)
  }

  /**
   * Execute function by name
   */
  async executeFunction(
    family: string,
    name: string,
    params: Record<string, any> = {},
    context?: Record<string, any>
  ): Promise<FunctionResult> {
    const key = `${family}:${name}`
    const fn = this.functionMap.get(key)

    if (!fn) {
      return {
        success: false,
        error: `Function not found: ${key}`,
        executionTime: 0,
        source: key,
      }
    }

    const startTime = performance.now()

    try {
      // Prepare arguments from params
      const args = Object.values(params)
      const data = await Promise.resolve(fn(...args))
      const executionTime = performance.now() - startTime

      const result: FunctionResult = {
        success: true,
        data,
        executionTime,
        source: key,
      }

      this.executionHistory.push(result)
      return result
    } catch (error) {
      const executionTime = performance.now() - startTime
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
        source: key,
      }
    }
  }

  /**
   * Chain multiple function calls
   */
  async chainFunctions(
    calls: FunctionCall[],
    context?: Record<string, any>
  ): Promise<FunctionResult[]> {
    const results: FunctionResult[] = []

    for (const call of calls) {
      const result = await this.executeFunction(
        call.family,
        call.name,
        call.params,
        { ...context, previousResults: results }
      )
      results.push(result)

      // Stop on error if strict mode
      if (!result.success) break
    }

    return results
  }

  /**
   * Parallel execution
   */
  async executeParallel(
    calls: FunctionCall[]
  ): Promise<FunctionResult[]> {
    const promises = calls.map(call =>
      this.executeFunction(call.family, call.name, call.params)
    )
    return Promise.all(promises)
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit: number = 100): FunctionResult[] {
    return this.executionHistory.slice(-limit)
  }

  /**
   * Get performance stats
   */
  getPerformanceStats(): {
    totalExecutions: number
    averageTime: number
    totalTime: number
    successRate: number
  } {
    if (this.executionHistory.length === 0) {
      return {
        totalExecutions: 0,
        averageTime: 0,
        totalTime: 0,
        successRate: 0,
      }
    }

    const total = this.executionHistory.length
    const successful = this.executionHistory.filter(r => r.success).length
    const totalTime = this.executionHistory.reduce((sum, r) => sum + r.executionTime, 0)

    return {
      totalExecutions: total,
      averageTime: totalTime / total,
      totalTime,
      successRate: (successful / total) * 100,
    }
  }
}
