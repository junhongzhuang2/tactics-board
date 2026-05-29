import { useEffect, useRef } from 'react'
import { useBoardStore } from '../store/boardStore'
import { totalDuration, advancePlayhead } from '../utils/interpolate'

// 监听 store 的 isPlaying，用 requestAnimationFrame 累加 playheadTime
export function usePlaybackEngine() {
  const rafRef = useRef(null)
  const lastRef = useRef(null)

  useEffect(() => {
    function tick(now) {
      const { isPlaying, playheadTime, loop, board, setPlayhead, pause } =
        useBoardStore.getState()
      if (!isPlaying || !board) {
        rafRef.current = null
        return
      }
      if (lastRef.current == null) lastRef.current = now
      const dt = now - lastRef.current
      lastRef.current = now

      const total = totalDuration(board.data.frames)
      const { next, stop } = advancePlayhead(playheadTime, dt, total, loop)
      setPlayhead(next)
      if (stop) {
        pause()
        rafRef.current = null
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    const unsub = useBoardStore.subscribe((state, prev) => {
      if (state.isPlaying && !prev.isPlaying) {
        lastRef.current = null
        rafRef.current = requestAnimationFrame(tick)
      } else if (!state.isPlaying && prev.isPlaying && rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    })

    return () => {
      unsub()
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])
}
