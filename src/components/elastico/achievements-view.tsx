'use client'

import { Award } from 'lucide-react'

export function AchievementsView() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center w-full">
      <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
        <Award className="size-7 text-primary" />
      </div>
      <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">
        Achievement tracking is being developed. Make predictions and follow matches to build your track record — achievements will be unlocked based on your real activity.
      </p>
    </div>
  )
}

export default AchievementsView
