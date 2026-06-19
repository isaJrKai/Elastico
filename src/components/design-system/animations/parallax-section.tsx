'use client'
import { useScroll, useTransform, motion } from 'framer-motion'
import { useRef } from 'react'

interface ParallaxSectionProps {
  children: React.ReactNode
  speed?: number // 0-1, lower = more parallax
  className?: string
}

export function ParallaxSection({
  children,
  speed = 0.5,
  className = '',
}: ParallaxSectionProps) {
  const ref = useRef(null)
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, (value) => value * speed)

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  )
}

// Depth-based parallax for images
export function ParallaxImage({
  src,
  alt,
  speed = 0.3,
  className = '',
}: {
  src: string
  alt: string
  speed?: number
  className?: string
}) {
  const ref = useRef(null)
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, (value) => value * speed)

  return (
    <motion.div
      ref={ref}
      style={{ y }}
      className={`overflow-hidden ${className}`}
    >
      <img src={src} alt={alt} className="w-full h-full object-cover" />
    </motion.div>
  )
}
