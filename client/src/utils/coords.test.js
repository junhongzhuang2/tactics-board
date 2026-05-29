import { toCanvas, toNorm, clampToField } from './coords'

describe('toCanvas', () => {
  test('converts normalized center to canvas center', () => {
    expect(toCanvas(0.5, 0.5, 1000, 400)).toEqual({ x: 500, y: 200 })
  })
  test('converts top-left corner', () => {
    expect(toCanvas(0, 0, 1000, 400)).toEqual({ x: 0, y: 0 })
  })
  test('converts bottom-right corner', () => {
    expect(toCanvas(1, 1, 1000, 400)).toEqual({ x: 1000, y: 400 })
  })
})

describe('toNorm', () => {
  test('converts canvas center to normalized center', () => {
    expect(toNorm(500, 200, 1000, 400)).toEqual({ x: 0.5, y: 0.5 })
  })
  test('converts canvas origin to normalized origin', () => {
    expect(toNorm(0, 0, 1000, 400)).toEqual({ x: 0, y: 0 })
  })
})

describe('clampToField', () => {
  test('passes through values within bounds', () => {
    expect(clampToField(0.5, 0.5)).toEqual({ x: 0.5, y: 0.5 })
  })
  test('clamps x below 0', () => {
    expect(clampToField(-0.1, 0.5)).toEqual({ x: 0, y: 0.5 })
  })
  test('clamps x above 1', () => {
    expect(clampToField(1.1, 0.5)).toEqual({ x: 1, y: 0.5 })
  })
  test('clamps y below 0', () => {
    expect(clampToField(0.5, -0.5)).toEqual({ x: 0.5, y: 0 })
  })
  test('clamps y above 1', () => {
    expect(clampToField(0.5, 2)).toEqual({ x: 0.5, y: 1 })
  })
})
