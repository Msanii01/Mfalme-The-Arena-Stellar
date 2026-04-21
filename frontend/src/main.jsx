import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PrivyProvider } from '@privy-io/react-auth';
import App from './App.jsx';
import './styles/global.css';

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID;

if (!PRIVY_APP_ID) {
  console.warn('⚠️  VITE_PRIVY_APP_ID is not set in frontend/.env — Privy auth will not work');
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          background: '#080A12', color: '#fff', minHeight: '100vh',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '40px', fontFamily: 'monospace'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h1 style={{ color: '#F5A623', marginBottom: '12px' }}>Mfalme Arena — Startup Error</h1>
          <p style={{ color: '#aaa', marginBottom: '20px' }}>The app crashed before it could load. Error details:</p>
          <pre style={{
            background: '#111', padding: '20px', borderRadius: '8px',
            border: '1px solid #333', color: '#ff6b6b', maxWidth: '800px',
            overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: '13px'
          }}>
            {this.state.error?.toString()}{'\n\n'}{this.state.error?.stack}
          </pre>
          <p style={{ color: '#555', marginTop: '20px', fontSize: '12px' }}>
            VITE_PRIVY_APP_ID: {PRIVY_APP_ID ? '✅ Set' : '❌ Missing'}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PrivyProvider
        appId={PRIVY_APP_ID || 'clxxxxxxxxxxxxxxxxxxxxxxxxx'}
        config={{
          loginMethods: ['email', 'google', 'apple'],
          appearance: {
            theme: 'dark',
            accentColor: '#F5A623',
            logo: '/favicon.svg',
          },
          embeddedWallets: {
            createOnLogin: 'users-without-wallets',
          },
        }}
      >
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </PrivyProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
