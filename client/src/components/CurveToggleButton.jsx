const styles = {
  btn: { padding: '3px 10px', height: 24, borderRadius: 5, fontSize: 12, whiteSpace: 'nowrap' },
}

// 选中元素后浮现的「曲线」开关（HTML）。stopPropagation 防冒泡到 Stage 误清选中。
export default function CurveToggleButton({ active, onToggle, style }) {
  const stop = (e) => e.stopPropagation()
  return (
    <div style={style} onClick={stop} onMouseDown={stop}>
      <button className={`ctrl-btn ${active ? 'active' : ''}`} style={styles.btn} onClick={onToggle}>
        {active ? '曲线 ✓' : '曲线'}
      </button>
    </div>
  )
}
