import { useRef } from 'react'
import { useFrontendTool, useRenderToolCall } from '@copilotkit/react-core'
import type { Incident, IncidentSeverity } from '../types/incident'
import type { AnalysisResult, RunbookEntry } from '../types/analysis'
import { generateAnalysis, runbookPool } from '../data/mockAnalysisData'
import { pickAlertTemplate, type AlertScenario } from '../data/alertTemplates'
import { AnalysisResultCard } from './AnalysisPanel'
import { RunbookExecutionCard } from './RunbookExecutionCard'
import {
  SeverityDistributionChart,
  StatusBreakdownChart,
  IncidentTimelineChart,
  ServiceImpactChart,
} from './charts/IncidentCharts'
import type { IncidentFormData } from './ChatIncidentForm'

interface CounterControllerProps {
  incidents: Incident[]
  setIncidents: React.Dispatch<React.SetStateAction<Incident[]>>
  onAiFillForm: (data: Partial<IncidentFormData>) => void
}

export function CounterController({ incidents, setIncidents, onAiFillForm }: CounterControllerProps) {
  // Cache analysis results so the chat-rendered card matches the handler's text summary
  // (generateAnalysis uses Math.random — calling it twice would produce different data)
  const analysisCache = useRef<Map<string, AnalysisResult>>(new Map())

  // Cache runbook proposals so the renderer can pick up the resolved incident+runbook
  // by toolCallId (handler runs once; renderer may run many times during chat re-renders)
  const runbookProposalCache = useRef<
    Map<string, { incident: Incident; runbook: RunbookEntry }>
  >(new Map())

  // Tool: Resolve an incident by ID (or the most recent one)
  useFrontendTool({
    name: 'resolveIncident',
    description: 'Resolve an incident. If no incidentId is provided, resolves the most recent open incident.',
    parameters: [
      {
        name: 'incidentId',
        type: 'string',
        description: 'The ID of the incident to resolve. If omitted, the most recent open incident is resolved.',
        required: false,
      },
    ],
    handler: async ({ incidentId }: { incidentId?: string }) => {
      const target = incidentId
        ? incidents.find(i => i.id === incidentId)
        : incidents.find(i => i.status !== 'Resolved')

      if (!target) return 'No open incidents to resolve.'

      setIncidents(prev =>
        prev.map(i =>
          i.id === target.id
            ? { ...i, status: 'Resolved' as const, timestamps: { ...i.timestamps, resolved: new Date().toISOString() } }
            : i
        )
      )
      return `Resolved incident "${target.title}" (${target.id}).`
    },
  }, [incidents])

  // Tool: Clear all incidents (resolve all)
  useFrontendTool({
    name: 'clearAllIncidents',
    description: 'Resolve all active incidents at once.',
    parameters: [],
    handler: async () => {
      const now = new Date().toISOString()
      setIncidents(prev =>
        prev.map(i =>
          i.status !== 'Resolved'
            ? { ...i, status: 'Resolved' as const, timestamps: { ...i.timestamps, resolved: now } }
            : i
        )
      )
      return 'All incidents resolved.'
    },
  }, [incidents])

  // Tool: Update incident status
  useFrontendTool({
    name: 'updateIncidentStatus',
    description: 'Change the status of an incident. Valid statuses: Open, Investigating, Mitigated, Resolved. A timeline event is automatically created.',
    parameters: [
      { name: 'incidentId', type: 'string', description: 'The ID of the incident to update', required: true },
      { name: 'status', type: 'string', description: 'New status: Open, Investigating, Mitigated, or Resolved', required: true },
    ],
    handler: async ({ incidentId, status }: { incidentId: string; status: string }) => {
      const validStatuses = ['Open', 'Investigating', 'Mitigated', 'Resolved'] as const
      if (!validStatuses.includes(status as any)) {
        return `Invalid status "${status}". Must be one of: ${validStatuses.join(', ')}`
      }
      const target = incidents.find(i => i.id === incidentId)
      if (!target) return `Incident ${incidentId} not found.`

      const now = new Date().toISOString()
      const newStatus = status as typeof validStatuses[number]
      setIncidents(prev =>
        prev.map(i => {
          if (i.id !== incidentId) return i
          return {
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
                type: 'status_change' as const,
                description: `Status changed from ${i.status} to ${newStatus}`,
                author: 'AI Assistant',
              },
            ],
          }
        })
      )
      return `Updated incident "${target.title}" status to ${newStatus}.`
    },
  }, [incidents])

  // Tool: Add a comment to an incident's timeline
  useFrontendTool({
    name: 'addIncidentComment',
    description: 'Add a comment to an incident timeline. Use this to log observations, updates, or notes on an incident.',
    parameters: [
      { name: 'incidentId', type: 'string', description: 'The ID of the incident', required: true },
      { name: 'comment', type: 'string', description: 'The comment text to add', required: true },
    ],
    handler: async ({ incidentId, comment }: { incidentId: string; comment: string }) => {
      const target = incidents.find(i => i.id === incidentId)
      if (!target) return `Incident ${incidentId} not found.`

      setIncidents(prev =>
        prev.map(i => {
          if (i.id !== incidentId) return i
          return {
            ...i,
            timeline: [
              ...i.timeline,
              {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                type: 'comment' as const,
                description: comment,
                author: 'AI Assistant',
              },
            ],
          }
        })
      )
      return `Added comment to incident "${target.title}".`
    },
  }, [incidents])

  // Tool: Report/fill a new incident — updates the shared form in the sidebar
  useFrontendTool({
    name: 'reportIncident',
    description:
      'Fill out the incident report form with details extracted from the conversation. ' +
      'You MUST fill ALL 6 fields: title, description, severity, type, affectedSystems, assignee. ' +
      'Use your best judgment to infer values for fields the user didn\'t mention. ' +
      'The form will switch to review mode so the user can confirm before submitting.',
    parameters: [
      { name: 'title', type: 'string', description: 'Short title of the incident', required: true },
      { name: 'description', type: 'string', description: 'Detailed description of the incident', required: true },
      { name: 'severity', type: 'string', description: 'Severity: P0 (critical), P1 (high), P2 (medium), P3 (low), P4 (info)', required: true },
      { name: 'type', type: 'string', description: 'Incident type: security, performance, availability, data, or other', required: true },
      { name: 'affectedSystems', type: 'string', description: 'Comma-separated list of affected systems/services', required: true },
      { name: 'assignee', type: 'string', description: 'Person or team to assign the incident to', required: true },
    ],
    handler: async (args: {
      title: string
      description: string
      severity: string
      type: string
      affectedSystems: string
      assignee: string
    }) => {
      // Update the shared form state — the portal form will reactively show the filled data
      onAiFillForm({
        title: args.title,
        description: args.description,
        severity: args.severity,
        type: args.type,
        affectedSystems: args.affectedSystems,
        assignee: args.assignee,
      })
      return `Incident form has been filled with all details. The user can now review and confirm.`
    },
  }, [incidents])

  // Tool: Analyze an incident — caches the result; the rich card is rendered separately below
  useFrontendTool({
    name: 'analyzeIncident',
    description:
      'Run a security analysis on an incident. The result is rendered as an interactive card in the chat ' +
      '(risk score, security logs, affected assets, related incidents, recommended runbooks) — ' +
      'do NOT repeat the analysis details in your text response. Just briefly acknowledge the result. ' +
      'If incidentId is omitted, analyzes the most recently created incident.',
    parameters: [
      { name: 'incidentId', type: 'string', description: 'The ID of the incident to analyze. Omit to analyze the most recent incident.', required: false },
    ],
    handler: async ({ incidentId }: { incidentId?: string }) => {
      const target = incidentId
        ? incidents.find(i => i.id === incidentId)
        : [...incidents].sort(
            (a, b) => new Date(b.timestamps.created).getTime() - new Date(a.timestamps.created).getTime(),
          )[0]

      if (!target) {
        return incidentId ? `Incident ${incidentId} not found.` : 'No incidents available to analyze.'
      }

      const analysis = generateAnalysis(target, incidents)
      analysisCache.current.set(target.id, analysis)
      return `Analysis complete for "${target.title}" (${target.id}). Risk score: ${analysis.riskScore}/100. The full breakdown is rendered below.`
    },
  }, [incidents])

  // Render: analyzeIncident tool calls render as a rich AnalysisResultCard in the chat
  useRenderToolCall({
    name: 'analyzeIncident',
    description: 'Renders the analysis result card in the chat',
    parameters: [
      { name: 'incidentId', type: 'string', description: 'The ID of the incident to analyze', required: false },
    ],
    render: (props) => {
      console.log('[analyzeIncident render]', { status: props.status, args: props.args, cacheSize: analysisCache.current.size })
      if (props.status === 'executing' || props.status === 'inProgress') {
        return (
          <div className="analysis-loading">
            <div className="analysis-spinner" />
            Analyzing incident...
          </div>
        )
      }

      const incidentId = props.args?.incidentId
      // Try cache by explicit ID first; fall back to the most recently cached entry
      let cached = incidentId ? analysisCache.current.get(incidentId) : undefined
      if (!cached && analysisCache.current.size > 0) {
        cached = Array.from(analysisCache.current.values()).pop()
      }
      if (cached) return <AnalysisResultCard analysis={cached} />

      // Defensive fallback: no cache at all — generate fresh
      const target = incidentId
        ? incidents.find(i => i.id === incidentId)
        : [...incidents].sort(
            (a, b) => new Date(b.timestamps.created).getTime() - new Date(a.timestamps.created).getTime(),
          )[0]
      if (!target) {
        return <div className="analysis-loading">No incident available to analyze.</div>
      }
      const fresh = generateAnalysis(target, incidents)
      return <AnalysisResultCard analysis={fresh} />
    },
  }, [incidents])

  // Render: triggerDemoAlert gets a small card too. Without a renderer here, the chat's
  // useLazyToolRenderer hook (which only looks at toolCalls[0]) would render nothing
  // when this tool is called first in a multi-tool turn.
  useRenderToolCall({
    name: 'triggerDemoAlert',
    description: 'Renders an "alert ingested" confirmation card in the chat',
    parameters: [
      { name: 'scenario', type: 'string', description: 'Optional scenario filter', required: false },
    ],
    render: (props) => {
      console.log('[triggerDemoAlert render]', { status: props.status, args: props.args })
      if (props.status === 'executing' || props.status === 'inProgress') {
        return (
          <div className="alert-ingest-card pending">
            <div className="alert-ingest-spinner" />
            <span>Ingesting alert{props.args?.scenario ? ` (${props.args.scenario})` : ''}…</span>
          </div>
        )
      }
      // The most recently created incident (the one just ingested) is at the front of the list
      const newest = incidents[0]
      if (!newest || newest.detectionSource !== 'alert') {
        return (
          <div className="alert-ingest-card">
            <div className="alert-ingest-icon">⚠️</div>
            <div className="alert-ingest-body">
              <div className="alert-ingest-title">Alert ingested</div>
              <div className="alert-ingest-meta">{typeof props.result === 'string' ? props.result : ''}</div>
            </div>
          </div>
        )
      }
      const sevColor: Record<string, string> = { P0: '#ef4444', P1: '#f97316', P2: '#eab308', P3: '#3b82f6', P4: '#94a3b8' }
      return (
        <div className="alert-ingest-card">
          <div className="alert-ingest-icon">⚠️</div>
          <div className="alert-ingest-body">
            <div className="alert-ingest-row">
              <span
                className="alert-ingest-sev"
                style={{ backgroundColor: sevColor[newest.severity] }}
              >
                {newest.severity}
              </span>
              <span className="alert-ingest-title">{newest.title}</span>
            </div>
            <div className="alert-ingest-meta">
              ID {newest.id} · affected: {newest.affectedServices.join(', ')}
            </div>
          </div>
        </div>
      )
    },
  }, [incidents])

  // Tool: Inject a realistic demo alert into the system.
  // The AI fills the alert payload from the user's natural-language description;
  // unspecified fields fall back to a matching template (or a random one if no hint).
  useFrontendTool({
    name: 'triggerDemoAlert',
    description:
      'Simulate a monitoring system alert (WAF / Datadog / CloudWatch / PagerDuty / CloudTrail / Kubernetes / etc.) ' +
      'arriving in the incident list. Use this whenever the user describes a scenario they want to see ' +
      '("payment service is slow", "credential stuffing", "database failover"). Generate a realistic alert payload ' +
      'from the user description by filling these fields:\n' +
      '- title: short alert headline (e.g., "payment-service P99 latency spike to 4.2s").\n' +
      '- description: log-style detail (1–2 sentences with concrete numbers / endpoints / IPs / metrics).\n' +
      '- severity: P0 (outage), P1 (major degradation), P2 (significant), P3 (minor), P4 (info). Infer from impact.\n' +
      '- affectedServices: comma-separated services. Use realistic names (e.g., "auth-service, api-gateway").\n' +
      '- source: realistic monitoring source. Pick from WAF, Datadog, CloudWatch, PagerDuty, CloudTrail, ' +
      'Kubernetes, Certificate Manager, SIEM, IDS, APM. Match it to the kind of signal (e.g., latency → Datadog, ' +
      'auth abuse → WAF, IAM anomaly → CloudTrail).\n' +
      '- scenario: tag as "security", "performance", "availability", or "data".\n\n' +
      'EXAMPLES:\n' +
      '• User: "payment service is slow" → { title: "payment-service P99 latency spike to 3.8s", ' +
      'description: "Datadog APM shows P99 latency on payment-service climbed from baseline 220ms to 3.8s ' +
      'over the last 6 minutes. Checkout flow timing out for ~12% of users.", severity: "P1", ' +
      'affectedServices: "payment-service, api-gateway", source: "Datadog", scenario: "performance" }\n' +
      '• User: "simulate a credential stuffing attack" → { title: "Credential stuffing attempt against auth-service", ' +
      'description: "WAF detected 14,200 failed login attempts in 4 minutes from IP range 198.51.100.0/24, matching ' +
      'known credential-stuffing toolkit signatures.", severity: "P0", affectedServices: "auth-service, api-gateway", ' +
      'source: "WAF", scenario: "security" }\n' +
      '• User: "any random alert" / no specific request → omit ALL fields; the system will pick a realistic template at random.\n\n' +
      'RULES: All fields are optional but if you fill ANY field you should fill ALL of them (otherwise the system ' +
      'will fill gaps from a matching template, which may not match your intent). Do NOT use placeholder text — ' +
      'every field must read like a real production alert.',
    parameters: [
      { name: 'title', type: 'string', description: 'Short alert headline', required: false },
      { name: 'description', type: 'string', description: 'Log-style alert detail (1–2 sentences with concrete numbers/endpoints/metrics)', required: false },
      { name: 'severity', type: 'string', description: 'P0 / P1 / P2 / P3 / P4 — infer from impact', required: false },
      { name: 'affectedServices', type: 'string', description: 'Comma-separated affected service names', required: false },
      { name: 'source', type: 'string', description: 'Monitoring source (WAF, Datadog, CloudWatch, PagerDuty, CloudTrail, Kubernetes, Certificate Manager, SIEM, IDS, APM)', required: false },
      { name: 'scenario', type: 'string', description: 'security / performance / availability / data', required: false },
    ],
    handler: async (args: {
      title?: string
      description?: string
      severity?: string
      affectedServices?: string
      source?: string
      scenario?: string
    }) => {
      const validSeverities: IncidentSeverity[] = ['P0', 'P1', 'P2', 'P3', 'P4']
      const validScenarios: AlertScenario[] = ['security', 'performance', 'availability', 'data']

      const scenarioHint = validScenarios.includes(args.scenario as AlertScenario)
        ? (args.scenario as AlertScenario)
        : undefined

      // Anything user/AI explicitly provided?
      const anyProvided =
        !!(args.title || args.description || args.severity || args.affectedServices || args.source)

      // Fallback template fills any gaps (and is the source of truth when no fields provided)
      const template = pickAlertTemplate(scenarioHint)

      const title = args.title?.trim() || template.title
      const description = args.description?.trim() || template.description
      const severity: IncidentSeverity = validSeverities.includes(args.severity as IncidentSeverity)
        ? (args.severity as IncidentSeverity)
        : template.severity
      const affectedServices = args.affectedServices?.trim()
        ? args.affectedServices.split(',').map(s => s.trim()).filter(Boolean)
        : template.affectedServices
      const source = args.source?.trim() || template.source

      const now = new Date().toISOString()
      const newIncident: Incident = {
        id: `INC-ALERT-${Date.now().toString(36).toUpperCase()}`,
        title,
        description,
        severity,
        status: 'Open',
        affectedServices,
        detectionSource: 'alert',
        timestamps: { created: now },
        timeline: [
          {
            id: crypto.randomUUID(),
            timestamp: now,
            type: 'status_change',
            description: `Alert ingested from ${source}: ${title}`,
            author: source,
          },
        ],
      }
      setIncidents(prev => [newIncident, ...prev])

      const origin = anyProvided ? 'AI-generated from user description' : 'random template'
      return (
        `New ${severity} alert ingested from ${source} (${origin}): "${title}" ` +
        `(id: ${newIncident.id}). Affected: ${affectedServices.join(', ')}.`
      )
    },
  }, [setIncidents])

  // Tool: Propose a runbook for human-in-the-loop approval.
  // Handler resolves the target incident + best-matching runbook and caches them
  // by toolCallId. The render hook below paints an approval card; nothing executes
  // until the user clicks Approve in that card.
  useFrontendTool({
    name: 'proposeRunbook',
    description:
      'PROPOSE a runbook to remediate an incident. The user must click Approve in the rendered card before anything actually runs. ' +
      'Use this when the user asks to run, execute, kick off, or apply a runbook. ' +
      'Available runbooks (use a hint that matches one of these titles or its keywords):\n' +
      runbookPool.map(r => `- ${r.title} (~${r.estimatedMinutes} min) — keywords: ${r.matchedServices.join(', ')}`).join('\n') +
      '\n\nNEVER claim a runbook ran, completed, or progressed without the user clicking Approve. ' +
      'The card visibly transitions to executing/complete states when execution actually happens — wait for that, do not narrate it.',
    parameters: [
      {
        name: 'incidentId',
        type: 'string',
        description: 'ID of the incident to run the runbook against. Omit to use the most recent open incident.',
        required: false,
      },
      {
        name: 'runbookHint',
        type: 'string',
        description:
          'Free-text hint to match a runbook (e.g., "failover", "service restart", "cache", "credential rotation"). ' +
          'Matched fuzzily against runbook titles and keywords.',
        required: false,
      },
    ],
    handler: async (
      args: { incidentId?: string; runbookHint?: string },
      ctx?: { toolCall?: { id?: string } },
    ) => {
      // Resolve target incident
      const target = args.incidentId
        ? incidents.find(i => i.id === args.incidentId)
        : incidents.find(i => i.status !== 'Resolved')
          ?? [...incidents].sort(
            (a, b) => new Date(b.timestamps.created).getTime() - new Date(a.timestamps.created).getTime(),
          )[0]

      if (!target) {
        return args.incidentId
          ? `Incident ${args.incidentId} not found.`
          : 'No incidents available to run a runbook against.'
      }

      // Pick a runbook: fuzzy match by hint, fall back to service-based match
      const hint = args.runbookHint?.toLowerCase().trim()
      let runbook: RunbookEntry | undefined
      if (hint) {
        runbook = runbookPool.find(r =>
          r.title.toLowerCase().includes(hint) ||
          r.matchedServices.some(s => hint.includes(s) || s.includes(hint)),
        )
      }
      if (!runbook) {
        const svcTerms = target.affectedServices.map(s => s.toLowerCase())
        runbook = runbookPool.find(r =>
          r.matchedServices.some(ms => svcTerms.some(t => t.includes(ms) || ms.includes(t))),
        )
      }
      if (!runbook) {
        runbook = runbookPool[1] // generic service restart fallback
      }

      const toolCallId = ctx?.toolCall?.id
      // Index by toolCallId AND under a "latest" key so the renderer's defensive
      // fallback (most-recent value) works even if toolCallId can't be threaded through.
      const entry = { incident: target, runbook }
      if (toolCallId) {
        runbookProposalCache.current.set(toolCallId, entry)
      }
      runbookProposalCache.current.set('__latest__', entry)

      return `Proposing "${runbook.title}" (~${runbook.estimatedMinutes} min, ${runbook.steps.length} steps) for ${target.id}. Approval required — review and click Approve in the card below.`
    },
  }, [incidents])

  // Render: proposeRunbook tool calls render as the approval/execution card
  useRenderToolCall({
    name: 'proposeRunbook',
    description: 'Renders the runbook approval card in the chat',
    parameters: [
      { name: 'incidentId', type: 'string', description: 'Target incident ID', required: false },
      { name: 'runbookHint', type: 'string', description: 'Runbook hint', required: false },
    ],
    render: (props) => {
      if (props.status === 'executing' || props.status === 'inProgress') {
        return (
          <div className="runbook-card runbook-card--pending" style={{ padding: '0.75rem 1rem' }}>
            <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>Preparing runbook proposal…</span>
          </div>
        )
      }

      const toolCallId = (props as { toolCallId?: string }).toolCallId ?? ''
      const cached =
        runbookProposalCache.current.get(toolCallId) ??
        runbookProposalCache.current.get('__latest__')
      if (!cached) {
        return (
          <div className="runbook-card runbook-card--cancelled" style={{ padding: '0.75rem 1rem' }}>
            <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>Runbook proposal unavailable.</span>
          </div>
        )
      }
      return (
        <RunbookExecutionCard
          incident={cached.incident}
          runbook={cached.runbook}
          setIncidents={setIncidents}
          toolCallId={toolCallId}
        />
      )
    },
  }, [incidents])

  // Tool: Generate a chart — handler only, rendering is separate below
  useFrontendTool({
    name: 'generateChart',
    description:
      'Render an interactive chart in the chat based on incident data. The chart is rendered visually by the UI automatically — do NOT include any markdown images or image syntax in your text response. ' +
      'Chart types: "severity" (pie chart of P0-P4 distribution), ' +
      '"status" (bar chart of Open/Investigating/Mitigated/Resolved), ' +
      '"timeline" (area chart of incidents over time), ' +
      '"services" (horizontal bar chart of most-affected services).',
    parameters: [
      {
        name: 'chartType',
        type: 'string',
        description: 'The type of chart to render: severity, status, timeline, or services',
        required: true,
      },
    ],
    handler: async ({ chartType }: { chartType: string }) => {
      const validTypes = ['severity', 'status', 'timeline', 'services'] as const
      if (!validTypes.includes(chartType as any)) {
        return `Invalid chart type "${chartType}". Must be one of: ${validTypes.join(', ')}`
      }

      const total = incidents.length
      const summaries: Record<string, string> = {
        severity: `Severity distribution across ${total} incidents: ${['P0','P1','P2','P3','P4'].map(s => `${s}: ${incidents.filter(i => i.severity === s).length}`).join(', ')}`,
        status: `Status breakdown across ${total} incidents: ${['Open','Investigating','Mitigated','Resolved'].map(s => `${s}: ${incidents.filter(i => i.status === s).length}`).join(', ')}`,
        timeline: `Timeline of ${total} incidents from ${incidents.length ? new Date(Math.min(...incidents.map(i => new Date(i.timestamps.created).getTime()))).toLocaleDateString() : 'N/A'} to ${incidents.length ? new Date(Math.max(...incidents.map(i => new Date(i.timestamps.created).getTime()))).toLocaleDateString() : 'N/A'}`,
        services: `Top affected services across ${total} incidents`,
      }

      return summaries[chartType] || `Chart rendered for ${total} incidents.`
    },
  }, [incidents])

  // Render: generateChart tool calls get rendered as chart components in the chat
  useRenderToolCall({
    name: 'generateChart',
    description: 'Renders a chart in the chat',
    parameters: [
      {
        name: 'chartType',
        type: 'string',
        description: 'The type of chart to render',
        required: true,
      },
    ],
    render: (props) => {
      if (props.status === 'executing' || props.status === 'inProgress') {
        return (
          <div className="chart-loading">
            <div className="chart-loading-spinner" />
            Generating chart...
          </div>
        )
      }

      const chartType = props.args?.chartType

      const chartMap: Record<string, React.ReactElement> = {
        severity: <SeverityDistributionChart incidents={incidents} />,
        status: <StatusBreakdownChart incidents={incidents} />,
        timeline: <IncidentTimelineChart incidents={incidents} />,
        services: <ServiceImpactChart incidents={incidents} />,
      }

      return chartMap[chartType] || <SeverityDistributionChart incidents={incidents} />
    },
  }, [incidents])

  return null
}
