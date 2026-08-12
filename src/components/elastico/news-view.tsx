'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useElasticoStore, type NewsItem } from '@/store/use-elastico-store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Search,
  Newspaper,
  Flame,
  ThumbsUp,
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  ExternalLink,
  ChevronDown,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

// ── Categories ────────────────────────────────────────────────────────────────

const categories = [
  { label: 'All', value: '' },
  { label: 'Match', value: 'match' },
  { label: 'Transfer', value: 'transfer' },
  { label: 'Injury', value: 'injury' },
  { label: 'Tactical', value: 'tactical' },
  { label: 'Rumor', value: 'rumor' },
] as const

// ── Sentiment Config ──────────────────────────────────────────────────────────

const sentimentConfig: Record<
  string,
  { icon: React.ElementType; color: string; bg: string }
> = {
  positive: {
    icon: TrendingUp,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
  },
  negative: {
    icon: TrendingDown,
    color: 'text-red-400',
    bg: 'bg-red-400/10',
  },
  neutral: {
    icon: Minus,
    color: 'text-muted-foreground',
    bg: 'bg-muted/50',
  },
}

// ── Category Badge Config ─────────────────────────────────────────────────────

const categoryBadgeConfig: Record<string, string> = {
  match: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  transfer: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  injury: 'bg-red-500/15 text-red-400 border-red-500/30',
  tactical: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  rumor: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  general: 'bg-muted text-muted-foreground border-border',
}

// ── Relative Time ─────────────────────────────────────────────────────────────

function getRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Unknown'
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

// ── Parse Reactions ───────────────────────────────────────────────────────────

function parseReactions(reactionsStr: string): {
  like: number
  fire: number
  think: number
} {
  try {
    const parsed = JSON.parse(reactionsStr)
    return {
      like: parsed.like || 0,
      fire: parsed.fire || 0,
      think: parsed.think || 0,
    }
  } catch {
    return { like: 0, fire: 0, think: 0 }
  }
}

// ── News View Component ───────────────────────────────────────────────────────

