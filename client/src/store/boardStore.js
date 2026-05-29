import { create } from 'zustand'

const useBoardStore = create((set) => ({
  board: null,
  currentFrameIndex: 0,
  isDirty: false,

  setBoard: (board) => set({ board, currentFrameIndex: 0, isDirty: false }),

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

  addFrame: () => set((s) => {
    const frames = s.board.data.frames
    const last = frames[frames.length - 1]
    const newFrame = {
      ...JSON.parse(JSON.stringify(last)),
      id: `frame-${Date.now()}`,
      annotations: [],
    }
    return {
      board: { ...s.board, data: { ...s.board.data, frames: [...frames, newFrame] } },
      currentFrameIndex: frames.length,
      isDirty: true,
    }
  }),

  removeFrame: (frameIndex) => set((s) => {
    if (s.board.data.frames.length <= 1) return s
    const frames = s.board.data.frames.filter((_, i) => i !== frameIndex)
    const currentFrameIndex = Math.min(s.currentFrameIndex, frames.length - 1)
    return {
      board: { ...s.board, data: { ...s.board.data, frames } },
      currentFrameIndex,
      isDirty: true,
    }
  }),

  setCurrentFrame: (frameIndex) => set({ currentFrameIndex: frameIndex }),

  renamePlayer: (playerId, name) => set((s) => {
    const players = s.board.data.players.map((p) =>
      p.id === playerId ? { ...p, name } : p
    )
    return { board: { ...s.board, data: { ...s.board.data, players } }, isDirty: true }
  }),

  markClean: () => set({ isDirty: false }),
}))

export { useBoardStore }
