import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listBoards, createBoard, deleteBoard, saveBoard } from '../api/boards'
import { createDefaultBoardData } from '../utils/defaultBoardData'

const STYLES = {
  page: { maxWidth: 760, margin: '0 auto', padding: '0 24px 60px' },
  hero: { textAlign: 'center', padding: '48px 16px 24px' },
  logo: { fontSize: 40, lineHeight: 1 },
  title: { fontSize: 26, fontWeight: 800, letterSpacing: 1, margin: '8px 0 4px' },
  subtitle: { fontSize: 13, fontWeight: 300, opacity: 0.7 },
  sectionLabel: { textAlign: 'center', fontSize: 11, letterSpacing: 1, opacity: 0.5, margin: '4px 0 16px' },
  cardName: { fontSize: 16, fontWeight: 500 },
  cardDate: { fontSize: 12, fontWeight: 300, opacity: 0.6, marginTop: 4 },
  empty: { textAlign: 'center', color: 'rgba(255,255,255,0.55)', marginTop: 32 },
  emptyIcon: { fontSize: 32, opacity: 0.5 },
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
    <div className="board-bg">
      <div style={STYLES.page}>
        <div style={STYLES.hero}>
          <div style={STYLES.logo}>🥏</div>
          <h1 style={STYLES.title}>飞盘战术板</h1>
          <div style={STYLES.subtitle}>讲解战术 · 复盘跑位</div>
        </div>

        <div style={STYLES.sectionLabel}>我的战术板</div>

        <div className="add-card" onClick={handleCreate}>＋ 新建战术板</div>

        {boards.length === 0 && (
          <div style={STYLES.empty}>
            <div style={STYLES.emptyIcon}>🥏</div>
            <p>还没有战术板，点上方新建一个</p>
          </div>
        )}

        {boards.map(board => (
          <div
            key={board.id}
            className="board-card"
            onClick={() => navigate(`/board/${board.id}`)}
          >
            <div>
              <div style={STYLES.cardName}>{board.name}</div>
              <div style={STYLES.cardDate}>
                {new Date(board.updated_at).toLocaleString('zh-CN')}
              </div>
            </div>
            <div className="card-actions">
              <button className="card-btn rename-btn" onClick={(e) => handleRename(e, board)}>
                重命名
              </button>
              <button className="card-btn delete-btn" onClick={(e) => handleDelete(e, board.id)}>
                删除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
