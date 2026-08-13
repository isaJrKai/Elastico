/*
 * SectionHeader — Small uppercase label + optional right action slot.
 * Used at the top of every data section in ELASTICO.
 */

'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export interface SectionHeaderProps {
  label: string
  /** Optional right-side action (button, link, etc.) */
  action?: React.ReactNode
  className?: string
}

export function SectionHeader({ label, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {action && <div>{action}</div>}
    </div>
  )
}

export default SectionHeader
