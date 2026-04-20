import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { matches } from '../lib/api';
import { usePrivy } from '../lib/privy';
import StatusBadge from '../components/StatusBadge';

export default function MatchHistory() {
  const navigate = useNavigate();
  const { user } = usePrivy();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await matches.getHistory();
        // Filter for finished matches for this view, or show all
        setHistory(data);
      } catch (err) {
        console.error('Failed to fetch match history:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  if (loading) return <div className="loading">Retrieving Arena Archives...</div>;

  const completed = history.filter(m => m.status === 'completed');
  const other = history.filter(m => m.status !== 'completed');

  const MatchRow = ({ m }) => {
    const isWinner = m.winner_id === user?.id;
    const isPlayerA = m.player_a_id === user?.id;
    const opponent = isPlayerA ? { name: m.u2_name, tag: m.u2_tag } : { name: m.u1_name, tag: m.u1_tag };

    return (
      <div 
        className={`card glass flex flex-col md:flex-row items-center justify-between p-6 hover:bg-white/5 cursor-pointer border-l-4 transition-all ${m.status === 'completed' ? (isWinner ? 'border-green-500' : 'border-red-500') : 'border-white/10'}`}
        onClick={() => navigate(`/matches/${m.match_id}`)}
      >
        <div className="flex flex-col md:flex-row md:items-center gap-6 flex-1">
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-xl shrink-0">
             {m.status === 'completed' ? (isWinner ? '🏆' : '💀') : '⚔️'}
          </div>
          
          <div>
            <div className="font-bold text-lg">
               VS {opponent.name} <span className="text-secondary text-xs font-normal">#{opponent.tag}</span>
            </div>
            <div className="text-xs text-secondary mt-1 uppercase tracking-tighter">
               {new Date(m.created_at).toLocaleDateString()} • {m.status === 'completed' ? (isWinner ? 'Victory' : 'Defeat') : m.status.toUpperCase()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-12 mt-4 md:mt-0">
          <div className="text-center">
            <div className="text-xs text-secondary uppercase mb-1">Stake</div>
            <div className="font-mono font-bold">${m.stake_amount}</div>
          </div>

          <div className="text-center w-24">
             <StatusBadge status={m.status} size="sm" />
          </div>
          
          <button className="btn btn-ghost btn-sm hidden md:block">Details</button>
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in space-y-8">
      <div className="page-header">
        <h1 className="page-title">Battle History</h1>
        <p className="page-subtitle">A record of your triumphs and lessons in the Arena.</p>
      </div>

      <div className="space-y-12">
        {completed.length > 0 && (
           <section className="space-y-6">
              <h2 className="heading text-xl uppercase tracking-widest text-primary italic">Completed Matches</h2>
              <div className="space-y-4">
                {completed.map(m => <MatchRow key={m.match_id} m={m} />)}
              </div>
           </section>
        )}

        {other.length > 0 && (
           <section className="space-y-6">
              <h2 className="heading text-xl uppercase tracking-widest text-secondary italic">Recent Activity</h2>
              <div className="space-y-4">
                {other.map(m => <MatchRow key={m.match_id} m={m} />)}
              </div>
           </section>
        )}

        {history.length === 0 && (
           <div className="card glass py-24 text-center">
              <div className="text-6xl mb-6 opacity-20">📜</div>
              <h2 className="heading">Archives are Empty</h2>
              <p className="text-secondary mb-8">Victory is earned, not given. Step into the Arena to begin your record.</p>
              <button 
                onClick={() => navigate('/challenge')} 
                className="btn btn-primary"
              >
                Find an Opponent
              </button>
           </div>
        )}
      </div>
    </div>
  );
}
