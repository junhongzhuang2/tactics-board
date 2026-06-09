import { act, renderHook } from '@testing-library/react'
import { useBoardStore } from './boardStore'
import { createDefaultBoardData } from '../utils/defaultBoardData'

beforeEach(() => {
  useBoardStore.setState({
    board: null,
    currentFrameIndex: 0,
    isDirty: false,
    isPlaying: false,
    playheadTime: 0,
    loop: false,
    past: [],
    future: [],
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
  act(() => result.current.updateFrameDiscState(0, 'disc-1', { x: 0.7, y: 0.2 }))
  expect(result.current.board.data.frames[0].discStates['disc-1'].x).toBe(0.7)
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

test('a mutating action pushes previous state to past and leaves future empty', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  expect(result.current.past.length).toBe(0)
  act(() => result.current.updateFramePlayerState(0, 'r1', { x: 0.3, y: 0.4, orientation: 0 }))
  expect(result.current.past.length).toBe(1)
  expect(result.current.future).toEqual([])
})

test('history caps at 200 entries', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  for (let i = 0; i < 201; i++) {
    act(() => result.current.updateFrameDiscState(0, 'disc-1', { x: (i % 100) / 100, y: 0.5 }))
  }
  expect(result.current.past.length).toBe(200)
})

test('setBoard clears history', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.updateFrameDiscState(0, 'disc-1', { x: 0.7, y: 0.2 }))
  expect(result.current.past.length).toBe(1)
  act(() => result.current.setBoard(makeBoard()))
  expect(result.current.past).toEqual([])
  expect(result.current.future).toEqual([])
})

test('history snapshot is not mutated by subsequent edits (immutability guard)', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard())) // frame0 r1.x = 0.1
  act(() => result.current.updateFramePlayerState(0, 'r1', { x: 0.5, y: 0.5, orientation: 0 }))
  expect(result.current.past[0].data.frames[0].playerStates.r1.x).toBe(0.1)
  act(() => result.current.updateFramePlayerState(0, 'r1', { x: 0.9, y: 0.9, orientation: 0 }))
  expect(result.current.past[0].data.frames[0].playerStates.r1.x).toBe(0.1)
})

test('undo restores previous data and moves current to future', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard())) // disc x = 0.5
  act(() => result.current.updateFrameDiscState(0, 'disc-1', { x: 0.7, y: 0.2 }))
  expect(result.current.board.data.frames[0].discStates['disc-1'].x).toBe(0.7)
  act(() => result.current.undo())
  expect(result.current.board.data.frames[0].discStates['disc-1'].x).toBe(0.5)
  expect(result.current.past.length).toBe(0)
  expect(result.current.future.length).toBe(1)
})

test('redo reapplies an undone change and empties future', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.updateFrameDiscState(0, 'disc-1', { x: 0.7, y: 0.2 }))
  act(() => result.current.undo())
  act(() => result.current.redo())
  expect(result.current.board.data.frames[0].discStates['disc-1'].x).toBe(0.7)
  expect(result.current.future).toEqual([])
  expect(result.current.past.length).toBe(1)
})

test('a new edit after undo clears the redo stack', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.updateFrameDiscState(0, 'disc-1', { x: 0.7, y: 0.2 }))
  act(() => result.current.undo())
  expect(result.current.future.length).toBe(1)
  act(() => result.current.updateFrameDiscState(0, 'disc-1', { x: 0.3, y: 0.3 }))
  expect(result.current.future).toEqual([])
})

test('undo and redo are no-ops on empty stacks', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.undo())
  expect(result.current.past).toEqual([])
  expect(result.current.board.data.frames[0].discStates['disc-1'].x).toBe(0.5)
  act(() => result.current.redo())
  expect(result.current.future).toEqual([])
})

test('undo restores the frame index and playhead where the edit happened', () => {
  const { result } = renderHook(() => useBoardStore())
  const board = makeBoard()
  board.data.frames.push({
    id: 'frame-1', duration: 500,
    playerStates: { r1: { x: 0.5, y: 0.5, orientation: 0 }, b1: { x: 0.5, y: 0.5, orientation: 0 } },
    discState: { x: 0.5, y: 0.5 }, annotations: [],
  })
  act(() => result.current.setBoard(board))
  act(() => result.current.setCurrentFrame(1)) // playhead=1000, no history (navigation)
  act(() => result.current.updateFramePlayerState(1, 'r1', { x: 0.8, y: 0.8, orientation: 0 }))
  act(() => result.current.setCurrentFrame(0)) // navigate away
  act(() => result.current.undo())
  expect(result.current.currentFrameIndex).toBe(1) // jumped back to edit site
  expect(result.current.playheadTime).toBe(1000)
  expect(result.current.board.data.frames[1].playerStates.r1.x).toBe(0.5) // reverted
})

