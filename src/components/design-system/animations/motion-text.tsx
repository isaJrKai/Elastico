'use client'
import { motion } from 'framer-motion'

interface MotionTextProps {
  children: string
  className?: string
  delay?: number
  duration?: number
}

export function MotionText({
  children,
  className = '',
  delay = 0,
  duration = 0.5,
}: MotionTextProps) {
  const variants = {
    hidden: { opacity: 0 },
    visible: (i: number) => ({
      opacity: 1,
      transition: {
        delay: delay + i * 0.03,
        duration,
      },
    }),
  }

  return (
    <motion.span className={className}>
      {children.split('').map((char, i) => (
        <motion.span
          key={i}
          initial="hidden"
          animate="visible"
          variants={variants}
          custom={i}
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  )
}

// Word-by-word animation
export function MotionTextWords({
  children,
  className = '',
  delay = 0,
  duration = 0.5,
}: MotionTextProps) {
  const words = children.split(' ')

  const variants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: delay + i * 0.1,
        duration,
      },
    }),
  }

  return (
    <motion.div className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial="hidden"
          animate="visible"
          variants={variants}
          custom={i}
          className="inline-block mr-2"
        >
          {word}
        </motion.span>
      ))}
    </motion.div>
  )
}
