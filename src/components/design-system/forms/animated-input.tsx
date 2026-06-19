'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'

interface AnimatedInputProps {
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  error?: string
  className?: string
}

export function AnimatedInput({
  label,
  type = 'text',
  value,
  onChange,
  error,
  className = '',
}: AnimatedInputProps) {
  const [isFocused, setIsFocused] = useState(false)

  return (
    <div className={`relative ${className}`}>
      <motion.label
        className="absolute left-4 text-sm text-muted-foreground pointer-events-none"
        animate={{
          y: isFocused || value ? -24 : 0,
          scale: isFocused || value ? 0.85 : 1,
        }}
        transition={{ duration: 0.2 }}
      >
        {label}
      </motion.label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={`
          w-full px-4 py-3 mt-2
          bg-white/5 dark:bg-black/20
          border-2 border-white/10
          rounded-lg
          focus:border-blue-500 focus:outline-none
          transition-all duration-200
          ${error ? 'border-red-500' : ''}
        `}
      />
      {error && (
        <motion.p
          className="mt-1 text-xs text-red-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {error}
        </motion.p>
      )}
    </div>
  )
}