test('markClean (autosave) does not pollute history; redo survives', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.updateFrameDiscState(0, 'disc-1', { x: 0.7, y: 0.2 }))
  act(() => result.current.undo())
  expect(result.current.future.length).toBe(1)
  act(() => result.current.markClean()) // simulate autosave
  expect(result.current.future.length).toBe(1) // not polluted
  act(() => result.current.redo())
  expect(result.current.board.data.frames[0].discStates['disc-1'].x).toBe(0.7) // redo still works
})

test('setPlayerShowCone toggles showCone and records history', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.setPlayerShowCone('r1', true))
  expect(result.current.board.data.players.find(p => p.id === 'r1').showCone).toBe(true)
  expect(result.current.past.length).toBe(1)
  act(() => result.current.undo())
  expect(result.current.board.data.players.find(p => p.id === 'r1').showCone).toBeFalsy()
})

test('redo lands the playhead on a keyframe (editable), even after scrubbing before undo', () => {
  const { result } = renderHook(() => useBoardStore())
  const board = makeBoard()
  board.data.frames.push({
    id: 'frame-1', duration: 500,
    playerStates: { r1: { x: 0.5, y: 0.5, orientation: 0 }, b1: { x: 0.5, y: 0.5, orientation: 0 } },
    discState: { x: 0.5, y: 0.5 }, annotations: [],
  })
  act(() => result.current.setBoard(board))
  // edit at frame 0 (playhead 0 = keyframe)
  act(() => result.current.updateFrameDiscState(0, 'disc-1', { x: 0.7, y: 0.2 }))
  // scrub to a non-keyframe position (between frame 0 @0 and frame 1 @1000)
  act(() => result.current.setPlayhead(400))
  act(() => result.current.undo())
  expect(result.current.playheadTime).toBe(0) // landed on frame 0 keyframe
  act(() => result.current.redo())
  // redo must also land on the keyframe of the edited frame (0), NOT the scrubbed 400
  expect(result.current.playheadTime).toBe(0)
  expect(result.current.currentFrameIndex).toBe(0)
})

test('addAnnotation frame scope pushes to that frame and records history', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.addAnnotation('frame', 0, { id: 'a1', type: 'arrow' }))
  expect(result.current.board.data.frames[0].annotations).toHaveLength(1)
  expect(result.current.board.data.frames[0].annotations[0].id).toBe('a1')
  expect(result.current.past.length).toBe(1)
})

test('addAnnotation global scope pushes to globalAnnotations', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.addAnnotation('global', null, { id: 'g1', type: 'arrow' }))
  expect(result.current.board.data.globalAnnotations.map(a => a.id)).toContain('g1')
  expect(result.current.past.length).toBe(1)
})

test('removeAnnotation deletes by id and records history; undo restores', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.addAnnotation('frame', 0, { id: 'a1', type: 'arrow' }))
  act(() => result.current.removeAnnotation('frame', 0, 'a1'))
  expect(result.current.board.data.frames[0].annotations).toHaveLength(0)
  act(() => result.current.undo())
  expect(result.current.board.data.frames[0].annotations).toHaveLength(1)
})

test('updateAnnotation 合并 patch（改 text + width）frame scope 并记历史；undo 恢复', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.addAnnotation('frame', 0, { id: 't1', type: 'text', x: 0.5, y: 0.5, text: '旧', width: 0.2, color: '#fff' }))
  act(() => result.current.updateAnnotation('frame', 0, 't1', { text: '新', width: 0.3 }))
  const a = result.current.board.data.frames[0].annotations[0]
  expect(a.text).toBe('新')
  expect(a.width).toBe(0.3)
  expect(a.color).toBe('#fff') // 未在 patch 里的字段保持不变
  act(() => result.current.undo())
  expect(result.current.board.data.frames[0].annotations[0].text).toBe('旧')
})

