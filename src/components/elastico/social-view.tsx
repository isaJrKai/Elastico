'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  MessageCircle,
  Heart,
  Flame,
  TrendingUp,
  Users,
  Send,
  Bookmark,
  Share2,
  ThumbsUp,
  MoreHorizontal,
  Eye,
  Clock,
  Hash,
  UserPlus,
  UserMinus,
  ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useElasticoStore } from '@/store/use-elastico-store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Mock Data ──────────────────────────────────────────────────────────────────

const MOCK_USERS = [
  { id: 'u1', name: 'AlphaPredictor', displayName: 'Alpha', avatar: null, accuracy: 72, predictions: 156, followers: 342, following: false },
  { id: 'u2', name: 'TacticalGenius', displayName: 'TG', avatar: null, accuracy: 68, predictions: 234, followers: 521, following: true },
  { id: 'u3', name: 'FootballNerd42', displayName: 'FN42', avatar: null, accuracy: 65, predictions: 89, followers: 128, following: false },
  { id: 'u4', name: 'StatMaster', displayName: 'SM', avatar: null, accuracy: 71, predictions: 312, followers: 456, following: true },
  { id: 'u5', name: 'GoalMachine', displayName: 'GM', avatar: null, accuracy: 63, predictions: 67, followers: 89, following: false },
  { id: 'u6', name: 'xG_Enthusiast', displayName: 'xG', avatar: null, accuracy: 74, predictions: 198, followers: 267, following: false },
]

const MOCK_FEED = [
  {
    id: 'f1',
    userId: 'u1',
    userName: 'AlphaPredictor',
    userAccuracy: 72,
    type: 'prediction' as const,
    match: 'BRA vs FRA',
    prediction: '2-1 BRA',
    confidence: 72,
    comment: 'Brazil\'s pressing will cause France issues. Vinicius will be the difference maker.',
    likes: 24,
    comments: 8,
    shares: 3,
    timeAgo: '2h ago',
    liked: false,
    model: 'elo',
  },
  {
    id: 'f2',
    userId: 'u2',
    userName: 'TacticalGenius',
    userAccuracy: 68,
    type: 'analysis' as const,
    match: 'GER vs ESP',
    prediction: '1-1 Draw',
    confidence: 65,
    comment: 'Both teams play possession-heavy football. The midfield battle between Rodri and Gündoğan will be key. Expect a tight game with few chances.',
    likes: 45,
    comments: 15,
    shares: 7,
    timeAgo: '4h ago',
    liked: true,
    model: 'dixon_coles',
  },
  {
    id: 'f3',
    userId: 'u6',
    userName: 'xG_Enthusiast',
    userAccuracy: 74,
    type: 'prediction' as const,
    match: 'ENG vs NED',
    prediction: '2-0 ENG',
    confidence: 78,
    comment: 'England\'s xG output (1.8/game) vs Netherlands\' xGA (1.1/game) suggests a comfortable win. Bellingham to score.',
    likes: 31,
    comments: 12,
    shares: 5,
    timeAgo: '5h ago',
    liked: false,
    model: 'poisson',
  },
  {
    id: 'f4',
    userId: 'u3',
    userName: 'FootballNerd42',
    userAccuracy: 65,
    type: 'discussion' as const,
    match: 'ARG vs POR',
    prediction: null,
    confidence: 0,
    comment: 'Is Messi still the best player in the world? His World Cup form suggests so, but age catches up with everyone. Thoughts?',
    likes: 67,
    comments: 42,
    shares: 12,
    timeAgo: '8h ago',
    liked: false,
    model: null,
  },
  {
    id: 'f5',
    userId: 'u4',
    userName: 'StatMaster',
    userAccuracy: 71,
    type: 'prediction' as const,
    match: 'JPN vs KOR',
    prediction: '3-1 JPN',
    confidence: 70,
    comment: 'Japan\'s form is exceptional (W4 D1). Korea struggles against high pressing teams. Asian derby always delivers drama.',
    likes: 19,
    comments: 6,
    shares: 2,
    timeAgo: '12h ago',
    liked: true,
    model: 'monte_carlo',
  },
]

const DISCUSSION_THREADS = [
  { id: 'd1', match: 'BRA vs FRA', posts: 47, activeUsers: 23, lastActivity: '2m ago', hot: true },
  { id: 'd2', match: 'GER vs ESP', posts: 38, activeUsers: 19, lastActivity: '15m ago', hot: true },
  { id: 'd3', match: 'ENG vs NED', posts: 29, activeUsers: 14, lastActivity: '1h ago', hot: false },
  { id: 'd4', match: 'ARG vs POR', posts: 65, activeUsers: 34, lastActivity: '30s ago', hot: true },
  { id: 'd5', match: 'JPN vs KOR', posts: 21, activeUsers: 11, lastActivity: '3h ago', hot: false },
]

