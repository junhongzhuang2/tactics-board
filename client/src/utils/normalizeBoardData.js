// 把旧的单盘结构（frame.discState）迁移成多盘（board.data.discs + frame.discStates）。幂等、不可变。
export function normalizeBoardData(data) {
  const discs = data.discs ?? [{ id: 'disc-1' }]
  const frames = data.frames.map((f) => {
    if (f.discStates) return f // 已是新结构
    const { discState, ...rest } = f
    return { ...rest, discStates: discState ? { 'disc-1': discState } : {} }
  })
  return { ...data, discs, frames }
}
