import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { CounterController } from './CounterController'
import type { Incident } from '../types/incident'

// Capture every hook registration
const registeredTools: Array<{ name: string; deps: unknown[]; tool: Record<string, unknown> }> = []
const registeredRenderers: Array<{ name: string; deps: unknown[]; tool: Record<string, unknown> }> = []

vi.mock('@copilotkit/react-core', () => ({
  useFrontendTool: (tool: Record<string, unknown>, deps: unknown[]) => {
    registeredTools.push({ name: tool.name as string, deps, tool })
  },
  useRenderToolCall: (tool: Record<string, unknown>, deps: unknown[]) => {
    registeredRenderers.push({ name: tool.name as string, deps, tool })
  },
}))

const mockIncidents: Incident[] = [
  {
    id: 'INC-001',
    title: 'API outage',
    description: 'Gateway down',
    severity: 'P0',
    status: 'Open',
    affectedServices: ['api-gateway', 'auth-service'],
    detectionSource: 'alert',
    timestamps: { created: '2026-03-08T10:00:00.000Z' },
    timeline: [],
  },
  {
    id: 'INC-002',
    title: 'DB connection pool exhaustion',
    description: 'Postgres maxed out',
    severity: 'P1',
    status: 'Investigating',
    affectedServices: ['postgres-primary'],
    detectionSource: 'alert',
    timestamps: { created: '2026-03-08T11:00:00.000Z', acknowledged: '2026-03-08T11:30:00.000Z' },
    timeline: [],
  },
  {
    id: 'INC-003',
    title: 'TLS cert expired',
    description: 'Cert expired',
    severity: 'P3',
    status: 'Resolved',
    affectedServices: ['web-prod-01'],
    detectionSource: 'alert',
    timestamps: { created: '2026-03-07T08:00:00.000Z', resolved: '2026-03-07T10:00:00.000Z' },
    timeline: [],
  },
]

const setIncidents = vi.fn()

beforeEach(() => {
  registeredTools.length = 0
  registeredRenderers.length = 0
  setIncidents.mockClear()
  render(<CounterController incidents={mockIncidents} setIncidents={setIncidents} onAiFillForm={vi.fn()} />)
})

describe('CounterController tool registrations', () => {
  it('registers all expected frontend tools', () => {
    const names = registeredTools.map(a => a.name)
    expect(names).toContain('resolveIncident')
    expect(names).toContain('clearAllIncidents')
    expect(names).toContain('updateIncidentStatus')
    expect(names).toContain('addIncidentComment')
    expect(names).toContain('reportIncident')
    expect(names).toContain('analyzeIncident')
    expect(names).toContain('generateChart')
    expect(names).toContain('triggerDemoAlert')
    expect(names).toContain('proposeRunbook')
  })

  it('registers render hooks for generateChart, analyzeIncident, triggerDemoAlert, and proposeRunbook', () => {
    const names = registeredRenderers.map(r => r.name)
    expect(names).toContain('generateChart')
    expect(names).toContain('analyzeIncident')
    expect(names).toContain('triggerDemoAlert')
    expect(names).toContain('proposeRunbook')
    expect(registeredRenderers).toHaveLength(4)
  })

  it('passes incidents as a dependency to incident-reading frontend tools', () => {
    // triggerDemoAlert depends on setIncidents (not the incidents list) by design,
    // since it only writes; all other tools read the current incidents and depend on it
    for (const tool of registeredTools) {
      if (tool.name === 'triggerDemoAlert') continue
      expect(tool.deps).toEqual([mockIncidents])
    }
  })

  it('passes incidents as a dependency to every render hook', () => {
    for (const renderer of registeredRenderers) {
      expect(renderer.deps).toEqual([mockIncidents])
    }
  })
})

