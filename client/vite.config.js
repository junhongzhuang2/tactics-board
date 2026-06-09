import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 构建发布到 GitHub Pages 子路径 /tactics-board/；本地 dev/test 用根路径
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/tactics-board/' : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    globals: true,
  },
}))
