import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  SeverityDistributionChart,
  StatusBreakdownChart,
  IncidentTimelineChart,
  ServiceImpactChart,
} from './IncidentCharts'
import type { Incident } from '../../types/incident'

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
    affectedServices: ['postgres-primary', 'api-gateway'],
    detectionSource: 'alert',
    timestamps: { created: '2026-03-08T11:00:00.000Z', acknowledged: '2026-03-08T11:30:00.000Z' },
    timeline: [],
  },
  {
    id: 'INC-003',
    title: 'TLS cert expired',
    description: 'Customer portal cert expired',
    severity: 'P3',
    status: 'Resolved',
    affectedServices: ['web-prod-01'],
    detectionSource: 'alert',
    timestamps: { created: '2026-03-07T08:00:00.000Z', resolved: '2026-03-07T10:00:00.000Z' },
    timeline: [],
  },
  {
    id: 'INC-004',
    title: 'Cache pressure',
    description: 'Redis memory high',
    severity: 'P2',
    status: 'Mitigated',
    affectedServices: ['redis-cache', 'api-gateway'],
    detectionSource: 'alert',
    timestamps: { created: '2026-03-08T06:00:00.000Z' },
    timeline: [],
  },
]

// Recharts renders SVG elements; jsdom has limited SVG support.
// We verify the component mounts, renders its container/title, and
// produces an SVG for each chart type.

describe('SeverityDistributionChart', () => {
  it('renders with incident data', () => {
    const { container } = render(<SeverityDistributionChart incidents={mockIncidents} />)
    expect(screen.getByText('Incidents by Severity')).toBeInTheDocument()
    expect(container.querySelector('.chart-container')).toBeInTheDocument()
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
  })

  it('renders empty-state message when no incidents', () => {
    render(<SeverityDistributionChart incidents={[]} />)
    expect(screen.getByText('Incidents by Severity')).toBeInTheDocument()
    expect(screen.getByText(/No incidents to chart/i)).toBeInTheDocument()
  })

  it('renders a responsive chart wrapper and a custom legend row per severity present', () => {
    const { container } = render(<SeverityDistributionChart incidents={mockIncidents} />)
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    // Custom legend entries — one per distinct severity in mockIncidents
    const distinctSeverities = new Set(mockIncidents.map(i => i.severity))
    const legendRows = container.querySelectorAll('.chart-legend-item')
    expect(legendRows.length).toBe(distinctSeverities.size)
  })

  it('shows footnote tags with active/resolved/critical counts', () => {
    const { container } = render(<SeverityDistributionChart incidents={mockIncidents} />)
    const tags = Array.from(container.querySelectorAll('.chart-footnote-tag')).map(t => t.textContent)
    const active = mockIncidents.filter(i => i.status !== 'Resolved').length
    const resolved = mockIncidents.length - active
    const critical = mockIncidents.filter(i => i.severity === 'P0').length
    expect(tags.some(t => t === `${active} active`)).toBe(true)
    expect(tags.some(t => t === `${resolved} resolved`)).toBe(true)
    if (critical > 0) {
      expect(tags.some(t => t === `${critical} critical`)).toBe(true)
    }
  })
})

describe('StatusBreakdownChart', () => {
  it('renders with incident data', () => {
    const { container } = render(<StatusBreakdownChart incidents={mockIncidents} />)
    expect(screen.getByText('Incidents by Status')).toBeInTheDocument()
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
  })

  it('renders empty-state message when no incidents', () => {
    render(<StatusBreakdownChart incidents={[]} />)
    expect(screen.getByText('Incidents by Status')).toBeInTheDocument()
    expect(screen.getByText(/No incidents to chart/i)).toBeInTheDocument()
  })

  it('shows footnote tags with active/resolved counts and resolution rate', () => {
    const { container } = render(<StatusBreakdownChart incidents={mockIncidents} />)
    const tags = Array.from(container.querySelectorAll('.chart-footnote-tag')).map(t => t.textContent)
    const resolved = mockIncidents.filter(i => i.status === 'Resolved').length
    const active = mockIncidents.length - resolved
    const rate = Math.round((resolved / mockIncidents.length) * 100)
    expect(tags.some(t => t === `${active} active`)).toBe(true)
    expect(tags.some(t => t === `${resolved} resolved`)).toBe(true)
    expect(tags.some(t => t === `${rate}% resolved`)).toBe(true)
  })
})

describe('IncidentTimelineChart', () => {
  it('renders with incident data', () => {
    const { container } = render(<IncidentTimelineChart incidents={mockIncidents} />)
    expect(screen.getByText('Incident Timeline')).toBeInTheDocument()
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
  })

  it('renders empty-state message when no incidents', () => {
    render(<IncidentTimelineChart incidents={[]} />)
    expect(screen.getByText('Incident Timeline')).toBeInTheDocument()
    expect(screen.getByText(/No incidents to chart/i)).toBeInTheDocument()
  })

  it('shows total + peak footnote tags', () => {
    const { container } = render(<IncidentTimelineChart incidents={mockIncidents} />)
    const tagText = Array.from(container.querySelectorAll('.chart-footnote-tag')).map(t => t.textContent ?? '')
    expect(tagText.some(t => t === `${mockIncidents.length} total`)).toBe(true)
    expect(tagText.some(t => t.startsWith('peak '))).toBe(true)
  })
})

describe('ServiceImpactChart', () => {
  it('renders with incident data showing affected services', () => {
    const { container } = render(<ServiceImpactChart incidents={mockIncidents} />)
    expect(screen.getByText('Most Affected Services')).toBeInTheDocument()
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
  })

  it('shows empty state when no services are affected', () => {
    const noServiceIncidents: Incident[] = [
      {
        ...mockIncidents[0],
        affectedServices: [],
      },
    ]
    render(<ServiceImpactChart incidents={noServiceIncidents} />)
    expect(screen.getByText('Most Affected Services')).toBeInTheDocument()
    expect(screen.getByText(/No service data available/i)).toBeInTheDocument()
  })

  it('renders empty state for fully empty incident list', () => {
    render(<ServiceImpactChart incidents={[]} />)
    expect(screen.getByText(/No service data available/i)).toBeInTheDocument()
  })

  it('shows footnote tags including unique-service count and top service', () => {
    const { container } = render(<ServiceImpactChart incidents={mockIncidents} />)
    const tagText = Array.from(container.querySelectorAll('.chart-footnote-tag')).map(t => t.textContent ?? '')
    const distinct = new Set(mockIncidents.flatMap(i => i.affectedServices))
    expect(tagText.some(t => t === `${distinct.size} services impacted`)).toBe(true)
    expect(tagText.some(t => t.startsWith('top:'))).toBe(true)
  })
})
