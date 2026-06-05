import { create } from 'zustand'
import { frameStartTimes, totalDuration } from '../utils/interpolate'
import { normalizeBoardData } from '../utils/normalizeBoardData'

const MIN_DURATION = 100
const HISTORY_LIMIT = 200

// 快照保存对旧 board.data 的引用（依赖 reducer 全程不可变更新）；
// 播放头不入快照——恢复时由 currentFrameIndex 推导到关键帧起点，保证落点可编辑
const snapshot = (s) => ({
  data: s.board.data,
  currentFrameIndex: s.currentFrameIndex,
})

// 在改动前压栈、清空重做栈，再合并本次改动
const withHistory = (s, next) => ({
  ...next,
  past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
  future: [],
})

const useBoardStore = create((set) => ({
  board: null,
  currentFrameIndex: 0,
  isDirty: false,
  isPlaying: false,
  playheadTime: 0,
  loop: false,
  past: [],
  future: [],

  setBoard: (board) => set({
    board: { ...board, data: normalizeBoardData(board.data) },
    currentFrameIndex: 0, isDirty: false,
    isPlaying: false, playheadTime: 0, loop: false,
    past: [], future: [],
  }),

  renameBoard: (name) => set((s) => {
    if (!s.board) return s
    return { board: { ...s.board, name }, isDirty: true }
  }),

  updateFramePlayerState: (frameIndex, playerId, state) => set((s) => {
    const frames = s.board.data.frames.map((f, i) =>
      i === frameIndex
        ? { ...f, playerStates: { ...f.playerStates, [playerId]: state } }
        : f
    )
    return withHistory(s, { board: { ...s.board, data: { ...s.board.data, frames } }, isDirty: true })
  }),

  updateFrameDiscState: (frameIndex, discId, state) => set((s) => {
    const frames = s.board.data.frames.map((f, i) =>
      i === frameIndex ? { ...f, discStates: { ...f.discStates, [discId]: state } } : f
    )
    return withHistory(s, { board: { ...s.board, data: { ...s.board.data, frames } }, isDirty: true })
  }),

  addDisc: () => set((s) => {
    const data = s.board.data
    const id = `disc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const n = data.discs.length
    const clamp = (v) => Math.min(1, Math.max(0, v))
    const pos = { x: clamp(0.5 + n * 0.04), y: clamp(0.5 + n * 0.04) }
    const discs = [...data.discs, { id }]
    const frames = data.frames.map((f) => ({ ...f, discStates: { ...f.discStates, [id]: pos } }))
    return withHistory(s, { board: { ...s.board, data: { ...data, discs, frames } }, isDirty: true })
  }),

  removeDisc: (discId) => set((s) => {
    const data = s.board.data
    const discs = data.discs.filter((d) => d.id !== discId)
    const frames = data.frames.map((f) => {
      const { [discId]: _removed, ...rest } = f.discStates ?? {}
      return { ...f, discStates: rest }
    })
    return withHistory(s, { board: { ...s.board, data: { ...data, discs, frames } }, isDirty: true })
  }),

  insertFrameAfter: (index) => set((s) => {
    const frames = s.board.data.frames
    const src = frames[index]
    const newFrame = {
      ...JSON.parse(JSON.stringify(src)),
      id: `frame-${Date.now()}`,
      annotations: [],
    }
    const next = [...frames.slice(0, index + 1), newFrame, ...frames.slice(index + 1)]
    const newIndex = index + 1
    return withHistory(s, {
      board: { ...s.board, data: { ...s.board.data, frames: next } },
      currentFrameIndex: newIndex,
      playheadTime: frameStartTimes(next)[newIndex],
      isPlaying: false,
      isDirty: true,
    })
  }),

  setFrameDuration: (index, ms) => set((s) => {
    const duration = Math.max(MIN_DURATION, Math.round(ms))
    const frames = s.board.data.frames.map((f, i) =>
      i === index ? { ...f, duration } : f
    )
    return withHistory(s, { board: { ...s.board, data: { ...s.board.data, frames } }, isDirty: true })
  }),

  removeFrame: (frameIndex) => set((s) => {
    if (s.board.data.frames.length <= 1) return s
    const frames = s.board.data.frames.filter((_, i) => i !== frameIndex)
    const currentFrameIndex = Math.min(s.currentFrameIndex, frames.length - 1)
    return withHistory(s, {
      board: { ...s.board, data: { ...s.board.data, frames } },
      currentFrameIndex,
      playheadTime: frameStartTimes(frames)[currentFrameIndex],
      isPlaying: false,
      isDirty: true,
    })
  }),

  setCurrentFrame: (frameIndex) => set((s) => ({
    currentFrameIndex: frameIndex,
    playheadTime: frameStartTimes(s.board.data.frames)[frameIndex],
    isPlaying: false,
  })),

  renamePlayer: (playerId, name) => set((s) => {
    const players = s.board.data.players.map((p) =>
      p.id === playerId ? { ...p, name } : p
    )
    return withHistory(s, { board: { ...s.board, data: { ...s.board.data, players } }, isDirty: true })
  }),

  setPlayerShowCone: (playerId, show) => set((s) => {
    const players = s.board.data.players.map((p) =>
      p.id === playerId ? { ...p, showCone: show } : p
    )
    return withHistory(s, { board: { ...s.board, data: { ...s.board.data, players } }, isDirty: true })
  }),

  addAnnotation: (scope, frameIndex, annotation) => set((s) => {
    const data = s.board.data
    if (scope === 'global') {
      const globalAnnotations = [...(data.globalAnnotations ?? []), annotation]
      return withHistory(s, { board: { ...s.board, data: { ...data, globalAnnotations } }, isDirty: true })
    }
    const frames = data.frames.map((f, i) =>
      i === frameIndex ? { ...f, annotations: [...(f.annotations ?? []), annotation] } : f
    )
    return withHistory(s, { board: { ...s.board, data: { ...data, frames } }, isDirty: true })
  }),

  removeAnnotation: (scope, frameIndex, annotationId) => set((s) => {
    const data = s.board.data
    if (scope === 'global') {
      const globalAnnotations = (data.globalAnnotations ?? []).filter((a) => a.id !== annotationId)
      return withHistory(s, { board: { ...s.board, data: { ...data, globalAnnotations } }, isDirty: true })
    }
    const frames = data.frames.map((f, i) =>
      i === frameIndex ? { ...f, annotations: (f.annotations ?? []).filter((a) => a.id !== annotationId) } : f
    )
    return withHistory(s, { board: { ...s.board, data: { ...data, frames } }, isDirty: true })
  }),

  updateAnnotation: (scope, frameIndex, annotationId, patch) => set((s) => {
    const data = s.board.data
    const apply = (a) => (a.id === annotationId ? { ...a, ...patch } : a)
    if (scope === 'global') {
      const globalAnnotations = (data.globalAnnotations ?? []).map(apply)
      return withHistory(s, { board: { ...s.board, data: { ...data, globalAnnotations } }, isDirty: true })
    }
    const frames = data.frames.map((f, i) =>
      i === frameIndex ? { ...f, annotations: (f.annotations ?? []).map(apply) } : f
    )
    return withHistory(s, { board: { ...s.board, data: { ...data, frames } }, isDirty: true })
  }),

  moveAnnotation: (fromScope, fromFrameIndex, toScope, toFrameIndex, annotationId) => set((s) => {
    const data = s.board.data
    let moved
    const pluck = (arr) => (arr ?? []).filter((a) => {
      if (a.id === annotationId) { moved = a; return false }
      return true
    })
    let globalAnnotations = data.globalAnnotations ?? []
    let frames = data.frames
    if (fromScope === 'global') globalAnnotations = pluck(globalAnnotations)
    else frames = frames.map((f, i) => (i === fromFrameIndex ? { ...f, annotations: pluck(f.annotations) } : f))
    if (!moved) return s
    if (toScope === 'global') globalAnnotations = [...globalAnnotations, moved]
    else frames = frames.map((f, i) => (i === toFrameIndex ? { ...f, annotations: [...(f.annotations ?? []), moved] } : f))
    return withHistory(s, { board: { ...s.board, data: { ...data, globalAnnotations, frames } }, isDirty: true })
  }),

  play: () => set((s) => {
    if (!s.board) return s
    const total = totalDuration(s.board.data.frames)
    if (total <= 0) return s // 单帧无可播放内容，保持暂停
    const playheadTime = (!s.loop && s.playheadTime >= total) ? 0 : s.playheadTime
    return { isPlaying: true, playheadTime }
  }),
  pause: () => set({ isPlaying: false }),
  toggleLoop: () => set((s) => ({ loop: !s.loop })),
  setPlayhead: (ms) => set({ playheadTime: ms }),

  undo: () => set((s) => {
    if (s.past.length === 0) return s
    const prev = s.past[s.past.length - 1]
    const cur = snapshot(s)
    return {
      board: { ...s.board, data: prev.data },
      currentFrameIndex: prev.currentFrameIndex,
      playheadTime: frameStartTimes(prev.data.frames)[prev.currentFrameIndex],
      isPlaying: false,
      isDirty: true,
      past: s.past.slice(0, -1),
      future: [...s.future, cur],
    }
  }),

  redo: () => set((s) => {
    if (s.future.length === 0) return s
    const entry = s.future[s.future.length - 1]
    const cur = snapshot(s)
    return {
      board: { ...s.board, data: entry.data },
      currentFrameIndex: entry.currentFrameIndex,
      playheadTime: frameStartTimes(entry.data.frames)[entry.currentFrameIndex],
      isPlaying: false,
      isDirty: true,
      past: [...s.past, cur],
      future: s.future.slice(0, -1),
    }
  }),

  markClean: () => set({ isDirty: false }),
}))

export { useBoardStore }
