const KEY = 'tactics-board:boards'

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? []
  } catch {
    return []
  }
}

function writeAll(boards) {
  try {
    localStorage.setItem(KEY, JSON.stringify(boards))
  } catch {
    throw new Error('存储空间已满，无法保存战术板数据')
  }
}

function newId() {
  return `board-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function now() {
  return new Date().toISOString()
}

export async function listBoards() {
  return readAll().sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0))
}

export async function getBoard(id) {
  return readAll().find((b) => b.id === id) ?? null
}

export async function createBoard(name, data) {
  const board = { id: newId(), name, data, created_at: now(), updated_at: now() }
  writeAll([...readAll(), board])
  return board
}

export async function saveBoard(id, fields) {
  const boards = readAll().map((b) => (b.id === id ? { ...b, ...fields, updated_at: now() } : b))
  writeAll(boards)
}

export async function deleteBoard(id) {
  writeAll(readAll().filter((b) => b.id !== id))
}
