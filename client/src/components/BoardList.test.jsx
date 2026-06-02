import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BoardList from './BoardList'
import * as api from '../api/boards'

vi.mock('../api/boards')

beforeEach(() => {
  vi.clearAllMocks() // 清掉跨测试残留的调用记录（saveBoard 等）
  vi.mocked(api.listBoards).mockResolvedValue([
    { id: 'b1', name: 'Old', updated_at: '2026-06-02T00:00:00Z' },
  ])
  vi.mocked(api.saveBoard).mockResolvedValue()
})

function renderList() {
  return render(<MemoryRouter><BoardList /></MemoryRouter>)
}

test('rename calls saveBoard and updates the card name', async () => {
  renderList()
  await screen.findByText('Old')
  vi.spyOn(window, 'prompt').mockReturnValue('New')
  fireEvent.click(screen.getByText('重命名'))
  await waitFor(() => expect(api.saveBoard).toHaveBeenCalledWith('b1', { name: 'New' }))
  expect(await screen.findByText('New')).toBeInTheDocument()
})

test('rename does nothing on cancel, empty, or unchanged name', async () => {
  renderList()
  await screen.findByText('Old')
  const promptSpy = vi.spyOn(window, 'prompt')
  promptSpy.mockReturnValueOnce(null)   // 取消
  fireEvent.click(screen.getByText('重命名'))
  promptSpy.mockReturnValueOnce('   ')  // 空白
  fireEvent.click(screen.getByText('重命名'))
  promptSpy.mockReturnValueOnce('Old')  // 未改动
  fireEvent.click(screen.getByText('重命名'))
  expect(api.saveBoard).not.toHaveBeenCalled()
})
