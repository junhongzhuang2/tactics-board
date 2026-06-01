import { createArrowAnnotation, visibleAnnotations, arrowPixelLength, MIN_ARROW_PX } from './annotations'

test('createArrowAnnotation builds an arrow with a unique id and fields', () => {
  const a = createArrowAnnotation('pass', 0.1, 0.2, 0.3, 0.4, '#ffeb3b')
  expect(a.type).toBe('arrow')
  expect(a.variant).toBe('pass')
  expect([a.x1, a.y1, a.x2, a.y2]).toEqual([0.1, 0.2, 0.3, 0.4])
  expect(a.color).toBe('#ffeb3b')
  expect(a.id).toMatch(/^anno-/)
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
