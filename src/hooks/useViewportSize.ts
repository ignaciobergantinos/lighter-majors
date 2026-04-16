// ── Viewport Size Hook — Reactive window dimensions ─────────
import { useState, useEffect } from 'react'

interface ViewportSize {
  width: number
  height: number
  /** Window width < 250px — ultra compact mode */
  isUltraCompact: boolean
  /** Window width < 320px — compact mode, collapse labels */
  isCompact: boolean
  /** Window height < 250px — condensed layout for constrained heights */
  isShortHeight: boolean
}

export function useViewportSize(): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(() => compute())

  useEffect(() => {
    function handleResize() {
      setSize(compute())
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return size
}

function compute(): ViewportSize {
  const width = typeof window !== 'undefined' ? window.innerWidth : 420
  const height = typeof window !== 'undefined' ? window.innerHeight : 680
  return {
    width,
    height,
    isUltraCompact: width < 250,
    isCompact: width < 320,
    isShortHeight: height < 250,
  }
}
