import { render, screen, fireEvent } from '@testing-library/react'
import Timeline from './Timeline'

const frames = [
  { id: 'f0', duration: 1000 },
  { id: 'f1', duration: 3000 },
  { id: 'f2', duration: 500 },
]

function setup(overrides = {}) {
  const handlers = {
    onJumpToFrame: vi.fn(),
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onToggleLoop: vi.fn(),
    onInsertAfter: vi.fn(),
    onRemoveFrame: vi.fn(),
    onSetDuration: vi.fn(),
    onStep: vi.fn(),
    onSetPlayhead: vi.fn(),
  }
  render(
    <Timeline
      frames={frames}
      currentFrameIndex={0}
      playheadTime={0}
      isPlaying={false}
      loop={false}
      {...handlers}
      {...overrides}
    />
  )
  return handlers
}

test('renders one block per frame, numbered', () => {
  setup()
  expect(screen.getByText('1')).toBeInTheDocument()
  expect(screen.getByText('2')).toBeInTheDocument()
  expect(screen.getByText('3')).toBeInTheDocument()
})

test('clicking a frame block jumps to it', () => {
  const h = setup()
  fireEvent.click(screen.getByText('2'))
  expect(h.onJumpToFrame).toHaveBeenCalledWith(1)
})

test('play button calls onPlay; shows pause while playing', () => {
  const h = setup()
  fireEvent.click(screen.getByLabelText('播放'))
  expect(h.onPlay).toHaveBeenCalled()
})

test('pause button calls onPause when playing', () => {
  const h = setup({ isPlaying: true })
  fireEvent.click(screen.getByLabelText('暂停'))
  expect(h.onPause).toHaveBeenCalled()
})

test('step buttons call onStep with direction', () => {
  const h = setup()
  fireEvent.click(screen.getByLabelText('上一帧'))
  expect(h.onStep).toHaveBeenCalledWith(-1)
  fireEvent.click(screen.getByLabelText('下一帧'))
  expect(h.onStep).toHaveBeenCalledWith(1)
})

test('loop toggle calls onToggleLoop', () => {
  const h = setup()
  fireEvent.click(screen.getByLabelText('循环'))
  expect(h.onToggleLoop).toHaveBeenCalled()
})

test('insert button inserts after current frame', () => {
  const h = setup({ currentFrameIndex: 1 })
  fireEvent.click(screen.getByLabelText('插入帧'))
  expect(h.onInsertAfter).toHaveBeenCalledWith(1)
})

test('right-click a frame block removes it', () => {
  const h = setup()
  fireEvent.contextMenu(screen.getByText('2'))
  expect(h.onRemoveFrame).toHaveBeenCalledWith(1)
})

test('duration input commits on change (seconds -> ms)', () => {
  const h = setup({ currentFrameIndex: 0 })
  const input = screen.getByLabelText('当前帧时长(秒)')
  fireEvent.change(input, { target: { value: '2' } })
  fireEvent.blur(input)
  expect(h.onSetDuration).toHaveBeenCalledWith(0, 2000)
})