test('updateAnnotation 合并 patch（global scope）', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.addAnnotation('global', null, { id: 'g1', type: 'text', x: 0.2, y: 0.2, text: 'A', color: '#fff' }))
  act(() => result.current.updateAnnotation('global', null, 'g1', { text: 'B' }))
  expect(result.current.board.data.globalAnnotations.find(a => a.id === 'g1').text).toBe('B')
})

test('renameBoard sets the board name and marks dirty without touching history', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.updateFrameDiscState(0, 'disc-1', { x: 0.7, y: 0.2 })) // 制造一条历史
  const pastLenBefore = result.current.past.length
  act(() => result.current.renameBoard('新名字'))
  expect(result.current.board.name).toBe('新名字')
  expect(result.current.isDirty).toBe(true)
  expect(result.current.past.length).toBe(pastLenBefore) // 历史不变（board.name 不入撤销栈）
})

test('moveAnnotation 本帧→全局：从帧移除、加入 global，记历史，undo 恢复', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.addAnnotation('frame', 0, { id: 'm1', type: 'rect', x1: 0, y1: 0, x2: 0.2, y2: 0.2 }))
  act(() => result.current.moveAnnotation('frame', 0, 'global', null, 'm1'))
  expect(result.current.board.data.frames[0].annotations.find(a => a.id === 'm1')).toBeUndefined()
  expect(result.current.board.data.globalAnnotations.find(a => a.id === 'm1')).toBeTruthy()
  act(() => result.current.undo())
  expect(result.current.board.data.frames[0].annotations.find(a => a.id === 'm1')).toBeTruthy()
  expect(result.current.board.data.globalAnnotations.find(a => a.id === 'm1')).toBeUndefined()
})

test('moveAnnotation 全局→本帧：从 global 移除、加入目标帧', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.addAnnotation('global', null, { id: 'g9', type: 'text', x: 0.1, y: 0.1, text: 'x' }))
  act(() => result.current.moveAnnotation('global', null, 'frame', 0, 'g9'))
  expect(result.current.board.data.globalAnnotations.find(a => a.id === 'g9')).toBeUndefined()
  expect(result.current.board.data.frames[0].annotations.find(a => a.id === 'g9')).toBeTruthy()
})

test('addDisc 给所有帧加一个盘并记历史', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  const before = result.current.board.data.discs.length
  act(() => result.current.addDisc())
  expect(result.current.board.data.discs.length).toBe(before + 1)
  const newId = result.current.board.data.discs[result.current.board.data.discs.length - 1].id
  for (const f of result.current.board.data.frames) {
    expect(f.discStates[newId]).toBeDefined()
  }
  expect(result.current.isDirty).toBe(true)
  expect(result.current.past.length).toBe(1)
})

test('removeDisc 从所有帧删一个盘', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.removeDisc('disc-1'))
  expect(result.current.board.data.discs.find(d => d.id === 'disc-1')).toBeUndefined()
  for (const f of result.current.board.data.frames) {
    expect(f.discStates['disc-1']).toBeUndefined()
  }
})

test('连续 removeDisc 删到空：discs 为空数组、每帧 discStates 为空，且不崩', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.addDisc())
  const ids = result.current.board.data.discs.map(d => d.id)
  act(() => result.current.removeDisc(ids[0]))
  act(() => result.current.removeDisc(ids[1]))
  expect(result.current.board.data.discs).toEqual([])
  for (const f of result.current.board.data.frames) {
    expect(f.discStates).toEqual({})
  }
})

test('setBoard 迁移旧单盘 discState 为 discStates（集成）', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard())) // makeBoard 用旧 discState 结构
  expect(result.current.board.data.discs).toEqual([{ id: 'disc-1' }])
  expect(result.current.board.data.frames[0].discStates['disc-1']).toEqual({ x: 0.5, y: 0.5 })
  expect(result.current.board.data.frames[0].discState).toBeUndefined()
})

test('setTrajectoryCtrl 给球员设控制点并记历史；传 null 删除回直线', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.setTrajectoryCtrl(0, 'player', 'r1', { x: 0.5, y: 0.9 }))
  expect(result.current.board.data.frames[0].playerStates.r1.ctrl).toEqual({ x: 0.5, y: 0.9 })
  expect(result.current.isDirty).toBe(true)
  expect(result.current.past.length).toBe(1)
  act(() => result.current.setTrajectoryCtrl(0, 'player', 'r1', null))
  expect(result.current.board.data.frames[0].playerStates.r1.ctrl).toBeUndefined()
})

