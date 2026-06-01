import { createDefaultBoardData } from './defaultBoardData'

test('creates 14 players, each with showCone false', () => {
  const data = createDefaultBoardData()
  expect(data.players.length).toBe(14)
  for (const p of data.players) {
    expect(p.showCone).toBe(false)
  }
})
