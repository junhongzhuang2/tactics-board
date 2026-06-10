// 一帧是否被教练手动改过：有标注，或任一 player/disc 带贝塞尔曲率 ctrl。
// 用于时间轴把「有战术发生」的帧标成飞盘黄小点。
export function isFrameModified(frame) {
  if (frame.annotations && frame.annotations.length > 0) return true
  for (const id in frame.playerStates) {
    if (frame.playerStates[id]?.ctrl) return true
  }
  for (const id in frame.discStates) {
    if (frame.discStates[id]?.ctrl) return true
  }
  return false
}
