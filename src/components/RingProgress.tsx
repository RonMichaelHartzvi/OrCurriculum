import { motion } from 'framer-motion'

interface RingProgressProps {
  value: number
  target: number
  color?: string
  size?: number
  strokeWidth?: number
  label?: string
  sublabel?: string
}

export function RingProgress({
  value,
  target,
  color = '#F9A8D4',
  size = 140,
  strokeWidth = 12,
  label,
  sublabel
}: RingProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = target > 0 ? Math.min(value / target, 1) : 0
  const offset = circumference * (1 - ratio)
  const pct = Math.round(ratio * 100)
  const done = target > 0 && value >= target

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.9" />
            <stop offset="100%" stopColor="#DB2777" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#FCE7F3"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#grad-${color.replace('#', '')})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ type: 'spring', damping: 22, stiffness: 120 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
        <div className="text-2xl font-display font-bold text-deepRose">
          {done ? '🎉' : `${pct}%`}
        </div>
        {label && <div className="text-xs font-semibold text-berry mt-0.5">{label}</div>}
        {sublabel && <div className="text-[10px] text-berry/60 mt-0.5">{sublabel}</div>}
      </div>
    </div>
  )
}
