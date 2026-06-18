'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Trophy,
  Award,
  Star,
  Flame,
  Lock,
  Unlock,
  Copy,
  ChevronRight,
  Target,
  Users,
  Brain,
  Zap,
  Calendar,
  Crown,
  Medal,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { useElasticoStore } from '@/store/use-elastico-store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  category: string
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  xp: number
  unlocked: boolean
  unlockedAt: string | null
  progress?: number
  maxProgress?: number
}

interface UserProgress {
  totalXp: number
  level: number
  xpInCurrentLevel: number
  xpForNextLevel: number
  unlockedCount: number
  totalCount: number
  completionPercent: number
}

// ── Mock Data ──────────────────────────────────────────────────────────────────

const MOCK_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_prediction', name: 'First Steps', description: 'Make your first prediction', icon: '🎯', category: 'prediction', tier: 'bronze', xp: 10, unlocked: true, unlockedAt: '2026-01-15' },
  { id: 'streak_5', name: 'Hot Streak', description: 'Get 5 predictions correct in a row', icon: '🔥', category: 'streak', tier: 'silver', xp: 50, unlocked: true, unlockedAt: '2026-01-20' },
  { id: 'streak_10', name: 'On Fire', description: 'Get 10 predictions correct in a row', icon: '💥', category: 'streak', tier: 'gold', xp: 150, unlocked: false, progress: 7, maxProgress: 10 },
  { id: 'streak_25', name: 'Unstoppable', description: 'Get 25 predictions correct in a row', icon: '⚡', category: 'streak', tier: 'platinum', xp: 500, unlocked: false, progress: 7, maxProgress: 25 },
  { id: 'predictions_10', name: 'Getting Started', description: 'Make 10 predictions', icon: '📋', category: 'prediction', tier: 'bronze', xp: 20, unlocked: true, unlockedAt: '2026-01-16' },
  { id: 'predictions_50', name: 'Regular Punter', description: 'Make 50 predictions', icon: '📊', category: 'prediction', tier: 'silver', xp: 100, unlocked: true, unlockedAt: '2026-02-01' },
  { id: 'predictions_100', name: 'Prediction Master', description: 'Make 100 predictions', icon: '👑', category: 'prediction', tier: 'gold', xp: 250, unlocked: false, progress: 67, maxProgress: 100 },
  { id: 'predictions_500', name: 'Oracle', description: 'Make 500 predictions', icon: '🔮', category: 'prediction', tier: 'platinum', xp: 1000, unlocked: false, progress: 67, maxProgress: 500 },
  { id: 'accuracy_60', name: 'Sharp Eye', description: 'Reach 60% prediction accuracy', icon: '👁️', category: 'analyst', tier: 'silver', xp: 75, unlocked: true, unlockedAt: '2026-02-10' },
  { id: 'accuracy_70', name: 'Expert Analyst', description: 'Reach 70% prediction accuracy', icon: '🧠', category: 'analyst', tier: 'gold', xp: 200, unlocked: false, progress: 62, maxProgress: 70 },
  { id: 'accuracy_80', name: 'Crystal Ball', description: 'Reach 80% prediction accuracy', icon: '💎', category: 'analyst', tier: 'platinum', xp: 500, unlocked: false, progress: 62, maxProgress: 80 },
  { id: 'social_share', name: 'Social Butterfly', description: 'Share a prediction', icon: '🦋', category: 'social', tier: 'bronze', xp: 15, unlocked: true, unlockedAt: '2026-01-18' },
  { id: 'follow_10', name: 'Networker', description: 'Follow 10 other users', icon: '🤝', category: 'social', tier: 'bronze', xp: 25, unlocked: false, progress: 4, maxProgress: 10 },
  { id: 'comment_50', name: 'Pundit', description: 'Write 50 comments', icon: '💬', category: 'social', tier: 'silver', xp: 75, unlocked: false, progress: 12, maxProgress: 50 },
  { id: 'daily_login_7', name: 'Dedicated Fan', description: 'Log in 7 days in a row', icon: '📅', category: 'early_adopter', tier: 'bronze', xp: 30, unlocked: true, unlockedAt: '2026-01-22' },
  { id: 'daily_login_30', name: 'Diehard Supporter', description: 'Log in 30 days in a row', icon: '🏅', category: 'early_adopter', tier: 'gold', xp: 200, unlocked: false, progress: 14, maxProgress: 30 },
  { id: 'early_adopter', name: 'Pioneer', description: 'Join during beta', icon: '🚀', category: 'early_adopter', tier: 'gold', xp: 100, unlocked: true, unlockedAt: '2026-01-10' },
  { id: 'bookmark_10', name: 'Collector', description: 'Bookmark 10 matches', icon: '🔖', category: 'analyst', tier: 'bronze', xp: 20, unlocked: true, unlockedAt: '2026-02-05' },
  { id: 'export_report', name: 'Data Nerd', description: 'Export your first report', icon: '📈', category: 'analyst', tier: 'bronze', xp: 15, unlocked: false, progress: 0, maxProgress: 1 },
  { id: 'tactical_view', name: 'Tactician', description: 'View tactical analysis 10 times', icon: '🎯', category: 'analyst', tier: 'silver', xp: 50, unlocked: false, progress: 3, maxProgress: 10 },
]

