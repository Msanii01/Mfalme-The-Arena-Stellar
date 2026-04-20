import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { tournaments } from '../lib/api';
import { usePrivy } from '../lib/privy';
import StatusBadge from '../components/StatusBadge';

export default function TournamentDetail() {
  const { id } = useParams();
  const { user } = usePrivy();
  
  const [tournament, setTournament] = useState(null);
  const [bracket, setBracket] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [tData, bData] = await Promise.all([
        tournaments.get(id),
        api.get(`/tournaments/${id}/bracket`) // Using direct api for the new endpoint
      ]);
      setTournament(tData);
      setBracket(bData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
    // Poll for updates if in progress
    let interval;
    if (tournament?.status === 'in_progress' || tournament?.status === 'registration_open') {
        interval = setInterval(fetchData, 10000);
    }
    return () => clearInterval(interval);
  }, [fetchData, tournament?.status]);

  const handleRegister = async () => {
    try {
      setRegistering(true);
      await tournaments.register(id);
      await fetchData();
      alert('Successfully registered for ' + tournament.name);
    } catch (err) {
      alert(err.message);
    } finally {
      setRegistering(false);
    }
  };

  if (loading) return <div className="loading">Entering Arena Detail...</div>;
  if (!tournament) return <div className="error">Tournament not found</div>;

  const isRegistered = tournament.participants?.some(p => p.user_id === user?.id);
  const myMatch = bracket.find(m => (m.player_a_id === user?.id || m.player_b_id === user?.id) && m.status !== 'completed');

  return (
    <div className="fade-in space-y-8">
      <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
           <div className="w-16 h-16 bg-primary/20 rounded flex items-center justify-center text-3xl">⚔️</div>
           <div>
              <h1 className="page-title">{tournament.name}</h1>
              <div className="flex items-center gap-4 text-sm text-secondary">
                 <span>{tournament.tournament_type === 'platform_run' ? '🛡️ Official' : '👑 Community'}</span>
                 <span>•</span>
                 <span>{tournament.bracket_size} Players</span>
                 <span>•</span>
                 <span>Prize: ${Number(tournament.prize_pool)} USDC</span>
              </div>
           </div>
        </div>
        <div className="flex items-center gap-4">
           <StatusBadge status={tournament.status} size="lg" />
           {tournament.status === 'registration_open' && !isRegistered && (
              <button 
                onClick={handleRegister} 
                disabled={registering} 
                className="btn btn-primary btn-lg"
              >
                {registering ? 'Processing...' : `Register for $${Number(tournament.entry_fee).toFixed(2)}`}
              </button>
           )}
           {isRegistered && tournament.status === 'registration_open' && (
              <div className="text-green-500 font-bold bg-green-500/10 px-4 py-2 rounded border border-green-500/20">
                ✓ Registered
              </div>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Main Content: Bracket or Info */}
         <div className="lg:col-span-2 space-y-6">
            {myMatch && (
               <div className="card glass border-accent bg-accent/5 p-6 space-y-4">
                  <div className="flex justify-between items-center">
                     <h3 className="text-accent font-black uppercase text-sm tracking-widest">Your Current Match</h3>
                     <span className="text-xs text-secondary">Round {myMatch.round_number}</span>
                  </div>
                  <div className="flex items-center justify-around py-4">
                    <div className="text-center">
                        <div className="font-bold">{myMatch.u1_name}</div>
                        <div className="text-xs text-secondary">#{myMatch.u1_tag}</div>
                    </div>
                    <div className="font-black text-2xl italic">VS</div>
                    <div className="text-center">
                        <div className="font-bold">{myMatch.u2_name}</div>
                        <div className="text-xs text-secondary">#{myMatch.u2_tag}</div>
                    </div>
                  </div>
                  <div className="bg-black/50 p-4 rounded font-mono text-center border border-white/5">
                     <div className="text-secondary text-xs mb-1 uppercase">Tournament Code</div>
                     <div className="text-xl select-all">{myMatch.tournament_code}</div>
                  </div>
                  <p className="text-xs text-center text-secondary">Join this lobby in League to play your match. Result will sync automatically.</p>
               </div>
            )}

            <div className="card glass min-h-[400px]">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="heading text-xl">Tournament Bracket</h2>
                  {tournament.challonge_url && (
                     <a href={tournament.challonge_url} target="_blank" rel="noreferrer" className="text-primary text-sm hover:underline">
                        Open Challonge Page ↗
                     </a>
                  )}
               </div>
               
               {bracket.length > 0 ? (
                  <div className="space-y-4">
                     {bracket.map(m => (
                        <div key={m.id} className={`flex items-center justify-between p-4 rounded bg-white/5 border ${m.status === 'completed' ? 'opacity-50' : 'border-white/5'}`}>
                           <div className="text-xs text-secondary w-16">R{m.round_number}</div>
                           <div className="flex-1 grid grid-cols-3 gap-4 items-center">
                              <div className={`text-right font-medium ${m.winner_id === m.player_a_id ? 'text-primary' : ''}`}>{m.u1_name}</div>
                              <div className="text-center text-xs text-secondary italic">vs</div>
                              <div className={`text-left font-medium ${m.winner_id === m.player_b_id ? 'text-primary' : ''}`}>{m.u2_name}</div>
                           </div>
                           <div className="w-24 text-right">
                              {m.status === 'completed' ? (
                                <StatusBadge status="completed" size="sm" />
                              ) : (
                                <span className="text-xs text-accent">Live</span>
                              )}
                           </div>
                        </div>
                     ))}
                  </div>
               ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-secondary space-y-4">
                     <div className="text-4xl opacity-20">📊</div>
                     <p>Bracket will be generated once registration is full ({tournament.registered_count}/{tournament.bracket_size})</p>
                  </div>
               )}
            </div>
         </div>

         {/* Sidebar: Players & Rules */}
         <div className="space-y-6">
            <div className="card glass">
               <h3 className="heading-sm mb-4">Participants ({tournament.participants?.length})</h3>
               <div className="space-y-3">
                  {tournament.participants?.map(p => (
                     <div key={p.user_id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs">
                           {p.riot_game_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="text-sm font-medium">
                           {p.riot_game_name} <span className="text-xs text-secondary">#{p.riot_tag_line}</span>
                        </div>
                     </div>
                  ))}
                  {tournament.participants?.length === 0 && <p className="text-sm text-secondary italic">No players joined yet.</p>}
               </div>
            </div>

            <div className="card glass">
               <h3 className="heading-sm mb-4">Prize Distribution</h3>
               <div className="space-y-3">
                  {Object.entries(tournament.prize_distribution || {}).map(([rank, percent]) => (
                     <div key={rank} className="flex justify-between text-sm">
                        <span className="text-secondary">{rank === '1' ? '🥇 1st Place' : rank === '2' ? '🥈 2nd Place' : rank === '3' ? '🥉 3rd Place' : `${rank}th Place`}</span>
                        <span className="font-bold text-primary">{percent}%</span>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

import api from '../lib/api';
