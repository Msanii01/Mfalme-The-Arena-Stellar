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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PrivyProvider
      appId={PRIVY_APP_ID || 'clxxxxxxxxxxxxxxxxxxxxxxxxx'}
      config={{
        // Login methods: email OTP, Google, Apple — as per spec
        loginMethods: ['email', 'google', 'apple'],
        appearance: {
          theme: 'dark',
          accentColor: '#F5A623',
          logo: '/favicon.svg',
        },
        // Embedded wallets — Privy auto-creates at signup
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        // Stellar is supported via Privy's tier-2 chain support
        // Docs: https://docs.privy.io/recipes/use-tier-2
        supportedChains: [],
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PrivyProvider>
  </React.StrictMode>
);
