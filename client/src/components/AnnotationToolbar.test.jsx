import { render, screen, fireEvent } from '@testing-library/react'
import AnnotationToolbar from './AnnotationToolbar'

function setup(over = {}) {
  const h = { onToolChange: vi.fn(), onScopeChange: vi.fn() }
  render(<AnnotationToolbar tool="none" scope="frame" {...h} {...over} />)
  return h
}

test('renders the three tools and two scope buttons', () => {
  setup()
  expect(screen.getByLabelText('选择')).toBeInTheDocument()
  expect(screen.getByLabelText('传盘')).toBeInTheDocument()
  expect(screen.getByLabelText('跑位')).toBeInTheDocument()
  expect(screen.getByLabelText('本帧')).toBeInTheDocument()
  expect(screen.getByLabelText('全局')).toBeInTheDocument()
})

test('clicking a tool calls onToolChange with its key', () => {
  const h = setup()
  fireEvent.click(screen.getByLabelText('传盘'))
  expect(h.onToolChange).toHaveBeenCalledWith('pass')
  fireEvent.click(screen.getByLabelText('跑位'))
  expect(h.onToolChange).toHaveBeenCalledWith('run')
})

test('clicking a scope button calls onScopeChange', () => {
  const h = setup()
  fireEvent.click(screen.getByLabelText('全局'))
  expect(h.onScopeChange).toHaveBeenCalledWith('global')
})

test('the active tool and scope are marked aria-pressed', () => {
  setup({ tool: 'pass', scope: 'global' })
  expect(screen.getByLabelText('传盘')).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('选择')).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByLabelText('全局')).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('本帧')).toHaveAttribute('aria-pressed', 'false')
})
