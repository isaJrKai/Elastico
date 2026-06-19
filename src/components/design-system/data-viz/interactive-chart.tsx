'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface InteractiveChartProps {
  data: any[]
  dataKey: string
  xAxisKey: string
  color?: string
  height?: number
}

export function InteractiveChart({
  data,
  dataKey,
  xAxisKey,
  color = '#3b82f6',
  height = 300,
}: InteractiveChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <motion.div
      className="w-full rounded-lg bg-white/5 dark:bg-black/20 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid stroke="#ffffff10" />
          <XAxis dataKey={xAxisKey} stroke="#ffffff40" />
          <YAxis stroke="#ffffff40" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(0,0,0,0.8)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
            }}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            dot={(props) => {
              const { cx, cy, payload, index } = props
              const isHovered = hoveredIndex === index

              return (
                <motion.circle
                  key={index}
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 8 : 4}
                  fill={color}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  animate={{ r: isHovered ? 8 : 4 }}
                  transition={{ duration: 0.2 }}
                />
              )
            }}
            isAnimationActive
            animationDuration={800}
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  )
}
