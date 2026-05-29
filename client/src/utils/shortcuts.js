// Ctrl/Cmd + Z（不含 Shift）= 撤销
export function isUndoShortcut(e) {
  return !!((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z'))
}

// Ctrl/Cmd + Shift + Z，或 Ctrl/Cmd + Y = 重做
export function isRedoShortcut(e) {
  return !!((e.ctrlKey || e.metaKey) && (
    ((e.key === 'z' || e.key === 'Z') && e.shiftKey) ||
    ((e.key === 'y' || e.key === 'Y') && !e.shiftKey)
  ))
}