describe('generateChart tool', () => {
  function getChartTool() {
    return registeredTools.find(a => a.name === 'generateChart')!
  }

  function getChartRenderer() {
    return registeredRenderers.find(a => a.name === 'generateChart')!
  }

  it('tool handler does NOT have a render prop (render is separate)', () => {
    const chart = getChartTool()
    expect(chart.tool.render).toBeUndefined()
  })

  it('renderer has a render function', () => {
    const renderer = getChartRenderer()
    expect(typeof renderer.tool.render).toBe('function')
  })

  it('handler returns severity summary with correct counts', async () => {
    const chart = getChartTool()
    const handler = chart.tool.handler as (args: { chartType: string }) => Promise<string>
    const result = await handler({ chartType: 'severity' })
    expect(result).toContain('3 incidents')
    expect(result).toContain('P0: 1')
    expect(result).toContain('P1: 1')
    expect(result).toContain('P3: 1')
  })

  it('handler returns status summary with correct counts', async () => {
    const chart = getChartTool()
    const handler = chart.tool.handler as (args: { chartType: string }) => Promise<string>
    const result = await handler({ chartType: 'status' })
    expect(result).toContain('3 incidents')
    expect(result).toContain('Open: 1')
    expect(result).toContain('Investigating: 1')
    expect(result).toContain('Resolved: 1')
  })

  it('handler returns timeline summary', async () => {
    const chart = getChartTool()
    const handler = chart.tool.handler as (args: { chartType: string }) => Promise<string>
    const result = await handler({ chartType: 'timeline' })
    expect(result).toContain('Timeline of 3 incidents')
  })

  it('handler returns services summary', async () => {
    const chart = getChartTool()
    const handler = chart.tool.handler as (args: { chartType: string }) => Promise<string>
    const result = await handler({ chartType: 'services' })
    expect(result).toContain('Top affected services')
  })

  it('handler rejects invalid chart types', async () => {
    const chart = getChartTool()
    const handler = chart.tool.handler as (args: { chartType: string }) => Promise<string>
    const result = await handler({ chartType: 'invalid' })
    expect(result).toContain('Invalid chart type')
    expect(result).toContain('severity, status, timeline, services')
  })

  it('render returns loading state for executing status', () => {
    const renderer = getChartRenderer()
    const renderFn = renderer.tool.render as (props: Record<string, unknown>) => JSX.Element
    const element = renderFn({ status: 'executing', args: { chartType: 'severity' } })
    const { container } = render(element)
    expect(container.textContent).toContain('Generating chart')
  })

  it('render returns loading state for inProgress status', () => {
    const renderer = getChartRenderer()
    const renderFn = renderer.tool.render as (props: Record<string, unknown>) => JSX.Element
    const element = renderFn({ status: 'inProgress', args: { chartType: 'severity' } })
    const { container } = render(element)
    expect(container.textContent).toContain('Generating chart')
  })

  it('render returns severity chart for complete status', () => {
    const renderer = getChartRenderer()
    const renderFn = renderer.tool.render as (props: Record<string, unknown>) => JSX.Element
    const element = renderFn({ status: 'complete', args: { chartType: 'severity' }, result: '' })
    const { container } = render(element)
    expect(container.textContent).toContain('Incidents by Severity')
  })

  it('render returns status chart for complete status', () => {
    const renderer = getChartRenderer()
    const renderFn = renderer.tool.render as (props: Record<string, unknown>) => JSX.Element
    const element = renderFn({ status: 'complete', args: { chartType: 'status' }, result: '' })
    const { container } = render(element)
    expect(container.textContent).toContain('Incidents by Status')
  })

  it('render returns timeline chart for complete status', () => {
    const renderer = getChartRenderer()
    const renderFn = renderer.tool.render as (props: Record<string, unknown>) => JSX.Element
    const element = renderFn({ status: 'complete', args: { chartType: 'timeline' }, result: '' })
    const { container } = render(element)
    expect(container.textContent).toContain('Incident Timeline')
  })

  it('render returns services chart for complete status', () => {
    const renderer = getChartRenderer()
    const renderFn = renderer.tool.render as (props: Record<string, unknown>) => JSX.Element
    const element = renderFn({ status: 'complete', args: { chartType: 'services' }, result: '' })
    const { container } = render(element)
    expect(container.textContent).toContain('Most Affected Services')
  })

  it('render falls back to severity chart for unknown chart type', () => {
    const renderer = getChartRenderer()
    const renderFn = renderer.tool.render as (props: Record<string, unknown>) => JSX.Element
    const element = renderFn({ status: 'complete', args: { chartType: 'unknown' }, result: '' })
    const { container } = render(element)
    expect(container.textContent).toContain('Incidents by Severity')
  })
})

