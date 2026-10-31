import { useEffect, useState } from 'react'

const API = ''

export default function App() {
  const [health, setHealth] = useState('Checking...')
  const [schemas, setSchemas] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API}/health`)
      .then((r) => r.json())
      .then((data) => setHealth(`${data.status} · database ${data.database}`))
      .catch(() => setHealth('API unavailable'))

    fetch(`${API}/api/v1/schemas`)
      .then((r) => r.json())
      .then((data) => setSchemas(data.schemas ?? []))
      .catch(() => setError('Could not load schema catalog. Start the FastAPI backend.'))
  }, [])

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">IS</span><span>Implementation Studio</span></div>
        <div className="nav-label">WORKSPACE</div>
        <div className="nav-item active">Overview</div>
        <div className="nav-item muted">Requirements <small>Milestone 2</small></div>
        <div className="nav-item muted">Artefacts <small>Milestone 2</small></div>
        <div className="nav-item muted">Traceability <small>Milestone 3</small></div>
        <div className="nav-item muted">Review & approval <small>Milestone 3</small></div>
        <div className="sidebar-bottom">Prototype · Local environment</div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><div className="eyebrow">WORKSPACE / OVERVIEW</div><h1>Implementation workspace</h1></div>
          <span className="status-pill"><i /> Prototype foundation</span>
        </header>

        <section className="welcome">
          <div>
            <div className="eyebrow light">AI-POWERED IMPLEMENTATION</div>
            <h2>From business requirements<br />to implementation artefacts.</h2>
            <p>Build a traceable path from source documents to validated configurations.</p>
          </div>
          <div className="welcome-symbol">↗</div>
        </section>

        <section className="stats">
          <div className="stat-card"><span>Active projects</span><strong>0</strong><small>Project workspace comes next</small></div>
          <div className="stat-card"><span>Requirements extracted</span><strong>0</strong><small>Extraction comes in Milestone 2</small></div>
          <div className="stat-card"><span>Artefacts generated</span><strong>0</strong><small>Generation comes in Milestone 2</small></div>
        </section>

        <section className="panel">
          <div className="panel-heading"><div><h3>Foundation status</h3><p>Milestone 1 API and schema registry</p></div><span className="tag">MILESTONE 1</span></div>
          <div className="health-row"><span>Backend API</span><strong>{health}</strong></div>
          <div className="health-row"><span>Schema registry</span><strong>{schemas.length} schemas available</strong></div>
          {error && <p className="error">{error}</p>}
        </section>

        <section className="panel">
          <div className="panel-heading"><div><h3>Schema catalog</h3><p>Contracts that define our canonical data structures</p></div></div>
          <div className="schema-list">
            {schemas.map((schema) => (
              <div className="schema-row" key={schema.path}>
                <div className="file-icon">{'{}'}</div>
                <div><strong>{schema.name}</strong><small>{schema.path}</small></div>
                <span className="schema-type">JSON SCHEMA</span>
              </div>
            ))}
            {schemas.length === 0 && <p className="empty">Schema catalog will appear when the backend is running.</p>}
          </div>
        </section>
      </section>
    </main>
  )
}
