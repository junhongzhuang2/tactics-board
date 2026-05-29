const express = require('express')
const router = express.Router()
const db = require('../db/boards')

router.post('/', async (req, res) => {
  try {
    const { name = 'Untitled Board', data } = req.body
    if (!data) return res.status(400).json({ error: 'data is required' })
    const board = await db.createBoard(name, data)
    res.status(201).json(board)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/', async (req, res) => {
  try {
    const boards = await db.listBoards()
    res.json(boards)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const board = await db.getBoardById(req.params.id)
    if (!board) return res.status(404).json({ error: 'Board not found' })
    res.json(board)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { name, data } = req.body
    await db.updateBoard(req.params.id, { name, data })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await db.deleteBoard(req.params.id)
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
