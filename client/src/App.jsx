import { Routes, Route } from 'react-router-dom'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<div>战术板首页（待实现）</div>} />
      <Route path="/board/:id" element={<div>战术板画布（待实现）</div>} />
    </Routes>
  )
}
