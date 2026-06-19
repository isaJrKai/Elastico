// Animation Timing Functions (Cubic Bezier)
export const easing = {
  smooth: [0.4, 0, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],
  easeOut: [0, 0, 0.2, 1],
  easeInOut: [0.4, 0, 0.2, 1],
  bounce: [0.68, -0.55, 0.265, 1.55],
  spring: { type: 'spring', stiffness: 300, damping: 30 },
}

// Duration constants (in seconds)
export const duration = {
  fast: 0.2,
  base: 0.3,
  slow: 0.5,
  verySlow: 1,
}

// Transition presets
export const transition = {
  fast: { duration: duration.fast, ease: easing.easeOut },
  base: { duration: duration.base, ease: easing.easeOut },
  smooth: { duration: duration.slow, ease: easing.smooth },
  spring: { type: 'spring', stiffness: 100, damping: 10 },
}
