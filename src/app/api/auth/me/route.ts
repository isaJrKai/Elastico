import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    // Screenshot mode: return demo user without DB
    const authHeader = req.headers.get('authorization')
    if (authHeader === 'Bearer screenshot-demo-token') {
      return NextResponse.json({ user: {
        id: 'demo-1', email: 'pro@elastico.ai', name: 'Demo Pro User',
        displayName: 'Pro User', avatarUrl: null, role: 'pro', plan: 'pro',
        predictionAccuracy: 72.5, predictionStreak: 5, bestStreak: 12,
        totalPredictions: 156, correctPredictions: 113, achievements: '{}',
        favoriteTeams: '[]', twoFactorEnabled: false, lastLoginAt: new Date().toISOString(),
        loginCount: 42, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      }})
    }

    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth

    // AuthUser already has sensitive fields stripped
    return NextResponse.json({ user: auth.user })
  } catch (error) {
    console.error('Me error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
