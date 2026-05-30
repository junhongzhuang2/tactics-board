import { render, screen, fireEvent } from '@testing-library/react'
import UndoRedoButtons from './UndoRedoButtons'

test('buttons are disabled when canUndo/canRedo are false', () => {
  render(<UndoRedoButtons canUndo={false} canRedo={false} onUndo={vi.fn()} onRedo={vi.fn()} />)
  expect(screen.getByLabelText('撤销')).toBeDisabled()
  expect(screen.getByLabelText('重做')).toBeDisabled()
})

test('clicking enabled buttons calls handlers', () => {
  const onUndo = vi.fn()
  const onRedo = vi.fn()
  render(<UndoRedoButtons canUndo={true} canRedo={true} onUndo={onUndo} onRedo={onRedo} />)
  fireEvent.click(screen.getByLabelText('撤销'))
  fireEvent.click(screen.getByLabelText('重做'))
  expect(onUndo).toHaveBeenCalledTimes(1)
  expect(onRedo).toHaveBeenCalledTimes(1)
})

test('clicking a disabled button does not call its handler', () => {
  const onUndo = vi.fn()
  render(<UndoRedoButtons canUndo={false} canRedo={true} onUndo={onUndo} onRedo={vi.fn()} />)
  fireEvent.click(screen.getByLabelText('撤销'))
  expect(onUndo).not.toHaveBeenCalled()
})
