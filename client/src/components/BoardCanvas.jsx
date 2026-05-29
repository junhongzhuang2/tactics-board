import { useEffect, useRef, useState } from 'react'
import { Stage, Layer } from 'react-konva'
import Field from './Field'
import Player from './Player'
import Disc from './Disc'
import Timeline from './Timeline'
import { useBoardStore } from '../store/boardStore'
import { usePlaybackEngine } from '../hooks/usePlaybackEngine'
import { interpolateAt, getEditableFrameIndex } from '../utils/interpolate'
import { saveBoard } from '../api/boards'

const FIELD_ASPECT = 100 / 37
const PADDING = 40

function useFieldSize(containerRef) {
  const [size, setSize] = useState({
    stageW: 800, stageH: 400,
    fieldW: 720, fieldH: 266,
    fieldX: 40, fieldY: 67,
  })

  useEffect(() => {
    function compute() {
      if (!containerRef.current) return
      const { clientWidth: cw, clientHeight: ch } = containerRef.current
      const availW = cw - PADDING * 2
      const availH = ch - PADDING * 2
      let fieldW, fieldH
      if (availW / availH > FIELD_ASPECT) {
        fieldH = availH; fieldW = fieldH * FIELD_ASPECT
      } else {
        fieldW = availW; fieldH = fieldW / FIELD_ASPECT
      }
      setSize({
        stageW: cw, stageH: ch,
        fieldW, fieldH,
        fieldX: (cw - fieldW) / 2,
        fieldY: (ch - fieldH) / 2,
      })
    }
    if (!containerRef.current) return
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [containerRef])

  return size
}

export default function BoardCanvas() {
  const containerRef = useRef(null)
  const { stageW, stageH, fieldW, fieldH, fieldX, fieldY } = useFieldSize(containerRef)
  const {
    board, currentFrameIndex, isDirty, playheadTime, isPlaying, loop,
    updateFramePlayerState, updateFrameDiscState,
    insertFrameAfter, removeFrame, setCurrentFrame, setFrameDuration,
    setPlayhead, play, pause, toggleLoop, markClean,
  } = useBoardStore()

  usePlaybackEngine()

  // Auto-save 1 second after any dirty change
  useEffect(() => {
    if (!isDirty || !board) return
    const timer = setTimeout(async () => {
      await saveBoard(board.id, { data: board.data })
      markClean()
    }, 1000)
    return () => clearTimeout(timer)
  }, [isDirty, board])

  const frames = board?.data.frames
  const view = frames ? interpolateAt(frames, playheadTime) : null
  const editableIndex = frames ? getEditableFrameIndex(frames, playheadTime, isPlaying) : -1
  const editable = editableIndex !== -1

  function handleStep(dir) {
    if (!frames) return
    const next = Math.max(0, Math.min(frames.length - 1, currentFrameIndex + dir))
    setCurrentFrame(next)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 顶栏 */}
      <div style={{
        padding: '8px 16px', background: '#111',
        borderBottom: '1px solid #333',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontWeight: 'bold', fontSize: 16 }}>{board?.name ?? '加载中…'}</span>
        {isDirty && <span style={{ fontSize: 12, color: '#888' }}>保存中…</span>}
        {!editable && board && <span style={{ fontSize: 12, color: '#f5c518' }}>预览中（停在关键帧才能编辑）</span>}
      </div>

      {/* 画布 — containerRef 始终挂载 */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#0d0d1a' }}>
        {!board || !view ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
            加载中…
          </div>
        ) : (
          <Stage width={stageW} height={stageH}>
            <Layer x={fieldX} y={fieldY}>
              <Field fieldWidth={fieldW} fieldHeight={fieldH} />
            </Layer>
            <Layer x={fieldX} y={fieldY}>
              {board.data.players.map(player => {
                const state = view.playerStates[player.id]
                if (!state) return null
                return (
                  <Player
                    key={player.id}
                    player={player}
                    playerState={state}
                    fieldWidth={fieldW}
                    fieldHeight={fieldH}
                    draggable={editable}
                    onDragEnd={(id, newState) =>
                      updateFramePlayerState(editableIndex, id, newState)
                    }
                    onDoubleClick={(id) => {
                      const p = board.data.players.find(pl => pl.id === id)
                      const newName = prompt(
                        `重命名球员 ${p.number}（当前: ${p.name}）`,
                        p.name
                      )
                      if (newName !== null && newName.trim()) {
                        useBoardStore.getState().renamePlayer(id, newName.trim())
                      }
                    }}
                  />
                )
              })}
              <Disc
                discState={view.discState}
                fieldWidth={fieldW}
                fieldHeight={fieldH}
                draggable={editable}
                onDragEnd={(newState) =>
                  updateFrameDiscState(editableIndex, newState)
                }
              />
            </Layer>
          </Stage>
        )}
      </div>

      {/* 时间轴 */}
      {board && (
        <Timeline
          frames={board.data.frames}
          currentFrameIndex={currentFrameIndex}
          playheadTime={playheadTime}
          isPlaying={isPlaying}
          loop={loop}
          onJumpToFrame={setCurrentFrame}
          onSetPlayhead={setPlayhead}
          onPlay={play}
          onPause={pause}
          onToggleLoop={toggleLoop}
          onInsertAfter={insertFrameAfter}
          onRemoveFrame={removeFrame}
          onSetDuration={setFrameDuration}
          onStep={handleStep}
        />
      )}
    </div>
  )
}
