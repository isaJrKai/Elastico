'use client'

import { Users } from 'lucide-react'

export function SocialView() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center w-full">
      <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
        <Users className="size-7 text-primary" />
      </div>
      <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">
        Social features including community discussions, prediction sharing, user profiles, and trending topics are under development.
      </p>
      <p className="text-xs text-muted-foreground/60 mt-3">
        Follow live match analysis and predictions in the meantime.
      </p>
    </div>
  )
}

export default SocialView
