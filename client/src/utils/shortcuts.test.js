import { isUndoShortcut, isRedoShortcut } from './shortcuts'

test('isUndoShortcut matches Ctrl+Z and Cmd+Z', () => {
  expect(isUndoShortcut({ ctrlKey: true, shiftKey: false, key: 'z' })).toBe(true)
  expect(isUndoShortcut({ metaKey: true, shiftKey: false, key: 'z' })).toBe(true)
  expect(isUndoShortcut({ ctrlKey: true, shiftKey: false, key: 'Z' })).toBe(true)
})

test('isUndoShortcut rejects Ctrl+Shift+Z and bare z', () => {
  expect(isUndoShortcut({ ctrlKey: true, shiftKey: true, key: 'z' })).toBe(false)
  expect(isUndoShortcut({ key: 'z' })).toBe(false)
})

test('isRedoShortcut matches Ctrl+Shift+Z, Cmd+Shift+Z and Ctrl+Y', () => {
  expect(isRedoShortcut({ ctrlKey: true, shiftKey: true, key: 'z' })).toBe(true)
  expect(isRedoShortcut({ metaKey: true, shiftKey: true, key: 'z' })).toBe(true)
  expect(isRedoShortcut({ ctrlKey: true, key: 'y' })).toBe(true)
})

test('isRedoShortcut rejects plain Ctrl+Z and bare y', () => {
  expect(isRedoShortcut({ ctrlKey: true, shiftKey: false, key: 'z' })).toBe(false)
  expect(isRedoShortcut({ key: 'y' })).toBe(false)
})
