import { act, renderHook } from '@testing-library/react'
import { useBoardStore } from './boardStore'

beforeEach(() => {
  useBoardStore.setState({
    board: null,
    currentFrameIndex: 0,
    isDirty: false,
    isPlaying: false,
    playheadTime: 0,
    loop: false,
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

test('insertFrameAfter inserts a copy after the given index', () => {
  const { result } = renderHook(() => useBoardStore())
  const board = makeBoard()
  board.data.frames.push({
    id: 'frame-1', duration: 1000,
    playerStates: { r1: { x: 0.9, y: 0.9, orientation: 0 }, b1: { x: 0.1, y: 0.1, orientation: 0 } },
    discState: { x: 0.2, y: 0.2 }, annotations: [],
  })
  act(() => result.current.setBoard(board))
  act(() => result.current.insertFrameAfter(0))
  expect(result.current.board.data.frames.length).toBe(3)
  // 新帧复制 index 0 的状态，插在 index 1
  expect(result.current.board.data.frames[1].playerStates.r1.x).toBe(0.1)
  expect(result.current.currentFrameIndex).toBe(1)
  expect(result.current.playheadTime).toBe(1000) // 新帧起点 = frame 0 duration
  expect(result.current.isDirty).toBe(true)
})

test('insertFrameAfter on last frame appends', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.insertFrameAfter(0))
  expect(result.current.board.data.frames.length).toBe(2)
  expect(result.current.currentFrameIndex).toBe(1)
})

test('setFrameDuration updates a frame duration with floor', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.setFrameDuration(0, 2500))
  expect(result.current.board.data.frames[0].duration).toBe(2500)
  act(() => result.current.setFrameDuration(0, 10)) // 低于下限
  expect(result.current.board.data.frames[0].duration).toBe(100)
  expect(result.current.isDirty).toBe(true)
})

test('play / pause toggle isPlaying', () => {
  const { result } = renderHook(() => useBoardStore())
  const board = makeBoard()
  board.data.frames.push({ id: 'frame-1', duration: 500, playerStates: {}, discState: { x: 0.5, y: 0.5 }, annotations: [] })
  act(() => result.current.setBoard(board))
  act(() => result.current.play())
  expect(result.current.isPlaying).toBe(true)
  act(() => result.current.pause())
  expect(result.current.isPlaying).toBe(false)
})

test('play does nothing on a single-frame board (total duration 0)', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard())) // 1 frame
  act(() => result.current.play())
  expect(result.current.isPlaying).toBe(false)
})

test('play rewinds to 0 when parked at end and not looping', () => {
  const { result } = renderHook(() => useBoardStore())
  const board = makeBoard()
  board.data.frames.push({ id: 'frame-1', duration: 500, playerStates: {}, discState: { x: 0.5, y: 0.5 }, annotations: [] })
  act(() => result.current.setBoard(board))
  act(() => result.current.setPlayhead(1000)) // total = 1000 (frame0 dur), at end
  act(() => result.current.play())
  expect(result.current.isPlaying).toBe(true)
  expect(result.current.playheadTime).toBe(0)
})

test('play keeps playhead at end when looping', () => {
  const { result } = renderHook(() => useBoardStore())
  const board = makeBoard()
  board.data.frames.push({ id: 'frame-1', duration: 500, playerStates: {}, discState: { x: 0.5, y: 0.5 }, annotations: [] })
  act(() => result.current.setBoard(board))
  act(() => result.current.toggleLoop()) // loop on
  act(() => result.current.setPlayhead(1000))
  act(() => result.current.play())
  expect(result.current.playheadTime).toBe(1000)
})

test('toggleLoop flips loop', () => {
  const { result } = renderHook(() => useBoardStore())
  expect(result.current.loop).toBe(false)
  act(() => result.current.toggleLoop())
  expect(result.current.loop).toBe(true)
})

test('setPlayhead sets playheadTime', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setPlayhead(640))
  expect(result.current.playheadTime).toBe(640)
})

test('setCurrentFrame syncs playhead to that frame start and pauses', () => {
  const { result } = renderHook(() => useBoardStore())
  const board = makeBoard()
  board.data.frames.push({ id: 'frame-1', duration: 500, playerStates: {}, discState: { x: 0.5, y: 0.5 }, annotations: [] })
  act(() => result.current.setBoard(board))
  act(() => result.current.play())
  act(() => result.current.setCurrentFrame(1))
  expect(result.current.currentFrameIndex).toBe(1)
  expect(result.current.playheadTime).toBe(1000) // frame 1 起点 = frame 0 duration
  expect(result.current.isPlaying).toBe(false)
})
