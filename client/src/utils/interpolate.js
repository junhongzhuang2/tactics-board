// 每帧在整条时间轴上的起始毫秒位置
export function frameStartTimes(frames) {
  const starts = []
  let acc = 0
  for (let i = 0; i < frames.length; i++) {
    starts.push(acc)
    acc += frames[i].duration
  }
  return starts
}

// 时间轴总长度 = 除最后一帧外所有帧 duration 之和（最后一帧无下一帧可过渡）
export function totalDuration(frames) {
  let acc = 0
  for (let i = 0; i < frames.length - 1; i++) {
    acc += frames[i].duration
  }
  return acc
}
