import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import guide from '../usage-guide.md?raw'

const BTN = {
  padding: '4px 10px', height: 28, borderRadius: 6,
  background: '#2a2a3e', border: '1px solid #555', color: '#ccc',
  fontSize: 13, cursor: 'pointer',
}

export default function HelpButton() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    // 捕获阶段吞掉所有按键，防止穿透到 BoardCanvas 挂在 window 的撤销/删除监听；仅 Esc 关闭
    function onKey(e) {
      e.stopPropagation()
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey, true) // true = 捕获阶段，先于下层冒泡监听
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  return (
    <>
      <button style={BTN} aria-label="帮助" title="使用帮助" onClick={() => setOpen(true)}>
        ? 帮助
      </button>
      {open && (
        <div
          className="help-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="使用帮助"
          onClick={() => setOpen(false)}
        >
          <div className="help-card" onClick={(e) => e.stopPropagation()}>
            <button className="help-close" aria-label="关闭" onClick={() => setOpen(false)}>×</button>
            <div className="help-md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{guide}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
