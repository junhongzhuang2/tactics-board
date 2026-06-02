const TOOLS = [
  { key: 'none', label: '选择' },
  { key: 'pass', label: '传盘' },
  { key: 'run', label: '跑位' },
]

const styles = {
  bar: {
    position: 'absolute', top: 12, left: 12, zIndex: 15,
    display: 'flex', alignItems: 'center', gap: 6, padding: 6,
    background: '#111', border: '1px solid #333', borderRadius: 8,
  },
  btn: (active) => ({
    padding: '4px 10px', height: 28, borderRadius: 6, fontSize: 13, cursor: 'pointer',
    background: active ? '#4a9eff' : '#2a2a3e',
    border: active ? '1px solid #4a9eff' : '1px solid #555',
    color: '#fff',
  }),
  sep: { width: 1, height: 20, background: '#444', margin: '0 2px' },
}

export default function AnnotationToolbar({ tool, scope, onToolChange, onScopeChange }) {
  return (
    <div style={styles.bar}>
      {TOOLS.map((t) => (
        <button
          key={t.key}
          aria-label={t.label}
          aria-pressed={tool === t.key}
          style={styles.btn(tool === t.key)}
          onClick={() => onToolChange(t.key)}
        >
          {t.label}
        </button>
      ))}
      <span style={styles.sep} />
      <button aria-label="本帧" aria-pressed={scope === 'frame'} style={styles.btn(scope === 'frame')} onClick={() => onScopeChange('frame')}>本帧</button>
      <button aria-label="全局" aria-pressed={scope === 'global'} style={styles.btn(scope === 'global')} onClick={() => onScopeChange('global')}>全局</button>
    </div>
  )
}
