'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useElasticoStore, type ChatMessage, type Match } from '@/store/use-elastico-store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Send,
  Trash2,
  Copy,
  Bot,
  User,
  Loader2,
  Sparkles,
  MessageSquare,
  ChevronDown,
  Cpu,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

// ── Model Options ──────────────────────────────────────────────────────────────

const MODEL_OPTIONS = [
  { value: 'pro', label: 'ELASTICO Pro (Best Quality)', icon: Cpu },
  { value: 'fast', label: 'ELASTICO Fast (Low Latency)', icon: Cpu },
  { value: 'local', label: 'ELASTICO Local (Offline Mode)', icon: WifiOff },
] as const

type ModelKey = (typeof MODEL_OPTIONS)[number]['value']

// ── Suggested Prompts ──────────────────────────────────────────────────────────

const suggestedPrompts = [
  'Analyze Brazil vs Argentina',
  'Who will win the World Cup?',
  'Best performing teams',
  'Predictions for upcoming matches',
]

// ── Markdown-like Parser ──────────────────────────────────────────────────────

function parseMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let inList = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Close list if we were in one and current line is not a list item
    if (inList && !line.startsWith('- ') && !line.match(/^\d+\.\s/)) {
      elements.push(<ul key={`list-end-${i}`} className="ml-4 mb-2 list-disc space-y-0.5" />)
      inList = false
    }

    // Headers (## style)
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={i} className="mb-2 mt-3 text-sm font-semibold text-foreground">
          {line.slice(3)}
        </h3>,
      )
      continue
    }

    // Bold text: **text**
    const renderInline = (str: string) => {
      const parts = str.split(/(\*\*[^*]+\*\*)/g)
      return parts.map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={j} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </strong>
          )
        }
        return <React.Fragment key={j}>{part}</React.Fragment>
      })
    }

    // List items
    if (line.startsWith('- ')) {
      if (!inList) {
        inList = true
      }
      elements.push(
        <li key={i} className="ml-4 list-disc text-sm text-muted-foreground">
          {renderInline(line.slice(2))}
        </li>,
      )
      continue
    }

    // Numbered list
    const numMatch = line.match(/^(\d+)\.\s(.*)$/)
    if (numMatch) {
      if (!inList) {
        inList = true
      }
      elements.push(
        <li key={i} className="ml-4 list-decimal text-sm text-muted-foreground">
          {renderInline(numMatch[2])}
        </li>,
      )
      continue
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />)
      continue
    }

    // Regular text
    elements.push(
      <p key={i} className="text-sm leading-relaxed text-muted-foreground">
        {renderInline(line)}
      </p>,
    )
  }

  if (inList) {
    elements.push(<ul key="list-final" className="ml-4 mb-2 list-disc space-y-0.5" />)
  }

  return elements
}

// ── Chat View Component ───────────────────────────────────────────────────────

