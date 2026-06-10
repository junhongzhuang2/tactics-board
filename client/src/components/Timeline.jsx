import { useRef, useState, useLayoutEffect } from 'react'
import { totalDuration, durationFromDrag, activeFrameIndex } from '../utils/interpolate'
import { isFrameModified } from '../utils/frameStatus'

const MIN_BLOCK_PX = 44
const HANDLE_PX = 6

const STYLES = {
  bar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 16px',
    background: 'rgba(17,24,20,0.55)',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  btn: {
    padding: '0 12px', height: 36, borderRadius: 6,
    fontSize: 16, lineHeight: 1,
  },
  track: {
    position: 'relative', flex: 1, height: 36,
    display: 'flex', gap: 2, overflow: 'hidden',
  },
  frame: {
    position: 'relative', height: 36, borderRadius: 6,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 13,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    userSelect: 'none', flexShrink: 0, boxSizing: 'border-box',
  },
  dot: (modified) => ({
    position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)',
    width: 5, height: 5, borderRadius: '50%',
    background: modified ? '#ffd23f' : 'rgba(255,255,255,0.25)',
    pointerEvents: 'none',
  }),
  slider: (left, width) => ({
    position: 'absolute', top: 0, height: 36, left, width,
    borderRadius: 6, boxSizing: 'border-box',
    background: 'rgba(56,189,248,0.15)', border: '2px solid #38bdf8',
    boxShadow: '0 0 12px rgba(56,189,248,0.3)', pointerEvents: 'none',
    transition: 'left .25s cubic-bezier(.16,1,.3,1), width .25s cubic-bezier(.16,1,.3,1)',
  }),
  playhead: (leftPct) => ({
    position: 'absolute', top: 0, bottom: 0, left: `${leftPct}%`,
    width: 2, background: '#ff5252', pointerEvents: 'none',
    transform: 'translateX(-1px)',
  }),
  durInput: {
    width: 56, height: 30, borderRadius: 6, textAlign: 'center',
    background: '#1a1a2e', border: '1px solid #555', color: '#fff',
  },
  handle: {
    position: 'absolute', top: 0, right: 0, bottom: 0, width: HANDLE_PX,
    cursor: 'ew-resize', background: 'rgba(255,255,255,0.25)',
    borderTopRightRadius: 6, borderBottomRightRadius: 6,
  },
}

export default function Timeline({
  frames,
  currentFrameIndex,
  playheadTime,
  isPlaying,
  loop,
  onJumpToFrame,
  onSetPlayhead,
  onPlay,
  onPause,
  onToggleLoop,
  onInsertAfter,
  onRemoveFrame,
  onSetDuration,
  onStep,
}) {
  const trackRef = useRef(null)
  const total = totalDuration(frames)
  const playheadPct = total > 0 ? Math.min(100, (playheadTime / total) * 100) : 0
  const activeIndex = activeFrameIndex(frames, playheadTime)

  const blockRefs = useRef([])
  const [slider, setSlider] = useState({ left: 0, width: 0 })

  function measureSlider() {
    const track = trackRef.current
    const el = blockRefs.current[activeIndex]
    if (!track || !el) return
    const t = track.getBoundingClientRect()
    const b = el.getBoundingClientRect()
    setSlider({ left: b.left - t.left, width: b.width })
  }

  // 切帧 / 帧增删 / 时长变化后重测；首帧用 layout effect 避免闪烁
  useLayoutEffect(() => {
    measureSlider()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => measureSlider())
    if (trackRef.current) ro.observe(trackRef.current)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, frames, total])

  // Frame block width proportional to duration
  function blockFlex(i) {
    if (i === frames.length - 1) return `0 0 ${MIN_BLOCK_PX}px`
    const dur = frames[i].duration > 0 ? frames[i].duration : 1
    return `${dur} 1 ${MIN_BLOCK_PX}px`
  }

  function handleTrackClick(e) {
    if (!trackRef.current || total <= 0) return
    const rect = trackRef.current.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    onSetPlayhead(Math.max(0, Math.min(total, pct * total)))
  }

  // Drag right edge of frame block to resize duration
  function handleResizeStart(e, i) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startDuration = frames[i].duration
    const trackPx = trackRef.current ? trackRef.current.getBoundingClientRect().width : 1
    const msPerPx = total > 0 ? total / trackPx : 1
    function onMove(ev) {
      onSetDuration(i, durationFromDrag(startDuration, ev.clientX - startX, msPerPx))
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const curDurSec = (frames[currentFrameIndex]?.duration ?? 0) / 1000

  return (
    <div style={STYLES.bar}>
      <button className="ctrl-btn" style={STYLES.btn} aria-label="上一帧" onClick={() => onStep(-1)}>⏮</button>
      {isPlaying ? (
        <button className="ctrl-btn" style={STYLES.btn} aria-label="暂停" onClick={onPause}>⏸</button>
      ) : (
        <button className="ctrl-btn" style={STYLES.btn} aria-label="播放" onClick={onPlay}>▶</button>
      )}
      <button className="ctrl-btn" style={STYLES.btn} aria-label="下一帧" onClick={() => onStep(1)}>⏭</button>
      <button
        className={`ctrl-btn ${loop ? 'active' : ''}`}
        style={STYLES.btn}
        aria-label="循环"
        onClick={onToggleLoop}
      >🔁</button>

      <div ref={trackRef} style={STYLES.track} onClick={handleTrackClick}>
        {frames.map((frame, i) => (
          <div
            key={frame.id}
            ref={(el) => { blockRefs.current[i] = el }}
            style={{ ...STYLES.frame, flex: blockFlex(i) }}
            onClick={(e) => { e.stopPropagation(); onJumpToFrame(i) }}
            onContextMenu={(e) => {
              e.preventDefault()
              if (frames.length > 1) onRemoveFrame(i)
            }}
            title={frames.length > 1 ? '右键删除此帧' : ''}
          >
            {i + 1}
            <span
              data-testid={`frame-dot-${i}`}
              data-modified={isFrameModified(frame) ? 'true' : 'false'}
              style={STYLES.dot(isFrameModified(frame))}
            />
            {i < frames.length - 1 && (
              <div
                style={STYLES.handle}
                onMouseDown={(e) => handleResizeStart(e, i)}
                onClick={(e) => e.stopPropagation()}
                title="拖动改变本帧时长"
              />
            )}
          </div>
        ))}
        <div data-testid="frame-slider" style={STYLES.slider(slider.left, slider.width)} />
        <div style={STYLES.playhead(playheadPct)} />
      </div>

      <label style={{ color: '#888', fontSize: 12 }}>时长</label>
      <input
        type="number"
        step="0.1"
        min="0.1"
        aria-label="当前帧时长(秒)"
        disabled={currentFrameIndex === frames.length - 1}
        title={currentFrameIndex === frames.length - 1 ? '最后一帧时长不参与动画' : undefined}
        style={STYLES.durInput}
        defaultValue={curDurSec}
        key={`${currentFrameIndex}-${curDurSec}`}
        onBlur={(e) => onSetDuration(currentFrameIndex, Math.round(parseFloat(e.target.value || '0') * 1000))}
      />
      <button className="ctrl-btn" style={STYLES.btn} aria-label="插入帧" onClick={() => onInsertAfter(currentFrameIndex)}>＋</button>
    </div>
  )
}
