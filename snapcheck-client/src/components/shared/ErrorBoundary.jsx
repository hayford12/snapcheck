import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--canvas)', flexDirection:'column', gap:'16px', padding:'32px', textAlign:'center' }}>
          <div style={{ fontSize:'48px' }}>⚠️</div>
          <h2 style={{ fontSize:'20px', fontWeight:700, color:'var(--ink)', margin:0 }}>Something went wrong</h2>
          <p style={{ fontSize:'13px', color:'var(--ink-soft)', maxWidth:'400px', margin:0 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button className="btn btn-accent" onClick={() => { this.setState({ hasError:false, error:null }); window.location.reload() }}>
            Reload Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
