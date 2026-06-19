'use client'
import { motion } from 'framer-motion'

interface PulseRingProps {
  active?: boolean
  color?: string
  size?: number
  duration?: number
  children?: React.ReactNode
}

export function PulseRing({
  active = true,
  color = 'bg-blue-500',
  size = 12,
  duration = 2,
  children,
}: PulseRingProps) {
  if (!active) {
    return (
      <div className={`w-${size} h-${size} ${color} rounded-full flex items-center justify-center`}>
        {children}
      </div>
    )
  }

  return (
    <div className="relative inline-flex">
      {/* Pulsing rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className={`absolute inset-0 ${color} rounded-full`}
          animate={{
            scale: [1, 2.5],
            opacity: [1, 0],
          }}
          transition={{
            duration,
            delay: i * (duration / 3),
            repeat: Infinity,
          }}
        />
      ))}

      {/* Center dot */}
      <div
        className={`relative w-${size} h-${size} ${color} rounded-full flex items-center justify-center`}
      >
        {children}
      </div>
    </div>
  )
}
