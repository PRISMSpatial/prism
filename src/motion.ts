// PRISM — shared animation config
// Mirrors design tokens: --motion-fast:120ms  --motion-base:220ms  --motion-slow:420ms
// Easing: cubic-bezier(.2,.7,.2,1)

export const EASE = [0.2, 0.7, 0.2, 1] as const

export const DUR = {
  fast: 0.12,
  base: 0.22,
  slow: 0.42,
} as const

// ─── Framer Motion variant presets ───────────────────────────────────────────

/** Module switch — slide + fade */
export const moduleVariants = {
  initial: { opacity: 0, x: -10 },
  animate: {
    opacity: 1, x: 0,
    transition: { duration: DUR.base, ease: EASE },
  },
  exit: {
    opacity: 0, x: 10,
    transition: { duration: DUR.fast, ease: EASE },
  },
}

/** Overlay (command palette, modal) — scale + fade */
export const overlayVariants = {
  initial: { opacity: 0, scale: 0.96, y: -6 },
  animate: {
    opacity: 1, scale: 1, y: 0,
    transition: { duration: DUR.base, ease: EASE },
  },
  exit: {
    opacity: 0, scale: 0.96, y: -6,
    transition: { duration: DUR.fast, ease: EASE },
  },
}

/** Backdrop fade */
export const backdropVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DUR.base } },
  exit:    { opacity: 0, transition: { duration: DUR.fast } },
}

/** Panel slide-in from right */
export const panelVariants = {
  initial: { opacity: 0, x: 24 },
  animate: {
    opacity: 1, x: 0,
    transition: { duration: DUR.base, ease: EASE },
  },
  exit: {
    opacity: 0, x: 24,
    transition: { duration: DUR.fast, ease: EASE },
  },
}

/** List item stagger container */
export const staggerContainer = {
  animate: {
    transition: { staggerChildren: 0.04, delayChildren: 0.06 },
  },
}

/** Individual stagger child — fade + slide up */
export const staggerItem = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1, y: 0,
    transition: { duration: DUR.base, ease: EASE },
  },
}

/** Cell pop-in for heatmap */
export const cellVariants = {
  initial: { opacity: 0, scale: 0.6 },
  animate: {
    opacity: 1, scale: 1,
    transition: { duration: DUR.fast, ease: EASE },
  },
}

/** Fade only */
export const fadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DUR.base } },
  exit:    { opacity: 0, transition: { duration: DUR.fast } },
}

/** Slide up from below */
export const slideUpVariants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1, y: 0,
    transition: { duration: DUR.slow, ease: EASE },
  },
  exit: {
    opacity: 0, y: 12,
    transition: { duration: DUR.fast, ease: EASE },
  },
}
