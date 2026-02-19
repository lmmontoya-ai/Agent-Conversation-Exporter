import { Component, type ReactNode } from 'react'
import { AppShell } from './components/layout/app-shell'

interface State {
  error: Error | null
}

class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[var(--bg)] p-8 text-center">
          <p className="font-[family-name:var(--font-heading)] text-[18px] font-semibold text-[var(--fg)]">
            Something went wrong
          </p>
          <p className="max-w-[360px] text-[13px] leading-relaxed text-[var(--fg-subtle)]">
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-2 rounded-lg bg-[var(--accent)] px-4 py-1.5 text-[13px] font-medium text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] active:scale-[0.98]"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  )
}

export default App
