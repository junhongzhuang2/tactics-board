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
    discStates: { 'disc-1': { x: 0, y: 0 } },
  },
  {
    id: 'f1', duration: 500,
    playerStates: { r1: { x: 1, y: 0.5, orientation: 2 } },
    discStates: { 'disc-1': { x: 1, y: 1 } },
  },
]

test('interpolateAt at frame start returns that frame exactly', () => {
  const v = interpolateAt(animFrames, 0)
  expect(v.playerStates.r1).toEqual({ x: 0, y: 0, orientation: 0 })
  expect(v.discStates['disc-1']).toEqual({ x: 0, y: 0 })
})

test('interpolateAt at segment midpoint returns midpoint values', () => {
  const v = interpolateAt(animFrames, 500) // 第0段中点 (0..1000)
  expect(v.playerStates.r1.x).toBeCloseTo(0.5)
  expect(v.playerStates.r1.y).toBeCloseTo(0.25)
  expect(v.playerStates.r1.orientation).toBeCloseTo(1)
  expect(v.discStates['disc-1'].x).toBeCloseTo(0.5)
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

import { getEditableFrameIndex } from './interpolate'

const efFrames = [
  { id: 'f0', duration: 1000, playerStates: {}, discState: { x: 0, y: 0 } },
  { id: 'f1', duration: 500, playerStates: {}, discState: { x: 0, y: 0 } },
  { id: 'f2', duration: 0, playerStates: {}, discState: { x: 0, y: 0 } },
]
// frameStartTimes = [0, 1000, 1500]

test('getEditableFrameIndex returns index when parked exactly on a keyframe start', () => {
  expect(getEditableFrameIndex(efFrames, 0, false)).toBe(0)
  expect(getEditableFrameIndex(efFrames, 1000, false)).toBe(1)
  expect(getEditableFrameIndex(efFrames, 1500, false)).toBe(2) // 最后一帧也可编辑
})

test('getEditableFrameIndex returns -1 between keyframes', () => {
  expect(getEditableFrameIndex(efFrames, 500, false)).toBe(-1)
})

test('getEditableFrameIndex returns -1 while playing', () => {
  expect(getEditableFrameIndex(efFrames, 0, true)).toBe(-1)
})

import { activeFrameIndex } from './interpolate'

const afFrames = [
  { id: 'f0', duration: 1000, playerStates: {}, discState: { x: 0, y: 0 } },
  { id: 'f1', duration: 500, playerStates: {}, discState: { x: 0, y: 0 } },
  { id: 'f2', duration: 0, playerStates: {}, discState: { x: 0, y: 0 } },
]
// frameStartTimes = [0, 1000, 1500]; total = 1500

test('activeFrameIndex returns segment index for the playhead', () => {
  expect(activeFrameIndex(afFrames, 0)).toBe(0)
  expect(activeFrameIndex(afFrames, 500)).toBe(0)   // within seg 0
  expect(activeFrameIndex(afFrames, 1000)).toBe(1)  // start of f1
  expect(activeFrameIndex(afFrames, 1200)).toBe(1)
  expect(activeFrameIndex(afFrames, 1500)).toBe(2)  // at total -> last
  expect(activeFrameIndex(afFrames, 99999)).toBe(2)
})

test('activeFrameIndex returns 0 for single frame', () => {
  expect(activeFrameIndex([afFrames[0]], 0)).toBe(0)
})

import { lerpAngle } from './interpolate'

test('lerpAngle handles the normal case', () => {
  expect(lerpAngle(0, Math.PI / 2, 0.5)).toBeCloseTo(Math.PI / 4)
})

test('lerpAngle crosses straight-left via the short path, not the long way', () => {
  const a = (170 * Math.PI) / 180
  const b = (-170 * Math.PI) / 180
  expect(Math.abs(lerpAngle(a, b, 0.5))).toBeCloseTo(Math.PI) // 落在正左 ±π，而非接近 0
})

test('interpolateAt uses shortest-path orientation (no 340-degree spin)', () => {
  const frames = [
    { id: 'f0', duration: 1000, playerStates: { r1: { x: 0.5, y: 0.5, orientation: (170 * Math.PI) / 180 } }, discState: { x: 0, y: 0 } },
    { id: 'f1', duration: 500,  playerStates: { r1: { x: 0.5, y: 0.5, orientation: (-170 * Math.PI) / 180 } }, discState: { x: 0, y: 0 } },
  ]
  const v = interpolateAt(frames, 500) // 第0段中点
  expect(Math.abs(v.playerStates.r1.orientation)).toBeCloseTo(Math.PI) // 正左，不是 0
})

import { advancePlayhead, durationFromDrag } from './interpolate'

test('advancePlayhead advances within range', () => {
  expect(advancePlayhead(100, 50, 1000, false)).toEqual({ next: 150, stop: false })
})

test('advancePlayhead stops at total when not looping and reaching end', () => {
  expect(advancePlayhead(980, 50, 1000, false)).toEqual({ next: 1000, stop: true })
})

test('advancePlayhead wraps around when looping', () => {
  const r = advancePlayhead(980, 70, 1000, true) // 1050 % 1000 = 50
  expect(r.stop).toBe(false)
  expect(r.next).toBeCloseTo(50)
})

test('advancePlayhead with zero total stays at 0', () => {
  expect(advancePlayhead(0, 50, 0, true)).toEqual({ next: 0, stop: false })
})

test('durationFromDrag adds pixel delta scaled by msPerPx', () => {
  // 往右拖 20px，每像素 10ms => +200ms
  expect(durationFromDrag(1000, 20, 10)).toBe(1200)
  // 往左拖
  expect(durationFromDrag(1000, -30, 10)).toBe(700)
})

test('durationFromDrag floors at minimum 100ms', () => {
  expect(durationFromDrag(200, -50, 10)).toBe(100) // 200-500 -> floor 100
})

test('durationFromDrag rounds to integer ms', () => {
  expect(durationFromDrag(1000, 3, 3.33)).toBe(1010) // 1000 + 9.99 -> 1010
})
