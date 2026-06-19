'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'

interface TooltipAnimProps {
  content: string
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export function TooltipAnim({
  content,
  children,
  position = 'top',
}: TooltipAnimProps) {
  const [isVisible, setIsVisible] = useState(false)

  const positionVariants = {
    top: { y: -10 },
    bottom: { y: 10 },
    left: { x: -10 },
    right: { x: 10 },
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}

      <AnimatePresence>
        {isVisible && (
          <motion.div
            className={`
              absolute px-3 py-2 bg-black/90 dark:bg-white/90
              text-white dark:text-black text-xs rounded-lg
              whitespace-nowrap pointer-events-none
              ${position === 'top' ? 'bottom-full mb-2 left-1/2 -translate-x-1/2' : ''}
              ${position === 'bottom' ? 'top-full mt-2 left-1/2 -translate-x-1/2' : ''}
              ${position === 'left' ? 'right-full mr-2 top-1/2 -translate-y-1/2' : ''}
              ${position === 'right' ? 'left-full ml-2 top-1/2 -translate-y-1/2' : ''}
            `}
            initial={{ opacity: 0, ...positionVariants[position] }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, ...positionVariants[position] }}
            transition={{ duration: 0.2 }}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
