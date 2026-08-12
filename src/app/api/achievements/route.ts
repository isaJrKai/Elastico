import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

// All possible achievements
const ALL_ACHIEVEMENTS = [
  { id: 'first_prediction', name: 'First Steps', description: 'Make your first prediction', icon: '🎯', category: 'prediction', tier: 'bronze', xp: 10 },
  { id: 'streak_5', name: 'Hot Streak', description: 'Get 5 predictions correct in a row', icon: '🔥', category: 'streak', tier: 'silver', xp: 50 },
  { id: 'streak_10', name: 'On Fire', description: 'Get 10 predictions correct in a row', icon: '💥', category: 'streak', tier: 'gold', xp: 150 },
  { id: 'streak_25', name: 'Unstoppable', description: 'Get 25 predictions correct in a row', icon: '⚡', category: 'streak', tier: 'platinum', xp: 500 },
  { id: 'predictions_10', name: 'Getting Started', description: 'Make 10 predictions', icon: '📋', category: 'prediction', tier: 'bronze', xp: 20 },
  { id: 'predictions_50', name: 'Regular Punter', description: 'Make 50 predictions', icon: '📊', category: 'prediction', tier: 'silver', xp: 100 },
  { id: 'predictions_100', name: 'Prediction Master', description: 'Make 100 predictions', icon: '👑', category: 'prediction', tier: 'gold', xp: 250 },
  { id: 'predictions_500', name: 'Oracle', description: 'Make 500 predictions', icon: '🔮', category: 'prediction', tier: 'platinum', xp: 1000 },
  { id: 'accuracy_60', name: 'Sharp Eye', description: 'Reach 60% prediction accuracy', icon: '👁️', category: 'analyst', tier: 'silver', xp: 75 },
  { id: 'accuracy_70', name: 'Expert Analyst', description: 'Reach 70% prediction accuracy', icon: '🧠', category: 'analyst', tier: 'gold', xp: 200 },
  { id: 'accuracy_80', name: 'Crystal Ball', description: 'Reach 80% prediction accuracy', icon: '💎', category: 'analyst', tier: 'platinum', xp: 500 },
  { id: 'social_share', name: 'Social Butterfly', description: 'Share a prediction', icon: '🦋', category: 'social', tier: 'bronze', xp: 15 },
  { id: 'follow_10', name: 'Networker', description: 'Follow 10 other users', icon: '🤝', category: 'social', tier: 'bronze', xp: 25 },
  { id: 'comment_50', name: 'Pundit', description: 'Write 50 comments', icon: '💬', category: 'social', tier: 'silver', xp: 75 },
  { id: 'daily_login_7', name: 'Dedicated Fan', description: 'Log in 7 days in a row', icon: '📅', category: 'early_adopter', tier: 'bronze', xp: 30 },
  { id: 'daily_login_30', name: 'Diehard Supporter', description: 'Log in 30 days in a row', icon: '🏅', category: 'early_adopter', tier: 'gold', xp: 200 },
  { id: 'early_adopter', name: 'Pioneer', description: 'Join during beta', icon: '🚀', category: 'early_adopter', tier: 'gold', xp: 100 },
  { id: 'bookmark_10', name: 'Collector', description: 'Bookmark 10 matches', icon: '🔖', category: 'analyst', tier: 'bronze', xp: 20 },
  { id: 'export_report', name: 'Data Nerd', description: 'Export your first report', icon: '📈', category: 'analyst', tier: 'bronze', xp: 15 },
  { id: 'tactical_view', name: 'Tactician', description: 'View tactical analysis 10 times', icon: '🎯', category: 'analyst', tier: 'silver', xp: 50 },
]

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth
    const { user } = auth

    const userAchievements: string[] = JSON.parse(user.achievements || '[]')

    const achievements = ALL_ACHIEVEMENTS.map((a) => ({
      ...a,
      unlocked: userAchievements.includes(a.id),
      unlockedAt: userAchievements.includes(a.id) ? new Date().toISOString() : null,
    }))

    // Calculate XP
    let totalXp = 0
    for (const a of achievements) {
      if (a.unlocked) totalXp += a.xp
    }

    // Level calculation (100 XP per level)
    const level = Math.floor(totalXp / 100) + 1
    const xpInCurrentLevel = totalXp % 100
    const xpForNextLevel = 100

    const unlockedCount = achievements.filter((a) => a.unlocked).length
    const totalCount = achievements.length

    return NextResponse.json({
      achievements,
      userProgress: {
        totalXp,
        level,
        xpInCurrentLevel,
        xpForNextLevel,
        unlockedCount,
        totalCount,
        completionPercent: totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0,
      },
    })
  } catch (error) {
    console.error('Achievements error:', error)
    return NextResponse.json({ error: 'Failed to fetch achievements' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth
    const { user } = auth

    const { achievementId } = await req.json()
    if (!achievementId) {
      return NextResponse.json({ error: 'Achievement ID required' }, { status: 400 })
    }

    const achievement = ALL_ACHIEVEMENTS.find((a) => a.id === achievementId)
    if (!achievement) {
      return NextResponse.json({ error: 'Achievement not found' }, { status: 404 })
    }

    // ── Server-side verification: only allow claiming achievements with no prerequisites ──
    // These are achievements that can be verified server-side without complex state checks.
    // To add more achievements, implement verification logic below and add the ID to this set.
    //
    // TODO: Add verification for each achievement:
    //   - streak_5/10/25: Query predictions table, check consecutive correct results
    //   - predictions_10/50/100/500: COUNT user's predictions in DB
    //   - accuracy_60/70/80: Compute (correct / total) from predictions table
    //   - social_share: Check if user has any shared predictions
    //   - follow_10: COUNT user's follows in DB
    //   - comment_50: COUNT user's comments in DB
    //   - daily_login_7/30: Check activity log for consecutive daily logins
    //   - early_adopter: Check user.createdAt against beta cutoff date
    //   - bookmark_10: COUNT user's bookmarks in DB
    //   - export_report: Check if user has any export activity records
    //   - tactical_view: COUNT tactical view activity records
    const CLAIMABLE_WITHOUT_VERIFICATION = new Set([
      'first_prediction', // Verified by checking if user has any predictions
      'first_login',      // Verified by the fact the user is authenticated
    ])

    if (!CLAIMABLE_WITHOUT_VERIFICATION.has(achievementId)) {
      return NextResponse.json({
        error: 'This achievement requires server-side verification and cannot be claimed directly',
      }, { status: 403 })
    }

    // Verify first_prediction: user must actually have at least one prediction
    if (achievementId === 'first_prediction') {
      const predictionCount = await db.prediction.count({ where: { userId: user.id } })
      if (predictionCount < 1) {
        return NextResponse.json({ error: 'Achievement not earned yet' }, { status: 403 })
      }
    }

    // first_login is inherently verified by the authenticated request above

    const userAchievements: string[] = JSON.parse(user.achievements || '[]')
    if (userAchievements.includes(achievementId)) {
      return NextResponse.json({ error: 'Already claimed' }, { status: 409 })
    }

    userAchievements.push(achievementId)

    await db.user.update({
      where: { id: user.id },
      data: { achievements: JSON.stringify(userAchievements) },
    })

    return NextResponse.json({ success: true, achievement })
  } catch (error) {
    console.error('Achievement claim error:', error)
    return NextResponse.json({ error: 'Failed to claim achievement' }, { status: 500 })
  }
}