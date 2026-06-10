import '@testing-library/jest-dom'

// jsdom 没有 canvas，mock 掉避免 Konva 报错
HTMLCanvasElement.prototype.getContext = () => ({
  fillRect: () => {},
  clearRect: () => {},
  getImageData: () => ({ data: [] }),
  putImageData: () => {},
  createImageData: () => [],
  setTransform: () => {},
  drawImage: () => {},
  save: () => {},
  fillText: () => {},
  restore: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  closePath: () => {},
  stroke: () => {},
  translate: () => {},
  scale: () => {},
  rotate: () => {},
  arc: () => {},
  fill: () => {},
  measureText: () => ({ width: 0 }),
  transform: () => {},
  rect: () => {},
  clip: () => {},
})

// jsdom 没有 ResizeObserver；Timeline 滑块测量用到，mock 成空实现
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
