import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { auth, setTokenProvider } from '../lib/api.js';
import { getStellarAddress, getUserEmail } from '../lib/privy.js';

const navItems = [
  { to: '/dashboard',   icon: '⚡', label: 'Dashboard' },
  { to: '/account',     icon: '🎮', label: 'Account Linking' },
  { to: '/challenge',   icon: '⚔️', label: 'Challenge',   phase: 3 },
  { to: '/history',     icon: '📜', label: 'Match History', phase: 3 },
  { to: '/tournaments', icon: '🏆', label: 'Tournaments',   phase: 4 },
  { to: '/my-tournaments', icon: '👑', label: 'My Tournaments', phase: 4 },
];

export default function Layout() {
  const { user, logout, getAccessToken } = usePrivy();
  const navigate = useNavigate();
  const [mfalmeUser, setMfalmeUser] = useState(null);

  // Register the Privy token provider with the API client
  useEffect(() => {
    setTokenProvider(getAccessToken);
  }, [getAccessToken]);

  // Sync user to backend on mount
  useEffect(() => {
    async function syncUser() {
      if (!user) return;
      try {
        const stellarAddress = getStellarAddress(user);
        const email = getUserEmail(user);
        const { user: synced } = await auth.syncPrivyUser({ email, stellarAddress });
        setMfalmeUser(synced);
      } catch (err) {
        console.warn('Failed to sync user:', err.message);
      }
    }
    syncUser();
  }, [user]);

  function getInitials(email) {
    if (!email) return '?';
    return email.charAt(0).toUpperCase();
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const email = getUserEmail(user);
  const riotHandle = mfalmeUser?.riotGameName
    ? `${mfalmeUser.riotGameName}#${mfalmeUser.riotTagLine}`
    : null;

  return (
    <div className="app-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <span className="sidebar-logo-crown">👑</span>
          <div>
            <div className="sidebar-logo-text">MFALME</div>
            <div className="sidebar-logo-sub">The Arena</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="nav-section-label">Main</div>

          {navItems.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title={label}
            >
              <span className="nav-item-icon">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">{getInitials(email)}</div>
            <div className="user-info">
              <div className="user-name">{riotHandle || email?.split('@')[0] || 'Player'}</div>
              <div className="user-handle">
                {mfalmeUser?.riotLinked ? (
                  <span style={{ color: 'var(--teal)', fontSize: '10px' }}>✅ Riot Linked</span>
                ) : (
                  <span style={{ color: 'var(--warning)', fontSize: '10px' }}>⚠ Link Riot ID</span>
                )}
              </div>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm btn-full"
            style={{ marginTop: '8px', fontSize: '12px' }}
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main-content">
        <Outlet context={{ mfalmeUser, setMfalmeUser }} />
      </main>
    </div>
  );
}
