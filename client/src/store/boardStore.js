import { create } from 'zustand'
import { frameStartTimes, totalDuration } from '../utils/interpolate'

const MIN_DURATION = 100

const useBoardStore = create((set) => ({
  board: null,
  currentFrameIndex: 0,
  isDirty: false,
  isPlaying: false,
  playheadTime: 0,
  loop: false,

  setBoard: (board) => set({
    board, currentFrameIndex: 0, isDirty: false,
    isPlaying: false, playheadTime: 0, loop: false,
  }),

  updateFramePlayerState: (frameIndex, playerId, state) => set((s) => {
    const frames = s.board.data.frames.map((f, i) =>
      i === frameIndex
        ? { ...f, playerStates: { ...f.playerStates, [playerId]: state } }
        : f
    )
    return { board: { ...s.board, data: { ...s.board.data, frames } }, isDirty: true }
  }),

  updateFrameDiscState: (frameIndex, discState) => set((s) => {
    const frames = s.board.data.frames.map((f, i) =>
      i === frameIndex ? { ...f, discState } : f
    )
    return { board: { ...s.board, data: { ...s.board.data, frames } }, isDirty: true }
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
    return {
      board: { ...s.board, data: { ...s.board.data, frames: next } },
      currentFrameIndex: newIndex,
      playheadTime: frameStartTimes(next)[newIndex],
      isPlaying: false,
      isDirty: true,
    }
  }),

  setFrameDuration: (index, ms) => set((s) => {
    const duration = Math.max(MIN_DURATION, Math.round(ms))
    const frames = s.board.data.frames.map((f, i) =>
      i === index ? { ...f, duration } : f
    )
    return { board: { ...s.board, data: { ...s.board.data, frames } }, isDirty: true }
  }),

  removeFrame: (frameIndex) => set((s) => {
    if (s.board.data.frames.length <= 1) return s
    const frames = s.board.data.frames.filter((_, i) => i !== frameIndex)
    const currentFrameIndex = Math.min(s.currentFrameIndex, frames.length - 1)
    return {
      board: { ...s.board, data: { ...s.board.data, frames } },
      currentFrameIndex,
      playheadTime: frameStartTimes(frames)[currentFrameIndex],
      isPlaying: false,
      isDirty: true,
    }
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
    return { board: { ...s.board, data: { ...s.board.data, players } }, isDirty: true }
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

  markClean: () => set({ isDirty: false }),
}))

export { useBoardStore }
