import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tournaments } from '../lib/api';
import StatusBadge from '../components/StatusBadge';

export default function TournamentLobby() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const data = await tournaments.list();
      setList(data);
    } catch (err) {
      console.error('Failed to fetch tournaments:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Fetching Arenas...</div>;

  const platformTournaments = list.filter(t => t.tournament_type === 'platform_run');
  const ugtTournaments = list.filter(t => t.tournament_type === 'user_generated');

  const TournamentCard = ({ t }) => (
    <div 
      className="card glass hover:bg-white/5 transition-all cursor-pointer border border-white/5 hover:border-primary/30"
      onClick={() => navigate(`/tournaments/${t.tournament_id}`)}
    >
      <div className="flex justify-between items-start mb-4">
        <StatusBadge status={t.status} />
        <div className="text-right">
          <div className="text-xs text-secondary uppercase tracking-widest">Prize Pool</div>
          <div className="text-xl font-bold text-primary">${Number(t.prize_pool).toLocaleString()}</div>
        </div>
      </div>
      
      <h3 className="text-xl font-black mb-2 uppercase italic tracking-tighter">{t.name}</h3>
      
      <div className="flex items-center gap-4 text-sm text-secondary mb-4">
        <div className="flex items-center gap-1">
          <span>👥</span> {t.registered_count} / {t.bracket_size}
        </div>
        <div className="flex items-center gap-1">
          <span>💰</span> Fee: ${Number(t.entry_fee).toFixed(2)}
        </div>
      </div>

      <div className="pt-4 border-t border-white/5 flex justify-between items-center">
        <span className="text-xs text-secondary bg-white/5 px-2 py-1 rounded">
          {t.tournament_type === 'platform_run' ? '🛡️ OFFICIAL' : '👑 COMMUNITY'}
        </span>
        <button className="text-primary text-sm font-bold hover:underline">View Bracket →</button>
      </div>
    </div>
  );

  return (
    <div className="fade-in space-y-12">
      <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Tournament Lobby</h1>
          <p className="page-subtitle">Join official brackets or host your own community prize pool.</p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => navigate('/tournaments/host')}>
          Host Tournament
        </button>
      </div>

      {/* Platform Section */}
      <section className="space-y-6">
        <h2 className="heading text-2xl border-l-4 border-primary pl-4 uppercase tracking-tighter italic">Official Mfalme Events</h2>
        {platformTournaments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {platformTournaments.map(t => <TournamentCard key={t.tournament_id} t={t} />)}
          </div>
        ) : (
          <div className="card glass text-center py-12 opacity-50">
            No official events currently scheduled.
          </div>
        )}
      </section>

      {/* UGT Section */}
      <section className="space-y-6">
        <h2 className="heading text-2xl border-l-4 border-accent pl-4 uppercase tracking-tighter italic">Community Prize Pools</h2>
        {ugtTournaments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ugtTournaments.map(t => <TournamentCard key={t.tournament_id} t={t} />)}
          </div>
        ) : (
          <div className="card glass text-center py-12 opacity-50">
            No community tournaments are live. Be the first to host one!
          </div>
        )}
      </section>
    </div>
  );
}
