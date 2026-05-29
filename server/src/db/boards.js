const pool = require('./pool')

async function createBoard(name, data) {
  const { rows } = await pool.query(
    'INSERT INTO boards (name, data) VALUES ($1, $2) RETURNING *',
    [name, JSON.stringify(data)]
  )
  return rows[0]
}

async function getBoardById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM boards WHERE id = $1',
    [id]
  )
  return rows[0] ?? null
}

async function listBoards() {
  const { rows } = await pool.query(
    'SELECT id, name, created_at, updated_at FROM boards ORDER BY updated_at DESC'
  )
  return rows
}

async function updateBoard(id, fields) {
  const updates = []
  const values = []
  let i = 1

  if (fields.name !== undefined) {
    updates.push(`name = $${i++}`)
    values.push(fields.name)
  }
  if (fields.data !== undefined) {
    updates.push(`data = $${i++}`)
    values.push(JSON.stringify(fields.data))
  }

  if (updates.length === 0) return

  values.push(id)
  await pool.query(
    `UPDATE boards SET ${updates.join(', ')} WHERE id = $${i}`,
    values
  )
}

async function deleteBoard(id) {
  await pool.query('DELETE FROM boards WHERE id = $1', [id])
}

module.exports = { createBoard, getBoardById, listBoards, updateBoard, deleteBoard }
