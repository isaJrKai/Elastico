'use client'
import { motion } from 'framer-motion'

interface GradientShiftProps {
  colors: string[]
  duration?: number
  className?: string
  children?: React.ReactNode
}

export function GradientShift({
  colors,
  duration = 5,
  className = '',
  children,
}: GradientShiftProps) {
  const gradients = [
    `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
    `linear-gradient(135deg, ${colors[1]}, ${colors[2] || colors[0]})`,
    `linear-gradient(135deg, ${colors[2] || colors[0]}, ${colors[0]})`,
  ]

  return (
    <motion.div
      className={className}
      animate={{
        backgroundImage: gradients,
      }}
      transition={{
        duration,
        repeat: Infinity,
        repeatType: 'mirror',
      }}
    >
      {children}
    </motion.div>
  )
}
