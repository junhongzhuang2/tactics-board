const styles = {
  bar: {
    display: 'flex', alignItems: 'center', gap: 6, padding: 4,
    // 浮在画布之上：不用 backdrop-filter（每帧重算模糊会拖慢拖拽/播放），改用近实色深底
    background: 'rgba(18,26,22,0.9)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
  },
  btn: { padding: '3px 8px', height: 24, borderRadius: 5, fontSize: 12 },
  del: {
    padding: '3px 8px', height: 24, borderRadius: 5, fontSize: 12, cursor: 'pointer',
    background: 'transparent', color: '#e57373', border: '1px solid #e57373',
  },
}

// 选中标注后的浮动小工具条（HTML）。stopPropagation 切断冒泡到任何 DOM 祖先，保证点击闭环。
export default function SelectionToolbar({ scope, canMoveToFrame, onSetScope, onDelete, style }) {
  const stop = (e) => e.stopPropagation()
  return (
    <div style={{ ...styles.bar, ...style }} onClick={stop} onMouseDown={stop}>
      <button
        aria-label="本帧"
        aria-pressed={scope === 'frame'}
        disabled={scope === 'global' && !canMoveToFrame}
        title={scope === 'global' && !canMoveToFrame ? '停在关键帧才能转为本帧' : undefined}
        className={`ctrl-btn ${scope === 'frame' ? 'active' : ''}`}
        style={styles.btn}
        onClick={() => onSetScope('frame')}
      >
        本帧
      </button>
      <button
        aria-label="全局"
        aria-pressed={scope === 'global'}
        className={`ctrl-btn ${scope === 'global' ? 'active' : ''}`}
        style={styles.btn}
        onClick={() => onSetScope('global')}
      >
        全局
      </button>
      <button aria-label="删除标注" style={styles.del} onClick={onDelete}>删除</button>
    </div>
  )
}
