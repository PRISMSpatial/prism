import { clsx } from 'clsx'

interface ChipProps {
  variant?: string
  dot?: boolean
  children: React.ReactNode
  className?: string
}

export function Chip({ variant, dot = true, children, className }: ChipProps) {
  return (
    <span className={clsx('chip', variant, className)}>
      {dot && <i />}
      {children}
    </span>
  )
}
