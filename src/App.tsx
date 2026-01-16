import { useState, useEffect, useRef, useCallback } from 'react'
import './style.css'
import { CopilotKit, useCopilotContext } from '@copilotkit/react-core'
import { CopilotPopup } from '@copilotkit/react-ui'
import '@copilotkit/react-ui/styles.css'
import { Counter } from './components/Counter'
import { CounterController } from './components/CounterController'
import { ErrorBoundary } from './components/ErrorBoundary'
import { IncidentForm } from './components/IncidentForm'
import type { IncidentData } from './components/IncidentForm'

function AppContent() {
  // Lift counter state to App level so both Counter and CounterController can access it
  const [count, setCount] = useState(0)
  const [isIncidentFormOpen, setIsIncidentFormOpen] = useState(false)
  const { addContext, removeContext } = useCopilotContext()
  const contextIdRef = useRef<string | undefined>(undefined)
  const prevCountRef = useRef<number>(count)

  // Function to update context - can be called from both useEffect and button click
  // This is a workaround for the known useCopilotReadable bug where
  // context from manual state changes isn't passed to the agent
  const updateContext = useCallback((newCount: number) => {
    // Always update context, even if count hasn't changed (to ensure it's fresh)
    // Remove old context if it exists
    if (contextIdRef.current) {
      removeContext(contextIdRef.current)
      contextIdRef.current = undefined
    }

    // Add new context with current incident count
    const contextString = `The current number of active incidents is ${newCount}.`
    contextIdRef.current = addContext(contextString)
    
    // Update the previous count reference
    prevCountRef.current = newCount
  }, [addContext, removeContext])

  const handleReportIncident = (incident: IncidentData) => {
    // Increment the counter when an incident is reported
    const newCount = count + 1
    setCount(newCount)
    updateContext(newCount)
    
    // Log the incident data (in a real app, this would be sent to a backend)
    console.log('New incident reported:', incident)
  }

  // Update context when count changes (from any source)
  useEffect(() => {
    updateContext(count)
  }, [count, updateContext])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (contextIdRef.current) {
        removeContext(contextIdRef.current)
        contextIdRef.current = undefined
      }
    }
  }, [removeContext])

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-icon">🚨</div>
            <span className="logo-text">IncidentResponse</span>
          </div>
          <nav className="nav">
            <a href="#dashboard" className="nav-link">Dashboard</a>
            <a href="#incidents" className="nav-link">Incidents</a>
            <a href="#analytics" className="nav-link">Analytics</a>
          </nav>
          <div className="header-actions">
            <button className="btn-secondary">Sign In</button>
            <button className="btn-primary">Get Started</button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Hero Section */}
        <section className="hero">
          <div className="hero-content">
            <h1 className="hero-title">
              Rapid Incident Response with
              <span className="gradient-text"> AI-Powered</span> Intelligence
            </h1>
            <p className="hero-description">
              Detect, analyze, and resolve incidents faster with real-time monitoring and intelligent automation.
              Minimize downtime and protect your infrastructure.
            </p>
            <div className="hero-actions">
              <button className="btn-primary btn-large">View Dashboard</button>
              <button className="btn-outline btn-large">See How It Works</button>
            </div>
          </div>
        </section>

        {/* Dashboard Section */}
        <section className="dashboard">
          <div className="dashboard-header">
            <div>
              <h2 className="section-title">Incident Dashboard</h2>
              <p className="section-subtitle">Real-time incident monitoring and response metrics</p>
            </div>
            <button 
              className="btn-primary btn-large"
              onClick={() => setIsIncidentFormOpen(true)}
            >
              Report Incident
            </button>
          </div>
          <div className="dashboard-grid">
            <div className="dashboard-card">
              <div className="card-header">
                <h3 className="card-title">Active Incidents</h3>
                <span className="card-badge">Live</span>
              </div>
              <div className="card-content">
                <Counter count={count} onOpenForm={() => setIsIncidentFormOpen(true)} />
                {/* CounterController registers frontend tools for AI to control the counter */}
                <CounterController count={count} setCount={setCount} />
              </div>
              <p className="card-description">
                Currently open incidents requiring attention
              </p>
            </div>
            <div className="dashboard-card">
              <div className="card-header">
                <h3 className="card-title">Mean Time to Resolve</h3>
              </div>
              <div className="card-content">
                <div className="metric">
                  <div className="metric-value">4.2m</div>
                  <div className="metric-label">Average</div>
                </div>
              </div>
              <p className="card-description">
                Average time to resolve incidents today
              </p>
            </div>
            <div className="dashboard-card">
              <div className="card-header">
                <h3 className="card-title">Resolved Today</h3>
              </div>
              <div className="card-content">
                <div className="metric">
                  <div className="metric-value">47</div>
                  <div className="metric-label">Incidents</div>
                </div>
              </div>
              <p className="card-description">
                Successfully resolved incidents in the last 24 hours
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Incident Form Modal */}
      <IncidentForm
        isOpen={isIncidentFormOpen}
        onClose={() => setIsIncidentFormOpen(false)}
        onSubmit={handleReportIncident}
      />

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <p>&copy; 2024 IncidentResponse. All rights reserved.</p>
          <div className="footer-links">
            <a href="#privacy">Privacy</a>
            <a href="#terms">Terms</a>
            <a href="#contact">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function App() {
  // Environment-based configuration for flexible deployment
  const runtimeUrl = import.meta.env.VITE_COPILOTKIT_RUNTIME_URL || "http://localhost:4000/copilotkit"
  const publicApiKey = import.meta.env.VITE_COPILOTKIT_PUBLIC_API_KEY
  const showDevConsole = import.meta.env.VITE_COPILOTKIT_SHOW_DEV_CONSOLE === 'true'

  return (
    <ErrorBoundary>
      <div id="app-content" style={{ minHeight: '100vh', position: 'relative' }}>
        <CopilotKit
          runtimeUrl={runtimeUrl}
          publicApiKey={publicApiKey}
          showDevConsole={showDevConsole}
          headers={{
            "x-copilotkit-runtime-client-gql-version": "1.50.0"
          }}
        >
          <AppContent />
          <CopilotPopup
            instructions="You are an AI incident response assistant for IncidentResponse, a platform for managing and resolving security and operational incidents. Help users track incidents, analyze metrics, and respond to issues. IMPORTANT: When asked about the current number of active incidents, always use the getCurrentIncidentCount tool to get the latest value, as the context may not reflect recent manual changes."
            labels={{
              title: "Incident Response Assistant",
              initial: "Hello! I'm your incident response assistant. How can I help you manage incidents today?",
            }}
          />
        </CopilotKit>
      </div>
    </ErrorBoundary>
  )
}

export default App
