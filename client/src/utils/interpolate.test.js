import { frameStartTimes, totalDuration } from './interpolate'

const frames = [
  { id: 'f0', duration: 1000 },
  { id: 'f1', duration: 500 },
  { id: 'f2', duration: 9999 }, // 最后一帧 duration 无效
]

test('frameStartTimes returns cumulative start time of each frame', () => {
  expect(frameStartTimes(frames)).toEqual([0, 1000, 1500])
})

test('totalDuration sums all but the last frame duration', () => {
  // 1000 + 500，最后一帧不计
  expect(totalDuration(frames)).toBe(1500)
})

test('totalDuration of single frame is 0', () => {
  expect(totalDuration([{ id: 'f0', duration: 1000 }])).toBe(0)
})

import { interpolateAt } from './interpolate'

const animFrames = [
  {
    id: 'f0', duration: 1000,
    playerStates: { r1: { x: 0, y: 0, orientation: 0 } },
    discState: { x: 0, y: 0 },
  },
  {
    id: 'f1', duration: 500,
    playerStates: { r1: { x: 1, y: 0.5, orientation: 2 } },
    discState: { x: 1, y: 1 },
  },
]

test('interpolateAt at frame start returns that frame exactly', () => {
  const v = interpolateAt(animFrames, 0)
  expect(v.playerStates.r1).toEqual({ x: 0, y: 0, orientation: 0 })
  expect(v.discState).toEqual({ x: 0, y: 0 })
})

test('interpolateAt at segment midpoint returns midpoint values', () => {
  const v = interpolateAt(animFrames, 500) // 第0段中点 (0..1000)
  expect(v.playerStates.r1.x).toBeCloseTo(0.5)
  expect(v.playerStates.r1.y).toBeCloseTo(0.25)
  expect(v.playerStates.r1.orientation).toBeCloseTo(1)
  expect(v.discState.x).toBeCloseTo(0.5)
})

test('interpolateAt at/after total duration returns last frame static state', () => {
  const v = interpolateAt(animFrames, 1000) // == totalDuration，落在最后一帧
  expect(v.playerStates.r1).toEqual({ x: 1, y: 0.5, orientation: 2 })
  const v2 = interpolateAt(animFrames, 99999)
  expect(v2.playerStates.r1).toEqual({ x: 1, y: 0.5, orientation: 2 })
})

test('interpolateAt with single frame returns that frame', () => {
  const single = [animFrames[0]]
  const v = interpolateAt(single, 0)
  expect(v.playerStates.r1).toEqual({ x: 0, y: 0, orientation: 0 })
})
