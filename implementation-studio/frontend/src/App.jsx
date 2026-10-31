import { useEffect, useRef, useState } from 'react'

const API = '/api/v1'
const FORMATS = '.pdf,.docx,.xlsx,.json,.txt,.md,.markdown'

async function request(path, options) {
  const response = await fetch(`${API}${path}`, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || 'The request could not be completed.')
  return data
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Location({ source }) {
  const parts = [source.page && `Page ${source.page}`, source.sheet && `Sheet ${source.sheet}`, source.section, source.paragraph && `Paragraph ${source.paragraph}`].filter(Boolean)
  return <span>{parts.length ? parts.join(' / ') : 'Document text'}</span>
}

const MOCK_NODES = [
  { id: 'trigger', kind: 'trigger', title: 'Loan application received', subtitle: 'TRIGGER', x: 40, y: 150 },
  { id: 'eligibility', kind: 'step', title: 'Validate eligibility', subtitle: 'VALIDATION', x: 270, y: 150 },
  { id: 'amount', kind: 'decision', title: 'Loan amount > ₹10L?', subtitle: 'DECISION', x: 500, y: 150 },
  { id: 'manager', kind: 'step', title: 'Manager approval', subtitle: 'APPROVAL', x: 740, y: 55 },
  { id: 'senior', kind: 'step', title: 'Senior manager approval', subtitle: 'APPROVAL', x: 980, y: 55 },
  { id: 'standard', kind: 'step', title: 'Standard approval', subtitle: 'APPROVAL', x: 740, y: 260 },
  { id: 'approved', kind: 'terminal', title: 'Application approved', subtitle: 'OUTCOME', x: 1220, y: 55 },
  { id: 'rejected', kind: 'terminal danger', title: 'Application rejected', subtitle: 'OUTCOME', x: 980, y: 350 },
]

const MOCK_EDGES = [
  ['trigger', 'eligibility', ''],
  ['eligibility', 'amount', 'eligible'],
  ['amount', 'manager', 'yes'],
  ['amount', 'standard', 'no'],
  ['manager', 'senior', 'approved'],
  ['manager', 'rejected', 'rejected'],
  ['senior', 'approved', 'approved'],
  ['senior', 'rejected', 'rejected'],
  ['standard', 'approved', 'approved'],
  ['standard', 'rejected', 'rejected'],
]

function edgePath(start, end) {
  const sourceX = start.x + 180
  const sourceY = start.y + 42
  const targetX = end.x
  const targetY = end.y + 42
  const middleX = sourceX + Math.max(28, (targetX - sourceX) / 2)
  return {
    path: `M ${sourceX} ${sourceY} L ${middleX} ${sourceY} L ${middleX} ${targetY} L ${targetX} ${targetY}`,
    labelX: middleX,
    labelY: (sourceY + targetY) / 2 - 5,
  }
}

function MockCanvas() {
  const [nodes, setNodes] = useState(MOCK_NODES)
  const [selectedId, setSelectedId] = useState('eligibility')
  const [running, setRunning] = useState(false)
  const [zoom, setZoom] = useState(1)
  const drag = useRef(null)
  const selected = nodes.find((node) => node.id === selectedId) || nodes[0]

  function moveNode(event) {
    if (!drag.current) return
    const { id, offsetX, offsetY } = drag.current
    const { canvasLeft, canvasTop } = drag.current
    setNodes((current) => current.map((node) => node.id === id
      ? { ...node, x: Math.max(20, (event.clientX - canvasLeft) / zoom - offsetX), y: Math.max(20, (event.clientY - canvasTop) / zoom - offsetY) }
      : node))
  }

  function startDrag(event, node) {
    event.stopPropagation()
    const bounds = event.currentTarget.parentElement.getBoundingClientRect()
    drag.current = {
      id: node.id,
      canvasLeft: bounds.left,
      canvasTop: bounds.top,
      offsetX: (event.clientX - bounds.left) / zoom - node.x,
      offsetY: (event.clientY - bounds.top) / zoom - node.y,
    }
    setSelectedId(node.id)
    window.addEventListener('pointermove', moveNode)
    window.addEventListener('pointerup', stopDrag, { once: true })
  }

  function stopDrag() {
    drag.current = null
    window.removeEventListener('pointermove', moveNode)
  }

  function reset() {
    setNodes(MOCK_NODES)
    setSelectedId('eligibility')
    setZoom(1)
  }

  function runSimulation() {
    setRunning(true)
    window.setTimeout(() => setRunning(false), 1800)
  }

  return <main className="mock-shell">
    <header className="mock-topbar">
      <div className="mock-brand"><span className="brand-mark">IS</span><div><strong>Implementation Studio</strong><small>WORKFLOW CANVAS / DEMO</small></div></div>
      <div className="mock-actions"><span className="mock-badge">HARDCODED DEMO</span><button type="button" onClick={reset}>Reset layout</button><button type="button" className="mock-run" onClick={runSimulation}>{running ? 'Running…' : 'Run simulation'} <span>▶</span></button></div>
    </header>
    <div className="mock-layout">
      <aside className="mock-palette"><span className="mock-eyebrow">NODE PALETTE</span><h2>Personal loan flow</h2><p>Drag nodes to explore the generated implementation shape.</p>
        {['Trigger', 'Validation', 'Decision', 'Approval', 'Outcome'].map((item) => <div className="palette-item" key={item}><span className={`palette-dot ${item.toLowerCase()}`} />{item}<span>+</span></div>)}
        <div className="mock-legend"><span className="mock-eyebrow">LEGEND</span><div><i className="edge-dot green" />Approved path</div><div><i className="edge-dot red" />Rejected path</div></div>
      </aside>
      <section className="mock-stage">
        <div className="mock-toolbar"><span><strong>Loan approval workflow</strong> <small>v1.0 · GENERATED</small></span><div><button type="button" onClick={() => setZoom((value) => Math.max(.7, value - .1))}>−</button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((value) => Math.min(1.3, value + .1))}>+</button></div></div>
        <div className="mock-canvas" onPointerMove={moveNode}>
          <div className="mock-grid" />
          <div className="mock-world" style={{ transform: `scale(${zoom})` }}>
            <svg className="mock-edges" width="1460" height="500" viewBox="0 0 1460 500" aria-hidden="true">
              {MOCK_EDGES.map(([from, to, label]) => {
                const start = nodes.find((node) => node.id === from)
                const end = nodes.find((node) => node.id === to)
                const route = edgePath(start, end)
                return <g key={`${from}-${to}`}><path className={label === 'rejected' ? 'rejected-edge' : 'approved-edge'} d={route.path} /><text x={route.labelX + 6} y={route.labelY}>{label}</text></g>
              })}
            </svg>
            <div className="mock-node-layer">
              {nodes.map((node) => <button type="button" key={node.id} className={`mock-node ${node.kind} ${selectedId === node.id ? 'selected' : ''}`} style={{ left: node.x, top: node.y }} onPointerDown={(event) => startDrag(event, node)} onClick={() => setSelectedId(node.id)}><span>{node.subtitle}</span><strong>{node.title}</strong><i>{node.kind === 'decision' ? '?' : node.kind === 'terminal' || node.kind.includes('danger') ? '●' : '→'}</i></button>)}
            </div>
          </div>
        </div>
        <div className={`mock-runbar ${running ? 'running' : ''}`}><span className="run-pulse" /><strong>{running ? 'Simulation running' : 'Ready to simulate'}</strong><span>{running ? 'Following approved path through the workflow…' : 'Select Run simulation to preview the approval path'}</span></div>
      </section>
      <aside className="mock-inspector"><span className="mock-eyebrow">INSPECTOR</span><h2>{selected.title}</h2><span className={`inspector-type ${selected.kind}`}>{selected.subtitle}</span><div className="inspector-section"><label>Node ID</label><code>{selected.id}</code></div><div className="inspector-section"><label>Source requirement</label><p>{selected.id === 'eligibility' ? 'REQ-0002 · Applicant eligibility rules' : 'REQ-0005 · Approval workflow'}</p></div><div className="inspector-section"><label>Configuration</label><div className="inspector-json">{JSON.stringify({ type: selected.kind.replace(' danger', ''), status: 'validated', review: 'approved' }, null, 2)}</div></div></aside>
    </div>
  </main>
}