export function ChatView() {
  const chatMessages = useElasticoStore(s => s.chatMessages)
  const addChatMessage = useElasticoStore(s => s.addChatMessage)
  const updateChatMessage = useElasticoStore(s => s.updateChatMessage)
  const clearChat = useElasticoStore(s => s.clearChat)
  const matches = useElasticoStore(s => s.matches)
  const user = useElasticoStore(s => s.user)
  const token = useElasticoStore(s => s.token)

  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedMatchId, setSelectedMatchId] = useState<string>('none')
  const [selectedModel, setSelectedModel] = useState<ModelKey>('pro')
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom on new message
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [chatMessages, isLoading, scrollToBottom])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // ── Send Message (with streaming support) ─────────────────────────────────

  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    }

    addChatMessage(userMsg)
    setInput('')
    setIsLoading(true)

    const isLocal = selectedModel === 'local'

    // Create placeholder AI message for streaming
    const aiMsgId = crypto.randomUUID()
    const aiMsg: ChatMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    addChatMessage(aiMsg)
    setStreamingMsgId(aiMsgId)

    try {
      const body: Record<string, unknown> = {
        message: trimmed,
        model: selectedModel,
        stream: !isLocal, // Only stream for NVIDIA models
      }

      if (selectedMatchId && selectedMatchId !== 'none') {
        body.matchId = selectedMatchId
        const match = matches.find((m) => m.id === selectedMatchId)
        if (match?.homeTeam && match?.awayTeam) {
          body.context = `${match.homeTeam.name} vs ${match.awayTeam.name}`
        }
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error('Failed to get response')

      // ── Handle streaming response ─────────────────────────────────────────
      if (!isLocal && res.headers.get('content-type')?.includes('text/plain')) {
        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let accumulated = ''
        let headerParsed = false

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            // First line is the JSON header with metadata
            if (!headerParsed && line.startsWith('{')) {
              headerParsed = true
              continue
            }

            // Empty line signals end of stream
            if (line.trim() === '') continue

            // Append token to content
            accumulated += line
            updateChatMessage(aiMsgId, { content: accumulated })
          }
        }

        if (!accumulated) {
          updateChatMessage(aiMsgId, { content: 'No response received. Please try again.' })
        }
      } else {
        // ── Handle JSON response (mock / non-streaming) ─────────────────────
        const data = await res.json()
        updateChatMessage(aiMsgId, { content: data.response || 'Sorry, I could not generate a response.' })
      }
    } catch {
      updateChatMessage(streamingMsgId || aiMsgId, { content: 'Sorry, something went wrong. Please try again.' })
      toast({
        title: 'Error',
        description: 'Failed to get AI response.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
      setStreamingMsgId(null)
    }
  }, [input, isLoading, selectedMatchId, selectedModel, matches, token, addChatMessage, updateChatMessage])

  // ── Clear Chat ───────────────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    clearChat()
    toast({
      title: 'Chat cleared',
      description: 'All messages have been removed.',
    })
  }, [clearChat])

  // ── Export Chat ──────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    if (chatMessages.length === 0) {
      toast({
        title: 'Nothing to export',
        description: 'Chat is empty.',
      })
      return
    }

    const text = chatMessages
      .map((msg) => {
        const time = new Date(msg.timestamp).toLocaleTimeString()
        const role = msg.role === 'user' ? 'You' : 'AI'
        return `[${time}] ${role}: ${msg.content}`
      })
      .join('\n\n')

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        toast({
          title: 'Copied to clipboard',
          description: 'Chat exported successfully.',
        })
      })
    } else {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
      toast({
        title: 'Copied to clipboard',
        description: 'Chat exported successfully.',
      })
    }
  }, [chatMessages])

  // ── Suggestion Click ─────────────────────────────────────────────────────

  const handleSuggestionClick = useCallback((prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }, [])

  // ── Key Down Handler ─────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  // ── Format Time ──────────────────────────────────────────────────────────

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // ── Determine active model info ──────────────────────────────────────────

  const activeModel = MODEL_OPTIONS.find((m) => m.value === selectedModel) || MODEL_OPTIONS[0]
  const isLocal = selectedModel === 'local'

  return (
    <div className="flex h-full flex-col gap-4">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15">
            <Bot className="size-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground">AI Chat</h1>
              {/* AI Provider Badge */}
              <Badge
                variant="outline"
                className="gap-1.5 border-primary/30 bg-primary/5 px-2 py-0 text-[10px] font-medium text-primary"
              >
                <Cpu className="size-3" />
                Powered by Multi-Provider AI Gateway
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {isLocal ? 'Offline mode — local analysis engine' : 'Real-time LLM football analysis'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Model Selector */}
          <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as ModelKey)}>
            <SelectTrigger className="h-9 w-[230px] text-xs glass-card border-border">
              <div className="flex items-center gap-1.5 truncate">
                {isLocal ? (
                  <WifiOff className="size-3 shrink-0 text-muted-foreground" />
                ) : (
                  <Wifi className="size-3 shrink-0 text-primary" />
                )}
                <SelectValue placeholder="Select AI model" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {MODEL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex items-center gap-2">
                    <opt.icon className={cn('size-3.5', isLocal ? 'text-muted-foreground' : 'text-primary')} />
                    <span>{opt.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Context Selector */}
          <Select value={selectedMatchId} onValueChange={setSelectedMatchId}>
            <SelectTrigger className="h-9 w-[200px] text-xs glass-card border-border">
              <SelectValue placeholder="Select match context" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No match context</SelectItem>
              {matches.map((match) => (
                <SelectItem key={match.id} value={match.id}>
                  {match.homeTeam?.name || 'TBD'} vs{' '}
                  {match.awayTeam?.name || 'TBD'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            className="size-9 text-muted-foreground hover:text-foreground"
            onClick={handleExport}
            aria-label="Export chat"
          >
            <Copy className="size-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-9 text-muted-foreground hover:text-destructive"
            onClick={handleClear}
            aria-label="Clear chat"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* ── Chat Messages Area ──────────────────────────────────────────────── */}
      <Card className="glass-card flex flex-1 overflow-hidden border-border">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {chatMessages.length === 0 && !isLoading && (
            <div className="flex h-full flex-col items-center justify-center gap-6 py-12">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
                <Sparkles className="size-8 text-primary" />
              </div>
              <div className="text-center">
                <h2 className="mb-1 text-lg font-semibold text-foreground">
                  ELASTICO AI Assistant
                </h2>
                <p className="mb-2 max-w-sm text-sm text-muted-foreground">
                  Ask me about match predictions, team analysis, tactics, or
                  player stats. Select a match for context-aware analysis.
                </p>
                <div className="flex items-center justify-center gap-1.5">
                  <Cpu className="size-3 text-primary/60" />
                  <span className="text-[11px] text-primary/60">
                    Using {activeModel.label}
                  </span>
                </div>
              </div>

              {/* Suggested Prompts */}
              <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSuggestionClick(prompt)}
                    className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2.5 text-left text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                  >
                    <MessageSquare className="size-3.5 shrink-0 text-primary/60" />
                    <span className="truncate">{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {chatMessages.map((msg) => {
            const isStreaming = msg.id === streamingMsgId
            return (
              <div
                key={msg.id}
                className={cn(
                  'flex animate-fade-in-up gap-3',
                  msg.role === 'user' ? 'flex-row-reverse' : 'flex-row',
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-primary',
                  )}
                >
                  {msg.role === 'user' ? (
                    <User className="size-4" />
                  ) : (
                    <Bot className="size-4" />
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-secondary text-secondary-foreground rounded-bl-md',
                  )}
                >
                  {/* Content */}
                  <div className="space-y-1">
                    {msg.role === 'assistant' ? (
                      msg.content ? (
                        parseMarkdown(msg.content)
                      ) : isStreaming ? (
                        <div className="flex items-center gap-1.5 py-1">
                          <span className="size-2 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
                          <span className="size-2 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
                          <span className="size-2 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]" />
                        </div>
                      ) : null
                    ) : (
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    )}
                  </div>

                  {/* Timestamp */}
                  {msg.content && (
                    <p
                      className={cn(
                        'mt-2 text-[10px]',
                        msg.role === 'user'
                          ? 'text-primary-foreground/60'
                          : 'text-muted-foreground/60',
                      )}
                    >
                      {formatTime(msg.timestamp)}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* ── Message Input ───────────────────────────────────────────────────── */}
      <Card className="glass-card border-border">
        <CardContent className="p-3">
          {chatMessages.length === 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSuggestionClick(prompt)}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                >
                  <ChevronDown className="size-3 text-primary/60" />
                  {prompt}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about match predictions, tactics, player stats..."
              disabled={isLoading}
              className="h-10 flex-1 border-border bg-secondary/50 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-primary/30"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              <span className="sr-only">Send message</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}