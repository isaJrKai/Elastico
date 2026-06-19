import { useEffect, useRef, useState } from 'react'

export function useScrollTrigger(
  threshold: number = 0.2,
  options: IntersectionObserverInit = {}
): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement>(null)
  const [isTriggered, setIsTriggered] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsTriggered(true)
          observer.unobserve(entry.target)
        }
      },
      { threshold, ...options }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [threshold, options])

  return [ref, isTriggered]
}
