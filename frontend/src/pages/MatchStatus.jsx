import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { matches, wallet } from '../lib/api';
import { usePrivy, useWallets } from '../lib/privy';
import StatusBadge from '../components/StatusBadge';
import SimulationBanner from '../components/SimulationBanner';

export default function MatchStatus() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = usePrivy();
  const { wallets } = useWallets();
  
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [depositing, setDepositing] = useState(false);
  const [polling, setPolling] = useState(true);

  const fetchMatch = useCallback(async () => {
    try {
      const data = await matches.getMatch(id);
      setMatch(data);
      
      // Stop polling if match is completed or cancelled
      if (['completed', 'cancelled'].includes(data.status)) {
        setPolling(false);
      }
    } catch (err) {
      setError(err.message);
      setPolling(false);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMatch();
    
    let interval;
    if (polling) {
      interval = setInterval(() => {
        // Only pool if match is in a state that can change
        if (match?.status !== 'completed' && match?.status !== 'cancelled') {
          if (match?.status === 'accepted') {
            // Check escrow verification
            // matches.verifyEscrow(id) will return the match if it's already active
            matches.verifyEscrow(id).then(updated => {
                if (updated.status === 'active') {
                    setMatch(updated);
                }
            }).catch(console.error);
          } else {
            fetchMatch();
          }
        }
      }, 5000);
    }
    
    return () => clearInterval(interval);
  }, [fetchMatch, polling, match?.status, id]);

  const handleDeposit = async () => {
    try {
      setDepositing(true);
      setError(null);
      
      // 1. Get XDR from backend
      const { xdr } = await wallet.getMatchDepositXdr(id);
      
      // 2. Find the Privy Stellar wallet
      const stellarWallet = wallets.find(w => w.chainType === 'stellar');
      if (!stellarWallet) {
        throw new Error('Stellar wallet not found. Please relink your account.');
      }
      
      // 3. Request signature and submission from Privy
      // x402 / Soroban deposit
      console.log('Requesting Privy signature for XDR:', xdr);
      
      // In Privy's Stellar implementation, we use sendTransaction with the XDR
      const result = await stellarWallet.sendTransaction({
        xdr: xdr
      });
      
      console.log('Transaction result:', result);
      
      // 4. Match state will update as we poll verify-escrow
      alert('Deposit submitted to network! Waiting for confirmation...');
      
    } catch (err) {
      console.error('Deposit failed:', err);
      setError(err.message || 'Failed to process deposit');
    } finally {
      setDepositing(false);
    }
  };

  if (loading) return <div className="loading">Initializing Battle Terminal...</div>;
  if (!match) return <div className="error">Match not found</div>;

  const isPlayerA = match.player_a_id === user?.id; // Note: user.id might need mapping to internal uuid
  const isPlayerB = match.player_b_id === user?.id;
  const isParticipant = isPlayerA || isPlayerB;

  return (
    <div className="fade-in space-y-6">
      {/* Simulation mode info */}
      {!match.tournament_code && <SimulationBanner mode="riot" />}

      <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Battle Terminal</h1>
          <p className="page-subtitle">Match ID: {id.slice(0, 8)}...</p>
        </div>
        <StatusBadge status={match.status} size="lg" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Match Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card glass">
            <div className="flex items-center justify-around py-8">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-4 border-2 border-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]">
                   <span className="text-2xl font-bold">P1</span>
                </div>
                <div className="font-bold text-xl">{match.u1_name}</div>
                <div className="text-secondary text-sm">#{match.u1_tag}</div>
              </div>

              <div className="text-center">
                <div className="text-4xl font-black text-accent mb-2">VS</div>
                <div className="text-primary font-bold text-2xl">${match.stake_amount}</div>
                <div className="text-secondary text-xs uppercase tracking-widest">Wager</div>
              </div>

              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-4 border-2 border-white/20">
                   <span className="text-2xl font-bold">P2</span>
                </div>
                <div className="font-bold text-xl">{match.u2_name}</div>
                <div className="text-secondary text-sm">#{match.u2_tag}</div>
              </div>
            </div>
          </div>

          {/* Action Center */}
          <div className="card glass border-primary/30">
             {match.status === 'pending' && (
                <div className="text-center py-6">
                  <h3 className="heading-sm mb-2">Waiting for Acceptance</h3>
                  <p className="text-secondary">The match has been issued. Waiting for {match.u2_name} to accept.</p>
                </div>
             )}

             {match.status === 'accepted' && (
                <div className="text-center py-6 space-y-4">
                  <h3 className="heading-sm">Next Step: Escrow Deposit</h3>
                  <p className="text-secondary">Both players must lock their ${match.stake_amount} USDC stake in the Soroban contract to activate the match.</p>
                  {isParticipant ? (
                    <button 
                      onClick={handleDeposit}
                      disabled={depositing}
                      className="btn btn-primary btn-lg"
                    >
                      {depositing ? 'Processing Transaction...' : `Deposit ${match.stake_amount} USDC`}
                    </button>
                  ) : (
                    <div className="bg-white/5 p-4 rounded text-sm">Spectating match. Waiting for deposits...</div>
                  )}
                  {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                </div>
             )}

             {match.status === 'active' && (
                <div className="p-6 space-y-6">
                   <div className="bg-accent/10 border border-accent/30 rounded-lg p-6 text-center">
                      <h3 className="text-accent font-bold uppercase tracking-tighter text-xl mb-4">Riot Tournament Code</h3>
                      <div className="bg-black/50 p-4 rounded font-mono text-2xl border border-white/10 select-all cursor-pointer shadow-inner" title="Click to copy">
                        {match.tournament_code}
                      </div>
                      <p className="text-secondary text-sm mt-4">
                        Paste this code into the <strong>"Tournament Code"</strong> tab in your League client to join the match lobby.
                      </p>
                   </div>
                   
                   <div className="flex items-center gap-4 text-sm text-secondary bg-white/5 p-4 rounded">
                      <div className="animate-pulse w-2 h-2 rounded-full bg-green-500"></div>
                      Monitoring match result from Riot... Settlement will trigger automatically.
                   </div>
                </div>
             )}

             {match.status === 'completed' && (
                <div className="p-6 text-center space-y-4">
                   <div className="text-5xl mb-2">🏆</div>
                   <h3 className="heading">Match Finalized</h3>
                   <p className="text-xl">Winner: <span className="text-primary font-bold">{match.winner_id === match.player_a_id ? match.u1_name : match.u2_name}</span></p>
                   <div className="text-sm text-secondary bg-white/5 p-3 rounded inline-block">
                      Settlement Tx: <span className="font-mono text-xs">{match.settlement_tx_id?.slice(0, 16)}...</span>
                   </div>
                </div>
             )}
          </div>
        </div>

        {/* Right Column: Timeline & Rules */}
        <div className="space-y-6">
           <div className="card glass">
              <h3 className="heading-sm mb-4">Rules of Engagement</h3>
              <ul className="space-y-3 text-sm text-secondary">
                 <li className="flex gap-2"><span>🛡️</span> <span>Draft Mode: Summoner's Rift 1v1</span></li>
                 <li className="flex gap-2"><span>🛡️</span> <span>Victory: First Blood, 100 CS, or First Tower</span></li>
                 <li className="flex gap-2"><span>🛡️</span> <span>Timeout: Matches expire 3 hours after code generation.</span></li>
                 <li className="flex gap-2"><span>🛡️</span> <span>Wager: Winners take all minus 5% platform fee.</span></li>
              </ul>
           </div>

           <div className="card glass">
              <h3 className="heading-sm mb-4">Escrow Status</h3>
              <div className="space-y-4">
                 <div className="flex justify-between text-sm">
                    <span>{match.u1_name}</span>
                    <span className="text-green-500">Locked ✅</span>
                 </div>
                 <div className="flex justify-between text-sm">
                    <span>{match.u2_name}</span>
                    <span className={match.status === 'active' || match.status === 'completed' ? 'text-green-500' : 'text-yellow-500'}>
                       {match.status === 'active' || match.status === 'completed' ? 'Locked ✅' : 'Waiting...'}
                    </span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
