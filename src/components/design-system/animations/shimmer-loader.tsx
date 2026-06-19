'use client'
import { motion } from 'framer-motion'

interface ShimmerLoaderProps {
  width?: number
  height?: number
  borderRadius?: number
  count?: number
}

export function ShimmerLoader({
  width = 100,
  height = 20,
  borderRadius = 8,
  count = 3,
}: ShimmerLoaderProps) {
  return (
    <div className="space-y-4">
      {[...Array(count)].map((_, i) => (
        <motion.div
          key={i}
          className="relative overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-800"
          style={{
            width: `${width}%`,
            height: `${height}px`,
            borderRadius: `${borderRadius}px`,
          }}
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent"
            animate={{
              x: [-100, 100],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'linear',
            }}
            style={{
              width: '100%',
              transform: 'translateX(-100%)',
            }}
          />
        </motion.div>
      ))}
    </div>
  )
}

// Card skeleton loader
export function SkeletonCardLoader({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 p-4 space-y-3">
          <ShimmerLoader width={100} height={200} count={1} />
          <ShimmerLoader width={80} height={16} count={1} />
          <ShimmerLoader width={60} height={12} count={1} />
        </div>
      ))}
    </div>
  )
}
