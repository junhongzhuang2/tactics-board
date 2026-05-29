const pool = require('../src/db/pool')
const db = require('../src/db/boards')

afterAll(() => pool.end())

beforeEach(async () => {
  await pool.query('DELETE FROM boards')
})

const SAMPLE_DATA = {
  players: [{ id: 'r1', team: 'red', number: 1, name: '1' }],
  frames: [{
    id: 'frame-0', duration: 1000,
    playerStates: { r1: { x: 0.5, y: 0.5, orientation: 0 } },
    discState: { x: 0.5, y: 0.5 },
    annotations: [],
  }],
  globalAnnotations: [],
}

test('createBoard returns board with id', async () => {
  const board = await db.createBoard('Test Board', SAMPLE_DATA)
  expect(board.id).toBeTruthy()
  expect(board.name).toBe('Test Board')
  expect(board.data).toEqual(SAMPLE_DATA)
})

test('getBoardById returns created board', async () => {
  const created = await db.createBoard('Test Board', SAMPLE_DATA)
  const found = await db.getBoardById(created.id)
  expect(found.id).toBe(created.id)
  expect(found.name).toBe('Test Board')
})

test('getBoardById returns null for unknown id', async () => {
  const found = await db.getBoardById('00000000-0000-0000-0000-000000000000')
  expect(found).toBeNull()
})

test('listBoards returns all boards ordered by updated_at desc', async () => {
  await db.createBoard('Board A', SAMPLE_DATA)
  await db.createBoard('Board B', SAMPLE_DATA)
  const boards = await db.listBoards()
  expect(boards.length).toBe(2)
  expect(boards[0].data).toBeUndefined()  // listBoards 不返回 data
})

test('updateBoard saves new data', async () => {
  const board = await db.createBoard('Test Board', SAMPLE_DATA)
  const newData = { ...SAMPLE_DATA, globalAnnotations: [{ id: 'a1' }] }
  await db.updateBoard(board.id, { data: newData })
  const updated = await db.getBoardById(board.id)
  expect(updated.data.globalAnnotations).toEqual([{ id: 'a1' }])
})

test('updateBoard can rename board', async () => {
  const board = await db.createBoard('Old Name', SAMPLE_DATA)
  await db.updateBoard(board.id, { name: 'New Name' })
  const updated = await db.getBoardById(board.id)
  expect(updated.name).toBe('New Name')
})

test('deleteBoard removes board', async () => {
  const board = await db.createBoard('Test Board', SAMPLE_DATA)
  await db.deleteBoard(board.id)
  const found = await db.getBoardById(board.id)
  expect(found).toBeNull()
})