export default function App() {
  if (new URLSearchParams(window.location.search).has('mock-workflow')) return <MockCanvas />
  const fileInput = useRef(null)
  const [documents, setDocuments] = useState([])
  const [documentId, setDocumentId] = useState('')
  const [document, setDocument] = useState(null)
  const [config, setConfig] = useState({
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    api_key_configured: false,
    gemini_endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    gemini_model: 'gemini-2.0-flash',
    gemini_api_key_configured: false,
  })
  const [mode, setMode] = useState('demo')
  const [endpoint, setEndpoint] = useState('https://api.openai.com/v1')
  const [model, setModel] = useState('gpt-4o-mini')
  const [apiKey, setApiKey] = useState('')
  const [view, setView] = useState('requirements')
  const [busy, setBusy] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [apiStatus, setApiStatus] = useState('Checking API')

  async function refreshDocuments() {
    const data = await request('/documents')
    setDocuments(data.documents ?? [])
  }

  useEffect(() => {
    request('/documents')
      .then((data) => {
        const items = data.documents ?? []
        setDocuments(items)
        if (items.length) setDocumentId(items[0].document_id)
      })
      .catch((cause) => setError(cause.message))
    request('/documents/config')
      .then((data) => {
        setConfig(data)
        setEndpoint(data.endpoint)
        setModel(data.model)
      })
      .catch((cause) => setError(cause.message))
    fetch('/health').then((response) => {
      if (!response.ok) throw new Error()
      setApiStatus('API connected')
    }).catch(() => setApiStatus('API unavailable'))
  }, [])

  useEffect(() => {
    if (!documentId) {
      setDocument(null)
      return
    }
    request(`/documents/${documentId}`)
      .then(setDocument)
      .catch((cause) => setError(cause.message))
  }, [documentId])

  async function uploadFile(file) {
    if (!file) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const body = new FormData()
      body.append('file', file)
      const uploaded = await request('/documents', { method: 'POST', body })
      await refreshDocuments()
      setDocumentId(uploaded.document_id)
      setDocument(uploaded)
      setView('requirements')
      setNotice(`${uploaded.document_name} added to the source library.`)
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function extract() {
    if (!document) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await request(`/documents/${document.document_id}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, endpoint, model, api_key: apiKey || null }),
      })
      const refreshed = await request(`/documents/${document.document_id}`)
      setDocument(refreshed)
      await refreshDocuments()
      setView('requirements')
      setNotice(`${result.count} candidate ${result.count === 1 ? 'requirement' : 'requirements'} extracted using ${mode === 'demo' ? 'labelled demo mode' : model}.`)
      setApiKey('')
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
    }
  }

  async function approveRequirement(requirementId) {
    if (!document) return
    setBusy(true)
    setError('')
    try {
      await request(`/documents/${document.document_id}/requirements/${requirementId}/approve`, { method: 'POST' })
      setDocument(await request(`/documents/${document.document_id}`))
      await refreshDocuments()
      setNotice(`${requirementId} approved for artefact generation.`)
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
    }
  }

  async function generateArtefacts() {
    if (!document) return
    setGenerating(true)
    setError('')
    setNotice('')
    try {
      const result = await request(`/documents/${document.document_id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, model, api_key: apiKey || null }),
      })
      setDocument(await request(`/documents/${document.document_id}`))
      await refreshDocuments()
      setView('artefacts')
      setNotice(`${result.report.artefact_count} artefacts generated; ${result.report.unproduced_requirements.length} requirements have no artefact.`)
      setApiKey('')
    } catch (cause) {
      setError(cause.message)
    } finally {
      setGenerating(false)
    }
  }

  function onDrop(event) {
    event.preventDefault()
    uploadFile(event.dataTransfer.files[0])
  }

  const requirementCount = documents.reduce((total, item) => total + (item.requirement_count || 0), 0)
  const artefactCount = documents.reduce((total, item) => total + (item.artefact_count || 0), 0)
  const warningCount = documents.reduce((total, item) => total + (item.warnings?.length || 0), 0)
  const approvedCount = document?.requirements?.filter((item) => item.status === 'APPROVED').length || 0

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">IS</span><span>Implementation<br />Studio</span></div>
        <div className="nav-label">WORKSPACE</div>
        <div className="nav-item active"><span className="nav-glyph">▤</span>Documents</div>
        <div className="nav-item muted"><span className="nav-glyph">≡</span>Requirements</div>
        <button className={`nav-item ${view === 'artefacts' ? 'active' : 'muted'}`} type="button" disabled={!document} onClick={() => setView('artefacts')}><span className="nav-glyph">◇</span>Artefacts</button>
        <div className="nav-item muted"><span className="nav-glyph">↗</span>Traceability <small>Next</small></div>
        <div className="sidebar-bottom"><span className={`api-dot ${apiStatus === 'API connected' ? 'online' : ''}`} />{apiStatus}<small>Local workspace</small></div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><div className="eyebrow">SOURCE LIBRARY / MILESTONE 2</div><h1>Documents & requirements</h1></div>
          <div className="topbar-meta"><button className="button secondary canvas-launch" type="button" onClick={() => window.open(`${window.location.pathname}?mock-workflow=1`, 'implementation-studio-mock-canvas', 'width=1500,height=900')}>Open mock canvas ↗</button><span className="status-pill">PROTOTYPE</span><span className="avatar">IS</span></div>
        </header>

        <section className="summary-strip" aria-label="Workspace summary">
          <div><span>Source documents</span><strong>{documents.length.toString().padStart(2, '0')}</strong></div>
          <div><span>Requirements</span><strong>{requirementCount.toString().padStart(2, '0')}</strong></div>
          <div><span>Artefacts</span><strong>{artefactCount.toString().padStart(2, '0')}</strong></div>
          <div><span>Extraction warnings</span><strong className={warningCount ? 'warning-number' : ''}>{warningCount.toString().padStart(2, '0')}</strong></div>
          <p>INGESTION &nbsp;·&nbsp; EVIDENCE &nbsp;·&nbsp; REVIEW</p>
        </section>

        <div className="workspace-grid">
          <aside className="library-column">
            <section className="upload-section">
              <div className="section-heading"><div><span className="eyebrow">01 / INGEST</span><h2>Source library</h2></div><span className="count-label">{documents.length} FILES</span></div>
              <div className="dropzone" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
                <input ref={fileInput} type="file" accept={FORMATS} onChange={(event) => uploadFile(event.target.files[0])} hidden />
                <span className="upload-mark">↑</span>
                <strong>Drop a source file here</strong>
                <span>PDF, DOCX, XLSX, JSON, TXT, MD</span>
                <button className="button secondary" type="button" disabled={busy} onClick={() => fileInput.current?.click()}>{busy ? 'Working…' : 'Browse files'}</button>
                <small>Maximum file size 25 MB</small>
              </div>
            </section>

            <section className="library-list-section">
              <div className="list-heading"><h3>Recent documents</h3><span>{documents.length}</span></div>
              <div className="document-list">
                {documents.map((item) => (
                  <button className={`document-row ${item.document_id === documentId ? 'selected' : ''}`} key={item.document_id} type="button" onClick={() => setDocumentId(item.document_id)}>
                    <span className={`file-badge ${item.file_type}`}>{item.file_type.toUpperCase().slice(0, 4)}</span>
                    <span className="document-meta"><strong>{item.document_name}</strong><small>{formatBytes(item.size_bytes)} <i /> {item.warnings?.length ? `${item.warnings.length} warning${item.warnings.length === 1 ? '' : 's'}` : 'Ready to extract'}</small></span>
                    <span className="row-chevron">›</span>
                  </button>
                ))}
                {!documents.length && <p className="empty-state">Uploaded documents will appear here.</p>}
              </div>
            </section>
          </aside>

          <section className="detail-column">
            {document ? <>
              <div className="document-header">
                <div className="document-title">
                  <span className={`file-badge large ${document.file_type}`}>{document.file_type.toUpperCase().slice(0, 4)}</span>
                  <div><span className="eyebrow">02 / DOCUMENT</span><h2>{document.document_name}</h2><p>{formatBytes(document.size_bytes)} <i /> Added {new Date(document.created_at).toLocaleDateString()}</p></div>
                </div>
                <span className="document-id">{document.document_id}</span>
              </div>

              {document.warnings?.length > 0 && <div className="warning-list" role="status">
                {document.warnings.map((warning, index) => <div className="warning-item" key={`${warning.code}-${index}`}><span>!</span><p><strong>{warning.code.replaceAll('_', ' ')}</strong> · {warning.message}</p></div>)}
              </div>}

              <section className="extract-panel">
                <div className="extract-panel-heading"><div><span className="eyebrow">03 / EXTRACT</span><h3>Requirement extraction</h3></div><span className={`mode-label ${mode}`}>{mode === 'demo' ? 'DEMO MODE' : 'API MODE'}</span></div>
                <div className="mode-switch" role="group" aria-label="Extraction mode">
                  <button type="button" className={mode === 'demo' ? 'chosen' : ''} onClick={() => setMode('demo')}>Demo extraction</button>
                  <button type="button" className={mode === 'openai_compatible' ? 'chosen' : ''} onClick={() => { setMode('openai_compatible'); setEndpoint(config.endpoint); setModel(config.model) }}>OpenAI-compatible</button>
                  <button type="button" className={mode === 'gemini' ? 'chosen' : ''} onClick={() => { setMode('gemini'); setEndpoint(config.gemini_endpoint); setModel(config.gemini_model) }}>Gemini</button>
                </div>
                {mode === 'demo' ? <p className="mode-note">Heuristic candidates for testing. All results are marked for review and are not production extraction.</p> : <div className="provider-fields">
                  <label>{mode === 'gemini' ? 'Gemini endpoint' : 'API endpoint'}<input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder={mode === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta' : 'https://provider.example/v1'} /></label>
                  <label>Model<input value={model} onChange={(event) => setModel(event.target.value)} placeholder="Model identifier" /></label>
                  <label className="key-field">API key<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={(mode === 'gemini' ? config.gemini_api_key_configured : config.api_key_configured) ? 'Using server-configured key' : 'Used for this request; not stored'} autoComplete="off" /></label>
                </div>}
                <div className="extract-actions"><span>{document.segments?.length || 0} readable source segments</span><button className="button primary" type="button" disabled={busy || !document.segments?.length} onClick={extract}>{busy ? 'Extracting…' : 'Run extraction'}<span aria-hidden="true">↗</span></button></div>
              </section>

              <section className="results-section">
                <div className="results-heading"><div><span className="eyebrow">04 / REVIEW</span><h3>{view === 'artefacts' ? 'Generated artefacts' : 'Extracted requirements'} <span>{view === 'artefacts' ? document.artefacts?.length || 0 : document.requirements?.length || 0}</span></h3></div><div className="results-controls">
                  <button className="button primary generate-button" type="button" disabled={generating || !approvedCount} title={!approvedCount ? 'Approve requirements without open questions first' : 'Generate from approved requirements'} onClick={generateArtefacts}>{generating ? 'Generating…' : `Generate (${approvedCount})`}<span aria-hidden="true">↗</span></button>
                  <div className="view-switch" role="tablist" aria-label="Document result view">
                    <button role="tab" aria-selected={view === 'requirements'} className={view === 'requirements' ? 'active' : ''} onClick={() => setView('requirements')}>Requirements</button>
                    <button role="tab" aria-selected={view === 'artefacts'} className={view === 'artefacts' ? 'active' : ''} onClick={() => setView('artefacts')}>Artefacts</button>
                    <button role="tab" aria-selected={view === 'source'} className={view === 'source' ? 'active' : ''} onClick={() => setView('source')}>Source</button>
                    <button role="tab" aria-selected={view === 'json'} className={view === 'json' ? 'active' : ''} onClick={() => setView('json')}>JSON</button>
                  </div>
                </div></div>

                {view === 'requirements' && <div className="requirements-list">
                  {(document.requirements || []).map((item) => <article className="requirement-row" key={item.requirement_id}>
                    <div className="requirement-meta"><span className="requirement-id">{item.requirement_id}</span><span className={`type-tag type-${item.requirement_type.toLowerCase()}`}>{item.requirement_type.replaceAll('_', ' ')}</span><span className={`review-tag ${item.status === 'APPROVED' ? 'approved' : ''}`}>{item.status.replaceAll('_', ' ')}</span>{item.status !== 'APPROVED' && <button className="approve-button" type="button" disabled={busy || item.requirement_type === 'OPEN_QUESTION' || item.open_questions?.length > 0} title={item.requirement_type === 'OPEN_QUESTION' || item.open_questions?.length ? 'Resolve open questions before approval' : 'Approve for artefact generation'} onClick={() => approveRequirement(item.requirement_id)}>Approve</button>}</div>
                    <h4>{item.title}</h4><p className="requirement-statement">{item.statement}</p>
                    <blockquote>{item.source.source_text}</blockquote>
                    <div className="source-location"><span>↳</span><Location source={item.source} /><span className="confidence">{Math.round((item.confidence || 0) * 100)}% confidence</span></div>
                    {item.open_questions?.length > 0 && <div className="open-questions"><strong>Unresolved</strong>{item.open_questions.map((question) => <span key={question}>{question}</span>)}</div>}
                  </article>)}
                  {!document.requirements?.length && <div className="empty-results"><span>◇</span><strong>No requirements extracted yet</strong><p>Run extraction to create source-linked candidates for review.</p></div>}
                </div>}

                {view === 'source' && <div className="source-segments">
                  {(document.segments || []).map((segment) => <article className="segment-row" key={segment.segment_id}><div><strong>{segment.segment_id}</strong><Location source={segment} /></div><p>{segment.text}</p></article>)}
                  {!document.segments?.length && <p className="empty-state">No readable text was extracted.</p>}
                </div>}

                {view === 'json' && <pre className="json-preview">{JSON.stringify(document.requirements || [], null, 2)}</pre>}

                {view === 'artefacts' && <div className="artefacts-list">
                  {document.generation_report && <div className="generation-summary"><span>{document.generation_report.validated_count} validated</span><span>{document.generation_report.validation_failed_count} failed validation</span><span>{document.generation_report.unproduced_requirements?.length || 0} unproduced requirements</span></div>}
                  {(document.artefacts || []).map((entry) => <article className="artefact-row" key={entry.artefact.artefact_id}>
                    <div className="artefact-heading"><div><span className="requirement-id">{entry.artefact.artefact_id}</span><span className="type-tag">{entry.artefact.artefact_type.replaceAll('_', ' ')}</span></div><span className={`artifact-status ${entry.validation_passed ? 'valid' : 'invalid'}`}>{entry.artefact.status.replaceAll('_', ' ')}</span></div>
                    <h4>{entry.artefact.name}</h4><p>{entry.artefact.description}</p>
                    <pre className="configuration-preview">{JSON.stringify(entry.artefact.configuration, null, 2)}</pre>
                    <div className="artefact-links"><span>Requirements: {entry.artefact.source_requirements.join(', ')}</span><span>Schema: {entry.schema_path}</span></div>
                    {entry.validation_errors?.length > 0 && <div className="validation-errors"><strong>Schema validation errors</strong>{entry.validation_errors.map((message) => <span key={message}>{message}</span>)}</div>}
                  </article>)}
                  {document.generation_report?.unproduced_requirements?.length > 0 && <section className="unproduced-list"><h4>Requirements without artefacts</h4>{document.generation_report.unproduced_requirements.map((item) => <div key={item.requirement_id}><span>{item.requirement_id} · {item.title}</span><strong>{item.reason.replaceAll('_', ' ')}</strong></div>)}</section>}
                  {!document.artefacts?.length && <div className="empty-results"><span>◇</span><strong>No artefacts generated</strong><p>Approve eligible requirements, then generate configurations.</p></div>}
                </div>}
              </section>
            </> : <div className="select-empty"><div className="empty-symbol">↑</div><span className="eyebrow">SOURCE LIBRARY</span><h2>Add a document to begin</h2><p>Upload a supported business document to inspect its extracted text and create traceable requirement candidates.</p><button className="button primary" type="button" onClick={() => fileInput.current?.click()}>Choose a file <span aria-hidden="true">↗</span></button></div>}
          </section>
        </div>
        {(error || notice) && <div className={`toast ${error ? 'toast-error' : ''}`} role="status"><span>{error ? '!' : '✓'}</span><p>{error || notice}</p><button type="button" aria-label="Dismiss message" onClick={() => { setError(''); setNotice('') }}>×</button></div>}
      </section>
    </main>
  )
}
