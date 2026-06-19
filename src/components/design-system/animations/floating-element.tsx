'use client'
import { motion } from 'framer-motion'

interface FloatingElementProps {
  children: React.ReactNode
  duration?: number
  delay?: number
  distance?: number
  className?: string
}

export function FloatingElement({
  children,
  duration = 4,
  delay = 0,
  distance = 20,
  className = '',
}: FloatingElementProps) {
  return (
    <motion.div
      className={className}
      animate={{
        y: [0, -distance, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  )
}

// Rotating floating element
export function FloatingRotating({
  children,
  duration = 6,
  className = '',
}: {
  children: React.ReactNode
  duration?: number
  className?: string
}) {
  return (
    <motion.div
      className={className}
      animate={{
        rotate: 360,
        y: [0, -15, 0],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      {children}
    </motion.div>
  )
}
