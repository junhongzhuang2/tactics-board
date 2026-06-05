// 把旧的单盘结构（frame.discState）迁移成多盘（board.data.discs + frame.discStates）。幂等、不可变。
export function normalizeBoardData(data) {
  let discs = data.discs
  if (!discs) {
    // 无顶层 discs：优先从各帧 discStates 键的并集推导（防 discStates 有键但 discs 缺失导致盘"消失"）；
    // 否则按旧单盘补 disc-1（frames 此时还是旧 discState 形态，下面的 map 会把它转成 discStates['disc-1']）。
    const ids = new Set()
    for (const f of data.frames) {
      if (f.discStates) for (const id in f.discStates) ids.add(id)
    }
    discs = ids.size > 0 ? [...ids].map((id) => ({ id })) : [{ id: 'disc-1' }]
  }
  const frames = data.frames.map((f) => {
    if (f.discStates) return f // 已是新结构
    const { discState, ...rest } = f
    return { ...rest, discStates: discState ? { 'disc-1': discState } : {} }
  })
  return { ...data, discs, frames }
}
