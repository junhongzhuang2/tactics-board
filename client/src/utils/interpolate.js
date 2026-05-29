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

function lerp(a, b, t) {
  return a + (b - a) * t
}

function snapshot(frame) {
  const playerStates = {}
  for (const id in frame.playerStates) {
    playerStates[id] = { ...frame.playerStates[id] }
  }
  return { playerStates, discState: { ...frame.discState } }
}

function lerpFrames(f0, f1, t) {
  const playerStates = {}
  for (const id in f0.playerStates) {
    const s0 = f0.playerStates[id]
    const s1 = f1.playerStates[id] ?? s0
    playerStates[id] = {
      x: lerp(s0.x, s1.x, t),
      y: lerp(s0.y, s1.y, t),
      orientation: lerp(s0.orientation, s1.orientation, t),
    }
  }
  return {
    playerStates,
    discState: {
      x: lerp(f0.discState.x, f1.discState.x, t),
      y: lerp(f0.discState.y, f1.discState.y, t),
    },
  }
}

// 给定整条时间轴上的毫秒位置，返回所有元素插值后的位置
export function interpolateAt(frames, playheadTime) {
  if (frames.length === 1) return snapshot(frames[0])
  const total = totalDuration(frames)
  if (playheadTime >= total) return snapshot(frames[frames.length - 1])
  if (playheadTime <= 0) return snapshot(frames[0])

  const starts = frameStartTimes(frames)
  let i = 0
  for (let k = 0; k < frames.length - 1; k++) {
    if (playheadTime >= starts[k] && playheadTime < starts[k + 1]) {
      i = k
      break
    }
  }
  const dur = frames[i].duration
  const t = dur > 0 ? (playheadTime - starts[i]) / dur : 0
  return lerpFrames(frames[i], frames[i + 1], t)
}
