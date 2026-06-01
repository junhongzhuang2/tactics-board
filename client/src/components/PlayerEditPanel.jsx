export const PANEL_W = 200
export const PANEL_H = 124

const styles = {
  panel: {
    position: 'absolute', width: PANEL_W, padding: 10, zIndex: 20,
    background: '#1a1a2e', border: '1px solid #555', borderRadius: 8,
    display: 'flex', flexDirection: 'column', gap: 8,
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  },
  input: {
    height: 30, borderRadius: 6, padding: '0 8px',
    background: '#0d0d1a', border: '1px solid #555', color: '#fff',
  },
  row: { display: 'flex', alignItems: 'center', gap: 6, color: '#ccc', fontSize: 13 },
  close: {
    height: 28, borderRadius: 6, background: '#2a2a3e',
    border: '1px solid #555', color: '#ccc', cursor: 'pointer',
  },
}

export default function PlayerEditPanel({ player, x, y, onRename, onToggleCone, onClose }) {
  function commit(e) {
    const v = e.target.value.trim()
    if (v) onRename(v)
  }
  return (
    <div style={{ ...styles.panel, left: x, top: y }}>
      <input
        aria-label="球员名字"
        style={styles.input}
        defaultValue={player.name}
        key={player.id}
        onKeyDown={(e) => { if (e.key === 'Enter') { commit(e); onClose() } }}
        onBlur={commit}
      />
      <label style={styles.row}>
        <input
          type="checkbox"
          aria-label="显示视野锥"
          checked={!!player.showCone}
          onChange={(e) => onToggleCone(e.target.checked)}
        />
        显示视野锥
      </label>
      <button style={styles.close} aria-label="关闭" onClick={onClose}>关闭</button>
    </div>
  )
}
