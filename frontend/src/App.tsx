import { useState, useEffect } from 'react'
import { fetchTasks, saveResult, type TaggingTask } from './api/tagging'
import './App.css'

function TaskCard({
  task,
  onSave,
}: {
  task: TaggingTask
  onSave: () => void
}) {
  const [offererCount, setOffererCount] = useState<string>(
    String(task.offerers?.length ?? 0)
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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

  return (
    <article className="task-card">
      <header>
        <h2>Licitación: {task.tenderId}</h2>
        {(task.ocid || task.awardIds?.length) ? (
          <p className="task-ids">
            {task.ocid && <span>OCID: {task.ocid}</span>}
            {task.awardIds?.length ? <span>Awards: {task.awardIds.join(', ')}</span> : null}
          </p>
        ) : null}
      </header>
      <div className="task-body">
        {task.pdfUrl && (
          <section className="pdf-section">
            <a href={task.pdfUrl} target="_blank" rel="noreferrer">
              Ver PDF
            </a>
            <iframe
              title={`PDF ${task.tenderId}`}
              src={task.pdfUrl}
              className="pdf-iframe"
            />
          </section>
        )}
        {!task.pdfUrl && (
          <p className="no-pdf">No hay PDF asociado (prefix de PDFs vacío o sin objeto).</p>
        )}
        <section className="offerers-section">
          <h3>Oferentes ({task.offerers?.length ?? 0})</h3>
          {task.offerers?.length ? (
            <ul>
              {task.offerers.map((o) => (
                <li key={o.id}>
                  {o.name ?? o.id}
                </li>
              ))}
            </ul>
          ) : (
            <p>Sin lista de oferentes en el input.</p>
          )}
        </section>
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
      </div>
    </article>
  )
}

export default function App() {
  const [tasks, setTasks] = useState<TaggingTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTasks = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTasks(50, 0)
      setTasks(data)
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
  }

  useEffect(() => {
    loadTasks()
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Tagging de Oferentes</h1>
        <p>Etiquetar licitaciones con la cantidad de oferentes.</p>
      </header>
      {loading && <p>Cargando tareas…</p>}
      {error && (
        <div className="error">
          Error: {error}
          <button onClick={loadTasks}>Reintentar</button>
        </div>
      )}
      {!loading && !error && tasks.length === 0 && (
        <p className="empty">
          No hay tareas. Sube archivos en el prefix de input del bucket (ids.json, ids.txt o {`{tenderId}.json`}).
        </p>
      )}
      <div className="task-list">
        {tasks.map((task) => (
          <TaskCard key={task.tenderId} task={task} onSave={() => {}} />
        ))}
      </div>
    </div>
  )
}
