'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useElasticoStore, type NewsItem } from '@/store/use-elastico-store'
import { SectionHeader, DataState, StatusBadge } from '@/components/elastico/primitives'
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
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  ExternalLink,
  ChevronDown,
  Zap,
  RefreshCw,
  AlertCircle,
  Loader2,
  Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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

// ── View States ───────────────────────────────────────────────────────────────

type ViewState = 'loading' | 'empty' | 'error' | 'success'

// ── News View Component ───────────────────────────────────────────────────────

export default function NewsView() {
  const setNews = useElasticoStore(s => s.setNews)

  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [viewState, setViewState] = useState<ViewState>('loading')
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null)
  const [isAppending, setIsAppending] = useState(false)

  // ── Fetch News ───────────────────────────────────────────────────────────

  const fetchNews = useCallback(
    async (pageNum: number, reset = false) => {
      if (reset) {
        setViewState('loading')
      } else {
        setIsAppending(true)
      }
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
          setViewState(items.length === 0 ? 'empty' : 'success')
        } else {
          setNewsItems((prev) => [...prev, ...items])
        }
        setNews(items)
        setTotalPages(data.pagination?.totalPages || 1)
        setPage(pageNum)
      } catch {
        if (reset) setViewState('error')
      } finally {
        setIsAppending(false)
      }
    },
    [activeCategory, search, setNews],
  )

  // ── Unified fetch: handles category + search changes ─────────────────
  // Merged into a single effect to avoid race conditions between
  // category-change and debounced-search effects.
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ page: '1', limit: '12' })
      if (activeCategory) params.set('category', activeCategory)
      if (search.trim()) params.set('search', search.trim())
      setViewState('loading')
      try {
        const res = await fetch(`/api/news?${params}`)
        if (cancelled) return
        if (!res.ok) throw new Error()
        const data = await res.json()
        const items: NewsItem[] = data.news || []
        setNewsItems(items)
        setTotalPages(data.pagination?.totalPages || 1)
        setPage(1)
        setViewState(items.length === 0 ? 'empty' : 'success')
        if (data.news) setNews(data.news)
      } catch {
        if (!cancelled) setViewState('error')
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [activeCategory, search, setNews])

  // ── Load More ────────────────────────────────────────────────────────────

  const handleLoadMore = useCallback(() => {
    fetchNews(page + 1, false)
  }, [fetchNews, page])

  const handleCategoryClick = useCallback((value: string) => {
    setActiveCategory(value)
  }, [])

  const handleRefresh = useCallback(() => {
    fetchNews(1, true)
  }, [fetchNews])

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
          <p className="text-xs text-muted-foreground">
            Latest football news and analysis
          </p>
        </div>
      </div>

      {/* ── Search Bar ──────────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search news..."
            className="h-10 pl-10 rounded-lg border border-border bg-card border-border bg-secondary/30 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-primary/30"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0 border-border bg-secondary/50 hover:bg-accent"
          onClick={handleRefresh}
          disabled={viewState === 'loading'}
        >
          <RefreshCw className={cn('size-4', viewState === 'loading' && 'animate-spin')} />
        </Button>
      </div>

      {/* ── Category Filter Pills ───────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => handleCategoryClick(cat.value)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
              activeCategory === cat.value
                ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                : 'border border-border bg-secondary/50 text-muted-foreground hover:border-primary/30 hover:text-foreground',
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── News Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {/* LOADING STATE */}
        {viewState === 'loading' && newsItems.length === 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="rounded-lg border border-border bg-card rounded-xl border-border overflow-hidden">
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
        )}

        {/* ERROR STATE */}
        {viewState === 'error' && newsItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="size-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="size-8 text-red-400" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-medium text-foreground">Failed to load news</h3>
              <p className="mt-1 text-xs text-muted-foreground">Check your connection and try again.</p>
            </div>
            <Button variant="outline" size="sm" className="mt-2 border-border text-xs" onClick={handleRefresh}>
              <RefreshCw className="size-3 mr-1.5" />
              Retry
            </Button>
          </div>
        )}

        {/* EMPTY STATE */}
        {viewState === 'empty' && newsItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="size-16 rounded-full bg-secondary flex items-center justify-center">
              <Inbox className="size-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-medium text-foreground">No news found</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Try adjusting your search or filters
              </p>
            </div>
          </div>
        )}

        {/* SUCCESS STATE */}
        {(viewState === 'success' || newsItems.length > 0) && (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {newsItems.map((item) => {
                const sentiment = sentimentConfig[item.sentiment || 'neutral']
                const SentimentIcon = sentiment.icon

                return (
                  <Card
                    key={item.id}
                    onClick={() => setSelectedNews(item)}
                    className={cn(
                      'rounded-lg border border-border bg-card rounded-xl cursor-pointer overflow-hidden transition-colors duration-200',
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
                            categoryBadgeConfig[item.category] || categoryBadgeConfig.general,
                          )}
                        >
                          {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
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

                      {/* Bottom Row: Source, Time */}
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
                  disabled={isAppending}
                  className="rounded-lg border border-border bg-card border-border text-sm text-muted-foreground hover:text-foreground"
                >
                  {isAppending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
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
        <DialogContent className="rounded-lg border border-border bg-card max-h-[85vh] overflow-y-auto border-border sm:max-w-2xl">
          {selectedNews && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      'h-5 rounded-md px-2 text-[10px] font-semibold',
                      categoryBadgeConfig[selectedNews.category] || categoryBadgeConfig.general,
                    )}
                  >
                    {selectedNews.category.charAt(0).toUpperCase() + selectedNews.category.slice(1)}
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
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
