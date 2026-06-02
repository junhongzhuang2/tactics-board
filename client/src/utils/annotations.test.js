import {
  createArrowAnnotation, visibleAnnotations, arrowPixelLength, MIN_ARROW_PX,
  createRectAnnotation, createEllipseAnnotation, createTextAnnotation,
  MIN_SHAPE_PX, DEFAULT_FONT_PX, ANNO_COLORS,
} from './annotations'

test('createArrowAnnotation builds an arrow with a unique id and fields', () => {
  const a = createArrowAnnotation('pass', 0.1, 0.2, 0.3, 0.4, '#ffeb3b')
  expect(a.type).toBe('arrow')
  expect(a.variant).toBe('pass')
  expect([a.x1, a.y1, a.x2, a.y2]).toEqual([0.1, 0.2, 0.3, 0.4])
  expect(a.color).toBe('#ffeb3b')
  expect(a.id).toMatch(/^anno-/)
})

test('createArrowAnnotation produces distinct ids for arrows made in the same tick', () => {
  const a = createArrowAnnotation('pass', 0, 0, 1, 1, '#fff')
  const b = createArrowAnnotation('pass', 0, 0, 1, 1, '#fff')
  expect(a.id).not.toBe(b.id)
})

test('visibleAnnotations returns globals always plus the active frame annotations, tagged', () => {
  const data = {
    globalAnnotations: [{ id: 'g1' }],
    frames: [{ annotations: [{ id: 'f0a' }] }, { annotations: [{ id: 'f1a' }] }],
  }
  expect(visibleAnnotations(data, 1)).toEqual([
    { annotation: { id: 'g1' }, scope: 'global', frameIndex: null },
    { annotation: { id: 'f1a' }, scope: 'frame', frameIndex: 1 },
  ])
})

test('visibleAnnotations with no frame annotations returns only globals', () => {
  const data = { globalAnnotations: [{ id: 'g1' }], frames: [{ annotations: [] }] }
  expect(visibleAnnotations(data, 0)).toEqual([
    { annotation: { id: 'g1' }, scope: 'global', frameIndex: null },
  ])
})

test('arrowPixelLength is euclidean; MIN_ARROW_PX is 5', () => {
  expect(arrowPixelLength(0, 0, 3, 4)).toBe(5)
  expect(MIN_ARROW_PX).toBe(5)
  expect(arrowPixelLength(0, 0, 3, 3.9)).toBeLessThan(5)
})

test('createRectAnnotation 产出 rect 结构（归一化两角 + 色 + 唯一 id）', () => {
  const a = createRectAnnotation(0.1, 0.2, 0.3, 0.4, '#ff5252')
  expect(a.type).toBe('rect')
  expect(a).toMatchObject({ x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.4, color: '#ff5252' })
  expect(a.id).toMatch(/^anno-/)
})

test('createEllipseAnnotation 产出 ellipse 结构', () => {
  const a = createEllipseAnnotation(0.1, 0.2, 0.3, 0.4, '#4a9eff')
  expect(a.type).toBe('ellipse')
  expect(a).toMatchObject({ x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.4, color: '#4a9eff' })
  expect(a.id).toMatch(/^anno-/)
})

test('createTextAnnotation 产出 text 结构（单点 + 字符串）', () => {
  const a = createTextAnnotation(0.5, 0.6, '助攻跑位', '#ffffff')
  expect(a.type).toBe('text')
  expect(a).toMatchObject({ x: 0.5, y: 0.6, text: '助攻跑位', color: '#ffffff' })
  expect(a.id).toMatch(/^anno-/)
})

test('三个 create 函数 id 互不相同', () => {
  const ids = new Set([
    createRectAnnotation(0, 0, 1, 1, '#fff').id,
    createEllipseAnnotation(0, 0, 1, 1, '#fff').id,
    createTextAnnotation(0, 0, 'x', '#fff').id,
  ])
  expect(ids.size).toBe(3)
})

test('常量值符合设计', () => {
  expect(MIN_SHAPE_PX).toBe(5)
  expect(DEFAULT_FONT_PX).toBe(16)
  expect(ANNO_COLORS).toEqual(['#ffeb3b', '#ff5252', '#4a9eff', '#ffffff'])
})

test('visibleAnnotations 对混合 type（rect/text）仍正确归类', () => {
  const data = {
    globalAnnotations: [{ id: 'g1', type: 'rect' }],
    frames: [{ annotations: [{ id: 'f1', type: 'text' }] }],
  }
  const vis = visibleAnnotations(data, 0)
  expect(vis).toHaveLength(2)
  expect(vis.find((e) => e.annotation.id === 'g1').scope).toBe('global')
  expect(vis.find((e) => e.annotation.id === 'f1').scope).toBe('frame')
})
