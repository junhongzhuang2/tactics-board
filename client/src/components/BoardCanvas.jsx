import { useEffect, useRef, useState } from 'react'
import { Stage, Layer } from 'react-konva'
import Field from './Field'
import Player from './Player'
import Disc from './Disc'
import Timeline from './Timeline'
import UndoRedoButtons from './UndoRedoButtons'
import PlayerEditPanel from './PlayerEditPanel'
import { useBoardStore } from '../store/boardStore'
import { usePlaybackEngine } from '../hooks/usePlaybackEngine'
import AnnotationToolbar from './AnnotationToolbar'
import AnnotationLayer from './AnnotationLayer'
import { interpolateAt, getEditableFrameIndex, activeFrameIndex } from '../utils/interpolate'
import { visibleAnnotations, createArrowAnnotation, arrowPixelLength, MIN_ARROW_PX, DEFAULT_ANNO_COLOR } from '../utils/annotations'
import { useAutoSave } from '../hooks/useAutoSave'
import { isUndoShortcut, isRedoShortcut } from '../utils/shortcuts'

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
    past, future, undo, redo,
    updateFramePlayerState, updateFrameDiscState,
    insertFrameAfter, removeFrame, setCurrentFrame, setFrameDuration,
    setPlayhead, play, pause, toggleLoop, markClean,
    renamePlayer, setPlayerShowCone,
    addAnnotation, removeAnnotation,
  } = useBoardStore()

  usePlaybackEngine()

  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const [tool, setTool] = useState('none')       // 'none' | 'pass' | 'run'
  const [scope, setScope] = useState('frame')    // 'frame' | 'global'
  const [draft, setDraft] = useState(null)       // { x1, y1, x2, y2 } 归一化
  const [selectedAnnoId, setSelectedAnnoId] = useState(null)

  const justDrewRef = useRef(false)
  const selectionRef = useRef(null)

  // 撤销/重做快捷键；焦点在输入框时放行给浏览器原生文本撤销
  useEffect(() => {
    function onKeyDown(e) {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectionRef.current) {
        e.preventDefault()
        const { scope: sc, frameIndex: fi, annotation } = selectionRef.current
        removeAnnotation(sc, fi, annotation.id)
        setSelectedAnnoId(null)
        return
      }
      if (isUndoShortcut(e)) { e.preventDefault(); undo() }
      else if (isRedoShortcut(e)) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

  const { saveStatus, retryNow } = useAutoSave({ board, isDirty, markClean })

  const frames = board?.data.frames
  const view = frames ? interpolateAt(frames, playheadTime) : null
  const editableIndex = frames ? getEditableFrameIndex(frames, playheadTime, isPlaying) : -1
  const editable = editableIndex !== -1
  const drawing = tool !== 'none'
  const activeIdx = frames ? activeFrameIndex(frames, playheadTime) : 0
  const annoEntries = board ? visibleAnnotations(board.data, activeIdx) : []
  selectionRef.current = annoEntries.find((e) => e.annotation.id === selectedAnnoId) ?? null

  function handleStep(dir) {
    if (!frames) return
    const next = Math.max(0, Math.min(frames.length - 1, currentFrameIndex + dir))
    setCurrentFrame(next)
  }

  function pointerToNorm(e) {
    const stage = e.target.getStage()
    const pos = stage?.getPointerPosition()
    if (!pos) return null
    return {
      x: Math.min(1, Math.max(0, (pos.x - fieldX) / fieldW)),
      y: Math.min(1, Math.max(0, (pos.y - fieldY) / fieldH)),
    }
  }

  function handleStageMouseDown(e) {
    justDrewRef.current = false // 每次新交互开头清残留标志（防拖到画布外无 click 时卡住）
    if (!drawing || isPlaying) return
    // 本帧标注只能停在关键帧时画：否则 currentFrameIndex 与活动帧分叉，画完即不可见
    if (scope === 'frame' && !editable) return
    const p = pointerToNorm(e)
    if (!p) return
    setDraft({ x1: p.x, y1: p.y, x2: p.x, y2: p.y })
  }

  function handleStageMouseMove(e) {
    if (!draft) return
    const p = pointerToNorm(e)
    if (!p) return
    setDraft((d) => ({ ...d, x2: p.x, y2: p.y }))
  }

  function handleStageMouseUp(e) {
    if (!draft) return
    const len = arrowPixelLength(draft.x1 * fieldW, draft.y1 * fieldH, draft.x2 * fieldW, draft.y2 * fieldH)
    if (len >= MIN_ARROW_PX) {
      const anno = createArrowAnnotation(tool, draft.x1, draft.y1, draft.x2, draft.y2, DEFAULT_ANNO_COLOR)
      addAnnotation(scope, currentFrameIndex, anno)
      justDrewRef.current = true   // 防绘制结束的残留 click 取消选中
      e.cancelBubble = true
    }
    setDraft(null)
  }

  function handleStageClick(e) {
    if (justDrewRef.current) { justDrewRef.current = false; return }
    if (tool === 'none' && e.target === e.target.getStage()) {
      setSelectedAnnoId(null) // 点空白取消选中
    }
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
        {board && (
          <UndoRedoButtons
            canUndo={past.length > 0}
            canRedo={future.length > 0}
            onUndo={undo}
            onRedo={redo}
          />
        )}
        {board && saveStatus === 'saving' && (
          <span style={{ fontSize: 12, color: '#888' }}>保存中…</span>
        )}
        {board && saveStatus === 'saved' && (
          <span style={{ fontSize: 12, color: '#888' }}>已保存</span>
        )}
        {board && saveStatus === 'error' && (
          <span style={{ fontSize: 12, color: '#f5c518', display: 'flex', alignItems: 'center', gap: 6 }}>
            ⚠ 保存失败，重试中
            <button
              onClick={retryNow}
              style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#2a2a3e', border: '1px solid #555', color: '#ccc', cursor: 'pointer' }}
            >
              立即重试
            </button>
          </span>
        )}
        {!editable && board && <span style={{ fontSize: 12, color: '#f5c518' }}>预览中（停在关键帧才能编辑）</span>}
      </div>

      {/* 画布 — containerRef 始终挂载 */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#0d0d1a' }}>
        {board && (
          <AnnotationToolbar
            tool={tool}
            scope={scope}
            onToolChange={(t) => { setTool(t); setSelectedAnnoId(null) }}
            onScopeChange={setScope}
          />
        )}
        {!board || !view ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
            加载中…
          </div>
        ) : (
          <Stage
            width={stageW}
            height={stageH}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            onClick={handleStageClick}
          >
            <Layer x={fieldX} y={fieldY}>
              <Field fieldWidth={fieldW} fieldHeight={fieldH} />
            </Layer>
            <AnnotationLayer
              x={fieldX}
              y={fieldY}
              entries={annoEntries}
              draft={draft}
              draftVariant={tool === 'none' ? 'run' : tool}
              draftColor={DEFAULT_ANNO_COLOR}
              fieldWidth={fieldW}
              fieldHeight={fieldH}
              selectedId={selectedAnnoId}
              onSelect={(id) => setSelectedAnnoId(id)}
              onDelete={(sc, fi, id) => { removeAnnotation(sc, fi, id); setSelectedAnnoId(null) }}
            />
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
                    draggable={editable && !drawing}
                    editable={editable}
                    onRotate={(orientation) =>
                      updateFramePlayerState(editableIndex, player.id, { ...state, orientation })
                    }
                    onDragEnd={(id, newState) =>
                      updateFramePlayerState(editableIndex, id, newState)
                    }
                    onDoubleClick={(id) => setSelectedPlayerId(id)}
                  />
                )
              })}
              <Disc
                discState={view.discState}
                fieldWidth={fieldW}
                fieldHeight={fieldH}
                draggable={editable && !drawing}
                onDragEnd={(newState) =>
                  updateFrameDiscState(editableIndex, newState)
                }
              />
            </Layer>
          </Stage>
        )}
        {selectedPlayerId && view && (() => {
          const sel = board.data.players.find(p => p.id === selectedPlayerId)
          const selState = view.playerStates[selectedPlayerId]
          if (!sel || !selState) return null
          const rawX = fieldX + selState.x * fieldW + 12
          const rawY = fieldY + selState.y * fieldH + 12
          return (
            <PlayerEditPanel
              player={sel}
              x={rawX}
              y={rawY}
              boundsW={stageW}
              boundsH={stageH}
              onRename={(name) => renamePlayer(selectedPlayerId, name)}
              onToggleCone={(show) => setPlayerShowCone(selectedPlayerId, show)}
              onClose={() => setSelectedPlayerId(null)}
            />
          )
        })()}
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