export default function NewsView() {
  const setNews = useElasticoStore(s => s.setNews)

  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null)

  // ── Fetch News ───────────────────────────────────────────────────────────

  const fetchNews = useCallback(
    async (pageNum: number, reset = false) => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({ page: String(pageNum), limit: '12' })
        if (activeCategory) params.set('category', activeCategory)
        if (search.trim()) params.set('search', search.trim())

        const res = await fetch(`/api/news?${params}`)
        if (!res.ok) throw new Error('Failed to fetch news')

        const data = await res.json()
        const items: NewsItem[] = data.news || []

        if (reset) {
          setNewsItems(items)
        } else {
          setNewsItems((prev) => [...prev, ...items])
        }
        setNews(items)
        setTotalPages(data.pagination?.totalPages || 1)
        setPage(pageNum)
      } catch {
        // Silent error – show empty state
      } finally {
        setIsLoading(false)
      }
    },
    [activeCategory, search, setNews],
  )

  // Initial fetch on category change
  useEffect(() => {
    const params = new URLSearchParams({ page: '1', limit: '12' })
    if (activeCategory) params.set('category', activeCategory)
    setIsLoading(true)
    fetch(`/api/news?${params}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setNewsItems(data.news || [])
        setTotalPages(data.pagination?.totalPages || 1)
        setPage(1)
        if (data.news) setNews(data.news)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [activeCategory, setNews])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ page: '1', limit: '12' })
      if (activeCategory) params.set('category', activeCategory)
      if (search.trim()) params.set('search', search.trim())
      setIsLoading(true)
      fetch(`/api/news?${params}`)
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => {
          setNewsItems(data.news || [])
          setTotalPages(data.pagination?.totalPages || 1)
          setPage(1)
          if (data.news) setNews(data.news)
        })
        .catch(() => {})
        .finally(() => setIsLoading(false))
    }, 400)
    return () => clearTimeout(timer)
  }, [search, activeCategory, setNews])

  // ── Load More ────────────────────────────────────────────────────────────

  const handleLoadMore = useCallback(() => {
    fetchNews(page + 1, false)
  }, [fetchNews, page])

  // ── Category Click ───────────────────────────────────────────────────────

  const handleCategoryClick = useCallback((value: string) => {
    setActiveCategory(value)
  }, [])

  // ── Format Date ──────────────────────────────────────────────────────────

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown date'
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15">
            <Newspaper className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">News Feed</h1>
            <p className="text-xs text-muted-foreground">
              Latest football news and analysis
            </p>
          </div>
        </div>
      </div>

      {/* ── Search Bar ──────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search news..."
          className="h-10 pl-10 glass-card border-border bg-secondary/30 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-primary/30"
        />
      </div>

      {/* ── Category Filter Pills ───────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => handleCategoryClick(cat.value)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-xs font-medium transition-all',
              activeCategory === cat.value
                ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                : 'border border-border bg-secondary/50 text-muted-foreground hover:border-primary/30 hover:text-foreground',
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── News Grid ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && newsItems.length === 0 ? (
          // Loading Skeletons
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card
                key={i}
                className="glass-card border-border overflow-hidden"
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-4 w-12 rounded-full" />
                  </div>
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : newsItems.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-secondary">
              <Newspaper className="size-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-medium text-foreground">No news found</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Try adjusting your search or filters
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Masonry-like Grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {newsItems.map((item, index) => {
                const reactions = parseReactions(item.reactions)
                const sentiment = sentimentConfig[item.sentiment || 'neutral']
                const SentimentIcon = sentiment.icon

                return (
                  <Card
                    key={item.id}
                    onClick={() => setSelectedNews(item)}
                    className={cn(
                      'glass-card glass-card-hover cursor-pointer overflow-hidden transition-all duration-200',
                      item.isBreaking && 'border-red-500/50 border-2',
                    )}
                  >
                    <CardContent className="p-4">
                      {/* Top Row: Category + Breaking Badge */}
                      <div className="mb-3 flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={cn(
                            'h-5 rounded-md px-2 text-[10px] font-semibold',
                            categoryBadgeConfig[item.category] ||
                              categoryBadgeConfig.general,
                          )}
                        >
                          {item.category.charAt(0).toUpperCase() +
                            item.category.slice(1)}
                        </Badge>

                        {item.isBreaking && (
                          <Badge className="h-5 gap-1 rounded-md bg-red-500/20 px-2 text-[10px] font-bold text-red-400 border border-red-500/30">
                            <span className="relative flex size-1.5">
                              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                              <span className="relative inline-flex size-1.5 rounded-full bg-red-500" />
                            </span>
                            BREAKING
                          </Badge>
                        )}

                        {/* Sentiment Indicator */}
                        <div
                          className={cn(
                            'ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                            sentiment.bg,
                            sentiment.color,
                          )}
                        >
                          <SentimentIcon className="size-3" />
                          {item.sentiment || 'neutral'}
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="mb-2 text-sm font-semibold leading-snug text-foreground line-clamp-2">
                        {item.title}
                      </h3>

                      {/* Summary */}
                      {item.summary && (
                        <p className="mb-3 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                          {item.summary}
                        </p>
                      )}

                      {/* Bottom Row: Source, Time, Reactions */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {item.source && (
                            <span className="flex items-center gap-1">
                              <ExternalLink className="size-3" />
                              {item.source}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {getRelativeTime(item.publishedAt)}
                          </span>
                        </div>

                        {/* Reaction Counts */}
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {reactions.like > 0 && (
                            <span className="flex items-center gap-0.5">
                              <ThumbsUp className="size-3" />
                              {reactions.like}
                            </span>
                          )}
                          {reactions.fire > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Flame className="size-3" />
                              {reactions.fire}
                            </span>
                          )}
                          {reactions.think > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Brain className="size-3" />
                              {reactions.think}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Load More */}
            {page < totalPages && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="glass-card border-border text-sm text-muted-foreground hover:text-foreground"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                      Loading...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <ChevronDown className="size-4" />
                      Load More News
                    </span>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── News Detail Modal ───────────────────────────────────────────────── */}
      <Dialog
        open={!!selectedNews}
        onOpenChange={(open) => !open && setSelectedNews(null)}
      >
        <DialogContent className="glass-card max-h-[85vh] overflow-y-auto border-border sm:max-w-2xl">
          {selectedNews && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      'h-5 rounded-md px-2 text-[10px] font-semibold',
                      categoryBadgeConfig[selectedNews.category] ||
                        categoryBadgeConfig.general,
                    )}
                  >
                    {selectedNews.category.charAt(0).toUpperCase() +
                      selectedNews.category.slice(1)}
                  </Badge>

                  {selectedNews.isBreaking && (
                    <Badge className="h-5 gap-1 rounded-md bg-red-500/20 px-2 text-[10px] font-bold text-red-400 border border-red-500/30">
                      <Zap className="size-3" />
                      BREAKING
                    </Badge>
                  )}

                  {/* Sentiment in modal */}
                  {(() => {
                    const s = sentimentConfig[selectedNews.sentiment || 'neutral']
                    const SI = s.icon
                    return (
                      <div
                        className={cn(
                          'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                          s.bg,
                          s.color,
                        )}
                      >
                        <SI className="size-3" />
                        {selectedNews.sentiment || 'neutral'}
                      </div>
                    )
                  })()}
                </div>
                <DialogTitle className="text-lg leading-snug text-foreground">
                  {selectedNews.title}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-3 text-xs text-muted-foreground">
                  {selectedNews.source && (
                    <span className="flex items-center gap-1">
                      <ExternalLink className="size-3" />
                      {selectedNews.source}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {formatDate(selectedNews.publishedAt)}
                  </span>
                </DialogDescription>
              </DialogHeader>

              {/* Content */}
              <div className="mt-2 space-y-4">
                {/* Summary */}
                {selectedNews.summary && (
                  <p className="text-sm font-medium text-foreground/90">
                    {selectedNews.summary}
                  </p>
                )}

                {/* Full Content */}
                {selectedNews.content && (
                  <div className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {selectedNews.content}
                  </div>
                )}

                {/* Related Teams — extracted from news content when available */}
                {selectedNews.content && (() => {
                  const content = selectedNews.title + ' ' + (selectedNews.content || '') + ' ' + (selectedNews.summary || '')
                  const teamPatterns = content.match(/[A-Z][a-z]+\s+(?:FC|United|City|Town|County|Rovers|Athletic|Wanderers|Albion|Hotspur|Forest|Palace|Villa|Ham|Wolves|Burnley|Boro)|[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g)
                  const teams = teamPatterns ? [...new Set(teamPatterns)].slice(0, 4) : []
                  if (teams.length === 0) return null
                  return (
                    <div className="pt-3 border-t border-border/50">
                      <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Related Teams
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {teams.map((team) => (
                          <Badge
                            key={team}
                            variant="outline"
                            className="rounded-md border-primary/30 text-primary text-xs"
                          >
                            {team}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Reaction Buttons */}
                <div className="flex items-center gap-3 pt-3 border-t border-border/50">
                  <span className="text-xs text-muted-foreground mr-1">
                    Reactions:
                  </span>
                  {[
                    {
                      icon: ThumbsUp,
                      label: 'Like',
                      type: 'like' as const,
                      count: parseReactions(selectedNews.reactions).like,
                    },
                    {
                      icon: Flame,
                      label: 'Fire',
                      type: 'fire' as const,
                      count: parseReactions(selectedNews.reactions).fire,
                    },
                    {
                      icon: Brain,
                      label: 'Think',
                      type: 'think' as const,
                      count: parseReactions(selectedNews.reactions).think,
                    },
                  ].map((reaction) => (
                    <button
                      key={reaction.label}
                      onClick={async () => {
                        // Optimistic update
                        const currentReactions = parseReactions(selectedNews.reactions)
                        const updatedReactions = { ...currentReactions, [reaction.type]: currentReactions[reaction.type] + 1 }
                        setSelectedNews({ ...selectedNews, reactions: JSON.stringify(updatedReactions) })
                        try {
                          const res = await fetch(`/api/news/${selectedNews.id}/react`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ type: reaction.type }),
                          })
                          if (!res.ok) throw new Error('Failed')
                        } catch {
                          // Revert optimistic update
                          setSelectedNews({ ...selectedNews, reactions: JSON.stringify(currentReactions) })
                          toast({ title: 'Coming soon', description: 'Reactions will be available soon!' })
                        }
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                    >
                      <reaction.icon className="size-3.5" />
                      {reaction.label}
                      {reaction.count > 0 && (
                        <span className="font-semibold text-foreground">
                          {reaction.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}