import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { matches, auth } from '../lib/api';
import { usePrivy } from '@privy-io/react-auth';
import StatusBadge from '../components/StatusBadge';

export default function ChallengeLobby() {
  const navigate = useNavigate();
  const { user: privyUser } = usePrivy();
  const [challenges, setChallenges] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    opponentId: '',
    stake: '5.00'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [history, users] = await Promise.all([
        matches.getHistory(),
        // For MVP, we need an endpoint to get users. Let's assume we use /auth/me for current and 
        // we'll need a way to find others. For now, we'll just show the history.
        // I'll add a mock user list if needed or just use history to find "Opponents"
        api.get('/auth/users') // I need to implement this in auth.js
      ]);
      setChallenges(history);
      setAvailableUsers(users.filter(u => u.privy_user_id !== privyUser?.id));
    } catch (err) {
      console.error('Failed to fetch lobby data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChallenge = async (e) => {
    e.preventDefault();
    if (!formData.opponentId) return;
    
    try {
      setCreating(true);
      const newMatch = await matches.createChallenge({
        player_b_id: formData.opponentId,
        stake_amount: parseFloat(formData.stake)
      });
      navigate(`/matches/${newMatch.match_id}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleAccept = async (id) => {
    try {
      await matches.acceptChallenge(id);
      navigate(`/matches/${id}`);
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="loading">Loading Arena...</div>;

  const incoming = challenges.filter(c => c.status === 'pending' && c.player_b_id === privyUser?.id);
  const sent = challenges.filter(c => c.status === 'pending' && c.player_a_id === privyUser?.id);
  const active = challenges.filter(c => ['accepted', 'active'].includes(c.status));

  return (
    <div className="fade-in space-y-8">
      <div className="page-header">
        <h1 className="page-title">Challenge Lobby</h1>
        <p className="page-subtitle">Prove your reign in the Arena.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create Challenge Form */}
        <div className="card glass col-span-1">
          <h2 className="heading mb-4">Start a Wager</h2>
          <form onSubmit={handleCreateChallenge} className="space-y-4">
            <div className="form-group">
              <label className="label text-secondary">Target Opponent</label>
              <select 
                className="input dark w-full"
                value={formData.opponentId}
                onChange={(e) => setFormData({...formData, opponentId: e.target.value})}
                required
              >
                <option value="">Select an opponent...</option>
                {availableUsers.map(u => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.riot_game_name}#{u.riot_tag_line}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="label text-secondary">Stake Amount (USDC)</label>
              <input 
                type="number" 
                className="input dark w-full"
                value={formData.stake}
                onChange={(e) => setFormData({...formData, stake: e.target.value})}
                min="0.50"
                step="0.01"
              />
            </div>
            <button 
              type="submit" 
              className="btn btn-primary w-full"
              disabled={creating || !formData.opponentId}
            >
              {creating ? 'Issuing Challenge...' : 'Issue Challenge'}
            </button>
          </form>
        </div>

        {/* Challenge Lists */}
        <div className="lg:col-span-2 space-y-6">
          {incoming.length > 0 && (
            <section className="space-y-4">
              <h3 className="heading-sm text-accent uppercase tracking-wider">Incoming Challenges</h3>
              {incoming.map(c => (
                <div key={c.match_id} className="card glass flex items-center justify-between">
                  <div>
                    <div className="font-bold">{c.u1_name}#{c.u1_tag}</div>
                    <div className="text-secondary text-sm">Wager: ${c.stake_amount} USDC</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleAccept(c.match_id)} className="btn btn-sm btn-primary">Accept</button>
                    <button className="btn btn-sm btn-secondary">Decline</button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {active.length > 0 && (
            <section className="space-y-4">
              <h3 className="heading-sm text-accent uppercase tracking-wider">Active Matches</h3>
              {active.map(c => (
                <div 
                  key={c.match_id} 
                  className="card glass flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => navigate(`/matches/${c.match_id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-bold">{c.u1_name}</div>
                      <div className="text-xs text-secondary">Player 1</div>
                    </div>
                    <div className="text-accent font-black">VS</div>
                    <div>
                      <div className="font-bold">{c.u2_name}</div>
                      <div className="text-xs text-secondary">Player 2</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <div className="font-bold text-primary">${c.stake_amount}</div>
                      <div className="text-xs text-secondary">Stake</div>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                </div>
              ))}
            </section>
          )}

          {sent.length > 0 && (
            <section className="space-y-4">
              <h3 className="heading-sm text-accent uppercase tracking-wider">Your Pending Challenges</h3>
              {sent.map(c => (
                <div key={c.match_id} className="card glass flex items-center justify-between opacity-75">
                  <div>
                    <div className="font-bold">{c.u2_name}#{c.u2_tag}</div>
                    <div className="text-secondary text-sm">Waiting for response... | ${c.stake_amount} USDC</div>
                  </div>
                  <button className="btn btn-sm btn-secondary">Cancel</button>
                </div>
              ))}
            </section>
          )}

          {incoming.length === 0 && active.length === 0 && sent.length === 0 && (
            <div className="card glass text-center py-12">
              <p className="text-secondary">The Arena is quiet. Issue a challenge to begin your reign.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Needed to make axios calls work in this component if not imported globally
import api from '../lib/api';