const CHALLENGES = [
  { id: 'daily_1', title: 'Predict 3 matches today', progress: 1, max: 3, timeRemaining: '14h 23m', xp: 30, type: 'daily' },
  { id: 'daily_2', title: 'Correctly predict 1 match', progress: 0, max: 1, timeRemaining: '14h 23m', xp: 50, type: 'daily' },
  { id: 'daily_3', title: 'View tactical analysis', progress: 0, max: 1, timeRemaining: '14h 23m', xp: 15, type: 'daily' },
  { id: 'weekly_1', title: 'Maintain a 5-day login streak', progress: 3, max: 5, timeRemaining: '4d 14h', xp: 100, type: 'weekly' },
  { id: 'weekly_2', title: 'Reach 65% accuracy this week', progress: 58, max: 65, timeRemaining: '4d 14h', xp: 150, type: 'weekly' },
  { id: 'weekly_3', title: 'Make 20 predictions this week', progress: 12, max: 20, timeRemaining: '4d 14h', xp: 80, type: 'weekly' },
]

const MOCK_LEADERBOARD = [
  { rank: 1, name: 'AlphaPredictor', level: 28, unlocked: 18, avatar: '🥇' },
  { rank: 2, name: 'TacticalGenius', level: 25, unlocked: 16, avatar: '🥈' },
  { rank: 3, name: 'FootballNerd42', level: 22, unlocked: 15, avatar: '🥉' },
  { rank: 4, name: 'StatMaster', level: 20, unlocked: 14, avatar: '4' },
  { rank: 5, name: 'GoalMachine', level: 18, unlocked: 13, avatar: '5' },
  { rank: 8, name: 'You', level: 12, unlocked: 8, avatar: '⭐', isUser: true },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  bronze: { label: 'Bronze', color: 'text-amber-600 bg-amber-600/10 border-amber-600/30', icon: Medal },
  silver: { label: 'Silver', color: 'text-slate-300 bg-slate-300/10 border-slate-300/30', icon: Star },
  gold: { label: 'Gold', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30', icon: Crown },
  platinum: { label: 'Platinum', color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30', icon: Trophy },
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  prediction: { label: 'Prediction Master', icon: Target },
  social: { label: 'Social Butterfly', icon: Users },
  analyst: { label: 'Analyst', icon: Brain },
  streak: { label: 'Streak Hunter', icon: Flame },
  early_adopter: { label: 'Early Adopter', icon: Zap },
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AchievementsView() {
  const user = useElasticoStore(s => s.user)
  const token = useElasticoStore(s => s.token)
  const [achievements, setAchievements] = useState<Achievement[]>(MOCK_ACHIEVEMENTS)
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAchievements() {
      try {
        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`
        const res = await fetch('/api/achievements', { headers })
        if (res.ok) {
          const data = await res.json()
          if (data.achievements?.length > 0) {
            setAchievements(data.achievements)
            setUserProgress(data.userProgress)
          }
        }
      } catch {
        // Use mock data
      } finally {
        setLoading(false)
      }
    }
    fetchAchievements()
  }, [token])

  // Compute progress if not from API
  const progress = useMemo(() => {
    if (userProgress) return userProgress
    const unlocked = achievements.filter(a => a.unlocked).length
    const totalXp = achievements.filter(a => a.unlocked).reduce((s, a) => s + a.xp, 0)
    return {
      totalXp,
      level: Math.floor(totalXp / 100) + 1,
      xpInCurrentLevel: totalXp % 100,
      xpForNextLevel: 100,
      unlockedCount: unlocked,
      totalCount: achievements.length,
      completionPercent: Math.round((unlocked / achievements.length) * 100),
    }
  }, [achievements, userProgress])

  const filteredAchievements = useMemo(() => {
    if (selectedCategory === 'all') return achievements
    return achievements.filter(a => a.category === selectedCategory)
  }, [achievements, selectedCategory])

  const categories = useMemo(() => {
    const cats = new Set(achievements.map(a => a.category))
    return Array.from(cats)
  }, [achievements])

  const recentUnlocks = useMemo(() =>
    achievements.filter(a => a.unlocked).sort((a, b) => (b.unlockedAt || '').localeCompare(a.unlockedAt || '')).slice(0, 3),
    [achievements]
  )

  const rarestAchievement = useMemo(() =>
    achievements.filter(a => a.unlocked).sort((a, b) => b.xp - a.xp)[0],
    [achievements]
  )

  const handleShare = (achievement: Achievement) => {
    const text = `🏆 Achievement Unlocked: ${achievement.icon} ${achievement.name}\n${achievement.description}\n\n— ELASTICO Football Analytics`
    navigator.clipboard.writeText(text).then(() => toast.success('Copied to clipboard!'))
  }

  const getStreakLevel = () => {
    const s = user?.predictionStreak || 0
    if (s >= 10) return { level: 3, color: 'text-red-400', label: '🔥🔥🔥' }
    if (s >= 5) return { level: 2, color: 'text-orange-400', label: '🔥🔥' }
    if (s >= 1) return { level: 1, color: 'text-yellow-400', label: '🔥' }
    return { level: 0, color: 'text-muted-foreground', label: '—' }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="text-primary" /> Achievements & Gamification
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Track your progress, unlock badges, and climb the leaderboard</p>
      </div>

      <Tabs defaultValue="achievements" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 h-auto bg-card/50 p-1 rounded-lg">
          <TabsTrigger value="achievements" className="text-xs">Achievement Grid</TabsTrigger>
          <TabsTrigger value="progress" className="text-xs">XP & Level</TabsTrigger>
          <TabsTrigger value="challenges" className="text-xs">Challenges</TabsTrigger>
          <TabsTrigger value="leaderboard" className="text-xs">Leaderboard</TabsTrigger>
          <TabsTrigger value="stats" className="text-xs">Stats</TabsTrigger>
          <TabsTrigger value="streak" className="text-xs">Streak</TabsTrigger>
        </TabsList>

        {/* XP & Level */}
        <TabsContent value="progress">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Level & XP</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <motion.div
                    className="text-6xl font-bold text-primary"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring' }}
                  >
                    {progress.level}
                  </motion.div>
                  <div className="text-sm text-muted-foreground mt-1">Current Level</div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>XP Progress</span>
                    <span>{progress.xpInCurrentLevel} / {progress.xpForNextLevel} XP</span>
                  </div>
                  <Progress value={(progress.xpInCurrentLevel / progress.xpForNextLevel) * 100} className="h-3" />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="text-center p-3 rounded-lg bg-card/50 border border-border/30">
                    <div className="text-2xl font-bold">{progress.totalXp}</div>
                    <div className="text-[10px] text-muted-foreground">Total XP</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-card/50 border border-border/30">
                    <div className="text-2xl font-bold text-primary">{progress.unlockedCount}/{progress.totalCount}</div>
                    <div className="text-[10px] text-muted-foreground">Unlocked</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Reward Tiers */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Reward Tiers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(Object.entries(TIER_CONFIG) as [keyof typeof TIER_CONFIG, typeof TIER_CONFIG.bronze][]).map(([tier, config]) => {
                  const count = achievements.filter(a => a.tier === tier && a.unlocked).length
                  const total = achievements.filter(a => a.tier === tier).length
                  const Icon = config.icon
                  return (
                    <div key={tier} className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border/30">
                      <Icon className={cn('size-6', config.color.split(' ')[0])} />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{config.label}</div>
                        <div className="text-[10px] text-muted-foreground">{count}/{total} unlocked</div>
                      </div>
                      <Progress value={(count / Math.max(total, 1)) * 100} className="w-20 h-2" />
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Achievement Grid */}
        <TabsContent value="achievements">
          {/* Category filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-8"
              onClick={() => setSelectedCategory('all')}
            >
              All ({achievements.length})
            </Button>
            {categories.map(cat => {
              const config = CATEGORY_CONFIG[cat]
              if (!config) return null
              const Icon = config.icon
              return (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-8 gap-1.5"
                  onClick={() => setSelectedCategory(cat)}
                >
                  <Icon className="size-3" />
                  {config.label} ({achievements.filter(a => a.category === cat).length})
                </Button>
              )
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredAchievements.map((achievement, i) => {
              const tierConfig = TIER_CONFIG[achievement.tier]
              const TierIcon = tierConfig.icon
              return (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ y: -4 }}
                  className={cn(
                    'rounded-xl border p-4 text-center transition-all cursor-pointer group relative',
                    achievement.unlocked
                      ? 'glass-card border-primary/30 bg-primary/5'
                      : 'bg-card/30 border-border/50 opacity-60'
                  )}
                >
                  {/* Locked overlay */}
                  {!achievement.unlocked && (
                    <Lock className="absolute top-2 right-2 size-3.5 text-muted-foreground/40" />
                  )}
                  {achievement.unlocked && (
                    <Unlock className="absolute top-2 right-2 size-3.5 text-primary/60" />
                  )}

                  <div className="text-3xl mb-2">{achievement.icon}</div>
                  <h4 className="text-xs font-semibold truncate">{achievement.name}</h4>
                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{achievement.description}</p>

                  {/* Progress bar for partial */}
                  {achievement.progress !== undefined && achievement.maxProgress !== undefined && (
                    <div className="mt-2 space-y-1">
                      <Progress value={(achievement.progress / achievement.maxProgress) * 100} className="h-1.5" />
                      <span className="text-[9px] text-muted-foreground">{achievement.progress}/{achievement.maxProgress}</span>
                    </div>
                  )}

                  {/* Tier badge */}
                  <div className="mt-2 flex items-center justify-center gap-1">
                    <TierIcon className="size-3" />
                    <Badge variant="outline" className={cn('text-[9px] h-5', tierConfig.color)}>
                      {tierConfig.label}
                    </Badge>
                  </div>

                  {/* XP */}
                  <div className="mt-1 text-[9px] text-muted-foreground">+{achievement.xp} XP</div>

                  {/* Share button on hover */}
                  {achievement.unlocked && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleShare(achievement) }}
                      className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Copy className="size-5 text-primary" />
                    </button>
                  )}
                </motion.div>
              )
            })}
          </div>
        </TabsContent>

        {/* Challenges */}
        <TabsContent value="challenges">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">Active Challenges</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CHALLENGES.map(challenge => (
                <motion.div
                  key={challenge.id}
                  whileHover={{ scale: 1.01 }}
                  className={cn(
                    'glass-card p-4 rounded-xl border space-y-3',
                    challenge.type === 'daily' ? 'border-primary/20' : 'border-orange-500/20'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="outline" className={cn('text-[9px] mb-1', challenge.type === 'daily' ? 'text-primary border-primary/30' : 'text-orange-400 border-orange-400/30')}>
                        {challenge.type === 'daily' ? '📅 Daily' : '📆 Weekly'}
                      </Badge>
                      <h4 className="text-sm font-medium">{challenge.title}</h4>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-primary">+{challenge.xp} XP</div>
                      <div className="text-[10px] text-muted-foreground">{challenge.timeRemaining}</div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Progress</span>
                      <span>{challenge.progress}/{challenge.max}</span>
                    </div>
                    <Progress value={(challenge.progress / challenge.max) * 100} className="h-2" />
                  </div>
                  {challenge.progress >= challenge.max && (
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">✅ Complete — Claim your reward!</Badge>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Leaderboard */}
        <TabsContent value="leaderboard">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Award className="size-4 text-primary" /> Achievement Collectors Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {MOCK_LEADERBOARD.map(entry => (
                  <div
                    key={entry.rank}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                      entry.isUser ? 'glass-card border-primary/30 bg-primary/5' : 'bg-card/50 border-border/30'
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold shrink-0">
                      {typeof entry.avatar === 'string' && entry.avatar.length === 1 ? entry.avatar : entry.avatar}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{entry.name}</div>
                      <div className="text-[10px] text-muted-foreground">Level {entry.level} · {entry.unlocked} achievements</div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      #{entry.rank}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Achievement Stats */}
        <TabsContent value="stats">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="glass-card">
              <CardContent className="p-6 text-center">
                <div className="text-4xl font-bold text-primary">{progress.unlockedCount}</div>
                <div className="text-sm text-muted-foreground mt-1">Total Unlocked</div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-6 text-center">
                <div className="text-4xl font-bold">{progress.completionPercent}%</div>
                <div className="text-sm text-muted-foreground mt-1">Completion</div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-6 text-center">
                <div className="text-4xl font-bold text-primary">{progress.totalXp}</div>
                <div className="text-sm text-muted-foreground mt-1">Total XP Earned</div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-6 text-center">
                {rarestAchievement ? (
                  <>
                    <div className="text-3xl mb-1">{rarestAchievement.icon}</div>
                    <div className="text-sm font-semibold">{rarestAchievement.name}</div>
                    <div className="text-[10px] text-muted-foreground">Rarest Achievement</div>
                  </>
                ) : (
                  <>
                    <div className="text-4xl font-bold text-muted-foreground">—</div>
                    <div className="text-sm text-muted-foreground mt-1">Rarest Achievement</div>
                  </>
                )}
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-6 text-center">
                {recentUnlocks[0] ? (
                  <>
                    <div className="text-3xl mb-1">{recentUnlocks[0].icon}</div>
                    <div className="text-sm font-semibold">{recentUnlocks[0].name}</div>
                    <div className="text-[10px] text-muted-foreground">Most Recent</div>
                  </>
                ) : (
                  <>
                    <div className="text-4xl font-bold text-muted-foreground">—</div>
                    <div className="text-sm text-muted-foreground mt-1">Most Recent</div>
                  </>
                )}
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-6 text-center">
                <div className="text-4xl font-bold text-primary">Lvl {progress.level}</div>
                <div className="text-sm text-muted-foreground mt-1">Current Level</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Streak Tracker */}
        <TabsContent value="streak">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Flame className="size-4 text-red-400" /> Prediction Streak
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                {(() => {
                  const s = getStreakLevel()
                  return (
                    <div className="space-y-3">
                      {/* Fire animation */}
                      <motion.div
                        className={cn('text-7xl', s.color)}
                        animate={s.level > 0 ? { scale: [1, 1.1, 1], rotate: [0, 2, -2, 0] } : {}}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        {s.label}
                      </motion.div>
                      <div className="text-5xl font-bold">{user?.predictionStreak || 0}</div>
                      <div className="text-sm text-muted-foreground">Current Prediction Streak</div>
                      <div className="text-xs text-muted-foreground">Best: {user?.bestStreak || 0} in a row</div>
                    </div>
                  )
                })()}
              </div>

              {/* Milestones */}
              <div className="flex items-center justify-center gap-4">
                {[3, 5, 10, 15, 25].map(milestone => {
                  const current = user?.predictionStreak || 0
                  const reached = current >= milestone
                  return (
                    <div key={milestone} className="text-center">
                      <div className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2',
                        reached ? 'bg-primary/20 border-primary text-primary' : 'bg-muted/50 border-border text-muted-foreground'
                      )}>
                        {reached ? '✓' : milestone}
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-1">{milestone} streak</div>
                    </div>
                  )
                })}
              </div>

              {/* Streak history */}
              <div className="border-t border-border/50 pt-4">
                <h4 className="text-sm font-medium mb-3">Recent Streaks</h4>
                <div className="space-y-2">
                  {[
                    { length: 5, date: 'Feb 1-6', correct: 5, total: 5 },
                    { length: 3, date: 'Jan 25-27', correct: 3, total: 3 },
                    { length: 2, date: 'Jan 20-21', correct: 2, total: 2 },
                  ].map((streak, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-card/50 border border-border/30">
                      <div>
                        <div className="text-sm font-medium">{streak.length} in a row</div>
                        <div className="text-[10px] text-muted-foreground">{streak.date}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-primary">{streak.correct}/{streak.total}</span>
                        <ChevronRight className="size-3 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}

export default AchievementsView