import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`ErrorBoundary [${this.props.tabName}]:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          maxWidth: '500px',
          margin: '0 auto',
          fontFamily: "'Libre Franklin', sans-serif",
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>&#x26A0;&#xFE0F;</div>
          <h3 style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: '20px',
            marginBottom: '8px',
            color: '#2c1810',
          }}>
            Something went wrong in {this.props.tabName || 'this section'}
          </h3>
          <p style={{ fontSize: '13px', color: '#8b7355', marginBottom: '20px', lineHeight: '1.6' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              border: 'none',
              background: '#4a7c2e',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: "'Libre Franklin', sans-serif",
            }}
          >
            Reset and Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
