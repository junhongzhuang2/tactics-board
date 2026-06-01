import { orientationFromHandle, handleOffset, coneWedgeRotationDeg, clampPanel } from './cone'

test('orientationFromHandle maps cardinal directions', () => {
  expect(orientationFromHandle(10, 0)).toBeCloseTo(0)            // 右
  expect(orientationFromHandle(0, 10)).toBeCloseTo(Math.PI / 2)  // 下
  expect(Math.abs(orientationFromHandle(-10, 0))).toBeCloseTo(Math.PI) // 左 ±π
  expect(orientationFromHandle(0, -10)).toBeCloseTo(-Math.PI / 2) // 上
})

test('handleOffset places the handle on the radius circle', () => {
  const r = handleOffset(0, 64);          expect(r.x).toBeCloseTo(64);  expect(r.y).toBeCloseTo(0)
  const d = handleOffset(Math.PI / 2, 64); expect(d.x).toBeCloseTo(0);   expect(d.y).toBeCloseTo(64)
  const u = handleOffset(-Math.PI / 2, 64);expect(u.x).toBeCloseTo(0);   expect(u.y).toBeCloseTo(-64)
})

test('coneWedgeRotationDeg centers the wedge on the facing direction (boundaries)', () => {
  expect(coneWedgeRotationDeg(0, 90)).toBeCloseTo(-45)
  expect(coneWedgeRotationDeg(Math.PI, 90)).toBeCloseTo(135)      // 左
  expect(coneWedgeRotationDeg(-Math.PI, 90)).toBeCloseTo(-225)    // 左（另一符号）
  expect(coneWedgeRotationDeg(-Math.PI / 2, 90)).toBeCloseTo(-135) // 上
})

test('coneWedgeRotationDeg gives visually-equivalent rotation for +pi and -pi (no flip/flicker)', () => {
  const norm = (deg) => ((deg % 360) + 360) % 360
  expect(norm(coneWedgeRotationDeg(Math.PI, 90))).toBeCloseTo(norm(coneWedgeRotationDeg(-Math.PI, 90)))
})

test('clampPanel keeps the panel inside the viewport', () => {
  expect(clampPanel(100, 100, 200, 120, 1000, 800)).toEqual({ x: 100, y: 100 }) // 不越界
  expect(clampPanel(900, 100, 200, 120, 1000, 800)).toEqual({ x: 800, y: 100 }) // 右越界
  expect(clampPanel(100, 750, 200, 120, 1000, 800)).toEqual({ x: 100, y: 680 }) // 底越界
  expect(clampPanel(50, 50, 1200, 120, 1000, 800)).toEqual({ x: 0, y: 50 })     // 面板比视口还宽 → 夹到 0
})
