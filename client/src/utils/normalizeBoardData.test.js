import { normalizeBoardData } from './normalizeBoardData'

test('迁移旧单盘 discState → discStates[disc-1] 并补 discs', () => {
  const old = {
    players: [], globalAnnotations: [],
    frames: [
      { id: 'f0', playerStates: {}, discState: { x: 0.5, y: 0.5 } },
      { id: 'f1', playerStates: {}, discState: { x: 0.3, y: 0.7 } },
    ],
  }
  const n = normalizeBoardData(old)
  expect(n.discs).toEqual([{ id: 'disc-1' }])
  expect(n.frames[0].discStates).toEqual({ 'disc-1': { x: 0.5, y: 0.5 } })
  expect(n.frames[1].discStates).toEqual({ 'disc-1': { x: 0.3, y: 0.7 } })
  expect(n.frames[0].discState).toBeUndefined()
})

test('已是新结构则幂等', () => {
  const cur = {
    players: [], globalAnnotations: [],
    discs: [{ id: 'disc-1' }, { id: 'disc-2' }],
    frames: [{ id: 'f0', playerStates: {}, discStates: { 'disc-1': { x: 0.5, y: 0.5 }, 'disc-2': { x: 0.6, y: 0.6 } } }],
  }
  const n = normalizeBoardData(cur)
  expect(n.discs).toEqual([{ id: 'disc-1' }, { id: 'disc-2' }])
  expect(n.frames[0].discStates).toEqual({ 'disc-1': { x: 0.5, y: 0.5 }, 'disc-2': { x: 0.6, y: 0.6 } })
})

test('不可变：不改入参', () => {
  const old = { players: [], globalAnnotations: [], frames: [{ id: 'f0', playerStates: {}, discState: { x: 0.5, y: 0.5 } }] }
  normalizeBoardData(old)
  expect(old.frames[0].discState).toEqual({ x: 0.5, y: 0.5 })
  expect(old.discs).toBeUndefined()
})
