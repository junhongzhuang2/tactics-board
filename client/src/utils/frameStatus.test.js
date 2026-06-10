import { isFrameModified } from './frameStatus'

test('空帧（无标注、无 ctrl）→ false', () => {
  expect(isFrameModified({ playerStates: { p1: { x: 0.1, y: 0.2 } }, discStates: {}, annotations: [] })).toBe(false)
})

test('缺省 playerStates/discStates/annotations 也不报错 → false', () => {
  expect(isFrameModified({})).toBe(false)
})

test('有本帧标注 → true', () => {
  expect(isFrameModified({ playerStates: {}, discStates: {}, annotations: [{ id: 'a' }] })).toBe(true)
})

test('某 player 带贝塞尔 ctrl → true', () => {
  expect(isFrameModified({
    playerStates: { p1: { x: 0.1, y: 0.2, ctrl: { x: 0.3, y: 0.4 } } },
    discStates: {}, annotations: [],
  })).toBe(true)
})

test('某 disc 带 ctrl → true', () => {
  expect(isFrameModified({
    playerStates: {}, discStates: { d1: { x: 0.5, y: 0.5, ctrl: { x: 0.6, y: 0.6 } } }, annotations: [],
  })).toBe(true)
})
