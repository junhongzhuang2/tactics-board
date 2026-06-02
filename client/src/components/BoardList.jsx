import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listBoards, createBoard, deleteBoard, saveBoard } from '../api/boards'
import { createDefaultBoardData } from '../utils/defaultBoardData'

const STYLES = {
  page: { maxWidth: 800, margin: '60px auto', padding: '0 24px' },
  header: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 32,
  },
  title: { fontSize: 28, fontWeight: 'bold' },
  createBtn: {
    padding: '10px 20px', background: '#4a9eff', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15,
  },
  card: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 20px', background: '#1a1a2e', borderRadius: 10,
    marginBottom: 12, cursor: 'pointer', border: '1px solid #2a2a4e',
  },
  cardName: { fontSize: 17, fontWeight: '500' },
  cardDate: { fontSize: 12, color: '#888', marginTop: 4 },
  deleteBtn: {
    padding: '6px 14px', background: 'transparent', color: '#e57373',
    border: '1px solid #e57373', borderRadius: 6, cursor: 'pointer', fontSize: 13,
  },
  renameBtn: {
    padding: '6px 14px', background: 'transparent', color: '#ccc',
    border: '1px solid #555', borderRadius: 6, cursor: 'pointer', fontSize: 13,
  },
  empty: { color: '#666', textAlign: 'center', marginTop: 80 },
}

export default function BoardList() {
  const [boards, setBoards] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    listBoards().then(setBoards)
  }, [])

  async function handleCreate() {
    const name = prompt('战术板名称', 'Untitled Board')
    if (!name) return
    const board = await createBoard(name, createDefaultBoardData())
    navigate(`/board/${board.id}`)
  }

  async function handleDelete(e, id) {
    e.stopPropagation()
    if (!confirm('确认删除此战术板？')) return
    await deleteBoard(id)
    setBoards(bs => bs.filter(b => b.id !== id))
  }

  async function handleRename(e, board) {
    e.stopPropagation()
    const v = prompt('新名称', board.name)
    const trimmed = v?.trim()
    if (!trimmed || trimmed === board.name) return // 取消/空/未改动 → 不发请求
    await saveBoard(board.id, { name: trimmed })
    setBoards(bs => bs.map(b => (b.id === board.id ? { ...b, name: trimmed } : b)))
  }

  return (
    <div style={STYLES.page}>
      <div style={STYLES.header}>
        <h1 style={STYLES.title}>飞盘战术板</h1>
        <button style={STYLES.createBtn} onClick={handleCreate}>+ 新建战术板</button>
      </div>

      {boards.length === 0 && (
        <p style={STYLES.empty}>还没有战术板，点击右上角新建一个</p>
      )}

      {boards.map(board => (
        <div
          key={board.id}
          style={STYLES.card}
          onClick={() => navigate(`/board/${board.id}`)}
        >
          <div>
            <div style={STYLES.cardName}>{board.name}</div>
            <div style={STYLES.cardDate}>
              {new Date(board.updated_at).toLocaleString('zh-CN')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={STYLES.renameBtn}
              onClick={(e) => handleRename(e, board)}
            >
              重命名
            </button>
            <button
              style={STYLES.deleteBtn}
              onClick={(e) => handleDelete(e, board.id)}
            >
              删除
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
