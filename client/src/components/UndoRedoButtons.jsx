const btnStyle = { padding: '0 10px', height: 28, borderRadius: 6, fontSize: 14, lineHeight: 1 }

export default function UndoRedoButtons({ canUndo, canRedo, onUndo, onRedo }) {
  return (
    <>
      <button className="ctrl-btn" style={btnStyle} aria-label="撤销" disabled={!canUndo} onClick={onUndo}>↶</button>
      <button className="ctrl-btn" style={btnStyle} aria-label="重做" disabled={!canRedo} onClick={onRedo}>↷</button>
    </>
  )
}
