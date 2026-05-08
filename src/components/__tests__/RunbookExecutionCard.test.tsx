import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { Dispatch, SetStateAction } from 'react'
import { RunbookExecutionCard } from '../RunbookExecutionCard'
import type { Incident } from '../../types/incident'
import type { RunbookEntry } from '../../types/analysis'

type SetIncidentsMock = Dispatch<SetStateAction<Incident[]>> & ReturnType<typeof vi.fn>

const mockRunbook: RunbookEntry = {
  id: 'rb-test',
  title: 'Test Service Restart',
  estimatedMinutes: 5,
  matchedServices: ['api'],
  steps: ['Drain traffic', 'Restart pods', 'Verify health'],
}

const mockIncident: Incident = {
  id: 'INC-RB-1',
  title: 'API gateway is sad',
  description: 'P99 latency spike',
  severity: 'P1',
  status: 'Investigating',
  affectedServices: ['api-gateway'],
  detectionSource: 'alert',
  timestamps: { created: '2026-03-08T10:00:00.000Z' },
  timeline: [],
}

let setIncidents: SetIncidentsMock

beforeEach(() => {
  vi.useFakeTimers()
  setIncidents = vi.fn() as unknown as SetIncidentsMock
})

afterEach(() => {
  vi.useRealTimers()
})

describe('RunbookExecutionCard — pending state', () => {
  it('renders runbook title, ETA, and Approve/Cancel buttons', () => {
    render(
      <RunbookExecutionCard
        incident={mockIncident}
        runbook={mockRunbook}
        setIncidents={setIncidents}
        toolCallId="tc-test"
      />,
    )
    expect(screen.getByText('Test Service Restart')).toBeInTheDocument()
    expect(screen.getByText('~5 min')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /approve & execute/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    // All three steps rendered as pending
    expect(screen.getByText('Drain traffic')).toBeInTheDocument()
    expect(screen.getByText('Restart pods')).toBeInTheDocument()
    expect(screen.getByText('Verify health')).toBeInTheDocument()
  })

  it('shows the target incident pill (severity, ID, title)', () => {
    render(
      <RunbookExecutionCard
        incident={mockIncident}
        runbook={mockRunbook}
        setIncidents={setIncidents}
        toolCallId="tc-test"
      />,
    )
    expect(screen.getByText('P1')).toBeInTheDocument()
    expect(screen.getByText('INC-RB-1')).toBeInTheDocument()
    expect(screen.getByText('API gateway is sad')).toBeInTheDocument()
  })
})

describe('RunbookExecutionCard — Approve flow', () => {
  it('runs all steps, appends a timeline event per step + a completion event + a status promotion', () => {
    render(
      <RunbookExecutionCard
        incident={mockIncident}
        runbook={mockRunbook}
        setIncidents={setIncidents}
        toolCallId="tc-test"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /approve & execute/i }))
    act(() => {
      vi.runAllTimers()
    })

    // 3 step events + 1 completion event + 1 status_change (since status was Investigating)
    expect(setIncidents).toHaveBeenCalledTimes(5)

    // Apply the updaters in order against a fresh copy and inspect the result
    let state: Incident[] = [{ ...mockIncident, timeline: [] }]
    for (const call of setIncidents.mock.calls) {
      const updater = call[0] as (prev: Incident[]) => Incident[]
      state = updater(state)
    }

    const final = state[0]
    expect(final.status).toBe('Mitigated')
    // 3 mitigation step events + 1 completion mitigation event + 1 status_change = 5 entries
    expect(final.timeline).toHaveLength(5)
    expect(final.timeline.filter(e => e.type === 'mitigation')).toHaveLength(4)
    expect(final.timeline.filter(e => e.type === 'status_change')).toHaveLength(1)
    expect(final.timeline.some(e => e.description.includes('Drain traffic'))).toBe(true)
    expect(final.timeline.some(e => e.description.includes('completed (3/3 steps'))).toBe(true)
  })

  it('does NOT promote an already-Resolved incident', () => {
    const resolved: Incident = { ...mockIncident, status: 'Resolved' }
    render(
      <RunbookExecutionCard
        incident={resolved}
        runbook={mockRunbook}
        setIncidents={setIncidents}
        toolCallId="tc-test"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /approve & execute/i }))
    act(() => {
      vi.runAllTimers()
    })

    // 3 step events + 1 completion event, but NO status_change event
    expect(setIncidents).toHaveBeenCalledTimes(4)

    let state: Incident[] = [{ ...resolved, timeline: [] }]
    for (const call of setIncidents.mock.calls) {
      const updater = call[0] as (prev: Incident[]) => Incident[]
      state = updater(state)
    }
    expect(state[0].status).toBe('Resolved')
    expect(state[0].timeline.some(e => e.type === 'status_change')).toBe(false)
  })
})

describe('RunbookExecutionCard — Cancel flow', () => {
  it('appends exactly one cancellation timeline entry and shows the cancelled message', () => {
    render(
      <RunbookExecutionCard
        incident={mockIncident}
        runbook={mockRunbook}
        setIncidents={setIncidents}
        toolCallId="tc-test"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(setIncidents).toHaveBeenCalledTimes(1)
    let state: Incident[] = [{ ...mockIncident, timeline: [] }]
    const updater = setIncidents.mock.calls[0][0] as (prev: Incident[]) => Incident[]
    state = updater(state)
    expect(state[0].timeline).toHaveLength(1)
    expect(state[0].timeline[0].type).toBe('comment')
    expect(state[0].timeline[0].description).toMatch(/cancelled by user/i)

    expect(screen.getByText(/cancelled by user/i)).toBeInTheDocument()
    // Approve/Cancel buttons should be gone
    expect(screen.queryByRole('button', { name: /approve & execute/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
  })
})