test('setTrajectoryCtrl 给飞盘设控制点；undo 恢复', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.setTrajectoryCtrl(0, 'disc', 'disc-1', { x: 0.3, y: 0.7 }))
  expect(result.current.board.data.frames[0].discStates['disc-1'].ctrl).toEqual({ x: 0.3, y: 0.7 })
  act(() => result.current.undo())
  expect(result.current.board.data.frames[0].discStates['disc-1'].ctrl).toBeUndefined()
})

test('updateFramePlayerState 保留已设的 ctrl（拖动球员不丢曲线）', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.setTrajectoryCtrl(0, 'player', 'r1', { x: 0.5, y: 0.9 }))
  act(() => result.current.updateFramePlayerState(0, 'r1', { x: 0.3, y: 0.4, orientation: 0 }))
  expect(result.current.board.data.frames[0].playerStates.r1.ctrl).toEqual({ x: 0.5, y: 0.9 })
  expect(result.current.board.data.frames[0].playerStates.r1.x).toBe(0.3)
})

test('updateFrameDiscState 保留已设的 ctrl（拖动飞盘不丢曲线）', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.setTrajectoryCtrl(0, 'disc', 'disc-1', { x: 0.5, y: 0.9 }))
  act(() => result.current.updateFrameDiscState(0, 'disc-1', { x: 0.3, y: 0.4 }))
  expect(result.current.board.data.frames[0].discStates['disc-1'].ctrl).toEqual({ x: 0.5, y: 0.9 })
  expect(result.current.board.data.frames[0].discStates['disc-1'].x).toBe(0.3)
})

test('insertFrameAfter 不让新帧继承 ctrl（避免凭空曲线）', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard(makeBoard()))
  act(() => result.current.setTrajectoryCtrl(0, 'player', 'r1', { x: 0.5, y: 0.9 }))
  act(() => result.current.insertFrameAfter(0))
  expect(result.current.board.data.frames[1].playerStates.r1.ctrl).toBeUndefined()
})

test('applyFormation sets current frame positions, keeps orientation, drops ctrl', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard({ id: 'b1', name: 'N', data: createDefaultBoardData() }))
  act(() => result.current.updateFramePlayerState(0, 'r1', { orientation: 1.2 }))
  act(() => result.current.setTrajectoryCtrl(0, 'player', 'r1', { x: 0.4, y: 0.4 }))
  const pastBefore = result.current.past.length

  act(() => result.current.applyFormation(0, 'default'))

  const f = result.current.board.data.frames[0]
  expect(f.playerStates.r1.x).toBe(0.15)
  expect(f.playerStates.r1.y).toBe(0.12)
  expect(f.playerStates.r1.orientation).toBe(1.2)
  expect(f.playerStates.r1.ctrl).toBeUndefined()
  expect(f.discStates['disc-1']).toEqual({ x: 0.162, y: 0.534 })
  expect(result.current.past.length).toBe(pastBefore + 1)
})

test('applyFormation is undoable in one step', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard({ id: 'b1', name: 'N', data: createDefaultBoardData() }))
  const before = result.current.board.data.frames[0].playerStates.r1.x
  act(() => result.current.applyFormation(0, 'vstack'))
  expect(result.current.board.data.frames[0].playerStates.r1.x).toBe(0.182)
  act(() => result.current.undo())
  expect(result.current.board.data.frames[0].playerStates.r1.x).toBe(before)
})

test('applyFormation only touches the target frame', () => {
  const { result } = renderHook(() => useBoardStore())
  act(() => result.current.setBoard({ id: 'b1', name: 'N', data: createDefaultBoardData() }))
  act(() => result.current.insertFrameAfter(0))
  const frame1R1Before = result.current.board.data.frames[1].playerStates.r1.x
  act(() => result.current.applyFormation(0, 'hstack'))
  expect(result.current.board.data.frames[0].playerStates.r1.x).toBe(0.221)
  expect(result.current.board.data.frames[1].playerStates.r1.x).toBe(frame1R1Before)
})
