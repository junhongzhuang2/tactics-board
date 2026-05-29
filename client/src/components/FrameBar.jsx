const STYLES = {
  bar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 16px', background: '#111',
    borderTop: '1px solid #333', overflowX: 'auto',
  },
  frame: (active) => ({
    minWidth: 44, height: 36, borderRadius: 6,
    background: active ? '#4a9eff' : '#2a2a3e',
    border: active ? '2px solid #4a9eff' : '2px solid #444',
    color: '#fff', cursor: 'pointer', fontSize: 13,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    userSelect: 'none',
  }),
  btn: {
    padding: '0 14px', height: 36, borderRadius: 6,
    background: '#2a2a3e', border: '1px solid #555',
    color: '#ccc', cursor: 'pointer', fontSize: 20, lineHeight: 1,
  },
}

export default function FrameBar({
  frames,              // Frame[]
  currentFrameIndex,   // number
  onSelectFrame,       // (index) => void
  onAddFrame,          // () => void
  onRemoveFrame,       // (index) => void
}) {
  return (
    <div style={STYLES.bar}>
      {frames.map((frame, i) => (
        <div
          key={frame.id}
          style={STYLES.frame(i === currentFrameIndex)}
          onClick={() => onSelectFrame(i)}
          onContextMenu={(e) => {
            e.preventDefault()
            if (frames.length > 1) onRemoveFrame(i)
          }}
          title={frames.length > 1 ? '右键删除此帧' : ''}
        >
          {i + 1}
        </div>
      ))}
      <button style={STYLES.btn} onClick={onAddFrame} title="添加帧">+</button>
    </div>
  )
}
