import { useFrontendTool } from '@copilotkit/react-core'

interface CounterProps {
  count: number
  onOpenForm: () => void
}

export function Counter({ count, onOpenForm }: CounterProps) {
  // Create a frontend tool that the AI can use to check the current incident count
  // This ensures the AI always has access to the latest value
  useFrontendTool({
    name: 'getCurrentIncidentCount',
    description: 'Get the current number of active incidents. Use this to check the latest count after any manual changes.',
    parameters: [],
    handler: async () => {
      return `The current number of active incidents is ${count}.`
    },
  })

  return (
    <div className="counter-container">
      <div className="counter-display">
        <div className="counter-value">{count}</div>
        <div className="counter-label">Active Incidents</div>
      </div>
      <button 
        className="counter-button"
        onClick={onOpenForm}
      >
        Report Incident
      </button>
    </div>
  )
}
