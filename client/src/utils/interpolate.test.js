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
