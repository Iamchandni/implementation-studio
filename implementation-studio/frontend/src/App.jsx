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

export default function App() {
  const fileInput = useRef(null)
  const [documents, setDocuments] = useState([])
  const [documentId, setDocumentId] = useState('')
  const [document, setDocument] = useState(null)
  const [config, setConfig] = useState({ endpoint: 'https://api.openai.com/v1', model: 'gpt-4o-mini', api_key_configured: false })
  const [mode, setMode] = useState('demo')
  const [endpoint, setEndpoint] = useState('https://api.openai.com/v1')
  const [model, setModel] = useState('gpt-4o-mini')
  const [apiKey, setApiKey] = useState('')
  const [view, setView] = useState('requirements')
  const [busy, setBusy] = useState(false)
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

  function onDrop(event) {
    event.preventDefault()
    uploadFile(event.dataTransfer.files[0])
  }

  const requirementCount = documents.reduce((total, item) => total + (item.requirement_count || 0), 0)
  const warningCount = documents.reduce((total, item) => total + (item.warnings?.length || 0), 0)

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">IS</span><span>Implementation<br />Studio</span></div>
        <div className="nav-label">WORKSPACE</div>
        <div className="nav-item active"><span className="nav-glyph">▤</span>Documents</div>
        <div className="nav-item muted"><span className="nav-glyph">≡</span>Requirements</div>
        <div className="nav-item muted"><span className="nav-glyph">◇</span>Artefacts <small>Next</small></div>
        <div className="nav-item muted"><span className="nav-glyph">↗</span>Traceability <small>Next</small></div>
        <div className="sidebar-bottom"><span className={`api-dot ${apiStatus === 'API connected' ? 'online' : ''}`} />{apiStatus}<small>Local workspace</small></div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><div className="eyebrow">SOURCE LIBRARY / MILESTONE 2</div><h1>Documents & requirements</h1></div>
          <div className="topbar-meta"><span className="status-pill">PROTOTYPE</span><span className="avatar">IS</span></div>
        </header>

        <section className="summary-strip" aria-label="Workspace summary">
          <div><span>Source documents</span><strong>{documents.length.toString().padStart(2, '0')}</strong></div>
          <div><span>Requirements</span><strong>{requirementCount.toString().padStart(2, '0')}</strong></div>
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
                  <button type="button" className={mode === 'openai_compatible' ? 'chosen' : ''} onClick={() => setMode('openai_compatible')}>OpenAI-compatible</button>
                </div>
                {mode === 'demo' ? <p className="mode-note">Heuristic candidates for testing. All results are marked for review and are not production extraction.</p> : <div className="provider-fields">
                  <label>API endpoint<input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://provider.example/v1" /></label>
                  <label>Model<input value={model} onChange={(event) => setModel(event.target.value)} placeholder="Model identifier" /></label>
                  <label className="key-field">API key<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={config.api_key_configured ? 'Using server-configured key' : 'Used for this request; not stored'} autoComplete="off" /></label>
                </div>}
                <div className="extract-actions"><span>{document.segments?.length || 0} readable source segments</span><button className="button primary" type="button" disabled={busy || !document.segments?.length} onClick={extract}>{busy ? 'Extracting…' : 'Run extraction'}<span aria-hidden="true">↗</span></button></div>
              </section>

              <section className="results-section">
                <div className="results-heading"><div><span className="eyebrow">04 / REVIEW</span><h3>Extracted requirements <span>{document.requirements?.length || 0}</span></h3></div><div className="view-switch" role="tablist" aria-label="Document result view">
                  <button role="tab" aria-selected={view === 'requirements'} className={view === 'requirements' ? 'active' : ''} onClick={() => setView('requirements')}>Requirements</button>
                  <button role="tab" aria-selected={view === 'source'} className={view === 'source' ? 'active' : ''} onClick={() => setView('source')}>Source text</button>
                  <button role="tab" aria-selected={view === 'json'} className={view === 'json' ? 'active' : ''} onClick={() => setView('json')}>JSON</button>
                </div></div>

                {view === 'requirements' && <div className="requirements-list">
                  {(document.requirements || []).map((item) => <article className="requirement-row" key={item.requirement_id}>
                    <div className="requirement-meta"><span className="requirement-id">{item.requirement_id}</span><span className={`type-tag type-${item.requirement_type.toLowerCase()}`}>{item.requirement_type.replaceAll('_', ' ')}</span><span className="review-tag">{item.status.replaceAll('_', ' ')}</span></div>
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
              </section>
            </> : <div className="select-empty"><div className="empty-symbol">↑</div><span className="eyebrow">SOURCE LIBRARY</span><h2>Add a document to begin</h2><p>Upload a supported business document to inspect its extracted text and create traceable requirement candidates.</p><button className="button primary" type="button" onClick={() => fileInput.current?.click()}>Choose a file <span aria-hidden="true">↗</span></button></div>}
          </section>
        </div>
        {(error || notice) && <div className={`toast ${error ? 'toast-error' : ''}`} role="status"><span>{error ? '!' : '✓'}</span><p>{error || notice}</p><button type="button" aria-label="Dismiss message" onClick={() => { setError(''); setNotice('') }}>×</button></div>}
      </section>
    </main>
  )
}
