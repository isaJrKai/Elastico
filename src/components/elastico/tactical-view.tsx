'use client'

import { Target } from 'lucide-react'

export function TacticalView() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center w-full">
      <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
        <Target className="size-7 text-primary" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Tactical Analysis Coming Soon</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">
        Formation analysis, tactical overlays, and match visualization tools are under development. Use the Prediction Engine for mathematical match analysis in the meantime.
      </p>
    </div>
  )
}

export default TacticalView
