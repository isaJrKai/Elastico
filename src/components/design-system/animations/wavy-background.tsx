'use client'
import { useEffect, useRef } from 'react'

interface WavyBackgroundProps {
  children: React.ReactNode
  color?: string
  waveCount?: number
  amplitude?: number
}

export function WavyBackground({
  children,
  color = 'rgba(59, 130, 246, 0.1)',
  waveCount = 3,
  amplitude = 20,
}: WavyBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    let animationId: number
    let time = 0

    const drawWaves = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = color

      for (let w = 0; w < waveCount; w++) {
        ctx.beginPath()
        ctx.moveTo(0, canvas.height / 2)

        for (let x = 0; x <= canvas.width; x += 5) {
          const y =
            canvas.height / 2 +
            Math.sin((x + time + w * Math.PI / waveCount) / 80) * amplitude
          ctx.lineTo(x, y)
        }

        ctx.lineTo(canvas.width, canvas.height)
        ctx.lineTo(0, canvas.height)
        ctx.fill()
      }

      time += 2
      animationId = requestAnimationFrame(drawWaves)
    }

    drawWaves()

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
    }
  }, [color, waveCount, amplitude])

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
