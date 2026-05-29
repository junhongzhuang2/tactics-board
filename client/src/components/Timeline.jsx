import { useRef } from 'react'
import { totalDuration, durationFromDrag } from '../utils/interpolate'

const MIN_BLOCK_PX = 44
const HANDLE_PX = 6

const STYLES = {
  bar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 16px', background: '#111', borderTop: '1px solid #333',
  },
  btn: {
    padding: '0 12px', height: 36, borderRadius: 6,
    background: '#2a2a3e', border: '1px solid #555',
    color: '#ccc', cursor: 'pointer', fontSize: 16, lineHeight: 1,
  },
  toggleOn: { background: '#4a9eff', borderColor: '#4a9eff', color: '#fff' },
  track: {
    position: 'relative', flex: 1, height: 36,
    display: 'flex', gap: 2, overflow: 'hidden',
  },
  frame: (active) => ({
    position: 'relative', height: 36, borderRadius: 6,
    background: active ? '#4a9eff' : '#2a2a3e',
    border: active ? '2px solid #4a9eff' : '2px solid #444',
    color: '#fff', cursor: 'pointer', fontSize: 13,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    userSelect: 'none', flexShrink: 0,
  }),
  playhead: (leftPct) => ({
    position: 'absolute', top: 0, bottom: 0, left: `${leftPct}%`,
    width: 2, background: '#ff5252', pointerEvents: 'none',
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

  // Frame block width proportional to duration
  function blockFlex(i) {
    if (i === frames.length - 1) return `0 0 ${MIN_BLOCK_PX}px`
    const dur = frames[i].duration || 1
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
      <button style={STYLES.btn} aria-label="上一帧" onClick={() => onStep(-1)}>⏮</button>
      {isPlaying ? (
        <button style={STYLES.btn} aria-label="暂停" onClick={onPause}>⏸</button>
      ) : (
        <button style={STYLES.btn} aria-label="播放" onClick={onPlay}>▶</button>
      )}
      <button style={STYLES.btn} aria-label="下一帧" onClick={() => onStep(1)}>⏭</button>
      <button
        style={{ ...STYLES.btn, ...(loop ? STYLES.toggleOn : {}) }}
        aria-label="循环"
        onClick={onToggleLoop}
      >🔁</button>

      <div ref={trackRef} style={STYLES.track} onClick={handleTrackClick}>
        {frames.map((frame, i) => (
          <div
            key={frame.id}
            style={{ ...STYLES.frame(i === currentFrameIndex), flex: blockFlex(i) }}
            onClick={(e) => { e.stopPropagation(); onJumpToFrame(i) }}
            onContextMenu={(e) => {
              e.preventDefault()
              if (frames.length > 1) onRemoveFrame(i)
            }}
            title={frames.length > 1 ? '右键删除此帧' : ''}
          >
            {i + 1}
            {/* Resize handle — not on last frame */}
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
        <div style={STYLES.playhead(playheadPct)} />
      </div>

      <label style={{ color: '#888', fontSize: 12 }}>时长</label>
      <input
        type="number"
        step="0.1"
        min="0.1"
        aria-label="当前帧时长(秒)"
        style={STYLES.durInput}
        defaultValue={curDurSec}
        key={`${currentFrameIndex}-${curDurSec}`}
        onBlur={(e) => onSetDuration(currentFrameIndex, Math.round(parseFloat(e.target.value || '0') * 1000))}
      />
      <button style={STYLES.btn} aria-label="插入帧" onClick={() => onInsertAfter(currentFrameIndex)}>＋</button>
    </div>
  )
}
