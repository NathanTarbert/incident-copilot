import { useState, useCallback, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import './style.css'
import { CopilotKit, useCopilotReadable } from '@copilotkit/react-core'
import { CopilotSidebar, useChatContext } from '@copilotkit/react-ui'
import '@copilotkit/react-ui/styles.css'
import { Counter } from './components/Counter'
import { CounterController } from './components/CounterController'
import { ChatIncidentForm, emptyFormData } from './components/ChatIncidentForm'
import type { IncidentFormData } from './components/ChatIncidentForm'
import { ErrorBoundary } from './components/ErrorBoundary'
import { IncidentsList } from './components/IncidentsList'
import { IncidentDetail } from './components/IncidentDetail'
import { CrossIncidentTimeline } from './components/CrossIncidentTimeline'
import type { Incident, IncidentSeverity, IncidentStatus } from './types/incident'
import { fetchAllIncidents } from './services/mockApi'

type SortOption = 'newest' | 'oldest' | 'severity' | 'status'
const severityOrder: Record<IncidentSeverity, number> = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 }
const statusOrder: Record<IncidentStatus, number> = { Open: 0, Investigating: 1, Mitigated: 2, Resolved: 3 }
const allSeverities: Array<IncidentSeverity | 'All'> = ['All', 'P0', 'P1', 'P2', 'P3', 'P4']
const allStatuses: Array<IncidentStatus | 'All'> = ['All', 'Open', 'Investigating', 'Mitigated', 'Resolved']

