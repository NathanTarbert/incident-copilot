import {
  PieChart, Pie, Cell, Tooltip, Label,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
  AreaChart, Area, ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import type { Incident } from '../../types/incident'
import './IncidentCharts.css'

const CHART_HEIGHT = 200
// Y-axis label column width for long service names like "postgres-primary"
const SERVICE_YAXIS_WIDTH = 115

const SEVERITY_COLORS: Record<string, string> = {
  P0: '#ef4444',
  P1: '#f97316',
  P2: '#eab308',
  P3: '#3b82f6',
  P4: '#94a3b8',
}

const STATUS_COLORS: Record<string, string> = {
  Open: '#ef4444',
  Investigating: '#f97316',
  Mitigated: '#eab308',
  Resolved: '#22c55e',
}

interface ChartProps {
  incidents: Incident[]
}

const SEVERITY_LABELS: Record<string, string> = {
  P0: 'Critical',
  P1: 'High',
  P2: 'Medium',
  P3: 'Low',
  P4: 'Info',
}

export function SeverityDistributionChart({ incidents }: ChartProps) {
  const counts = incidents.reduce<Record<string, number>>((acc, i) => {
    acc[i.severity] = (acc[i.severity] || 0) + 1
    return acc
  }, {})

  // Order slices P0 → P4 so the visual flow matches severity gradient
  const ordered = (['P0', 'P1', 'P2', 'P3', 'P4'] as const).filter(k => (counts[k] || 0) > 0)
  const data = ordered.map(name => ({ name, value: counts[name] }))

  const total = incidents.length
  const critical = counts['P0'] || 0
  const active = incidents.filter(i => i.status !== 'Resolved').length
  const resolved = total - active

  if (total === 0) {
    return (
      <div className="chart-container">
        <div className="chart-title">Incidents by Severity</div>
        <div className="chart-loading">No incidents to chart.</div>
      </div>
    )
  }

  return (
    <div className="chart-container">
      <div className="chart-title">Incidents by Severity</div>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={48}
          outerRadius={78}
          paddingAngle={2}
          dataKey="value"
          labelLine={false}
          stroke="#fff"
          strokeWidth={2}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] || '#94a3b8'} />
          ))}
          <Label
            position="center"
            content={(props) => {
              const vb = props.viewBox as { cx?: number; cy?: number } | undefined
              if (!vb || vb.cx == null || vb.cy == null) return null
              return (
                <g>
                  <text x={vb.cx} y={vb.cy - 6} textAnchor="middle" className="chart-center-num">
                    {total}
                  </text>
                  <text x={vb.cx} y={vb.cy + 12} textAnchor="middle" className="chart-center-label">
                    Incidents
                  </text>
                </g>
              )
            }}
          />
        </Pie>
        <Tooltip
          formatter={((value: unknown, _name: unknown, props: unknown) => {
            const v = typeof value === 'number' ? value : Number(value)
            const pct = total ? Math.round((v / total) * 100) : 0
            const sevName = (props as { payload?: { name?: string } } | undefined)?.payload?.name ?? ''
            const label = SEVERITY_LABELS[sevName] ?? sevName
            return [`${v} (${pct}%)`, label]
          }) as never}
        />
      </PieChart>
      </ResponsiveContainer>
      <div className="chart-legend">
        {data.map(({ name, value }) => {
          const pct = Math.round((value / total) * 100)
          return (
            <div key={name} className="chart-legend-item">
              <span className="chart-legend-dot" style={{ backgroundColor: SEVERITY_COLORS[name] }} />
              <span className="chart-legend-name">
                {name} <span className="chart-legend-sublabel">{SEVERITY_LABELS[name]}</span>
              </span>
              <span className="chart-legend-meta">{value} · {pct}%</span>
            </div>
          )
        })}
      </div>
      <div className="chart-footnote">
        {critical > 0 && <span className="chart-footnote-tag critical">{critical} critical</span>}
        <span className="chart-footnote-tag">{active} active</span>
        <span className="chart-footnote-tag muted">{resolved} resolved</span>
      </div>
    </div>
  )
}

export function StatusBreakdownChart({ incidents }: ChartProps) {
  const counts = incidents.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1
    return acc
  }, {})

  // Order matches IR lifecycle so the visual reads left-to-right naturally
  const ordered = (['Open', 'Investigating', 'Mitigated', 'Resolved'] as const).filter(
    k => (counts[k] || 0) > 0,
  )
  const data = ordered.map(name => ({ name, value: counts[name] }))

  const total = incidents.length
  const resolved = counts['Resolved'] || 0
  const active = total - resolved
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0

  if (total === 0) {
    return (
      <div className="chart-container">
        <div className="chart-title">Incidents by Status</div>
        <div className="chart-loading">No incidents to chart.</div>
      </div>
    )
  }

  return (
    <div className="chart-container">
      <div className="chart-title">Incidents by Status</div>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={{ top: 18, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={((value: unknown, _name: unknown, props: unknown) => {
            const v = typeof value === 'number' ? value : Number(value)
            const pct = total ? Math.round((v / total) * 100) : 0
            const statusName = (props as { payload?: { name?: string } } | undefined)?.payload?.name ?? ''
            return [`${v} (${pct}%)`, statusName]
          }) as never}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#6366f1'} />
          ))}
          <LabelList dataKey="value" position="top" style={{ fontSize: 11, fontWeight: 600, fill: '#0f172a' }} />
        </Bar>
      </BarChart>
      </ResponsiveContainer>
      <div className="chart-footnote">
        <span className="chart-footnote-tag">{active} active</span>
        <span className="chart-footnote-tag muted">{resolved} resolved</span>
        <span className="chart-footnote-tag">{resolutionRate}% resolved</span>
      </div>
    </div>
  )
}

