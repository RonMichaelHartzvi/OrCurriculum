import { AnimatePresence, motion } from 'framer-motion'
import { type ReactNode, useEffect } from 'react'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'md' | 'lg'
}

const SIZE_CLASS: Record<NonNullable<DialogProps['size']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-2xl sm:min-h-[75vh]'
}

export function Dialog({ open, onClose, title, children, size = 'md' }: DialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 overflow-y-auto bg-berry/25 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="min-h-full flex items-end sm:items-center justify-center p-3 sm:p-6">
            <motion.div
              className={`card w-full ${SIZE_CLASS[size]} p-6`}
              initial={{ y: 40, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 30, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', damping: 22, stiffness: 260 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-display font-bold text-deepRose">{title}</h2>
                <button
                  className="btn-ghost text-2xl leading-none"
                  onClick={onClose}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              {children}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