function AppContent() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [isIncidentsCollapsed, setIsIncidentsCollapsed] = useState(false)
  const [showReportForm, setShowReportForm] = useState(false)
  const [formData, setFormData] = useState<IncidentFormData>({ ...emptyFormData })
  const [formMode, setFormMode] = useState<'editing' | 'review' | 'submitted'>('editing')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)
  const { setOpen } = useChatContext()

  useEffect(() => {
    fetchAllIncidents().then(setIncidents)
  }, [])

  // Find the sidebar's message container for portal rendering
  useEffect(() => {
    if (!showReportForm) {
      setPortalContainer(null)
      return
    }
    const findContainer = () => {
      const container = document.querySelector('.copilotKitMessages')
      if (container) {
        setPortalContainer(container as HTMLElement)
      } else {
        requestAnimationFrame(findContainer)
      }
    }
    const timer = setTimeout(findContainer, 50)
    return () => clearTimeout(timer)
  }, [showReportForm])

  const handleReportViaChat = useCallback(() => {
    setOpen(true)
    setFormData({ ...emptyFormData })
    setFormMode('editing')
    setFormErrors({})
    setShowReportForm(true)
  }, [setOpen])

  // Called by AI tool to fill the form with data
  const handleAiFillForm = useCallback((data: Partial<IncidentFormData>) => {
    setFormData(prev => ({
      ...prev,
      ...Object.fromEntries(
        Object.entries(data).filter(([, v]) => v && String(v).trim())
      ),
    }))
    setFormMode('review')
    setFormErrors({})
  }, [])

  const handleFormSubmit = useCallback((newIncident: Incident) => {
    setIncidents(prev => [newIncident, ...prev])
    // Keep form visible in submitted state (shows success), auto-hide after delay
    setTimeout(() => setShowReportForm(false), 3000)
  }, [])

  // Filter / sort / search state
  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | 'All'>('All')
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'All'>('All')
  const [sortBy, setSortBy] = useState<SortOption>('newest')

  const filteredIncidents = useMemo(() => {
    let result = incidents

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.affectedServices.some(s => s.toLowerCase().includes(q)) ||
        (i.owner && i.owner.toLowerCase().includes(q))
      )
    }

    // Severity filter
    if (severityFilter !== 'All') {
      result = result.filter(i => i.severity === severityFilter)
    }

    // Status filter
    if (statusFilter !== 'All') {
      result = result.filter(i => i.status === statusFilter)
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.timestamps.created).getTime() - new Date(a.timestamps.created).getTime()
        case 'oldest':
          return new Date(a.timestamps.created).getTime() - new Date(b.timestamps.created).getTime()
        case 'severity':
          return severityOrder[a.severity] - severityOrder[b.severity]
        case 'status':
          return statusOrder[a.status] - statusOrder[b.status]
        default:
          return 0
      }
    })

    return result
  }, [incidents, searchQuery, severityFilter, statusFilter, sortBy])

  const activeCount = incidents.filter(i => i.status !== 'Resolved').length

  const sortedIncidents = useMemo(
    () =>
      [...incidents].sort(
        (a, b) =>
          new Date(b.timestamps.created).getTime() - new Date(a.timestamps.created).getTime()
      ),
    [incidents]
  )

  // Dynamic metrics
  const resolvedToday = useMemo(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    return incidents.filter(
      i => i.status === 'Resolved' && i.timestamps.resolved && new Date(i.timestamps.resolved).getTime() > oneDayAgo
    ).length
  }, [incidents])

  const mttr = useMemo(() => {
    const resolved = incidents.filter(i => i.timestamps.resolved)
    if (resolved.length === 0) return null
    const totalMs = resolved.reduce((sum, i) => {
      const created = new Date(i.timestamps.created).getTime()
      const resolvedAt = new Date(i.timestamps.resolved!).getTime()
      return sum + (resolvedAt - created)
    }, 0)
    const avgMs = totalMs / resolved.length
    const avgMinutes = avgMs / 60000
    if (avgMinutes < 1) return `${Math.round(avgMs / 1000)}s`
    if (avgMinutes < 60) return `${avgMinutes.toFixed(1)}m`
    return `${(avgMinutes / 60).toFixed(1)}h`
  }, [incidents])

  // Let the AI know when the incident report form is open and what the user has filled so far
  useCopilotReadable({
    description: "The incident report form state. When incidentFormOpen is true, the user has a form open in the chat. currentFormData shows what they've typed so far. When the user asks you to fill it out, complete the remaining fields, or provides incident details, you MUST call the reportIncident tool with ALL fields filled — merge what the user already typed with your best guesses for the empty fields.",
    value: {
      incidentFormOpen: showReportForm,
      currentFormData: showReportForm ? formData : null,
    },
  })

  // Share incident details with the AI
  useCopilotReadable({
    description: "The current list of incidents sorted newest-first, with their status, severity, title, description, and timestamps (created, acknowledged, resolved). Use timestamps.created to answer time-based queries like 'incidents in the last 24 hours'.",
    value: {
      activeCount,
      total: incidents.length,
      currentTime: new Date().toISOString(),
      incidents: sortedIncidents.map(i => ({
        id: i.id,
        title: i.title,
        severity: i.severity,
        status: i.status,
        description: i.description,
        affectedServices: i.affectedServices,
        timestamps: i.timestamps,
      })),
    },
  })

  useCopilotReadable({
    description: "The currently selected/viewed incident with full detail",
    value: selectedIncident
      ? {
          id: selectedIncident.id,
          title: selectedIncident.title,
          severity: selectedIncident.severity,
          status: selectedIncident.status,
          description: selectedIncident.description,
          affectedServices: selectedIncident.affectedServices,
          owner: selectedIncident.owner,
          detectionSource: selectedIncident.detectionSource,
          timestamps: selectedIncident.timestamps,
          timelineLength: selectedIncident.timeline.length,
        }
      : null,
  })

  const handleStatusChange = useCallback((incidentId: string, newStatus: IncidentStatus) => {
    const now = new Date().toISOString()
    setIncidents(prev =>
      prev.map(i => {
        if (i.id !== incidentId) return i
        const updated: Incident = {
          ...i,
          status: newStatus,
          timestamps: {
            ...i.timestamps,
            ...(newStatus === 'Resolved' ? { resolved: now } : {}),
            ...(newStatus === 'Investigating' && !i.timestamps.acknowledged ? { acknowledged: now } : {}),
          },
          timeline: [
            ...i.timeline,
            {
              id: crypto.randomUUID(),
              timestamp: now,
              type: 'status_change',
              description: `Status changed from ${i.status} to ${newStatus}`,
              author: 'System',
            },
          ],
        }
        setSelectedIncident(updated)
        return updated
      })
    )
  }, [])

  const handleAddComment = useCallback((incidentId: string, comment: string) => {
    const now = new Date().toISOString()
    setIncidents(prev =>
      prev.map(i => {
        if (i.id !== incidentId) return i
        const updated: Incident = {
          ...i,
          timeline: [
            ...i.timeline,
            {
              id: crypto.randomUUID(),
              timestamp: now,
              type: 'comment',
              description: comment,
              author: i.owner || 'User',
            },
          ],
        }
        setSelectedIncident(updated)
        return updated
      })
    )
  }, [])

  return (
    <div id="app-content" style={{ minHeight: '100vh', position: 'relative' }}>
      <div className="app-container">
        {/* Header */}
        <header className="header">
          <div className="header-content">
            <div className="logo-section">
              <div className="logo-icon">🚨</div>
              <span className="logo-text">IncidentResponse</span>
            </div>
            <nav className="nav">
              <a href="#dashboard" className="nav-link">Dashboard</a>
              <a href="#incidents" className="nav-link">Incidents</a>
              <a href="#analytics" className="nav-link">Analytics</a>
            </nav>
            <div className="header-actions">
              <span className="welcome-text">Welcome, Nathan</span>
              <div className="avatar" aria-label="User avatar">NT</div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="main-content">
          {/* Dashboard Section */}
          <section className="dashboard">
            <div className="dashboard-header">
              <div>
                <h2 className="section-title">Dashboard</h2>
              </div>
              <button
                className="btn-primary btn-large"
                onClick={handleReportViaChat}
              >
                Report Incident
              </button>
            </div>
            <div className="dashboard-grid">
              <div className="dashboard-card">
                <div className="card-header">
                  <h3 className="card-title">Active Incidents</h3>
                  <span className="card-badge">Live</span>
                </div>
                <div className="card-content">
                  <Counter count={activeCount} />
                  <CounterController
                    incidents={incidents}
                    setIncidents={setIncidents}
                    onAiFillForm={handleAiFillForm}
                  />
                </div>
                <p className="card-description">
                  Currently open incidents requiring attention
                </p>
              </div>
              <div className="dashboard-card">
                <div className="card-header">
                  <h3 className="card-title">Mean Time to Resolve</h3>
                </div>
                <div className="card-content">
                  <div className="metric">
                    <div className="metric-value">{mttr ?? '—'}</div>
                    <div className="metric-label">Average</div>
                  </div>
                </div>
                <p className="card-description">
                  Average time to resolve incidents
                </p>
              </div>
              <div className="dashboard-card">
                <div className="card-header">
                  <h3 className="card-title">Resolved Today</h3>
                </div>
                <div className="card-content">
                  <div className="metric">
                    <div className="metric-value">{resolvedToday}</div>
                    <div className="metric-label">Incidents</div>
                  </div>
                </div>
                <p className="card-description">
                  Successfully resolved incidents in the last 24 hours
                </p>
              </div>
            </div>

            {/* Reported Incidents */}
            <div className="dashboard-card" style={{ gridColumn: '1 / -1' }}>
              <div
                className="card-header"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setIsIncidentsCollapsed(prev => !prev)}
              >
                <h3 className="card-title">
                  <span className={`collapse-chevron${isIncidentsCollapsed ? ' collapsed' : ''}`}>&#9660;</span>
                  {' '}Reported Incidents
                </h3>
                <span className="card-badge">{activeCount} Active</span>
              </div>

              {!isIncidentsCollapsed && <>
              {/* Toolbar */}
              <div className="incidents-toolbar">
                <input
                  type="text"
                  className="toolbar-search-input"
                  placeholder="Search incidents..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <div className="toolbar-filters">
                  <div className="filter-pills">
                    <span className="filter-pills-label">Severity:</span>
                    {allSeverities.map(s => (
                      <button
                        key={s}
                        className={`filter-pill${severityFilter === s ? ' active' : ''}`}
                        onClick={() => setSeverityFilter(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="filter-pills">
                    <span className="filter-pills-label">Status:</span>
                    {allStatuses.map(s => (
                      <button
                        key={s}
                        className={`filter-pill${statusFilter === s ? ' active' : ''}`}
                        onClick={() => setStatusFilter(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="toolbar-sort">
                  <label htmlFor="sort-select">Sort:</label>
                  <select
                    id="sort-select"
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as SortOption)}
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="severity">By Severity</option>
                    <option value="status">By Status</option>
                  </select>
                </div>
              </div>

              <div className="card-content">
                <IncidentsList incidents={filteredIncidents} onIncidentClick={setSelectedIncident} />
              </div>
              </>}
            </div>

            {/* Activity Timeline */}
            <div className="dashboard-card" style={{ gridColumn: '1 / -1' }}>
              <div className="card-header">
                <h3 className="card-title">Activity Timeline</h3>
                <span className="card-badge">Recent</span>
              </div>
              <div className="card-content">
                <CrossIncidentTimeline
                  incidents={filteredIncidents}
                  onIncidentClick={setSelectedIncident}
                />
              </div>
            </div>
          </section>
        </main>

        {/* Incident Detail Modal */}
        {selectedIncident && (
          <IncidentDetail
            incident={selectedIncident}
            allIncidents={incidents}
            isOpen={!!selectedIncident}
            onClose={() => setSelectedIncident(null)}
            onStatusChange={handleStatusChange}
            onAddComment={handleAddComment}
          />
        )}

      </div>

      {/* Portal: render incident form directly into the sidebar message area */}
      {showReportForm && portalContainer && createPortal(
        <div className="chat-portal-form-wrapper">
          <ChatIncidentForm
            formData={formData}
            onFormDataChange={setFormData}
            mode={formMode}
            onModeChange={setFormMode}
            onSubmit={handleFormSubmit}
            errors={formErrors}
            onErrorsChange={setFormErrors}
          />
        </div>,
        portalContainer
      )}
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <CopilotKit
        runtimeUrl={import.meta.env.VITE_COPILOTKIT_RUNTIME_URL || "http://localhost:4000/copilotkit"}
        publicApiKey={import.meta.env.VITE_COPILOTKIT_PUBLIC_API_KEY}
      >
        <CopilotSidebar
          instructions={`You are an AI incident response assistant for IncidentResponse, a platform for managing and resolving security and operational incidents. Help users track incidents, analyze metrics, and respond to issues.

CRITICAL: NEVER invent, fabricate, or hallucinate incident titles, IDs, severities, or analysis results. Every incident you reference MUST come from the readable "incidents" state. If you don't see an incident matching the user's request, say so — do not make one up.

Tool: generateChart — the chart is rendered automatically in the chat. Do NOT add any markdown images, image links, or image syntax. Just describe what the chart shows in plain text.

Tool: analyzeIncident — the result is rendered as a rich interactive card in the chat (risk score, security logs, affected assets, related incidents, runbooks). Do NOT repeat any of those details in your text response. Just say something brief like "Here's the analysis below." If the user says "analyze it" or "analyze the most recent one", call this tool with NO incidentId argument — it will default to the most recent incident automatically. If the user names a specific incident, use its exact ID from the readable state. NEVER fabricate a risk score, summary, or analysis text. NEVER write a sentence like "I completed the analysis" or "the analysis shows X" without first calling the analyzeIncident tool. If you have not called the tool, do not claim that an analysis exists.

Tool: triggerDemoAlert — simulates an alert arriving from a monitoring system. The user typically describes a SCENARIO they want to see (e.g. "payment service is slow", "kafka lag", "credential stuffing attack on auth-service"). When they do, you MUST generate a realistic alert payload for that scenario by filling all of the tool's optional fields (title, description, severity, affectedServices, source, scenario) — see the tool's own description for examples and rules. ONLY omit all fields when the user genuinely asks for a random alert ("any random alert", "surprise me"). After it runs, briefly announce what came in (severity + title + source) in one short sentence and STOP — do not also call analyzeIncident in the same turn (one tool per turn).

Tool: proposeRunbook — Human-in-the-loop runbook execution. Use this when the user asks to "run", "execute", "kick off", "apply", or "propose" a runbook (or a remediation procedure like "failover", "service restart", "credential rotation", "DDoS mitigation", "cache recovery", etc.). Pass an optional incidentId (defaults to most recent open) and an optional runbookHint (free text — "failover", "cache", "service restart", etc.). The tool ONLY proposes; it renders an approval card with the steps and Approve/Cancel buttons. Nothing executes until the user clicks Approve. NEVER claim a runbook ran, completed, or progressed without the user clicking Approve and the card visibly transitioning. Do not narrate fake step completions. The card updates in real time when execution actually happens.

ONE-TOOL-PER-TURN RULE: Each response from you MUST call AT MOST ONE tool (other than reportIncident's form-fill flow). The chat UI only renders the first tool call's visual card per assistant message — chaining multiple tools in one turn breaks the UX.

If the user asks for two actions in one message (e.g. "trigger an alert AND analyze it"):
1. In your FIRST response, call only triggerDemoAlert. After the tool runs, briefly acknowledge (one short sentence — "New P1 alert ingested. Want me to analyze it?") and STOP. Do not call analyzeIncident in the same turn.
2. The user will reply (or you can suggest they say "yes" / "analyze it"). On your NEXT turn, call analyzeIncident.

Never split a single tool call into multiple. Never claim a tool ran without calling it.

CRITICAL RULE — Incident Form Filling:
When a user describes an incident, mentions a problem, or asks you to fill out the incident form, you MUST call the reportIncident tool.
- You MUST fill ALL 6 fields: title, description, severity, type, affectedSystems, assignee.
- For fields the user didn't mention, use your best professional judgment to infer reasonable values based on the context.
- For severity: infer from urgency/impact described. Default to P2 if truly unclear.
- For type: infer from context (e.g., "breach" = security, "slow" = performance, "down" = availability).
- For affectedSystems: infer from what the user mentions (e.g., "API gateway" → "API Gateway").
- For assignee: if not mentioned, suggest a reasonable team like "Platform Team", "Security Team", "SRE Team", etc. based on incident type.
- For description: write a thorough, professional incident description even if the user gave a vague one-liner.
- After calling the tool, tell the user to review the form and click "Confirm & Report" if the details look correct, or edit any fields first.`}
          labels={{
            title: "Incident Response Assistant",
            initial: "Hello! I'm your incident response assistant. How can I help you manage incidents today?",
          }}
          suggestions={[
            { title: "Simulate a slow payment service", message: "Trigger an alert: our payment service is responding slowly" },
            { title: "Simulate a credential stuffing attack", message: "Trigger an alert: someone is credential-stuffing our auth service" },
            { title: "Analyze most recent incident", message: "Analyze the most recent incident" },
            { title: "Run a service restart runbook", message: "Propose a service restart runbook on the most recent incident" },
            { title: "Run a database failover runbook", message: "Propose the database failover runbook" },
            { title: "Severity Chart", message: "Show me a chart of incidents by severity" },
            { title: "Status Breakdown", message: "Show me incidents by status" },
            { title: "Incident Timeline", message: "Show me a timeline of incidents over time" },
            { title: "Service Impact", message: "Show me which services are most affected" },
          ]}
        >
          <AppContent />
        </CopilotSidebar>
      </CopilotKit>
    </ErrorBoundary>
  )
}

export default App