export function IncidentTimelineChart({ incidents }: ChartProps) {
  const buckets: Record<string, number> = {}
  incidents.forEach(i => {
    const d = new Date(i.timestamps.created)
    const key = `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:00`
    buckets[key] = (buckets[key] || 0) + 1
  })

  const data = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, count]) => ({ time, count }))

  const total = incidents.length
  const periods = data.length
  const peak = data.reduce<{ time: string; count: number }>(
    (best, cur) => (cur.count > best.count ? cur : best),
    { time: '', count: 0 },
  )
  const avgPerPeriod = periods > 0 ? +(total / periods).toFixed(1) : 0

  if (total === 0) {
    return (
      <div className="chart-container">
        <div className="chart-title">Incident Timeline</div>
        <div className="chart-loading">No incidents to chart.</div>
      </div>
    )
  }

  return (
    <div className="chart-container">
      <div className="chart-title">Incident Timeline</div>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <AreaChart data={data} margin={{ top: 8, right: 10, left: -10, bottom: 5 }}>
        <defs>
          <linearGradient id="timeline-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="time" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={((value: unknown) => {
            const v = typeof value === 'number' ? value : Number(value)
            return [`${v} ${v === 1 ? 'incident' : 'incidents'}`, 'Count']
          }) as never}
          labelFormatter={((label: unknown) => `At ${String(label ?? '')}`) as never}
        />
        {avgPerPeriod > 0 && periods > 1 && (
          <ReferenceLine
            y={avgPerPeriod}
            stroke="#94a3b8"
            strokeDasharray="4 4"
            label={{
              value: `avg ${avgPerPeriod}`,
              position: 'right',
              fontSize: 9,
              fill: '#64748b',
            }}
          />
        )}
        <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#timeline-fill)" />
      </AreaChart>
      </ResponsiveContainer>
      <div className="chart-footnote">
        <span className="chart-footnote-tag">{total} total</span>
        {peak.count > 0 && (
          <span className="chart-footnote-tag">peak {peak.count} @ {peak.time}</span>
        )}
        {periods > 1 && (
          <span className="chart-footnote-tag muted">{periods} time slots</span>
        )}
      </div>
    </div>
  )
}

export function ServiceImpactChart({ incidents }: ChartProps) {
  const serviceCounts: Record<string, number> = {}
  incidents.forEach(i => {
    i.affectedServices.forEach(s => {
      serviceCounts[s] = (serviceCounts[s] || 0) + 1
    })
  })

  const allEntries = Object.entries(serviceCounts).sort(([, a], [, b]) => b - a)
  const data = allEntries.slice(0, 8).map(([service, count]) => ({ service, count }))
  const totalUniqueServices = allEntries.length
  const totalIncidents = incidents.length
  const top = data[0]
  // Right margin must accommodate the value label outside the bar end
  const chartRightMargin = 28

  if (data.length === 0) {
    return (
      <div className="chart-container">
        <div className="chart-title">Most Affected Services</div>
        <div className="chart-loading">No service data available.</div>
      </div>
    )
  }

  const chartHeight = Math.max(150, data.length * 32 + 40)

  return (
    <div className="chart-container">
      <div className="chart-title">Most Affected Services</div>
      <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: chartRightMargin, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="service" tick={{ fontSize: 10 }} width={SERVICE_YAXIS_WIDTH} />
        <Tooltip
          formatter={((value: unknown, _name: unknown, props: unknown) => {
            const v = typeof value === 'number' ? value : Number(value)
            const pct = totalIncidents ? Math.round((v / totalIncidents) * 100) : 0
            const svc = (props as { payload?: { service?: string } } | undefined)?.payload?.service ?? ''
            return [`${v} of ${totalIncidents} (${pct}%)`, svc]
          }) as never}
        />
        <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]}>
          <LabelList dataKey="count" position="right" style={{ fontSize: 11, fontWeight: 600, fill: '#0f172a' }} />
        </Bar>
      </BarChart>
      </ResponsiveContainer>
      <div className="chart-footnote">
        <span className="chart-footnote-tag">{totalUniqueServices} services impacted</span>
        {top && (
          <span className="chart-footnote-tag critical">
            top: {top.service} ({top.count})
          </span>
        )}
        {totalUniqueServices > data.length && (
          <span className="chart-footnote-tag muted">
            +{totalUniqueServices - data.length} more
          </span>
        )}
      </div>
    </div>
  )
}