const TRENDING_TOPICS = [
  { topic: 'Mbappé transfer rumors', posts: 234, trend: 'up' as const },
  { topic: 'World Cup Group A drama', posts: 189, trend: 'up' as const },
  { topic: 'VAR controversy in BRA-FRA', posts: 156, trend: 'up' as const },
  { topic: 'Best young players 2026', posts: 142, trend: 'stable' as const },
  { topic: 'Premier League impact on internationals', posts: 98, trend: 'down' as const },
  { topic: 'Tactical innovations at WC2026', posts: 87, trend: 'up' as const },
]

const COMMUNITY_STATS = [
  { label: 'Total Predictions', value: '24,891' },
  { label: 'Active Users', value: '1,247' },
  { label: 'Discussions', value: '342' },
  { label: 'Avg Accuracy', value: '61.3%' },
  { label: 'Most Active User', value: 'StatMaster' },
  { label: 'Top Discussion', value: 'ARG vs POR' },
]

// ── Component ──────────────────────────────────────────────────────────────────

export function SocialView() {
  const user = useElasticoStore(s => s.user)
  const [feed, setFeed] = useState(MOCK_FEED)
  const [newComment, setNewComment] = useState('')
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set(['u2', 'u4']))
  const [sortBy, setSortBy] = useState('recent')

  const sortedFeed = useMemo(() => {
    const sorted = [...feed]
    if (sortBy === 'recent') return sorted
    if (sortBy === 'popular') return sorted.sort((a, b) => b.likes - a.likes)
    if (sortBy === 'discussed') return sorted.sort((a, b) => b.comments - a.comments)
    return sorted
  }, [feed, sortBy])

  const handleLike = (id: string) => {
    setFeed(prev => prev.map(item =>
      item.id === id
        ? { ...item, liked: !item.liked, likes: item.liked ? item.likes - 1 : item.likes + 1 }
        : item
    ))
  }

  const handleFollow = (userId: string) => {
    setFollowingUsers(prev => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
        toast.success('Unfollowed user')
      } else {
        next.add(userId)
        toast.success('Following user')
      }
      return next
    })
  }

  const handlePostComment = () => {
    if (!newComment.trim()) return
    const newPost = {
      id: `f${Date.now()}`,
      userId: user?.id || 'me',
      userName: user?.displayName || user?.name || 'You',
      userAccuracy: user?.predictionAccuracy ? +(user.predictionAccuracy * 100).toFixed(0) : 50,
      type: 'discussion' as const,
      match: null,
      prediction: null,
      confidence: 0,
      comment: newComment,
      likes: 0,
      comments: 0,
      shares: 0,
      timeAgo: 'Just now',
      liked: false,
      model: null,
    }
    setFeed(prev => [newPost, ...prev])
    setNewComment('')
    toast.success('Posted to community feed!')
  }

  const handleShare = (item: typeof MOCK_FEED[0]) => {
    const text = `${item.userName}: "${item.comment.substring(0, 100)}..." — ELASTICO`
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="text-primary" /> Social & Community
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Connect with fellow football analysts, share predictions, and discuss matches</p>
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="popular">Most Liked</SelectItem>
            <SelectItem value="discussed">Most Discussed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="feed" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 h-auto bg-card/50 p-1 rounded-lg">
          <TabsTrigger value="feed" className="text-xs">Community Feed</TabsTrigger>
          <TabsTrigger value="threads" className="text-xs">Discussions</TabsTrigger>
          <TabsTrigger value="users" className="text-xs">User Profiles</TabsTrigger>
          <TabsTrigger value="leaderboard-comments" className="text-xs">LB Comments</TabsTrigger>
          <TabsTrigger value="trending" className="text-xs">Trending</TabsTrigger>
          <TabsTrigger value="stats" className="text-xs">Community Stats</TabsTrigger>
        </TabsList>

        {/* Community Feed */}
        <TabsContent value="feed">
          <div className="space-y-4">
            {/* New post composer */}
            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                      {user?.displayName?.[0] || user?.name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Share a prediction, analysis, or thought..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>💬 Be respectful</span>
                        <span>·</span>
                        <span>📊 Back up claims with data</span>
                      </div>
                      <Button size="sm" className="h-7 text-xs gap-1" onClick={handlePostComment} disabled={!newComment.trim()}>
                        <Send className="size-3" /> Post
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feed items */}
            {sortedFeed.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-xl border border-border/30 overflow-hidden"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-muted text-xs font-semibold">
                        {item.userName.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{item.userName}</span>
                        <Badge variant="outline" className="text-[9px] text-primary border-primary/30">
                          {item.userAccuracy}% acc
                        </Badge>
                        {item.model && (
                          <Badge variant="outline" className="text-[9px] text-muted-foreground">{item.model}</Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">{item.timeAgo}</span>
                      </div>

                      {/* Match & prediction */}
                      {item.match && (
                        <div className="mt-2 p-2 rounded-lg bg-card/50 border border-border/30 flex items-center gap-3">
                          <Badge variant="outline" className="text-xs">{item.match}</Badge>
                          {item.prediction && (
                            <span className="text-sm font-medium text-primary">{item.prediction}</span>
                          )}
                          {item.confidence > 0 && (
                            <span className="text-[10px] text-muted-foreground ml-auto">{item.confidence}% conf</span>
                          )}
                        </div>
                      )}

                      {/* Comment */}
                      <p className="text-sm mt-2 text-foreground/90 leading-relaxed">{item.comment}</p>

                      {/* Reactions */}
                      <div className="flex items-center gap-4 mt-3">
                        <button
                          onClick={() => handleLike(item.id)}
                          className="flex items-center gap-1.5 text-xs transition-colors hover:text-red-400"
                        >
                          <Heart className={cn('size-3.5', item.liked ? 'fill-red-400 text-red-400' : 'text-muted-foreground')} />
                          <span className={item.liked ? 'text-red-400' : 'text-muted-foreground'}>{item.likes}</span>
                        </button>
                        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                          <MessageCircle className="size-3.5" />
                          {item.comments}
                        </button>
                        <button
                          onClick={() => handleShare(item)}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Share2 className="size-3.5" />
                          {item.shares}
                        </button>
                        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors ml-auto">
                          <Bookmark className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Discussion Threads */}
        <TabsContent value="threads">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageCircle className="size-4 text-primary" /> Match Discussion Threads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {DISCUSSION_THREADS.map(thread => (
                  <motion.div
                    key={thread.id}
                    whileHover={{ x: 4 }}
                    className="flex items-center gap-4 p-4 rounded-lg bg-card/50 border border-border/30 cursor-pointer group"
                    onClick={() => toast.info('Opening discussion thread...')}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{thread.match}</span>
                        {thread.hot && (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[9px] hover:bg-red-500/20 px-1.5">
                            <Flame className="size-2.5 mr-0.5" /> Hot
                          </Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {thread.posts} posts · {thread.activeUsers} active users · Last activity {thread.lastActivity}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Eye className="size-3.5 text-muted-foreground" />
                      <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Profiles */}
        <TabsContent value="users">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="size-4 text-primary" /> Community Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {MOCK_USERS.map(u => (
                  <div key={u.id} className="flex items-center gap-4 p-3 rounded-lg bg-card/50 border border-border/30">
                    <Avatar className="size-10">
                      <AvatarFallback className="bg-muted text-sm font-semibold">{u.displayName}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{u.name}</div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{u.accuracy}% accuracy</span>
                        <span>·</span>
                        <span>{u.predictions} predictions</span>
                        <span>·</span>
                        <span>{u.followers} followers</span>
                      </div>
                    </div>
                    <Button
                      variant={followingUsers.has(u.id) ? 'outline' : 'default'}
                      size="sm"
                      className="text-xs h-8 gap-1"
                      onClick={() => handleFollow(u.id)}
                    >
                      {followingUsers.has(u.id) ? (
                        <><UserMinus className="size-3" /> Unfollow</>
                      ) : (
                        <><UserPlus className="size-3" /> Follow</>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leaderboard Comments */}
        <TabsContent value="leaderboard-comments">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Leaderboard Discussion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { user: 'AlphaPredictor', rank: 1, comment: 'Incredible accuracy this month! The ELO model is really paying off.', time: '1h ago' },
                { user: 'StatMaster', rank: 4, comment: 'Close race at the top. A few more correct predictions and I could climb to #2!', time: '3h ago' },
                { user: 'TacticalGenius', rank: 2, comment: 'Dixon-Coles predictions have been much more reliable than Poisson for me. Anyone else notice this?', time: '5h ago' },
                { user: 'FootballNerd42', rank: 3, comment: 'Great community here. The tactical analysis tools have really helped my predictions.', time: '8h ago' },
              ].map((comment, i) => (
                <div key={i} className="p-3 rounded-lg bg-card/50 border border-border/30">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-primary">{comment.user}</span>
                    <Badge variant="outline" className="text-[9px]">Rank #{comment.rank}</Badge>
                    <span className="text-[10px] text-muted-foreground ml-auto">{comment.time}</span>
                  </div>
                  <p className="text-sm text-foreground/80">{comment.comment}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trending Topics */}
        <TabsContent value="trending">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" /> Trending Topics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {TRENDING_TOPICS.map((topic, i) => (
                  <motion.div
                    key={topic.topic}
                    whileHover={{ x: 4 }}
                    className="flex items-center gap-4 p-3 rounded-lg bg-card/50 border border-border/30 cursor-pointer group"
                    onClick={() => toast.info(`Opening "${topic.topic}" discussion...`)}
                  >
                    <div className="text-lg font-bold text-muted-foreground/40 w-6 text-center">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Hash className="size-3.5 text-primary" />
                        <span className="text-sm font-medium">{topic.topic}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{topic.posts} posts</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {topic.trend === 'up' && <TrendingUp className="size-3.5 text-primary" />}
                      {topic.trend === 'down' && <TrendingUp className="size-3.5 text-red-400 rotate-180" />}
                      {topic.trend === 'stable' && <span className="text-[10px] text-muted-foreground">—</span>}
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Community Stats */}
        <TabsContent value="stats">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {COMMUNITY_STATS.map(stat => (
              <Card key={stat.label} className="glass-card">
                <CardContent className="p-6 text-center">
                  <div className="text-2xl font-bold text-primary">{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}

export default SocialView