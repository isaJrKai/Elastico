'use client'
import { useRef } from 'react'
import { motion } from 'framer-motion'

interface SwipeCardProps {
  children: React.ReactNode
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  className?: string
}

export function SwipeCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  className = '',
}: SwipeCardProps) {
  const ref = useRef(null)

  return (
    <motion.div
      ref={ref}
      className={`cursor-grab active:cursor-grabbing rounded-xl overflow-hidden ${className}`}
      drag="x"
      dragElastic={0.2}
      onDragEnd={(event, info) => {
        if (info.offset.x > 100) {
          onSwipeRight?.()
        } else if (info.offset.x < -100) {
          onSwipeLeft?.()
        }
      }}
      whileDrag={{ scale: 0.95 }}
    >
      {children}
    </motion.div>
  )
}
