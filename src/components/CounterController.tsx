import { useFrontendTool } from '@copilotkit/react-core'

interface CounterControllerProps {
  count: number
  setCount: (value: number | ((prev: number) => number)) => void
}

export function CounterController({ count, setCount }: CounterControllerProps) {
  // Tool: Report new incidents (increments the counter)
  useFrontendTool({
    name: 'reportIncident',
    description: 'Report one or more new incidents. If no amount is provided, reports 1 incident.',
    parameters: [
      {
        name: 'amount',
        type: 'number',
        description: 'The number of incidents to report. Defaults to 1 if not specified.',
        required: false,
      },
    ],
    handler: async ({ amount = 1 }) => {
      setCount((prev) => prev + amount)
      return `${amount} new incident${amount > 1 ? 's' : ''} reported. Total active incidents: ${count + amount}`
    },
  })

  // Tool: Resolve incidents (decrements the counter)
  useFrontendTool({
    name: 'resolveIncident',
    description: 'Resolve one or more incidents. If no amount is provided, resolves 1 incident.',
    parameters: [
      {
        name: 'amount',
        type: 'number',
        description: 'The number of incidents to resolve. Defaults to 1 if not specified.',
        required: false,
      },
    ],
    handler: async ({ amount = 1 }) => {
      const newCount = Math.max(0, count - amount)
      setCount(newCount)
      return `${amount} incident${amount > 1 ? 's' : ''} resolved. Remaining active incidents: ${newCount}`
    },
  })

  // Tool: Set incident count to a specific value
  useFrontendTool({
    name: 'setIncidentCount',
    description: 'Set the number of active incidents to a specific value.',
    parameters: [
      {
        name: 'value',
        type: 'number',
        description: 'The number of active incidents to set.',
        required: true,
      },
    ],
    handler: async ({ value }) => {
      setCount(Math.max(0, value))
      return `Active incidents set to ${Math.max(0, value)}`
    },
  })

  // Tool: Clear all incidents
  useFrontendTool({
    name: 'clearAllIncidents',
    description: 'Clear all active incidents (set count to zero).',
    parameters: [],
    handler: async () => {
      setCount(0)
      return 'All incidents cleared. No active incidents remaining.'
    },
  })

  // This component doesn't render anything — it only registers tools
  return null
}
