import { render, screen, fireEvent } from '@testing-library/react'
import FormationMenu from './FormationMenu'

test('opens menu and lists all five presets', () => {
  render(<FormationMenu onApply={() => {}} disabled={false} />)
  fireEvent.click(screen.getByText(/阵型/))
  expect(screen.getByText('默认阵型')).toBeInTheDocument()
  expect(screen.getByText('竖排')).toBeInTheDocument()
  expect(screen.getByText('横排')).toBeInTheDocument()
  expect(screen.getByText('Zone')).toBeInTheDocument()
  expect(screen.getByText('Junk')).toBeInTheDocument()
})

test('clicking a preset calls onApply with its key and closes', () => {
  const onApply = vi.fn()
  render(<FormationMenu onApply={onApply} disabled={false} />)
  fireEvent.click(screen.getByText(/阵型/))
  fireEvent.click(screen.getByText('竖排'))
  expect(onApply).toHaveBeenCalledWith('vstack')
  expect(screen.queryByText('竖排')).not.toBeInTheDocument()
})

test('disabled trigger does not open the menu', () => {
  render(<FormationMenu onApply={() => {}} disabled={true} />)
  fireEvent.click(screen.getByText(/阵型/))
  expect(screen.queryByText('默认阵型')).not.toBeInTheDocument()
})
