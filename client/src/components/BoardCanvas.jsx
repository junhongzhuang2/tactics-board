import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
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
import TrajectoryHandle from './TrajectoryHandle'
import SelectionToolbar from './SelectionToolbar'
import CurveToggleButton from './CurveToggleButton'
import FormationMenu from './FormationMenu'
import HelpButton from './HelpButton'
import { interpolateAt, getEditableFrameIndex, activeFrameIndex } from '../utils/interpolate'
import {
  visibleAnnotations, createArrowAnnotation, createRectAnnotation, createEllipseAnnotation, createTextAnnotation,
  arrowPixelLength, MIN_SHAPE_PX, DEFAULT_ANNO_COLOR, DEFAULT_FONT_PX, annotationTopAnchor,
} from '../utils/annotations'
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
    updateFramePlayerState, updateFrameDiscState, addDisc, removeDisc, setTrajectoryCtrl,
    insertFrameAfter, removeFrame, setCurrentFrame, setFrameDuration, applyFormation,
    setPlayhead, play, pause, toggleLoop, markClean,
    renamePlayer, setPlayerShowCone, renameBoard,
    addAnnotation, removeAnnotation, updateAnnotation, moveAnnotation,
  } = useBoardStore()

  usePlaybackEngine()

  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const [tool, setTool] = useState('none')       // 'none' | 'pass' | 'run'
  const [scope, setScope] = useState('frame')    // 'frame' | 'global'
  const [draft, setDraft] = useState(null)       // { x1, y1, x2, y2 } 归一化
  const [selectedAnnoId, setSelectedAnnoId] = useState(null)
  const [selectedElement, setSelectedElement] = useState(null) // { kind:'player'|'disc', id } | null
  const [editingCurve, setEditingCurve] = useState(false)
  const [color, setColor] = useState(DEFAULT_ANNO_COLOR)
  const [textDraft, setTextDraft] = useState(null) // { x, y } 归一化；非 null 时显示内联输入框
  const [dragPreview, setDragPreview] = useState(null) // { id, patch }：拖句柄改尺寸的本地预览，不入历史
  const [editingName, setEditingName] = useState(false)

  const justDrewRef = useRef(false)
  const selectionRef = useRef(null)
  const endingTextRef = useRef(false) // 输入框开着时点画布：本次点击只用于结束编辑，不新建

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

  useEffect(() => { setEditingCurve(false) }, [selectedElement])

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

  const handleSelectPlayer = useCallback((id) => setSelectedElement({ kind: 'player', id }), [])
  const handleSelectDisc = useCallback((id) => setSelectedElement({ kind: 'disc', id }), [])

  const handleDiscDragEnd = useCallback(
    (discId, state) => updateFrameDiscState(editableIndex, discId, state),
    [updateFrameDiscState, editableIndex]
  )
  const handleDiscRemove = useCallback((discId) => { removeDisc(discId); setSelectedElement(null) }, [removeDisc])

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
    if (dragPreview) setDragPreview(null) // 清理可能残留的改尺寸预览（拖拽异常中断时）
    if (!drawing || isPlaying) return
    // 本帧标注只能停在关键帧时画：否则 currentFrameIndex 与活动帧分叉，画完即不可见
    if (scope === 'frame' && !editable) return
    // 文字在 click（手势结束）时放置，不在 mousedown：否则 mousedown 的默认聚焦行为会立刻 blur 掉刚挂载的 autoFocus 输入框
    if (tool === 'text') {
      if (textDraft) endingTextRef.current = true // 已有输入框：本次点击用于结束（blur 提交），随后的 click 不新建
      return
    }
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
    if (len >= MIN_SHAPE_PX) {
      const { x1, y1, x2, y2 } = draft
      let anno
      if (tool === 'rect') anno = createRectAnnotation(x1, y1, x2, y2, color)
      else if (tool === 'ellipse') anno = createEllipseAnnotation(x1, y1, x2, y2, color)
      else anno = createArrowAnnotation(tool, x1, y1, x2, y2, color) // pass / run
      addAnnotation(scope, currentFrameIndex, anno)
      justDrewRef.current = true   // 防绘制结束的残留 click 取消选中
      e.cancelBubble = true
    }
    setDraft(null)
  }

  function handleStageClick(e) {
    if (justDrewRef.current) { justDrewRef.current = false; return }
    if (tool === 'text') {
      if (endingTextRef.current) { endingTextRef.current = false; return } // 本次点击是结束上一个编辑，不新建
      // 放置文字：在 click（手势结束）时挂载输入框，确保 autoFocus 不被本次点击的聚焦行为打断
      if (isPlaying) return
      if (scope === 'frame' && !editable) return
      const p = pointerToNorm(e)
      if (p) setTextDraft({ x: p.x, y: p.y })
      return
    }
    if (tool === 'none' && e.target === e.target.getStage()) {
      setSelectedAnnoId(null) // 点空白取消选中
      setSelectedElement(null)
    }
  }

  function toolToType(t) {
    if (t === 'rect' || t === 'ellipse') return t
    return 'arrow' // pass / run / none 的 draft 预览都按箭头渲染
  }

  // 双击已有文字 → 进入编辑（预填当前内容 + 框宽，按标注自身的 scope/frame 定位）
  function handleEditText(sc, fi, annotation) {
    setTextDraft({
      x: annotation.x, y: annotation.y,
      editingId: annotation.id, scope: sc, frameIndex: fi,
      initial: annotation.text, initialWidth: annotation.width,
    })
  }

  function commitText(value, widthPx) {
    const t = value.trim()
    const width = widthPx ? widthPx / fieldW : undefined // 归一化框宽，用于画布上自动折行
    if (textDraft?.editingId != null) {
      // 编辑已有文字：空 → 删除；非空且 text/宽度 有变化 → 更新；未变 → 不动
      const { scope: sc, frameIndex: fi, editingId, initial, initialWidth } = textDraft
      if (!t) removeAnnotation(sc, fi, editingId)
      else if (t !== initial || width !== initialWidth) updateAnnotation(sc, fi, editingId, { text: t, width })
      setTextDraft(null)
      return
    }
    // 新建：mousedown/click 已做 frame-scope 门控，这里只需判空
    if (t && textDraft) {
      addAnnotation(scope, currentFrameIndex, createTextAnnotation(textDraft.x, textDraft.y, t, color, width))
    }
    setTextDraft(null)
  }

  // 改尺寸：拖句柄时本地预览，松手提交一步
  function handleResizePreview(id, patch) {
    setDragPreview({ id, patch })
  }
  function handleResizeCommit(sc, fi, id, patch) {
    updateAnnotation(sc, fi, id, patch)
    setDragPreview(null)
  }

  // 浮动工具条「本帧/全局」切换
  function handleSetScope(toScope) {
    const sel = selectionRef.current
    if (!sel || toScope === sel.scope) return
    if (toScope === 'frame' && !editable) return // 兜底：非关键帧不能转本帧，防标注锁死
    if (toScope === 'frame') moveAnnotation('global', null, 'frame', currentFrameIndex, sel.annotation.id)
    else moveAnnotation(sel.scope, sel.frameIndex, 'global', null, sel.annotation.id)
  }

  // 选中元素「本帧→下一帧」这一段（满足编辑门控且确实移动了）；否则 null
  const curveSeg = (() => {
    if (!selectedElement || isPlaying || tool !== 'none' || !editable || selectedPlayerId !== null) return null
    if (!board || editableIndex < 0 || editableIndex >= board.data.frames.length - 1) return null
    const { kind, id } = selectedElement
    const key = kind === 'player' ? 'playerStates' : 'discStates'
    const cur = board.data.frames[editableIndex][key]?.[id]
    const next = board.data.frames[editableIndex + 1][key]?.[id]
    if (!cur || !next) return null
    const moved = Math.abs(cur.x - next.x) > 1e-6 || Math.abs(cur.y - next.y) > 1e-6
    if (!moved) return null
    return { kind, id, cur, next }
  })()

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 顶栏 */}
      <div style={{
        padding: '8px 16px',
        background: 'rgba(17,24,20,0.55)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link
          to="/"
          title="返回战术板列表"
          className="ctrl-btn"
          style={{
            padding: '4px 10px', height: 28, borderRadius: 6, lineHeight: '20px',
            fontSize: 13, textDecoration: 'none',
          }}
        >
          ← 返回
        </Link>
        {editingName ? (
          <input
            aria-label="战术板名称"
            autoFocus
            defaultValue={board?.name ?? ''}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = e.target.value.trim()
                if (v) renameBoard(v)
                setEditingName(false)
              } else if (e.key === 'Escape') {
                setEditingName(false)
              }
            }}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v) renameBoard(v)
              setEditingName(false)
            }}
            style={{
              fontSize: 16, fontWeight: 'bold', padding: '2px 6px', borderRadius: 4,
              background: '#0d0d1a', border: '1px solid #555', color: '#fff',
            }}
          />
        ) : (
          <span
            style={{ fontWeight: 'bold', fontSize: 16, cursor: board ? 'text' : 'default' }}
            title={board ? '双击改名' : undefined}
            onDoubleClick={() => { if (board) setEditingName(true) }}
          >
            {board?.name ?? '加载中…'}
          </span>
        )}
        {board && (
          <UndoRedoButtons
            canUndo={past.length > 0}
            canRedo={future.length > 0}
            onUndo={undo}
            onRedo={redo}
          />
        )}
        {board && (
          <button
            onClick={addDisc}
            disabled={isPlaying}
            title="加一个飞盘"
            className="ctrl-btn"
            style={{
              padding: '4px 10px', height: 28, borderRadius: 6, fontSize: 13,
            }}
          >
            + 盘
          </button>
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
              className="ctrl-btn"
              style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4 }}
            >
              立即重试
            </button>
          </span>
        )}
        {!editable && board && <span style={{ fontSize: 12, color: '#f5c518' }}>预览中（停在关键帧才能编辑）</span>}
        <div style={{ marginLeft: 'auto' }}>
          <HelpButton />
        </div>
      </div>

      {/* 画布 — containerRef 始终挂载 */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse 75% 70% at center, #0d3b2e 0%, #0a2519 45%, #04100b 100%)' }}>
        {board && (
          <AnnotationToolbar
            tool={tool}
            scope={scope}
            color={color}
            onToolChange={(t) => { setTool(t); setSelectedAnnoId(null); setSelectedElement(null); endingTextRef.current = false }}
            onScopeChange={setScope}
            onColorChange={setColor}
          />
        )}
        {textDraft && (
          <textarea
            key={textDraft.editingId ?? '__new__'}
            aria-label="文字标注内容"
            autoFocus
            defaultValue={textDraft.initial ?? ''}
            onKeyDown={(e) => { if (e.key === 'Escape') setTextDraft(null) }} // 回车换行；Esc 取消
            onBlur={(e) => commitText(e.target.value, e.target.offsetWidth)}  // 失焦提交，记住拖出来的框宽
            style={{
              position: 'absolute',
              left: fieldX + textDraft.x * fieldW,
              top: fieldY + textDraft.y * fieldH,
              zIndex: 30, // 高于 Konva Stage 容器
              width: textDraft.initialWidth != null ? textDraft.initialWidth * fieldW : 160,
              minWidth: 60, minHeight: 28,
              resize: 'both', overflow: 'auto', // 可拖右下角调整长宽
              fontSize: DEFAULT_FONT_PX, fontWeight: 'bold', fontFamily: 'inherit', lineHeight: 1.2,
              padding: '2px 6px', borderRadius: 4, boxSizing: 'border-box',
              background: '#0d0d1a', border: '1px solid #555', color: '#fff',
              whiteSpace: 'pre-wrap',
            }}
          />
        )}
        {selectedAnnoId && selectionRef.current && (() => {
          const sel = selectionRef.current
          const anchor = annotationTopAnchor(sel.annotation)
          return (
            <SelectionToolbar
              scope={sel.scope}
              canMoveToFrame={editable}
              onSetScope={handleSetScope}
              onDelete={() => { removeAnnotation(sel.scope, sel.frameIndex, sel.annotation.id); setSelectedAnnoId(null) }}
              style={{
                position: 'absolute',
                left: fieldX + anchor.x * fieldW,
                top: fieldY + anchor.y * fieldH - 40,
                transform: 'translateX(-50%)',
                zIndex: 25,
              }}
            />
          )
        })()}
        {curveSeg && (
          <CurveToggleButton
            active={editingCurve}
            onToggle={() => setEditingCurve((v) => !v)}
            style={{
              position: 'absolute',
              left: fieldX + curveSeg.cur.x * fieldW,
              top: fieldY + curveSeg.cur.y * fieldH - 36,
              transform: 'translateX(-50%)',
              zIndex: 26,
            }}
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
              draftType={toolToType(tool)}
              draftVariant={tool === 'pass' ? 'pass' : 'run'}
              draftColor={color}
              tool={tool}
              dragPreview={dragPreview}
              isPlaying={isPlaying}
              onMove={updateAnnotation}
              onResizePreview={handleResizePreview}
              onResizeCommit={handleResizeCommit}
              fieldWidth={fieldW}
              fieldHeight={fieldH}
              selectedId={selectedAnnoId}
              onSelect={(id) => setSelectedAnnoId(id)}
              onDelete={(sc, fi, id) => { removeAnnotation(sc, fi, id); setSelectedAnnoId(null) }}
              onEdit={handleEditText}
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
                    onDoubleClick={(id) => { setSelectedPlayerId(id); setSelectedElement(null) }}
                    onSelect={handleSelectPlayer}
                  />
                )
              })}
              {board.data.discs.map((d) => {
                const ds = view.discStates[d.id]
                if (!ds) return null
                return (
                  <Disc
                    key={d.id}
                    discId={d.id}
                    discState={ds}
                    fieldWidth={fieldW}
                    fieldHeight={fieldH}
                    draggable={editable && !drawing}
                    onDragEnd={handleDiscDragEnd}
                    onContextMenu={handleDiscRemove}
                    onSelect={handleSelectDisc}
                  />
                )
              })}
              {curveSeg && editingCurve && (
                <TrajectoryHandle
                  key={`${curveSeg.kind}-${curveSeg.id}`}
                  p0={{ x: curveSeg.cur.x, y: curveSeg.cur.y }}
                  p1={{ x: curveSeg.next.x, y: curveSeg.next.y }}
                  ctrl={curveSeg.cur.ctrl ?? null}
                  fieldWidth={fieldW}
                  fieldHeight={fieldH}
                  onCommit={(c) => setTrajectoryCtrl(editableIndex, curveSeg.kind, curveSeg.id, c)}
                  onClear={() => setTrajectoryCtrl(editableIndex, curveSeg.kind, curveSeg.id, null)}
                />
              )}
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

      {/* 底栏：阵型预设 */}
      {board && (
        <div style={{
          padding: '6px 16px',
          background: 'rgba(17,24,20,0.55)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <FormationMenu onApply={(key) => applyFormation(editableIndex, key)} disabled={!editable} />
        </div>
      )}

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
