import { render, screen, fireEvent } from '@testing-library/react'
import PlayerEditPanel from './PlayerEditPanel'

const player = { id: 'r1', name: '7', showCone: false }

test('renders name input and cone checkbox reflecting the player', () => {
  render(<PlayerEditPanel player={player} x={0} y={0} onRename={vi.fn()} onToggleCone={vi.fn()} onClose={vi.fn()} />)
  expect(screen.getByLabelText('球员名字')).toHaveValue('7')
  expect(screen.getByLabelText('显示视野锥')).not.toBeChecked()
})

test('changing the checkbox calls onToggleCone', () => {
  const onToggleCone = vi.fn()
  render(<PlayerEditPanel player={player} x={0} y={0} onRename={vi.fn()} onToggleCone={onToggleCone} onClose={vi.fn()} />)
  fireEvent.click(screen.getByLabelText('显示视野锥'))
  expect(onToggleCone).toHaveBeenCalledWith(true)
})

test('Enter in the name input commits a trimmed name and closes', () => {
  const onRename = vi.fn()
  const onClose = vi.fn()
  render(<PlayerEditPanel player={player} x={0} y={0} onRename={onRename} onToggleCone={vi.fn()} onClose={onClose} />)
  const input = screen.getByLabelText('球员名字')
  fireEvent.change(input, { target: { value: '  小王  ' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onRename).toHaveBeenCalledWith('小王')
  expect(onClose).toHaveBeenCalled()
})

test('empty name is not committed', () => {
  const onRename = vi.fn()
  render(<PlayerEditPanel player={player} x={0} y={0} onRename={onRename} onToggleCone={vi.fn()} onClose={vi.fn()} />)
  const input = screen.getByLabelText('球员名字')
  fireEvent.change(input, { target: { value: '   ' } })
  fireEvent.blur(input)
  expect(onRename).not.toHaveBeenCalled()
})

test('close button calls onClose', () => {
  const onClose = vi.fn()
  render(<PlayerEditPanel player={player} x={0} y={0} onRename={vi.fn()} onToggleCone={vi.fn()} onClose={onClose} />)
  fireEvent.click(screen.getByLabelText('关闭'))
  expect(onClose).toHaveBeenCalled()
})
