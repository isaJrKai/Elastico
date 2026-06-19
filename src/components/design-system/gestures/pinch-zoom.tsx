'use client'
import { useRef, useState } from 'react'
import { motion } from 'framer-motion'

interface PinchZoomProps {
  src: string
  alt: string
  maxScale?: number
}

export function PinchZoom({ src, alt, maxScale = 3 }: PinchZoomProps) {
  const ref = useRef(null)
  const [scale, setScale] = useState(1)

  return (
    <motion.div
      ref={ref}
      className="overflow-hidden rounded-lg"
      whileHover={{ scale: 1.05 }}
    >
      <motion.img
        src={src}
        alt={alt}
        drag
        dragElastic={0.2}
        animate={{ scale }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onWheel={(e) => {
          e.preventDefault()
          const newScale = Math.min(maxScale, Math.max(1, scale + (e.deltaY > 0 ? -0.1 : 0.1)))
          setScale(newScale)
        }}
        className="w-full h-auto cursor-grab active:cursor-grabbing"
      />
    </motion.div>
  )
}
