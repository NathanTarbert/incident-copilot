import './style.css'
import { CopilotKit } from '@copilotkit/react-core'
import { CopilotPopup } from '@copilotkit/react-ui'
import '@copilotkit/react-ui/styles.css'
import { Counter } from './components/Counter'
import { ErrorBoundary } from './components/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <div id="app-content" style={{ minHeight: '100vh', position: 'relative' }}>
        <CopilotKit
          headers={{
            "x-copilotkit-runtime-client-gql-version": "1.50.0"
          }}
          runtimeUrl="http://localhost:4000/copilotkit"
        >
          <div className="app-container">
            {/* Header */}
            <header className="header">
              <div className="header-content">
                <div className="logo-section">
                  <div className="logo-icon">⚡</div>
                  <span className="logo-text">TaskFlow</span>
                </div>
                <nav className="nav">
                  <a href="#features" className="nav-link">Features</a>
                  <a href="#pricing" className="nav-link">Pricing</a>
                  <a href="#about" className="nav-link">About</a>
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
                    Streamline Your Workflow with
                    <span className="gradient-text"> AI-Powered</span> Tools
                  </h1>
                  <p className="hero-description">
                    Boost productivity with intelligent automation and real-time insights.
                    Experience the future of task management.
                  </p>
                  <div className="hero-actions">
                    <button className="btn-primary btn-large">Start Free Trial</button>
                    <button className="btn-outline btn-large">Watch Demo</button>
                  </div>
                </div>
              </section>

              {/* Dashboard Section */}
              <section className="dashboard">
                <div className="dashboard-header">
                  <h2 className="section-title">Dashboard</h2>
                  <p className="section-subtitle">Track your metrics in real-time</p>
                </div>
                <div className="dashboard-grid">
                  <div className="dashboard-card">
                    <div className="card-header">
                      <h3 className="card-title">Activity Counter</h3>
                      <span className="card-badge">Live</span>
                    </div>
                    <div className="card-content">
                      <Counter />
                    </div>
                    <p className="card-description">
                      Track your daily interactions and activities
                    </p>
                  </div>
                  <div className="dashboard-card">
                    <div className="card-header">
                      <h3 className="card-title">Performance</h3>
                    </div>
                    <div className="card-content">
                      <div className="metric">
                        <div className="metric-value">98%</div>
                        <div className="metric-label">Uptime</div>
                      </div>
                    </div>
                    <p className="card-description">
                      System reliability and availability
                    </p>
                  </div>
                  <div className="dashboard-card">
                    <div className="card-header">
                      <h3 className="card-title">Users</h3>
                    </div>
                    <div className="card-content">
                      <div className="metric">
                        <div className="metric-value">1,234</div>
                        <div className="metric-label">Active</div>
                      </div>
                    </div>
                    <p className="card-description">
                      Current active users on the platform
                    </p>
                  </div>
                </div>
              </section>
            </main>

            {/* Footer */}
            <footer className="footer">
              <div className="footer-content">
                <p>&copy; 2024 TaskFlow. All rights reserved.</p>
                <div className="footer-links">
                  <a href="#privacy">Privacy</a>
                  <a href="#terms">Terms</a>
                  <a href="#contact">Contact</a>
                </div>
              </div>
            </footer>
          </div>
          <CopilotPopup
            instructions="You are a helpful assistant for TaskFlow, a productivity SaaS platform. Answer questions clearly and concisely about the application, features, and help users with their tasks."
            labels={{
              title: "AI Assistant",
              initial: "Hello! How can I help you with TaskFlow today?",
            }}
          />
        </CopilotKit>
      </div>
    </ErrorBoundary>
  )
}

export default App
