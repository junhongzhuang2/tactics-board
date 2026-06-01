import { act, renderHook } from '@testing-library/react'
import { useAutoSave } from './useAutoSave'
import * as api from '../api/boards'

vi.mock('../api/boards', () => ({ saveBoard: vi.fn() }))

const board = { id: 'b1', data: { x: 1 } }

beforeEach(() => {
  vi.useFakeTimers()
  api.saveBoard.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

test('saves after the 1s debounce, marks clean, status saved', async () => {
  api.saveBoard.mockResolvedValue()
  const markClean = vi.fn()
  const { result } = renderHook(() => useAutoSave({ board, isDirty: true, markClean }))
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(api.saveBoard).toHaveBeenCalledWith('b1', { data: { x: 1 } })
  expect(markClean).toHaveBeenCalledTimes(1)
  expect(result.current.saveStatus).toBe('saved')
})

test('on failure goes to error then auto-retries after backoff', async () => {
  api.saveBoard.mockRejectedValueOnce(new Error('net')).mockResolvedValueOnce()
  const markClean = vi.fn()
  const { result } = renderHook(() => useAutoSave({ board, isDirty: true, markClean }))
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(api.saveBoard).toHaveBeenCalledTimes(1)
  expect(result.current.saveStatus).toBe('error')
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  expect(api.saveBoard).toHaveBeenCalledTimes(2)
  expect(result.current.saveStatus).toBe('saved')
  expect(markClean).toHaveBeenCalledTimes(1)
})

test('retryNow triggers an immediate save', async () => {
  api.saveBoard.mockRejectedValueOnce(new Error('net')).mockResolvedValueOnce()
  const { result } = renderHook(() => useAutoSave({ board, isDirty: true, markClean: vi.fn() }))
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(result.current.saveStatus).toBe('error')
  await act(async () => { result.current.retryNow(); await vi.advanceTimersByTimeAsync(0) })
  expect(api.saveBoard).toHaveBeenCalledTimes(2)
  expect(result.current.saveStatus).toBe('saved')
})

test('a late stale response does not overwrite newer state (race guard)', async () => {
  let resolveFirst
  api.saveBoard
    .mockImplementationOnce(() => new Promise((res) => { resolveFirst = res }))
    .mockResolvedValueOnce()
  const markClean = vi.fn()
  const { result, rerender } = renderHook(
    ({ b }) => useAutoSave({ board: b, isDirty: true, markClean }),
    { initialProps: { b: board } }
  )
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(result.current.saveStatus).toBe('saving')

  const board2 = { id: 'b1', data: { x: 2 } }
  rerender({ b: board2 })
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(api.saveBoard).toHaveBeenCalledTimes(2)
  expect(result.current.saveStatus).toBe('saved')

  markClean.mockClear()
  await act(async () => { resolveFirst(); await Promise.resolve() })
  expect(markClean).not.toHaveBeenCalled()
  expect(result.current.saveStatus).toBe('saved')
})
