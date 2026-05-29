export function toCanvas(normX, normY, fieldWidth, fieldHeight) {
  return { x: normX * fieldWidth, y: normY * fieldHeight }
}

export function toNorm(canvasX, canvasY, fieldWidth, fieldHeight) {
  return { x: canvasX / fieldWidth, y: canvasY / fieldHeight }
}

export function clampToField(x, y) {
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
  }
}
