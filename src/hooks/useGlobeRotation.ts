import { useEffect, useRef, useState } from 'react'

export function useGlobeRotation(enabled: boolean, speed = 0.12) {
  const [rot, setRot] = useState(0)
  const rafRef = useRef<number>()
  const lastRef = useRef<number>()

  useEffect(() => {
    if (!enabled) return
    const tick = (ts: number) => {
      if (lastRef.current != null) {
        const dt = ts - lastRef.current
        setRot(r => r + speed * (dt / 16.67))
      }
      lastRef.current = ts
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [enabled, speed])

  return rot
}
