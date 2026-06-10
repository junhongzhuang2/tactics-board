import { render, screen, fireEvent } from '@testing-library/react'
import HelpButton from './HelpButton'

test('opens the help modal showing the guide', () => {
  render(<HelpButton />)
  expect(screen.queryByText(/使用指南/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('? 帮助'))
  expect(screen.getByText(/使用指南/)).toBeInTheDocument()
})

test('closes on the × button', () => {
  render(<HelpButton />)
  fireEvent.click(screen.getByText('? 帮助'))
  fireEvent.click(screen.getByLabelText('关闭'))
  expect(screen.queryByText(/使用指南/)).not.toBeInTheDocument()
})

test('closes on overlay click but not on card click', () => {
  const { container } = render(<HelpButton />)
  fireEvent.click(screen.getByText('? 帮助'))
  fireEvent.click(container.querySelector('.help-card')) // 点卡片不关
  expect(screen.getByText(/使用指南/)).toBeInTheDocument()
  fireEvent.click(container.querySelector('.help-overlay')) // 点遮罩关
  expect(screen.queryByText(/使用指南/)).not.toBeInTheDocument()
})

test('closes on Escape', () => {
  render(<HelpButton />)
  fireEvent.click(screen.getByText('? 帮助'))
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(screen.queryByText(/使用指南/)).not.toBeInTheDocument()
})

test('keyboard events do not leak to lower layers while open', () => {
  const spy = vi.fn()
  window.addEventListener('keydown', spy) // 冒泡阶段，模拟 BoardCanvas 的 window 监听
  render(<HelpButton />)
  fireEvent.click(screen.getByText('? 帮助'))
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
  expect(spy).not.toHaveBeenCalled() // 被捕获阶段拦截器 stopPropagation 拦下
  window.removeEventListener('keydown', spy)
})
