import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Incident } from '../types/incident'
import type { RunbookEntry } from '../types/analysis'
import './RunbookExecutionCard.css'

type Mode = 'pending' | 'executing' | 'complete' | 'cancelled'
type StepStatus = 'pending' | 'running' | 'done'

interface RunbookExecutionCardProps {
  incident: Incident
  runbook: RunbookEntry
  setIncidents: Dispatch<SetStateAction<Incident[]>>
  toolCallId: string
}

const SEVERITY_COLORS: Record<string, string> = {
  P0: '#ef4444',
  P1: '#f97316',
  P2: '#eab308',
  P3: '#3b82f6',
  P4: '#94a3b8',
}

function appendTimeline(
  setIncidents: Dispatch<SetStateAction<Incident[]>>,
  incidentId: string,
  event: { type: 'mitigation' | 'comment' | 'status_change'; description: string; author?: string },
  patch?: Partial<Pick<Incident, 'status' | 'timestamps'>>,
) {
  setIncidents(prev =>
    prev.map(i => {
      if (i.id !== incidentId) return i
      return {
        ...i,
        ...(patch ?? {}),
        timeline: [
          ...i.timeline,
          {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            type: event.type,
            description: event.description,
            author: event.author,
          },
        ],
      }
    }),
  )
}

export function RunbookExecutionCard({
  incident,
  runbook,
  setIncidents,
}: RunbookExecutionCardProps) {
  const [mode, setMode] = useState<Mode>('pending')
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(
    () => runbook.steps.map(() => 'pending'),
  )
  const startedAtRef = useRef<number>(0)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // Cancel any pending timeouts if the chat scrolls away / unmounts mid-execution
  useEffect(() => {
    return () => {
      for (const t of timeoutsRef.current) clearTimeout(t)
      timeoutsRef.current = []
    }
  }, [])

  const runbookAuthor = `Runbook: ${runbook.title}`

  const handleApprove = () => {
    if (mode !== 'pending') return
    setMode('executing')
    startedAtRef.current = Date.now()

    let cumulative = 0
    runbook.steps.forEach((step, idx) => {
      const stepDelay = 700 + Math.floor(Math.random() * 600) // 700–1300ms
      cumulative += stepDelay

      // Mark step as running just before its delay starts
      const runningAt = cumulative - stepDelay + 50
      timeoutsRef.current.push(
        setTimeout(() => {
          setStepStatuses(prev => {
            const next = [...prev]
            next[idx] = 'running'
            return next
          })
        }, runningAt),
      )

      // Mark step done + append timeline event after the delay
      timeoutsRef.current.push(
        setTimeout(() => {
          setStepStatuses(prev => {
            const next = [...prev]
            next[idx] = 'done'
            return next
          })
          appendTimeline(setIncidents, incident.id, {
            type: 'mitigation',
            description: `Runbook step: ${step}`,
            author: runbookAuthor,
          })
        }, cumulative),
      )
    })

    // Final completion: summary event + auto-promote to Mitigated if applicable
    timeoutsRef.current.push(
      setTimeout(() => {
        const elapsedSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
        const total = runbook.steps.length
        const shouldPromote = incident.status === 'Open' || incident.status === 'Investigating'

        appendTimeline(
          setIncidents,
          incident.id,
          {
            type: 'mitigation',
            description: `Runbook "${runbook.title}" completed (${total}/${total} steps in ${elapsedSec}s)`,
            author: runbookAuthor,
          },
        )

        if (shouldPromote) {
          appendTimeline(
            setIncidents,
            incident.id,
            {
              type: 'status_change',
              description: `Status changed from ${incident.status} to Mitigated`,
              author: runbookAuthor,
            },
            { status: 'Mitigated' },
          )
        }

        setMode('complete')
      }, cumulative + 200),
    )
  }

  const handleCancel = () => {
    if (mode !== 'pending') return
    setMode('cancelled')
    appendTimeline(setIncidents, incident.id, {
      type: 'comment',
      description: `Runbook "${runbook.title}" proposal cancelled by user`,
      author: 'User',
    })
  }

  const headerLabel: Record<Mode, string> = {
    pending: 'Runbook Proposal',
    executing: 'Executing Runbook',
    complete: 'Runbook Complete',
    cancelled: 'Runbook Cancelled',
  }

  const statusPillLabel: Record<Mode, string> = {
    pending: 'Approval required',
    executing: `${stepStatuses.filter(s => s === 'done').length} / ${runbook.steps.length} steps`,
    complete: `${runbook.steps.length} / ${runbook.steps.length} steps`,
    cancelled: 'Cancelled',
  }

  const completedCount = stepStatuses.filter(s => s === 'done').length
  const progressPct = runbook.steps.length > 0
    ? Math.round((completedCount / runbook.steps.length) * 100)
    : 0

  return (
    <div className={`runbook-card runbook-card--${mode}`}>
      <div className="runbook-card-header">
        <div className="runbook-card-header-left">
          <span className="runbook-card-icon" aria-hidden>📋</span>
          <span className="runbook-card-header-title">{headerLabel[mode]}</span>
        </div>
        <span className={`runbook-card-pill runbook-card-pill--${mode}`}>
          {statusPillLabel[mode]}
        </span>
      </div>

      <div className="runbook-card-body">
        <div className="runbook-card-title">{runbook.title}</div>
        <div className="runbook-card-meta">
          <span className="runbook-card-eta">~{runbook.estimatedMinutes} min</span>
          <span className="runbook-card-target">
            <span
              className="runbook-card-target-sev"
              style={{ backgroundColor: SEVERITY_COLORS[incident.severity] }}
            >
              {incident.severity}
            </span>
            <span className="runbook-card-target-id">{incident.id}</span>
            <span className="runbook-card-target-title">{incident.title}</span>
          </span>
        </div>

        {(mode === 'executing' || mode === 'complete') && (
          <div className="runbook-card-progress">
            <div
              className="runbook-card-progress-bar"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}

        <ol className="runbook-card-steps">
          {runbook.steps.map((step, idx) => {
            const status = stepStatuses[idx]
            return (
              <li key={idx} className={`runbook-card-step runbook-card-step--${status}`}>
                <span className="runbook-card-step-icon" aria-hidden>
                  {status === 'done' && '✓'}
                  {status === 'running' && <span className="runbook-card-step-spinner" />}
                  {status === 'pending' && '○'}
                </span>
                <span className="runbook-card-step-text">{step}</span>
              </li>
            )
          })}
        </ol>

        {mode === 'complete' && (
          <div className="runbook-card-footer-msg runbook-card-footer-msg--complete">
            ✓ Completed in {Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))}s
            {incident.status === 'Open' || incident.status === 'Investigating'
              ? ` · incident promoted to Mitigated`
              : ''}
          </div>
        )}

        {mode === 'cancelled' && (
          <div className="runbook-card-footer-msg runbook-card-footer-msg--cancelled">
            Cancelled by user. Logged to incident timeline.
          </div>
        )}
      </div>

      {mode === 'pending' && (
        <div className="runbook-card-actions">
          <button
            type="button"
            className="runbook-card-btn runbook-card-btn--primary"
            onClick={handleApprove}
          >
            Approve & Execute
          </button>
          <button
            type="button"
            className="runbook-card-btn runbook-card-btn--secondary"
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
