import { Routes, Route, useParams } from 'react-router-dom'
import { useEffect } from 'react'
import BoardList from './components/BoardList'
import BoardCanvas from './components/BoardCanvas'
import { getBoard } from './api/boards'
import { useBoardStore } from './store/boardStore'

function BoardPage() {
  const { id } = useParams()
  const setBoard = useBoardStore(s => s.setBoard)

  useEffect(() => {
    getBoard(id).then(board => { if (board) setBoard(board) })
  }, [id])

  return <BoardCanvas />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<BoardList />} />
      <Route path="/board/:id" element={<BoardPage />} />
    </Routes>
  )
}
