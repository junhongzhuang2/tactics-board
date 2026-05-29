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

// 播放头精确停在某关键帧起点且未播放时返回该帧索引，否则 -1
export function getEditableFrameIndex(frames, playheadTime, isPlaying) {
  if (isPlaying) return -1
  const starts = frameStartTimes(frames)
  return starts.findIndex((s) => s === playheadTime)
}

// 推进播放头：返回新位置与是否应停止（rAF 循环用）
export function advancePlayhead(playheadTime, dt, total, loop) {
  if (total <= 0) return { next: 0, stop: false }
  const next = playheadTime + dt
  if (next >= total) {
    if (loop) return { next: next % total, stop: false }
    return { next: total, stop: true }
  }
  return { next, stop: false }
}

// 拖帧块右边缘改时长：起始时长 + 像素位移×每像素毫秒，floor 到最小值
export function durationFromDrag(startDuration, deltaPx, msPerPx, minDuration = 100) {
  return Math.max(minDuration, Math.round(startDuration + deltaPx * msPerPx))
}
