import { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { auth } from '../lib/api.js';
import SimulationBanner from '../components/SimulationBanner.jsx';

export default function AccountLinking() {
  const { mfalmeUser, setMfalmeUser } = useOutletContext();
  const navigate = useNavigate();

  const [gameName, setGameName] = useState('');
  const [tagLine, setTagLine] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLink = async (e) => {
    e.preventDefault();

    if (!gameName.trim() || !tagLine.trim()) {
      setError('Please fill in both fields.');
      return;
    }

    if (gameName.includes('#') || tagLine.includes('#')) {
      setError('Do not include the # symbol. Split your Riot ID into Game Name and Tagline.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await auth.linkRiotId({ gameName, tagLine });

      setMfalmeUser(response.user);
      setSuccess(`Successfully linked to Riot ID: ${response.riotId}`);

      // If they came here to onboard, redirect back to dashboard after 2s
      if (!mfalmeUser?.riotLinked) {
        setTimeout(() => navigate('/dashboard'), 2000);
      }
    } catch (err) {
      setError(err.message || 'Failed to link Riot Account. Please check your ID and try again.');
    } finally {
      setLoading(false);
    }
  };

  const isLinked = !!mfalmeUser?.riotLinked;
  // If we don't have the user object yet, or they are fully linked and we just loaded, the backend auth/me returns riotMode. 
  // Let's assume we pass down `simulated=true` on the auth object if the backend told us.
  // Actually, we'll just check if the backend responded with simulated: true in the sync or we can fetch it. For now, since it's Phase 1 and we want to show it, let's hardcode show it if not linked.
  const showSimBanner = true;

  return (
    <div className="fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="page-header text-center">
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎮</div>
        <h1 className="page-title">Riot Account Linking</h1>
        <p className="page-subtitle">Connect your League of Legends account to compete</p>
      </div>

      {showSimBanner && <SimulationBanner feature="Riot API" isSimulated={true} />}

      <div className="card">
        {isLinked && !success ? (
          // ALREADY LINKED STATE
          <div className="text-center" style={{ padding: '32px 0' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              color: 'var(--bg-primary)',
              margin: '0 auto 24px',
              boxShadow: '0 0 30px rgba(0,212,170,0.3)',
            }}>
              ✓
            </div>
            <h2 className="heading mb-2">Account Linked</h2>
            <div className="body text-muted mb-6">
              You are permanently linked to the following Riot Account:
            </div>

            <div style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              display: 'inline-block',
              textAlign: 'left',
              minWidth: '300px',
            }}>
              <div className="form-label mb-1">Riot ID</div>
              <div className="heading mb-4 text-gold">
                {mfalmeUser.riotGameName}<span style={{ color: 'var(--text-muted)' }}>#{mfalmeUser.riotTagLine}</span>
              </div>

              <div className="form-label mb-1">Permanent PUUID</div>
              <div className="puuid-display">
                {mfalmeUser.riotPuuid}
              </div>
            </div>

            <p className="caption mt-6">
              For security and fairness, your Mfalme account is permanently linked to this PUUID.
              You cannot change this link.
            </p>
          </div>
        ) : (
          // LINKING FORM
          <div style={{ padding: '16px' }}>
            <div className="alert alert-info mb-6">
              <div>
                <strong>Why do we need this?</strong>
                <div style={{ marginTop: '4px' }}>
                  We use the official Riot Account API to resolve your Riot ID into a permanent PUUID.
                  This ensures that even if you change your display name later, your match history and tournament entries remain valid.
                </div>
              </div>
            </div>

            <form onSubmit={handleLink}>
              <div className="form-group mb-6">
                <label className="form-label">Riot ID</label>
                <div className="riot-id-input">
                  <input
                    type="text"
                    placeholder="Game Name (e.g. Faker)"
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                    disabled={loading}
                    maxLength={16}
                  />
                  <div className="riot-id-separator">#</div>
                  <input
                    type="text"
                    placeholder="Tagline (e.g. KR1)"
                    value={tagLine}
                    onChange={(e) => setTagLine(e.target.value)}
                    disabled={loading}
                    maxLength={5}
                  />
                </div>
                <div className="form-hint">
                  Find this in your League of Legends client under your profile portrait. Do not enter the # symbol.
                </div>
              </div>

              {error && (
                <div className="alert alert-danger mb-6">
                  <span style={{ fontSize: '16px' }}>⚠️</span> {error}
                </div>
              )}

              {success && (
                <div className="alert alert-success mb-6">
                  <span style={{ fontSize: '16px' }}>✅</span> {success}
                </div>
              )}

              <button
                type="submit"
                className={`btn btn-primary btn-lg btn-full ${loading ? 'btn-loading' : ''}`}
                disabled={loading || !gameName || !tagLine}
              >
                {loading ? 'Resolving PUUID via Riot API...' : 'Link Riot Account'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
