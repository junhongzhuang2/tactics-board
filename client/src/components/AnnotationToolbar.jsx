import { useState } from 'react'
import { ANNO_COLORS } from '../utils/annotations'

const TOOLS = [
  { key: 'none', label: '选择' },
  { key: 'pass', label: '传盘' },
  { key: 'run', label: '跑位' },
  { key: 'rect', label: '矩形' },
  { key: 'ellipse', label: '椭圆' },
  { key: 'text', label: '文字' },
]

const styles = {
  bar: {
    position: 'absolute', top: 12, left: 12, zIndex: 15,
    display: 'flex', alignItems: 'center', gap: 6, padding: 6,
    // 浮在动画画布之上：不用 backdrop-filter（浏览器每帧重算模糊→播放卡顿），改用近实色深底
    background: 'rgba(18,26,22,0.9)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
  },
  btn: { padding: '4px 10px', height: 28, borderRadius: 6, fontSize: 13 },
  sep: { width: 1, height: 20, background: '#444', margin: '0 2px' },
  swatch: (c, active) => ({
    width: 20, height: 20, padding: 0, borderRadius: 4, cursor: 'pointer', background: c,
    border: active ? '2px solid #fff' : '1px solid #555',
  }),
}

export default function AnnotationToolbar({ tool, scope, color, onToolChange, onScopeChange, onColorChange }) {
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <div style={styles.bar}>
        <button aria-label="展开工具栏" className="ctrl-btn" style={styles.btn} onClick={() => setCollapsed(false)}>✎ 标注</button>
      </div>
    )
  }

  return (
    <div style={styles.bar}>
      {TOOLS.map((t) => (
        <button
          key={t.key}
          aria-label={t.label}
          aria-pressed={tool === t.key}
          className={`ctrl-btn ${tool === t.key ? 'active' : ''}`}
          style={styles.btn}
          onClick={() => onToolChange(t.key)}
        >
          {t.label}
        </button>
      ))}
      <span style={styles.sep} />
      <button aria-label="本帧" aria-pressed={scope === 'frame'} className={`ctrl-btn ${scope === 'frame' ? 'active' : ''}`} style={styles.btn} onClick={() => onScopeChange('frame')}>本帧</button>
      <button aria-label="全局" aria-pressed={scope === 'global'} className={`ctrl-btn ${scope === 'global' ? 'active' : ''}`} style={styles.btn} onClick={() => onScopeChange('global')}>全局</button>
      <span style={styles.sep} />
      {ANNO_COLORS.map((c) => (
        <button
          key={c}
          aria-label={`颜色 ${c}`}
          aria-pressed={color === c}
          style={styles.swatch(c, color === c)}
          onClick={() => onColorChange(c)}
        />
      ))}
      <span style={styles.sep} />
      <button aria-label="收起工具栏" className="ctrl-btn" style={styles.btn} onClick={() => setCollapsed(true)}>«</button>
    </div>
  )
}
