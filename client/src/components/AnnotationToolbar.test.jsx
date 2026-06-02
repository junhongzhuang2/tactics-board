import { render, screen, fireEvent } from '@testing-library/react'
import AnnotationToolbar from './AnnotationToolbar'

function setup(over = {}) {
  const h = { onToolChange: vi.fn(), onScopeChange: vi.fn(), onColorChange: vi.fn() }
  render(<AnnotationToolbar tool="none" scope="frame" color="#ffeb3b" {...h} {...over} />)
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

test('renders the rect / ellipse / text tools', () => {
  setup()
  expect(screen.getByLabelText('矩形')).toBeInTheDocument()
  expect(screen.getByLabelText('椭圆')).toBeInTheDocument()
  expect(screen.getByLabelText('文字')).toBeInTheDocument()
})

test('clicking a new tool calls onToolChange with its key', () => {
  const h = setup()
  fireEvent.click(screen.getByLabelText('矩形'))
  expect(h.onToolChange).toHaveBeenCalledWith('rect')
  fireEvent.click(screen.getByLabelText('椭圆'))
  expect(h.onToolChange).toHaveBeenCalledWith('ellipse')
  fireEvent.click(screen.getByLabelText('文字'))
  expect(h.onToolChange).toHaveBeenCalledWith('text')
})

test('renders a color swatch per ANNO_COLORS and calls onColorChange', () => {
  const h = setup()
  fireEvent.click(screen.getByLabelText('颜色 #ff5252'))
  expect(h.onColorChange).toHaveBeenCalledWith('#ff5252')
})

test('the active color swatch is marked aria-pressed', () => {
  setup({ color: '#4a9eff' })
  expect(screen.getByLabelText('颜色 #4a9eff')).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('颜色 #ffeb3b')).toHaveAttribute('aria-pressed', 'false')
})

test('工具栏可收起与展开', () => {
  setup()
  expect(screen.getByLabelText('矩形')).toBeInTheDocument()
  fireEvent.click(screen.getByLabelText('收起工具栏'))
  expect(screen.queryByLabelText('矩形')).not.toBeInTheDocument()
  fireEvent.click(screen.getByLabelText('展开工具栏'))
  expect(screen.getByLabelText('矩形')).toBeInTheDocument()
})
