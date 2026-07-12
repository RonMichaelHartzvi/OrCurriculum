import { AnimatePresence, motion } from 'framer-motion'
import { useRegisterSW } from 'virtual:pwa-register/react'

// How often the SW checks for a new version while the app is open.
// Cheap network hit, gives near-instant "new version" prompts after a deploy.
const UPDATE_POLL_MS = 60_000

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegistered(reg) {
      if (!reg) return
      setInterval(() => {
        reg.update().catch(() => {})
      }, UPDATE_POLL_MS)
    }
  })

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 260 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 card px-4 py-3 flex items-center gap-3 shadow-petal"
        >
          <span className="text-lg" aria-hidden>
            🌸
          </span>
          <span className="text-sm text-berry font-display font-semibold">
            New version ready
          </span>
          <button
            className="btn-primary text-sm !px-3 !py-1.5"
            onClick={() => updateServiceWorker(true)}
          >
            Reload
          </button>
          <button
            className="btn-ghost text-xs !px-2"
            onClick={() => setNeedRefresh(false)}
          >
            Later
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
