import { useState, Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import './style.css'
import typescriptLogo from './typescript.svg'
import viteLogo from '/vite.svg'
import { CopilotKit } from '@copilotkit/react-core'
import { CopilotPopup } from '@copilotkit/react-ui'
import '@copilotkit/react-ui/styles.css'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
          <h1>Something went wrong</h1>
          <p style={{ color: 'red' }}>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

function Counter() {
  const [count, setCount] = useState(0)

  return (
    <div className="card">
      <button onClick={() => setCount((count) => count + 1)}>
        count is {count}
      </button>
    </div>
  )
}

function App() {
  const apiKey = import.meta.env.VITE_COPILOTKIT_PUBLIC_API_KEY

  return (
    <ErrorBoundary>
      <div id="app-content" style={{ minHeight: '100vh', position: 'relative' }}>
        <CopilotKit
        headers={{
          "x-copilotkit-runtime-client-gql-version": "1.50.0"
        }}
        publicApiKey={apiKey} > 
          <div>
            <a href="https://vite.dev" target="_blank">
              <img src={viteLogo} className="logo" alt="Vite logo" />
            </a>
            <a href="https://www.typescriptlang.org/" target="_blank">
              <img src={typescriptLogo} className="logo vanilla" alt="TypeScript logo" />
            </a>
            <h1>Vite + TypeScript + React</h1>
            <Counter />
            <p className="read-the-docs">
              Click on the Vite and TypeScript logos to learn more
            </p>
          </div>
          <CopilotPopup
            instructions="You are a helpful assistant. Answer questions clearly and concisely."
            labels={{
              title: "AI Assistant",
              initial: "Hello! How can I help you today?",
            }}
          />
        </CopilotKit>
      </div>
    </ErrorBoundary>
  )
}

export default App
