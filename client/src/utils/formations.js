// 归一化坐标（0..1）。数组下标 i 对应球衣号 i+1。红队左进攻、蓝队右防守、飞盘给红队。
// 坐标由用户在可视化拖拽编辑器中亲手摆定。
export const FORMATIONS = {
  default: {
    label: '默认阵型',
    red:  [[0.15,0.12],[0.15,0.25],[0.15,0.38],[0.15,0.50],[0.15,0.63],[0.15,0.76],[0.15,0.88]],
    blue: [[0.85,0.12],[0.85,0.25],[0.85,0.38],[0.85,0.50],[0.85,0.63],[0.85,0.76],[0.85,0.88]],
    disc: [0.162,0.534],
  },
  vstack: {
    label: '竖排',
    red:  [[0.182,0.441],[0.18,0.618],[0.42,0.50],[0.49,0.50],[0.56,0.50],[0.63,0.50],[0.70,0.50]],
    blue: [[0.20,0.401],[0.20,0.576],[0.411,0.556],[0.48,0.56],[0.548,0.562],[0.618,0.557],[0.688,0.562]],
    disc: [0.189,0.481],
  },
  hstack: {
    label: '横排',
    red:  [[0.221,0.494],[0.22,0.35],[0.22,0.65],[0.509,0.241],[0.509,0.447],[0.506,0.637],[0.506,0.836]],
    blue: [[0.244,0.463],[0.252,0.363],[0.245,0.617],[0.53,0.20],[0.53,0.40],[0.53,0.60],[0.53,0.80]],
    disc: [0.229,0.523],
  },
  zone: {
    label: 'Zone',
    red:  [[0.242,0.497],[0.24,0.299],[0.242,0.689],[0.513,0.205],[0.512,0.399],[0.511,0.604],[0.514,0.792]],
    blue: [[0.242,0.444],[0.288,0.375],[0.298,0.502],[0.485,0.317],[0.471,0.502],[0.491,0.698],[0.638,0.494]],
    disc: [0.252,0.531],
  },
  junk: {
    label: 'Junk',
    red:  [[0.241,0.498],[0.243,0.299],[0.242,0.71],[0.48,0.22],[0.48,0.398],[0.485,0.576],[0.487,0.781]],
    blue: [[0.287,0.495],[0.272,0.385],[0.27,0.613],[0.456,0.317],[0.443,0.488],[0.475,0.669],[0.619,0.463]],
    disc: [0.247,0.533],
  },
}

export const FORMATION_ORDER = ['default', 'vstack', 'hstack', 'zone', 'junk']

// 返回 { playerStates: {id:{x,y}}, discStates: {discId:{x,y}} } 补丁。
// 只含每个元素的新 x,y；不含 orientation/ctrl（合并交给 store）。
export function buildFormationPatch(formationKey, players, discs) {
  const f = FORMATIONS[formationKey]
  if (!f) return { playerStates: {}, discStates: {} }
  const playerStates = {}
  for (const p of players) {
    const arr = p.team === 'red' ? f.red : p.team === 'blue' ? f.blue : null
    const coord = arr && arr[p.number - 1]
    if (coord) playerStates[p.id] = { x: coord[0], y: coord[1] }
  }
  const discStates = {}
  if (discs.length > 0 && f.disc) {
    discStates[discs[0].id] = { x: f.disc[0], y: f.disc[1] }
  }
  return { playerStates, discStates }
}
