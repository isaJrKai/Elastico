import { NextRequest, NextResponse } from 'next/server'
import * as EclecticFunctions from '@/lib/federation/eclectic-function-library'
import { FunctionRouter } from '@/lib/federation/function-router'

const functionRouter = new FunctionRouter()

// Register all eclectic functions
function initializeRouter() {
  // Animation
  functionRouter.registerFunction('animations', 'easeInOutCubic', EclecticFunctions.easeInOutCubic)
  functionRouter.registerFunction('animations', 'interpolate', EclecticFunctions.interpolate)
  functionRouter.registerFunction('animations', 'bezier', EclecticFunctions.bezier)

  // Data processing
  functionRouter.registerFunction('data', 'debounce', EclecticFunctions.debounce)
  functionRouter.registerFunction('data', 'throttle', EclecticFunctions.throttle)
  functionRouter.registerFunction('data', 'memoize', EclecticFunctions.memoize)
  functionRouter.registerFunction('data', 'groupBy', EclecticFunctions.groupBy)
  functionRouter.registerFunction('data', 'flatten', EclecticFunctions.flatten)
  functionRouter.registerFunction('data', 'chunk', EclecticFunctions.chunk)
  functionRouter.registerFunction('data', 'unique', EclecticFunctions.unique)

  // Validation
  functionRouter.registerFunction('validation', 'validateEmail', EclecticFunctions.validateEmail)
  functionRouter.registerFunction('validation', 'validateURL', EclecticFunctions.validateURL)
  functionRouter.registerFunction('validation', 'validatePhoneNumber', EclecticFunctions.validatePhoneNumber)
  functionRouter.registerFunction('validation', 'validateCreditCard', EclecticFunctions.validateCreditCard)

  // String
  functionRouter.registerFunction('string', 'slugify', EclecticFunctions.slugify)
  functionRouter.registerFunction('string', 'camelCase', EclecticFunctions.camelCase)
  functionRouter.registerFunction('string', 'pascalCase', EclecticFunctions.pascalCase)
  functionRouter.registerFunction('string', 'snakeCase', EclecticFunctions.snakeCase)
  functionRouter.registerFunction('string', 'capitalize', EclecticFunctions.capitalize)
  functionRouter.registerFunction('string', 'truncate', EclecticFunctions.truncate)

  // Date
  functionRouter.registerFunction('date', 'formatDate', EclecticFunctions.formatDate)
  functionRouter.registerFunction('date', 'parseDate', EclecticFunctions.parseDate)
  functionRouter.registerFunction('date', 'diffDates', EclecticFunctions.diffDates)
  functionRouter.registerFunction('date', 'addDays', EclecticFunctions.addDays)

  // Object
  functionRouter.registerFunction('object', 'deepClone', EclecticFunctions.deepClone)
  functionRouter.registerFunction('object', 'deepMerge', EclecticFunctions.deepMerge)
  functionRouter.registerFunction('object', 'pick', EclecticFunctions.pick)
  functionRouter.registerFunction('object', 'omit', EclecticFunctions.omit)

  // Array
  functionRouter.registerFunction('array', 'shuffle', EclecticFunctions.shuffle)
  functionRouter.registerFunction('array', 'sample', EclecticFunctions.sample)
  functionRouter.registerFunction('array', 'difference', EclecticFunctions.difference)
  functionRouter.registerFunction('array', 'intersection', EclecticFunctions.intersection)

  // Math
  functionRouter.registerFunction('math', 'clamp', EclecticFunctions.clamp)
  functionRouter.registerFunction('math', 'lerp', EclecticFunctions.lerp)
  functionRouter.registerFunction('math', 'map', EclecticFunctions.map)
  functionRouter.registerFunction('math', 'random', EclecticFunctions.random)
  functionRouter.registerFunction('math', 'randomInt', EclecticFunctions.randomInt)

  // Functional
  functionRouter.registerFunction('functional', 'compose', EclecticFunctions.compose)
  functionRouter.registerFunction('functional', 'pipe', EclecticFunctions.pipe)
  functionRouter.registerFunction('functional', 'curry', EclecticFunctions.curry)
}

initializeRouter()

/**
 * GET /api/federation/functions
 * List available eclectic functions
 * Query: family=animations, tag=animation
 */
export async function GET(request: NextRequest) {
  try {
    const family = request.nextUrl.searchParams.get('family')
    const tag = request.nextUrl.searchParams.get('tag')

    let functions: any[] = []

    if (family) {
      functions = [
        'easeInOutCubic',
        'interpolate',
        'debounce',
        'throttle',
        'groupBy',
        'validateEmail',
        'slugify',
        'formatDate',
        'deepClone',
        'shuffle',
        'clamp',
        'compose',
      ] // Simplified list for demo
    }

    return NextResponse.json({
      success: true,
      functions: {
        total: 34,
        families: [
          'animations',
          'data',
          'validation',
          'string',
          'date',
          'object',
          'array',
          'math',
          'functional',
        ],
        filtered: functions,
      },
      timestamp: new Date(),
    })
  } catch (error) {
    console.error('Functions list error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/federation/functions/execute
 * Execute a function from the library
 * Body: {
 *   family: 'string',
 *   name: 'slugify',
 *   params: { text: 'Hello World' }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { family, name, params = {} } = await request.json()

    if (!family || !name) {
      return NextResponse.json(
        { success: false, error: 'Family and name parameters required' },
        { status: 400 }
      )
    }

    console.log(`⚡ Executing ${family}:${name} with params:`, params)

    const result = await functionRouter.executeFunction(family, name, params)

    return NextResponse.json({
      success: result.success,
      function: `${family}:${name}`,
      result: result.data,
      executionTime: `${result.executionTime.toFixed(2)}ms`,
      timestamp: new Date(),
    })
  } catch (error) {
    console.error('Function execution error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
