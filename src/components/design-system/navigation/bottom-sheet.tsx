'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useRef, useEffect } from 'react'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  snapPoints?: number[]
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  snapPoints = [0.5, 1],
}: BottomSheetProps) {
  const ref = useRef(null)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Sheet */}
          <motion.div
            ref={ref}
            className="fixed bottom-0 left-0 right-0 rounded-t-3xl bg-white dark:bg-black max-h-[90vh] shadow-2xl z-50"
            initial={{ y: 500 }}
            animate={{ y: 0 }}
            exit={{ y: 500 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            drag="y"
            dragElastic={0.2}
            onDragEnd={(event, info) => {
              if (info.offset.y > 100) {
                onClose()
              }
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-4 pb-2">
              <div className="w-12 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-50px)]">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
