'use client'
import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface LiveCounterProps {
  value: number
  duration?: number
  prefix?: string
  suffix?: string
  decimals?: number
}

export function LiveCounter({
  value,
  duration = 2,
  prefix = '',
  suffix = '',
  decimals = 0,
}: LiveCounterProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return

    let animationId: number
    let currentValue = 0
    const increment = value / (duration * 60)

    const animate = () => {
      currentValue += increment
      if (currentValue < value) {
        ref.current!.textContent = `${prefix}${currentValue.toFixed(decimals)}${suffix}`
        animationId = requestAnimationFrame(animate)
      } else {
        ref.current!.textContent = `${prefix}${value.toFixed(decimals)}${suffix}`
      }
    }

    animate()

    return () => cancelAnimationFrame(animationId)
  }, [value, duration, prefix, suffix, decimals])

  return (
    <motion.div
      ref={ref}
      className="text-2xl font-bold"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {prefix}0{suffix}
    </motion.div>
  )
}
