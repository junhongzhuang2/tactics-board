const BASE = '/api/boards'

export async function listBoards() {
  const res = await fetch(BASE)
  if (!res.ok) throw new Error('Failed to list boards')
  return res.json()
}

export async function createBoard(name, data) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, data }),
  })
  if (!res.ok) throw new Error('Failed to create board')
  return res.json()
}

export async function getBoard(id) {
  const res = await fetch(`${BASE}/${id}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to get board')
  return res.json()
}

export async function saveBoard(id, fields) {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  if (!res.ok) throw new Error('Failed to save board')
}

export async function deleteBoard(id) {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete board')
}
