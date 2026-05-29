import { act, renderHook } from '@testing-library/react'
import { useBoardStore } from './boardStore'

beforeEach(() => {
  useBoardStore.setState({
    board: null,
    currentFrameIndex: 0,
    isDirty: false,
  })
})

const makeBoard = () => ({
  id: 'board-1',
  name: 'Test Board',
  data: {
    players: [
      { id: 'r1', team: 'red', number: 1, name: '1' },
      { id: 'b1', team: 'blue', number: 1, name: '1' },
    ],
    frames: [
      {
        id: 'frame-0', duration: 1000,
        playerStates: {
          r1: { x: 0.1, y: 0.5, orientation: 0 },
          b1: { x: 0.9, y: 0.5, orientation: 0 },
        },
        discState: { x: 0.5, y: 0.5 },
        annotations: [],
      },
    ],
    globalAnnotations: [],
  },
})

test('setBoard loads a board', () => {
  const { result } = renderHook(() => useBoardStore())
  const board = makeBoard()
  act(() => result.current.setBoard(board))
  expect(result.current.board.id).toBe('board-1')
  expect(result.current.currentFrameIndex).toBe(0)
  expect(result.current.isDirty).toBe(false)
})

test('updateFramePlayerState updates position and marks dirty', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.updateFramePlayerState(0, 'r1', { x: 0.3, y: 0.4, orientation: 0 }))
  expect(result.current.board.data.frames[0].playerStates.r1.x).toBe(0.3)
  expect(result.current.isDirty).toBe(true)
})

test('updateFrameDiscState updates disc position', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.updateFrameDiscState(0, { x: 0.7, y: 0.2 }))
  expect(result.current.board.data.frames[0].discState.x).toBe(0.7)
  expect(result.current.isDirty).toBe(true)
})

test('addFrame appends copy of current frame', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.addFrame())
  expect(result.current.board.data.frames.length).toBe(2)
  expect(result.current.board.data.frames[1].playerStates.r1.x).toBe(0.1)
})

test('removeFrame removes a frame', () => {
  const { result } = renderHook(() => useBoardStore())
  const board = makeBoard()
  board.data.frames.push({
    id: 'frame-1', duration: 1000,
    playerStates: { r1: { x: 0.5, y: 0.5, orientation: 0 }, b1: { x: 0.5, y: 0.5, orientation: 0 } },
    discState: { x: 0.5, y: 0.5 }, annotations: []
  })
  act(() => result.current.setBoard(board))
  act(() => result.current.removeFrame(1))
  expect(result.current.board.data.frames.length).toBe(1)
})

test('removeFrame does not remove last frame', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.removeFrame(0))
  expect(result.current.board.data.frames.length).toBe(1)
})

test('setCurrentFrame updates index', () => {
  const { result } = renderHook(() => useBoardStore())
  const board = makeBoard()
  board.data.frames.push({ id: 'frame-1', duration: 1000, playerStates: {}, discState: { x: 0.5, y: 0.5 }, annotations: [] })
  act(() => result.current.setBoard(board))
  act(() => result.current.setCurrentFrame(1))
  expect(result.current.currentFrameIndex).toBe(1)
})

test('renamePlayer updates player name', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.renamePlayer('r1', '小王'))
  expect(result.current.board.data.players.find(p => p.id === 'r1').name).toBe('小王')
  expect(result.current.isDirty).toBe(true)
})
