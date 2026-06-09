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

test('empty state shows the add card and a hint', async () => {
  vi.mocked(api.listBoards).mockResolvedValue([])
  renderList()
  expect(await screen.findByText('＋ 新建战术板')).toBeInTheDocument()
  expect(screen.getByText(/还没有战术板/)).toBeInTheDocument()
})

test('clicking the add-board card runs create flow', async () => {
  vi.mocked(api.listBoards).mockResolvedValue([])
  vi.mocked(api.createBoard).mockResolvedValue({ id: 'new1' })
  vi.spyOn(window, 'prompt').mockReturnValue('My Board')
  renderList()
  fireEvent.click(await screen.findByText('＋ 新建战术板'))
  await waitFor(() => expect(api.createBoard).toHaveBeenCalled())
})

test('cards and add-card expose their CSS hooks', async () => {
  const { container } = renderList()
  await screen.findByText('Old')
  expect(container.querySelector('.add-card')).toBeTruthy()
  expect(container.querySelector('.board-card')).toBeTruthy()
  expect(container.querySelector('.board-bg')).toBeTruthy()
})
