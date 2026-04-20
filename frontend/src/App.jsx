import { Routes, Route, Navigate } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AccountLinking from './pages/AccountLinking.jsx';
import ChallengeLobby from './pages/ChallengeLobby.jsx';
import MatchStatus from './pages/MatchStatus.jsx';
import MatchHistory from './pages/MatchHistory.jsx';
import TournamentLobby from './pages/TournamentLobby.jsx';
import TournamentDetail from './pages/TournamentDetail.jsx';
import HostTournament from './pages/HostTournament.jsx';
import MyTournaments from './pages/MyTournaments.jsx';

function ProtectedRoute({ children }) {
  const { ready, authenticated } = usePrivy();

  if (!ready) {
    return (
      <div className="loading-screen">
        <div className="loading-crown">👑</div>
        <div className="loading-text">Loading Arena...</div>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  const { ready, authenticated } = usePrivy();

  if (!ready) {
    return (
      <div className="loading-screen">
        <div className="loading-crown">👑</div>
        <div className="loading-text">Initializing Mfalme Arena...</div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={authenticated ? <Navigate to="/dashboard" replace /> : <Login />}
      />

      {/* Protected — all wrap in Layout */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="account" element={<AccountLinking />} />
        <Route path="challenge" element={<ChallengeLobby />} />
        <Route path="matches/:id" element={<MatchStatus />} />
        <Route path="history" element={<MatchHistory />} />
        <Route path="tournaments" element={<TournamentLobby />} />
        <Route path="tournaments/:id" element={<TournamentDetail />} />
        <Route path="tournaments/host" element={<HostTournament />} />
        <Route path="my-tournaments" element={<MyTournaments />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to={authenticated ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}
