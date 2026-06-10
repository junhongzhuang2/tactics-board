import { useState, useRef, useEffect } from 'react'
import { FORMATIONS, FORMATION_ORDER } from '../utils/formations'

const TRIGGER = {
  padding: '4px 12px', height: 28, borderRadius: 6, fontSize: 13,
}
const MENU = {
  position: 'absolute', bottom: '100%', left: 0, marginBottom: 6,
  background: '#1a1a2e', border: '1px solid #444', borderRadius: 8,
  padding: 4, display: 'flex', flexDirection: 'column', gap: 2,
  minWidth: 120, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', zIndex: 20,
}
const ITEM = {
  padding: '7px 12px', borderRadius: 5, background: 'transparent',
  border: 'none', color: '#eee', fontSize: 13, textAlign: 'left', cursor: 'pointer',
}

export default function FormationMenu({ onApply, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {open && (
        <div style={MENU}>
          {FORMATION_ORDER.map((key) => (
            <button
              key={key}
              style={ITEM}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a4e')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              onClick={() => { onApply(key); setOpen(false) }}
            >
              {FORMATIONS[key].label}
            </button>
          ))}
        </div>
      )}
      <button
        className="ctrl-btn"
        style={TRIGGER}
        disabled={disabled}
        title={disabled ? '播放中或非关键帧不可用' : '选择阵型预设'}
        onClick={() => { if (!disabled) setOpen((o) => !o) }}
      >
        阵型 ▲
      </button>
    </div>
  )
}
