import { useState, useEffect } from 'react'
import { fetchTasks, fetchStats, saveResult, type TaggingTask } from './api/tagging'
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
  onSave,
}: {
  task: TaggingTask
  onSave: () => void
}) {
  const [offererCount, setOffererCount] = useState<string>(
    String(task.savedOffererCount ?? task.offerers?.length ?? 0)
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(!!task.saved)
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
      onSave()
    } catch {
      setSaving(false)
    }
    setSaving(false)
  }

  const hasPdfs = task.pdfAdaUrl || task.pdfCcoUrl

  useEffect(() => {
    if (task.saved) {
      setSaved(true)
      if (task.savedOffererCount != null) setOffererCount(String(task.savedOffererCount))
    }
  }, [task.saved, task.savedOffererCount])

  return (
    <article className="task-card">
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
          <button type="submit" disabled={saving || saved}>
            {saved ? 'Guardado' : saving ? 'Guardando…' : 'Guardar tag'}
          </button>
        </form>
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
  const [tasks, setTasks] = useState<TaggingTask[]>([])
  const [stats, setStats] = useState<{ total: number; saved: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [page, setPage] = useState(0)

  const loadTasks = async (pageNum = 0) => {
    setLoading(true)
    setError(null)
    try {
      const [tasksData, statsData] = await Promise.all([
        fetchTasks(PAGE_SIZE, pageNum * PAGE_SIZE, true),
        fetchStats(),
      ])
      setTasks(tasksData)
      setStats(statsData)
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
  }

  useEffect(() => {
    loadTasks(0)
  }, [])

  const goToPage = (p: number) => {
    setPage(p)
    loadTasks(p)
  }

  const onSave = () => {
    loadTasks(page)
    fetchStats().then(setStats)
  }

  const totalPages = stats ? Math.ceil(stats.total / PAGE_SIZE) : 0

  const pending = tasks.filter((t) => !t.saved)
  const completed = tasks.filter((t) => t.saved)

  const adaCount = tasks.filter((t) => t.pdfAdaUrl).length
  const ccoCount = tasks.filter((t) => t.pdfCcoUrl).length

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
              <span>{pending.length} pendientes</span>
              <span>{stats.saved} completadas</span>
              <span>ADA: {adaCount}/{tasks.length}</span>
              <span>CCO: {ccoCount}/{tasks.length}</span>
            </div>
          </>
        )}
      </header>
      {loading && <p>Cargando tareas…</p>}
      {error && (
        <div className="error">
          Error: {error}
          <button onClick={() => { setPage(0); loadTasks(0); }}>Reintentar</button>
        </div>
      )}
      {!loading && !error && tasks.length === 0 && (
        <p className="empty">
          No hay tareas. Sube archivos en el prefix de input del bucket (ids.json, ids.txt o {`{tenderId}.json`}).
        </p>
      )}
      {!loading && !error && (tasks.length > 0 || stats) && (
        <div className="task-sections">
          {totalPages > 1 && (
            <nav className="pagination">
              <button
                type="button"
                disabled={page <= 0 || loading}
                onClick={() => goToPage(page - 1)}
              >
                ← Anterior
              </button>
              <span className="pagination-info">
                Página {page + 1} de {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1 || loading}
                onClick={() => goToPage(page + 1)}
              >
                Siguiente →
              </button>
            </nav>
          )}
          <section className="task-section task-section-pending">
            <h2 className="section-title">Pendientes ({pending.length})</h2>
            <div className="task-list">
              {pending.length > 0 ? (
                pending.map((task) => (
                  <TaskCard key={task.tenderId} task={task} onSave={onSave} />
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
              {showCompleted ? '▼' : '▶'} Completadas ({stats?.saved ?? completed.length})
            </button>
            {showCompleted && (
              <div className="task-list">
                {completed.map((task) => (
                  <TaskCard key={task.tenderId} task={task} onSave={onSave} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
