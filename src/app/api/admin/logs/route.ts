import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth
    const { user } = auth
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // API logging has been moved to serverless provider logs (e.g. Vercel Logs, CloudWatch).
    // The ApiLog table no longer exists.
    return NextResponse.json({
      logs: [],
      pagination: {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
      },
      message: 'API logging has been moved to serverless provider logs.',
    })
  } catch (error) {
    console.error('Admin logs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}