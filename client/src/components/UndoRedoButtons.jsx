const btnStyle = (enabled) => ({
  padding: '0 10px', height: 28, borderRadius: 6,
  background: '#2a2a3e', border: '1px solid #555',
  color: enabled ? '#ccc' : '#555',
  cursor: enabled ? 'pointer' : 'default',
  fontSize: 14, lineHeight: 1,
})

export default function UndoRedoButtons({ canUndo, canRedo, onUndo, onRedo }) {
  return (
    <>
      <button style={btnStyle(canUndo)} aria-label="撤销" disabled={!canUndo} onClick={onUndo}>↶</button>
      <button style={btnStyle(canRedo)} aria-label="重做" disabled={!canRedo} onClick={onRedo}>↷</button>
    </>
  )
}
