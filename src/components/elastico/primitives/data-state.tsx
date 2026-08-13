/*
 * DataState — Unified loading / empty / error states.
 * Every data-dependent section in ELASTICO must use this.
 */

'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react'

// ── Props ──────────────────────────────────────────────────────────────

interface DataStateBaseProps {
  type: 'loading' | 'empty' | 'error'
  className?: string
}

export interface DataStateLoadingProps extends DataStateBaseProps {
  type: 'loading'
  /** Number of skeleton lines (for text content) */
  lines?: number
}

export interface DataStateEmptyProps extends DataStateBaseProps {
  type: 'empty'
  message?: string
  /** Optional action button */
  actionLabel?: string
  actionOnClick?: () => void
}

export interface DataStateErrorProps extends DataStateBaseProps {
  type: 'error'
  message?: string
  /** Retry callback */
  onRetry?: () => void
}

export type DataStateProps = DataStateLoadingProps | DataStateEmptyProps | DataStateErrorProps

// ── Component ──────────────────────────────────────────────────────────

export function DataState(props: DataStateProps) {
  if (props.type === 'loading') {
    return (
      <div className={cn('flex flex-col gap-3 animate-pulse', props.className)}>
        {Array.from({ length: props.lines || 3 }).map((_, i) => (
          <div
            key={i}
            className="h-4 rounded-md bg-muted/50"
            style={{ width: `${85 - i * 15}%` }}
          />
        ))}
      </div>
    )
  }

  if (props.type === 'empty') {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 text-center', props.className)}>
        <div className="size-12 rounded-full bg-muted/40 flex items-center justify-center mb-3">
          <Inbox className="size-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          {props.message || 'No data available'}
        </p>
        {props.actionLabel && props.actionOnClick && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3 h-8 text-xs border-border"
            onClick={props.actionOnClick}
          >
            {props.actionLabel}
          </Button>
        )}
      </div>
    )
  }

  // Error
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', props.className)}>
      <div className="size-12 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
        <AlertCircle className="size-5 text-red-400" />
      </div>
      <p className="text-sm text-muted-foreground">
        {props.message || 'Something went wrong'}
      </p>
      {props.onRetry && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 h-8 text-xs border-border"
          onClick={props.onRetry}
        >
          <RefreshCw className="size-3 mr-1.5" />
          Retry
        </Button>
      )}
    </div>
  )
}

export default DataState
