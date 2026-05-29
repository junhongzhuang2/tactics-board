const request = require('supertest')
const app = require('../src/app')
const pool = require('../src/db/pool')

afterAll(() => pool.end())
beforeEach(async () => pool.query('DELETE FROM boards'))

const SAMPLE_DATA = {
  players: [], frames: [
    { id: 'frame-0', duration: 1000, playerStates: {}, discState: { x: 0.5, y: 0.5 }, annotations: [] }
  ], globalAnnotations: [],
}

test('POST /api/boards creates a board', async () => {
  const res = await request(app)
    .post('/api/boards')
    .send({ name: 'My Board', data: SAMPLE_DATA })
  expect(res.status).toBe(201)
  expect(res.body.id).toBeTruthy()
  expect(res.body.name).toBe('My Board')
})

test('GET /api/boards lists boards', async () => {
  await request(app).post('/api/boards').send({ name: 'Board A', data: SAMPLE_DATA })
  await request(app).post('/api/boards').send({ name: 'Board B', data: SAMPLE_DATA })
  const res = await request(app).get('/api/boards')
  expect(res.status).toBe(200)
  expect(res.body.length).toBe(2)
})

test('GET /api/boards/:id returns board', async () => {
  const create = await request(app).post('/api/boards').send({ name: 'My Board', data: SAMPLE_DATA })
  const res = await request(app).get(`/api/boards/${create.body.id}`)
  expect(res.status).toBe(200)
  expect(res.body.name).toBe('My Board')
  expect(res.body.data).toBeDefined()
})

test('GET /api/boards/:id returns 404 for unknown id', async () => {
  const res = await request(app).get('/api/boards/00000000-0000-0000-0000-000000000000')
  expect(res.status).toBe(404)
})

test('PUT /api/boards/:id updates data', async () => {
  const create = await request(app).post('/api/boards').send({ name: 'My Board', data: SAMPLE_DATA })
  const newData = { ...SAMPLE_DATA, globalAnnotations: [{ id: 'a1' }] }
  const res = await request(app).put(`/api/boards/${create.body.id}`).send({ data: newData })
  expect(res.status).toBe(200)
  const get = await request(app).get(`/api/boards/${create.body.id}`)
  expect(get.body.data.globalAnnotations).toEqual([{ id: 'a1' }])
})

test('DELETE /api/boards/:id removes board', async () => {
  const create = await request(app).post('/api/boards').send({ name: 'My Board', data: SAMPLE_DATA })
  const res = await request(app).delete(`/api/boards/${create.body.id}`)
  expect(res.status).toBe(204)
  const get = await request(app).get(`/api/boards/${create.body.id}`)
  expect(get.status).toBe(404)
})
