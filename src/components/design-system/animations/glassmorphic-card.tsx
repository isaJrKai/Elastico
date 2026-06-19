'use client'
import { motion, useMousePosition } from 'framer-motion'
import { useRef } from 'react'

interface GlassmorphCardProps {
  children: React.ReactNode
  className?: string
  glowColor?: string
  interactive?: boolean
}

export function GlassmorphCard({
  children,
  className = '',
  glowColor = 'from-blue-500/0 to-purple-500/0',
  interactive = true,
}: GlassmorphCardProps) {
  const ref = useRef(null)

  return (
    <motion.div
      ref={ref}
      className={`
        relative rounded-2xl p-6
        bg-white/10 dark:bg-white/5
        backdrop-blur-xl
        border border-white/20 dark:border-white/10
        shadow-xl
        transition-all duration-300 ease-out
        hover:bg-white/15 dark:hover:bg-white/8
        hover:border-white/30 dark:hover:border-white/15
        hover:shadow-2xl
        ${className}
      `}
      whileHover={interactive ? { y: -5, scale: 1.02 } : {}}
    >
      <div
        className={`
          absolute inset-0 rounded-2xl
          bg-gradient-to-br ${glowColor}
          opacity-0 hover:opacity-100
          transition-opacity duration-300
          pointer-events-none
        `}
      />
      <div className="relative z-10">{children}</div>
    </motion.div>
  )
}

// Glassmorphic button
export function GlassmorphButton({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <motion.button
      onClick={onClick}
      className={`
        px-6 py-3 rounded-xl
        bg-white/10 dark:bg-white/5
        backdrop-blur-md
        border border-white/20 dark:border-white/10
        text-white font-medium
        transition-all duration-200
        hover:bg-white/20 dark:hover:bg-white/10
        hover:border-white/30 dark:hover:border-white/15
        active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {children}
    </motion.button>
  )
}
