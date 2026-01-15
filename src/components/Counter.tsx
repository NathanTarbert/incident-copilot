import { useState } from 'react'
import { useCopilotReadable } from '@copilotkit/react-core'

export function Counter() {
  const [count, setCount] = useState(0)

  // Make the count value readable by CopilotKit
  useCopilotReadable({
    description: 'The current count value in the counter',
    value: count,
  })

  return (
    <div className="counter-container">
      <div className="counter-display">
        <div className="counter-value">{count}</div>
        <div className="counter-label">Actions</div>
      </div>
      <button 
        className="counter-button"
        onClick={() => setCount((count) => count + 1)}
      >
        Increment
      </button>
    </div>
  )
}