describe('resolveIncident tool', () => {
  function getAction() {
    return registeredTools.find(a => a.name === 'resolveIncident')!
  }

  it('resolves the most recent open incident when no ID given', async () => {
    const handler = getAction().tool.handler as (args: { incidentId?: string }) => Promise<string>
    const result = await handler({})
    expect(result).toContain('API outage')
    expect(setIncidents).toHaveBeenCalled()
  })

  it('resolves a specific incident by ID', async () => {
    const handler = getAction().tool.handler as (args: { incidentId?: string }) => Promise<string>
    const result = await handler({ incidentId: 'INC-002' })
    expect(result).toContain('DB connection pool exhaustion')
  })

  it('returns message when no open incidents', async () => {
    registeredTools.length = 0
    registeredRenderers.length = 0
    render(<CounterController incidents={[{ ...mockIncidents[2] }]} setIncidents={setIncidents} onAiFillForm={vi.fn()} />)
    const handler = registeredTools.find(a => a.name === 'resolveIncident')!.tool.handler as (args: { incidentId?: string }) => Promise<string>
    const result = await handler({})
    expect(result).toContain('No open incidents')
  })
})

describe('analyzeIncident tool', () => {
  function getTool() {
    return registeredTools.find(a => a.name === 'analyzeIncident')!
  }
  function getRenderer() {
    return registeredRenderers.find(r => r.name === 'analyzeIncident')!
  }

  it('handler returns a brief summary string (not a markdown wall)', async () => {
    const handler = getTool().tool.handler as (args: { incidentId: string }) => Promise<string>
    const result = await handler({ incidentId: 'INC-001' })
    expect(result).toMatch(/Risk score: \d+\/100/)
    expect(result).toContain('API outage')
    expect(result).toMatch(/rendered below|breakdown/)
    // Should NOT include the verbose section headers from the old markdown response
    expect(result).not.toMatch(/Security Logs \(/)
    expect(result).not.toMatch(/Affected Assets \(/)
    expect(result).not.toMatch(/Recommended Runbooks \(/)
  })

  it('handler returns not-found message for unknown incident ID', async () => {
    const handler = getTool().tool.handler as (args: { incidentId?: string }) => Promise<string>
    const result = await handler({ incidentId: 'NOPE' })
    expect(result).toContain('not found')
  })

  it('handler defaults to most recent incident when no ID provided', async () => {
    const handler = getTool().tool.handler as (args: { incidentId?: string }) => Promise<string>
    const result = await handler({})
    // Most recent in mockIncidents (by created timestamp) is INC-002 (2026-03-08T11:00)
    expect(result).toContain('DB connection pool exhaustion')
    expect(result).toMatch(/Risk score: \d+\/100/)
  })

  it('renderer shows loading state while executing', () => {
    const render = getRenderer().tool.render as (props: Record<string, unknown>) => React.ReactElement
    const el = render({ status: 'executing', args: { incidentId: 'INC-001' } })
    expect(el.props.className).toContain('analysis-loading')
  })

  it('renderer shows loading state while inProgress', () => {
    const render = getRenderer().tool.render as (props: Record<string, unknown>) => React.ReactElement
    const el = render({ status: 'inProgress', args: { incidentId: 'INC-001' } })
    expect(el.props.className).toContain('analysis-loading')
  })

  it('renderer shows AnalysisResultCard once handler has cached a result', async () => {
    const handler = getTool().tool.handler as (args: { incidentId: string }) => Promise<string>
    await handler({ incidentId: 'INC-001' })
    const render = getRenderer().tool.render as (props: Record<string, unknown>) => React.ReactElement
    const el = render({ status: 'complete', args: { incidentId: 'INC-001' } })
    // AnalysisResultCard receives an analysis prop with the expected shape
    expect(el.props.analysis).toBeDefined()
    expect(el.props.analysis.riskScore).toBeGreaterThan(0)
    expect(Array.isArray(el.props.analysis.securityLogs)).toBe(true)
  })

  it('renderer falls back to fresh analysis on cache miss for known incident', () => {
    const render = getRenderer().tool.render as (props: Record<string, unknown>) => React.ReactElement
    // No handler call → no cache entry → defensive fallback path
    const el = render({ status: 'complete', args: { incidentId: 'INC-002' } })
    expect(el.props.analysis).toBeDefined()
    expect(el.props.analysis.riskScore).toBeGreaterThan(0)
  })

  it('renderer shows not-found message for unknown incident with no cache', () => {
    const render = getRenderer().tool.render as (props: Record<string, unknown>) => React.ReactElement
    const el = render({ status: 'complete', args: { incidentId: 'NOPE' } })
    expect(el.props.className).toContain('analysis-loading')
  })
})

describe('triggerDemoAlert tool', () => {
  function getTool() {
    return registeredTools.find(a => a.name === 'triggerDemoAlert')!
  }

  it('creates an incident with detectionSource=alert and prepends to list', async () => {
    const handler = getTool().tool.handler as (args: { scenario?: string }) => Promise<string>
    const result = await handler({})
    expect(setIncidents).toHaveBeenCalledTimes(1)
    const updater = setIncidents.mock.calls[0][0] as (prev: Incident[]) => Incident[]
    const next = updater(mockIncidents)
    expect(next.length).toBe(mockIncidents.length + 1)
    const newIncident = next[0]
    expect(newIncident.detectionSource).toBe('alert')
    expect(newIncident.status).toBe('Open')
    expect(newIncident.id).toMatch(/^INC-ALERT-/)
    expect(newIncident.timeline.length).toBeGreaterThan(0)
    expect(typeof result).toBe('string')
    expect(result).toMatch(/alert ingested/i)
  })

  it('honors a valid scenario filter', async () => {
    const { alertTemplates } = await import('../data/alertTemplates')
    const securityTitles = alertTemplates.filter(t => t.scenario === 'security').map(t => t.title)
    const handler = getTool().tool.handler as (args: { scenario?: string }) => Promise<string>
    for (let i = 0; i < 8; i++) {
      setIncidents.mockClear()
      await handler({ scenario: 'security' })
      const updater = setIncidents.mock.calls[0][0] as (prev: Incident[]) => Incident[]
      const newIncident = updater(mockIncidents)[0]
      expect(securityTitles).toContain(newIncident.title)
    }
  })

  it('treats unknown scenario as random (any template allowed)', async () => {
    const handler = getTool().tool.handler as (args: { scenario?: string }) => Promise<string>
    const result = await handler({ scenario: 'bogus' })
    expect(setIncidents).toHaveBeenCalledTimes(1)
    expect(result).toMatch(/alert ingested/i)
  })

  it('uses fully AI-provided fields verbatim when all are passed', async () => {
    type Args = {
      title?: string
      description?: string
      severity?: string
      affectedServices?: string
      source?: string
      scenario?: string
    }
    const handler = getTool().tool.handler as (args: Args) => Promise<string>
    const result = await handler({
      title: 'payment-service P99 latency spike to 4.2s',
      description:
        'Datadog APM shows P99 latency on payment-service climbed from 220ms baseline to 4.2s over 6 minutes.',
      severity: 'P1',
      affectedServices: 'payment-service, api-gateway',
      source: 'Datadog',
      scenario: 'performance',
    })
    const updater = setIncidents.mock.calls[0][0] as (prev: Incident[]) => Incident[]
    const newIncident = updater(mockIncidents)[0]
    expect(newIncident.title).toBe('payment-service P99 latency spike to 4.2s')
    expect(newIncident.severity).toBe('P1')
    expect(newIncident.affectedServices).toEqual(['payment-service', 'api-gateway'])
    expect(newIncident.timeline[0].author).toBe('Datadog')
    expect(newIncident.timeline[0].description).toContain('Datadog')
    expect(result).toContain('AI-generated from user description')
  })

  it('partially fills from AI input and fills gaps from a matching template', async () => {
    type Args = {
      title?: string
      description?: string
      severity?: string
      affectedServices?: string
      source?: string
      scenario?: string
    }
    const handler = getTool().tool.handler as (args: Args) => Promise<string>
    await handler({ title: 'Custom DB hiccup', scenario: 'data' })
    const updater = setIncidents.mock.calls[0][0] as (prev: Incident[]) => Incident[]
    const newIncident = updater(mockIncidents)[0]
    expect(newIncident.title).toBe('Custom DB hiccup')
    // Description, severity, services, source filled from a "data" scenario template
    expect(newIncident.description.length).toBeGreaterThan(10)
    expect(['P0', 'P1', 'P2', 'P3', 'P4']).toContain(newIncident.severity)
    expect(newIncident.affectedServices.length).toBeGreaterThan(0)
  })

  it('falls back to a template when severity is invalid', async () => {
    const handler = getTool().tool.handler as (args: { severity?: string }) => Promise<string>
    await handler({ severity: 'CRITICAL' as any })
    const updater = setIncidents.mock.calls[0][0] as (prev: Incident[]) => Incident[]
    const newIncident = updater(mockIncidents)[0]
    expect(['P0', 'P1', 'P2', 'P3', 'P4']).toContain(newIncident.severity)
  })

  it('labels random fallback distinctly in the result message', async () => {
    const handler = getTool().tool.handler as (args: Record<string, never>) => Promise<string>
    const result = await handler({})
    expect(result).toContain('random template')
  })
})

describe('proposeRunbook tool', () => {
  type RunbookHandler = (
    args: { incidentId?: string; runbookHint?: string },
    ctx?: { toolCallId?: string },
  ) => Promise<string>

  function getTool() {
    return registeredTools.find(a => a.name === 'proposeRunbook')!
  }

  it('matches a runbook by hint and returns an approval-required message', async () => {
    const handler = getTool().tool.handler as RunbookHandler
    const result = await handler({ runbookHint: 'failover' }, { toolCallId: 'tc-1' })
    expect(result.toLowerCase()).toContain('database failover')
    expect(result.toLowerCase()).toContain('approval')
  })

  it('falls back to service-based match when no hint is given', async () => {
    const handler = getTool().tool.handler as RunbookHandler
    // mockIncidents[1] is open against postgres-primary — should match the DB failover runbook
    const result = await handler({ incidentId: 'INC-002' }, { toolCallId: 'tc-2' })
    expect(result.toLowerCase()).toContain('database failover')
  })

  it('defaults to first non-resolved incident when no incidentId given', async () => {
    const handler = getTool().tool.handler as RunbookHandler
    const result = await handler({ runbookHint: 'service restart' }, { toolCallId: 'tc-3' })
    // First non-resolved in mockIncidents is INC-001 (Open, api-gateway/auth-service)
    expect(result).toContain('INC-001')
  })

  it('returns a not-found message for an unknown incident ID', async () => {
    const handler = getTool().tool.handler as RunbookHandler
    const result = await handler({ incidentId: 'NOPE' }, { toolCallId: 'tc-4' })
    expect(result).toContain('not found')
  })

  it('renderer returns a placeholder during executing/inProgress', () => {
    const renderer = registeredRenderers.find(r => r.name === 'proposeRunbook')!
    const render = renderer.tool.render as (props: Record<string, unknown>) => React.ReactElement
    const el = render({ status: 'executing', args: {}, toolCallId: 'tc-x' })
    expect(el.props.className).toContain('runbook-card--pending')
  })
})
