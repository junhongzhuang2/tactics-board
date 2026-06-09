import { listBoards, getBoard, createBoard, saveBoard, deleteBoard } from './boards'

beforeEach(() => { localStorage.clear() })

const tick = () => new Promise((r) => setTimeout(r, 2))

test('createBoard 后 listBoards 含它、getBoard 命中', async () => {
  const b = await createBoard('板1', { x: 1 })
  expect(b.id).toMatch(/^board-/)
  expect(b.name).toBe('板1')
  expect(b.data).toEqual({ x: 1 })
  expect(b.created_at).toBeTruthy()
  expect(b.updated_at).toBeTruthy()
  expect(await listBoards()).toHaveLength(1)
  expect((await getBoard(b.id)).name).toBe('板1')
})

test('getBoard 未命中返回 null', async () => {
  expect(await getBoard('nope')).toBeNull()
})

test('saveBoard 改 name/data 并更新 updated_at', async () => {
  const b = await createBoard('旧', { v: 1 })
  const before = (await getBoard(b.id)).updated_at
  await tick()
  await saveBoard(b.id, { name: '新', data: { v: 2 } })
  const after = await getBoard(b.id)
  expect(after.name).toBe('新')
  expect(after.data).toEqual({ v: 2 })
  expect(after.updated_at >= before).toBe(true)
})

test('deleteBoard 删除', async () => {
  const b = await createBoard('x', {})
  await deleteBoard(b.id)
  expect(await listBoards()).toHaveLength(0)
})

test('listBoards 按 updated_at 倒序（最新在前）', async () => {
  const a = await createBoard('A', {})
  await tick()
  const b = await createBoard('B', {})
  const list = await listBoards()
  expect(list[0].id).toBe(b.id)
})

test('localStorage 内容损坏时 listBoards 兜底空数组', async () => {
  localStorage.setItem('tactics-board:boards', '{not json')
  expect(await listBoards()).toEqual([])
})
