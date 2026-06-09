import { describe, test, expect } from 'vitest'
import { FORMATIONS, FORMATION_ORDER, buildFormationPatch } from './formations'

const players = [
  { id: 'r1', team: 'red', number: 1 }, { id: 'r2', team: 'red', number: 2 },
  { id: 'r3', team: 'red', number: 3 }, { id: 'r4', team: 'red', number: 4 },
  { id: 'r5', team: 'red', number: 5 }, { id: 'r6', team: 'red', number: 6 },
  { id: 'r7', team: 'red', number: 7 },
  { id: 'b1', team: 'blue', number: 1 }, { id: 'b2', team: 'blue', number: 2 },
  { id: 'b3', team: 'blue', number: 3 }, { id: 'b4', team: 'blue', number: 4 },
  { id: 'b5', team: 'blue', number: 5 }, { id: 'b6', team: 'blue', number: 6 },
  { id: 'b7', team: 'blue', number: 7 },
]
const discs = [{ id: 'disc-1' }]

test('FORMATION_ORDER lists the five presets', () => {
  expect(FORMATION_ORDER).toEqual(['default', 'vstack', 'hstack', 'zone', 'junk'])
})

test('buildFormationPatch maps default formation to exact coords', () => {
  const { playerStates, discStates } = buildFormationPatch('default', players, discs)
  expect(playerStates.r1).toEqual({ x: 0.15, y: 0.12 })
  expect(playerStates.r4).toEqual({ x: 0.15, y: 0.50 })
  expect(playerStates.b1).toEqual({ x: 0.85, y: 0.12 })
  expect(discStates['disc-1']).toEqual({ x: 0.162, y: 0.534 })
})

test('buildFormationPatch only sets the first disc, ignores others', () => {
  const { discStates } = buildFormationPatch('vstack', players, [{ id: 'disc-1' }, { id: 'disc-2' }])
  expect(discStates['disc-1']).toEqual({ x: 0.189, y: 0.481 })
  expect(discStates['disc-2']).toBeUndefined()
})

test('buildFormationPatch skips players not present and needs no orientation/ctrl', () => {
  const { playerStates } = buildFormationPatch('default', [{ id: 'r1', team: 'red', number: 1 }], discs)
  expect(Object.keys(playerStates)).toEqual(['r1'])
  expect(playerStates.r1).toEqual({ x: 0.15, y: 0.12 })
})

test('buildFormationPatch with no discs returns empty discStates', () => {
  const { discStates } = buildFormationPatch('default', players, [])
  expect(discStates).toEqual({})
})

test('unknown formation key returns empty patch', () => {
  expect(buildFormationPatch('nope', players, discs)).toEqual({ playerStates: {}, discStates: {} })
})
