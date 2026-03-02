import { useState, useEffect } from 'react'
import { fetchTasks, fetchStats, saveResult, deleteResult, type TaggingTask } from './api/tagging'
import './App.css'

function PdfBadges({ task }: { task: TaggingTask }) {
  const hasAda = !!task.pdfAdaUrl
  const hasCco = !!task.pdfCcoUrl
  const total = 2
  const available = (hasAda ? 1 : 0) + (hasCco ? 1 : 0)

  return (
    <div className="pdf-badges">
      <span className="pdf-badges-summary">
        {available}/{total} PDFs
      </span>
      <span className={`pdf-badge ${hasAda ? 'available' : 'missing'}`} title="Acta de Apertura">
        {hasAda ? (
          <a href={task.pdfAdaUrl} target="_blank" rel="noreferrer">ADA</a>
        ) : (
          'ADA'
        )}
      </span>
      <span className={`pdf-badge ${hasCco ? 'available' : 'missing'}`} title="Cuadro Comparativo de Ofertas">
        {hasCco ? (
          <a href={task.pdfCcoUrl} target="_blank" rel="noreferrer">CCO</a>
        ) : (
          'CCO'
        )}
      </span>
    </div>
  )
}

function TaskCard({
  task,
  onTaskSaved,
  onTaskDiscarded,
  onTaskUndone,
  variant,
}: {
  task: TaggingTask
  onTaskSaved?: (tenderId: string, offererCount: number) => void
  onTaskDiscarded?: (tenderId: string) => void
  onTaskUndone?: (tenderId: string) => void
  variant: 'pending' | 'completed' | 'discarded'
}) {
  const [offererCount, setOffererCount] = useState<string>(
    String(task.savedOffererCount ?? task.offerers?.length ?? 0)
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(!!task.saved)
  const [discarding, setDiscarding] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = parseInt(offererCount, 10)
    if (Number.isNaN(n) || n < 0) return
    setSaving(true)
    try {
      await saveResult({
        ocid: task.ocid,
        tenderId: task.tenderId,
        awardIds: task.awardIds,
        offererCount: n,
      })
      setSaved(true)
      onTaskSaved?.(task.tenderId, n)
    } catch {
      setSaving(false)
    }
    setSaving(false)
  }

  const handleDiscard = async () => {
    setDiscarding(true)
    try {
      await saveResult({
        ocid: task.ocid,
        tenderId: task.tenderId,
        awardIds: task.awardIds,
        discarded: true,
      })
      onTaskDiscarded?.(task.tenderId)
    } catch {
      setShowDiscardConfirm(false)
    }
    setDiscarding(false)
    setShowDiscardConfirm(false)
  }

  const handleUndo = async () => {
    setUndoing(true)
    try {
      await deleteResult(task.tenderId)
      onTaskUndone?.(task.tenderId)
    } catch {
      // ignore
    }
    setUndoing(false)
  }

  const hasPdfs = task.pdfAdaUrl || task.pdfCcoUrl

  useEffect(() => {
    if (task.saved) {
      setSaved(true)
      if (task.savedOffererCount != null) setOffererCount(String(task.savedOffererCount))
    }
  }, [task.saved, task.savedOffererCount])

  return (
    <article className={`task-card task-card-${variant}`}>
      <header className="task-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="task-card-title-row">
          <h2>
            {task.tenderId}
            <span className="expand-hint">{expanded ? '▼' : '▶'}</span>
          </h2>
          <PdfBadges task={task} />
        </div>
        {(task.ocid || task.awardIds?.length) ? (
          <p className="task-ids">
            {task.ocid && <span>OCID: {task.ocid}</span>}
            {task.awardIds?.length ? <span>Awards: {task.awardIds.length}</span> : null}
          </p>
        ) : null}
      </header>
      <div className="task-body">
        {variant === 'discarded' ? (
          <div className="tag-form tag-form-discarded">
            <span className="discarded-label">Descartada (PDFs incorrectos)</span>
            <button
              type="button"
              className="btn-undo"
              onClick={handleUndo}
              disabled={undoing}
            >
              {undoing ? 'Deshaciendo…' : 'Deshacer'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="tag-form">
            <label>
              Cantidad de oferentes:
              <input
                type="number"
                min={0}
                value={offererCount}
                onChange={(e) => setOffererCount(e.target.value)}
                disabled={saved}
              />
            </label>
            <div className="tag-form-actions">
              <button type="submit" disabled={saving || saved}>
                {saved ? 'Guardado' : saving ? 'Guardando…' : 'Guardar tag'}
              </button>
              {variant === 'pending' && (
                <button
                  type="button"
                  className="btn-discard"
                  onClick={(e) => { e.stopPropagation(); setShowDiscardConfirm(true); }}
                  disabled={saving || saved}
                >
                  Descartar
                </button>
              )}
            </div>
          </form>
        )}
        {showDiscardConfirm && (
          <div className="modal-overlay" onClick={() => setShowDiscardConfirm(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>¿Descartar esta tarea?</h3>
              <p>Los PDFs no son correctos. La tarea pasará a &quot;Descartadas&quot; y podrás deshacerlo más tarde.</p>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowDiscardConfirm(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-discard-confirm"
                  onClick={handleDiscard}
                  disabled={discarding}
                >
                  {discarding ? 'Descartando…' : 'Sí, descartar'}
                </button>
              </div>
            </div>
          </div>
        )}
        {expanded && hasPdfs && (
          <section className="pdf-section">
            {task.pdfAdaUrl && (
              <div className="pdf-link-block">
                <a href={task.pdfAdaUrl} target="_blank" rel="noreferrer">Ver Acta de Apertura</a>
                <iframe
                  title={`ADA ${task.tenderId}`}
                  src={task.pdfAdaUrl}
                  className="pdf-iframe"
                />
              </div>
            )}
            {task.pdfCcoUrl && (
              <div className="pdf-link-block">
                <a href={task.pdfCcoUrl} target="_blank" rel="noreferrer">Ver Cuadro Comparativo</a>
                <iframe
                  title={`CCO ${task.tenderId}`}
                  src={task.pdfCcoUrl}
                  className="pdf-iframe"
                />
              </div>
            )}
          </section>
        )}
        {expanded && !hasPdfs && (
          <p className="no-pdf">No hay PDFs disponibles (ADA/CCO) para esta licitación.</p>
        )}
      </div>
    </article>
  )
}

const PAGE_SIZE = 25

export default function App() {
  const [pendingTasks, setPendingTasks] = useState<TaggingTask[]>([])
  const [completedTasks, setCompletedTasks] = useState<TaggingTask[]>([])
  const [discardedTasks, setDiscardedTasks] = useState<TaggingTask[]>([])
  const [stats, setStats] = useState<{ total: number; saved: number; discarded: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [showDiscarded, setShowDiscarded] = useState(false)
  const [pagePending, setPagePending] = useState(0)
  const [pageCompleted, setPageCompleted] = useState(0)
  const [pageDiscarded, setPageDiscarded] = useState(0)
  const [loadingPending, setLoadingPending] = useState(false)
  const [loadingCompleted, setLoadingCompleted] = useState(false)
  const [loadingDiscarded, setLoadingDiscarded] = useState(false)

  const loadSection = async (
    status: 'pending' | 'saved' | 'discarded',
    pageNum: number,
    setter: React.Dispatch<React.SetStateAction<TaggingTask[]>>,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    setLoading(true)
    try {
      const tasksData = await fetchTasks(PAGE_SIZE, pageNum * PAGE_SIZE, { status })
      setter(tasksData)
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
  }

  const loadAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [pendingData, completedData, discardedData, statsData] = await Promise.all([
        fetchTasks(PAGE_SIZE, 0, { status: 'pending' }),
        fetchTasks(PAGE_SIZE, 0, { status: 'saved' }),
        fetchTasks(PAGE_SIZE, 0, { status: 'discarded' }),
        fetchStats(),
      ])
      setPendingTasks(pendingData)
      setCompletedTasks(completedData)
      setDiscardedTasks(discardedData)
      setStats(statsData)
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  const loadPending = (p: number) => {
    setPagePending(p)
    loadSection('pending', p, setPendingTasks, setLoadingPending)
  }

  const loadCompleted = (p: number) => {
    setPageCompleted(p)
    loadSection('saved', p, setCompletedTasks, setLoadingCompleted)
  }

  const loadDiscarded = (p: number) => {
    setPageDiscarded(p)
    loadSection('discarded', p, setDiscardedTasks, setLoadingDiscarded)
  }

  const updateStatsOptimistic = (delta: { saved?: number; discarded?: number }) => {
    setStats((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        saved: prev.saved + (delta.saved ?? 0),
        discarded: prev.discarded + (delta.discarded ?? 0),
      }
    })
  }

  const onTaskSaved = (tenderId: string, offererCount: number) => {
    const task = pendingTasks.find((t) => t.tenderId === tenderId)
    if (task) {
      const updated = { ...task, saved: true, savedOffererCount: offererCount }
      setPendingTasks((prev) => prev.filter((t) => t.tenderId !== tenderId))
      setCompletedTasks((prev) => [updated, ...prev])
      updateStatsOptimistic({ saved: 1 })
    }
  }

  const onTaskDiscarded = (tenderId: string) => {
    const task = pendingTasks.find((t) => t.tenderId === tenderId)
    if (task) {
      const updated = { ...task, discarded: true }
      setPendingTasks((prev) => prev.filter((t) => t.tenderId !== tenderId))
      setDiscardedTasks((prev) => [updated, ...prev])
      updateStatsOptimistic({ discarded: 1 })
    }
  }

  const onTaskUndone = (tenderId: string) => {
    const task = discardedTasks.find((t) => t.tenderId === tenderId)
    if (task) {
      const updated = { ...task, discarded: false, saved: false, savedOffererCount: undefined }
      setDiscardedTasks((prev) => prev.filter((t) => t.tenderId !== tenderId))
      setPendingTasks((prev) => [updated, ...prev])
      updateStatsOptimistic({ discarded: -1 })
    }
  }

  const pendingCount = stats ? stats.total - stats.saved - stats.discarded : 0
  const totalPagesPending = Math.ceil(pendingCount / PAGE_SIZE)
  const totalPagesCompleted = Math.ceil((stats?.saved ?? 0) / PAGE_SIZE)
  const totalPagesDiscarded = Math.ceil((stats?.discarded ?? 0) / PAGE_SIZE)

  const allLoadedTasks = [...pendingTasks, ...completedTasks, ...discardedTasks]
  const adaCount = allLoadedTasks.filter((t) => t.pdfAdaUrl).length
  const ccoCount = allLoadedTasks.filter((t) => t.pdfCcoUrl).length

  return (
    <div className="app">
      <header className="app-header">
        <h1>Tagging de Oferentes</h1>
        <p>Etiquetar licitaciones con la cantidad de oferentes.</p>
        {!loading && !error && stats && stats.total > 0 && (
          <>
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${(stats.saved / stats.total) * 100}%` }}
              />
              <span className="progress-bar-label">
                {stats.saved} / {stats.total} etiquetados
              </span>
            </div>
            <div className="stats">
              <span>{stats.total} tareas</span>
              <span>{pendingCount} pendientes</span>
              <span>{stats.saved} completadas</span>
              <span>{stats.discarded ?? 0} descartadas</span>
              <span>ADA: {adaCount}/{allLoadedTasks.length}</span>
              <span>CCO: {ccoCount}/{allLoadedTasks.length}</span>
            </div>
          </>
        )}
      </header>
      {loading && (
        <div className="section-spinner section-spinner-full" aria-label="Cargando">
          <span className="spinner" />
          <span>Cargando tareas…</span>
        </div>
      )}
      {error && (
        <div className="error">
          Error: {error}
          <button onClick={() => loadAll()}>Reintentar</button>
        </div>
      )}
      {!loading && !error && stats?.total === 0 && (
        <p className="empty">
          No hay tareas. Sube archivos en el prefix de input del bucket (ids.json, ids.txt o {`{tenderId}.json`}).
        </p>
      )}
      {!loading && !error && stats && stats.total > 0 && (
        <div className="task-sections">
          <section className="task-section task-section-pending">
            <div className="section-header">
              <h2 className="section-title">Pendientes ({pendingCount})</h2>
              {totalPagesPending > 1 && (
                <nav className="pagination pagination-inline">
                  <button
                    type="button"
                    disabled={pagePending <= 0 || loadingPending}
                    onClick={() => loadPending(pagePending - 1)}
                  >
                    ←
                  </button>
                  <span className="pagination-info">
                    {pagePending + 1} / {totalPagesPending}
                  </span>
                  <button
                    type="button"
                    disabled={pagePending >= totalPagesPending - 1 || loadingPending}
                    onClick={() => loadPending(pagePending + 1)}
                  >
                    →
                  </button>
                </nav>
              )}
            </div>
            <div className="task-list task-list-with-spinner">
              {loadingPending ? (
                <div className="section-spinner" aria-label="Cargando">
                  <span className="spinner" />
                  <span>Cargando tareas…</span>
                </div>
              ) : pendingTasks.length > 0 ? (
                pendingTasks.map((task) => (
                  <TaskCard
                    key={task.tenderId}
                    task={task}
                    onTaskSaved={onTaskSaved}
                    onTaskDiscarded={onTaskDiscarded}
                    variant="pending"
                  />
                ))
              ) : (
                <p className="section-empty">No hay tareas pendientes.</p>
              )}
            </div>
          </section>
          <section className="task-section task-section-completed">
            <button
              type="button"
              className="section-toggle"
              onClick={() => setShowCompleted(!showCompleted)}
            >
              {showCompleted ? '▼' : '▶'} Completadas ({stats.saved})
            </button>
            {showCompleted && (
              <>
                {totalPagesCompleted > 1 && (
                  <nav className="pagination pagination-inline">
                    <button
                      type="button"
                      disabled={pageCompleted <= 0 || loadingCompleted}
                      onClick={() => loadCompleted(pageCompleted - 1)}
                    >
                      ←
                    </button>
                    <span className="pagination-info">
                      {pageCompleted + 1} / {totalPagesCompleted}
                    </span>
                    <button
                      type="button"
                      disabled={pageCompleted >= totalPagesCompleted - 1 || loadingCompleted}
                      onClick={() => loadCompleted(pageCompleted + 1)}
                    >
                      →
                    </button>
                  </nav>
                )}
                <div className="task-list task-list-with-spinner">
                  {loadingCompleted ? (
                    <div className="section-spinner" aria-label="Cargando">
                      <span className="spinner" />
                      <span>Cargando tareas…</span>
                    </div>
                  ) : completedTasks.length > 0 ? (
                    completedTasks.map((task) => (
                      <TaskCard
                        key={task.tenderId}
                        task={task}
                        variant="completed"
                      />
                    ))
                  ) : (
                    <p className="section-empty">No hay tareas completadas.</p>
                  )}
                </div>
              </>
            )}
          </section>
          <section className="task-section task-section-discarded">
            <button
              type="button"
              className="section-toggle"
              onClick={() => setShowDiscarded(!showDiscarded)}
            >
              {showDiscarded ? '▼' : '▶'} Descartadas ({stats.discarded ?? 0})
            </button>
            {showDiscarded && (
              <>
                {totalPagesDiscarded > 1 && (
                  <nav className="pagination pagination-inline">
                    <button
                      type="button"
                      disabled={pageDiscarded <= 0 || loadingDiscarded}
                      onClick={() => loadDiscarded(pageDiscarded - 1)}
                    >
                      ←
                    </button>
                    <span className="pagination-info">
                      {pageDiscarded + 1} / {totalPagesDiscarded}
                    </span>
                    <button
                      type="button"
                      disabled={pageDiscarded >= totalPagesDiscarded - 1 || loadingDiscarded}
                      onClick={() => loadDiscarded(pageDiscarded + 1)}
                    >
                      →
                    </button>
                  </nav>
                )}
                <div className="task-list task-list-with-spinner">
                  {loadingDiscarded ? (
                    <div className="section-spinner" aria-label="Cargando">
                      <span className="spinner" />
                      <span>Cargando tareas…</span>
                    </div>
                  ) : discardedTasks.length > 0 ? (
                    discardedTasks.map((task) => (
                      <TaskCard
                        key={task.tenderId}
                        task={task}
                        onTaskUndone={onTaskUndone}
                        variant="discarded"
                      />
                    ))
                  ) : (
                    <p className="section-empty">No hay tareas descartadas.</p>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
