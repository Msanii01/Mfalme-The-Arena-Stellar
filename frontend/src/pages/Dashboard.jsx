import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { auth, matches, wallet } from '../lib/api';
import { getStellarAddress, getUserEmail } from '../lib/privy.js';
import StatusBadge from '../components/StatusBadge';

export default function Dashboard() {
  const { mfalmeUser } = useOutletContext();
  const { user } = usePrivy();
  const navigate = useNavigate();

  const [stats, setStats] = useState({ wins: 0, losses: 0, total_earned: 0, active_count: 0 });
  const [activeMatches, setActiveMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, historyData] = await Promise.all([
          auth.getDashboardStats(),
          matches.getHistory()
        ]);
        setStats(statsData);
        setActiveMatches(historyData.filter(m => ['pending', 'accepted', 'active'].includes(m.status)));
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatUsdc = (amount) => {
    return Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleLinkRiot = () => navigate('/account');

  if (loading) return <div className="loading">Syncing Arena Profile...</div>;

  return (
    <div className="fade-in space-y-8">
      {/* ── Header ── */}
      <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Arena Command</h1>
          <p className="page-subtitle">Welcome back, <span className="text-primary font-bold">{mfalmeUser?.riotGameName || 'Player'}</span>. The Arena awaits.</p>
        </div>

        <div className="flex gap-3">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/wallet')}>
            Manage Wallet
          </button>
          {!mfalmeUser?.riotLinked && (
            <button className="btn btn-primary btn-sm" onClick={handleLinkRiot}>
              Link Riot ID
            </button>
          )}
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card glass p-6 border-l-4 border-primary">
          <div className="text-secondary text-xs uppercase tracking-widest mb-1">Total Earnings</div>
          <div className="text-3xl font-black text-primary">${formatUsdc(stats.total_earned)}</div>
          <div className="text-[10px] text-secondary mt-1">LIFETIME REVENUE (USDC)</div>
        </div>

        <div className="card glass p-6">
          <div className="text-secondary text-xs uppercase tracking-widest mb-1">Win Rate</div>
          <div className="text-3xl font-black">
            {stats.wins + stats.losses > 0 
              ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) 
              : 0}%
          </div>
          <div className="text-[10px] text-secondary mt-1">{stats.wins} W / {stats.losses} L</div>
        </div>

        <div className="card glass p-6 border-l-4 border-accent">
          <div className="text-secondary text-xs uppercase tracking-widest mb-1">Active Battles</div>
          <div className="text-3xl font-black text-accent">{stats.active_count}</div>
          <div className="text-[10px] text-secondary mt-1">LIVE WAGERS & TOURNAMENTS</div>
        </div>

        <div className="card glass p-6">
          <div className="text-secondary text-xs uppercase tracking-widest mb-1">Rank</div>
          <div className="text-3xl font-black italic">ARENA INITIATE</div>
          <div className="text-[10px] text-secondary mt-1">PLATFORM TIER</div>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Live Engagements */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
             <h2 className="heading text-xl">Active Engagements</h2>
             <button className="text-primary text-xs hover:underline" onClick={() => navigate('/challenge')}>New Challenge →</button>
          </div>

          <div className="space-y-4">
             {activeMatches.length > 0 ? (
                activeMatches.map(m => (
                  <div 
                    key={m.match_id} 
                    className="card glass flex items-center justify-between p-5 hover:bg-white/5 cursor-pointer transition-colors"
                    onClick={() => navigate(`/matches/${m.match_id}`)}
                  >
                    <div className="flex items-center gap-4">
                       <div className="font-bold text-lg">{m.u1_name} <span className="text-accent text-xs italic">vs</span> {m.u2_name}</div>
                    </div>
                    <div className="flex items-center gap-6">
                       <div className="text-right">
                          <div className="text-xs text-secondary mb-1">Stake</div>
                          <div className="font-bold text-primary">${m.stake_amount}</div>
                       </div>
                       <StatusBadge status={m.status} />
                    </div>
                  </div>
                ))
             ) : (
                <div className="card glass py-12 text-center opacity-70">
                   <div className="text-4xl mb-4 text-secondary/30">⚔️</div>
                   <p className="text-secondary text-sm">No live battles currently on your scope.</p>
                   {!mfalmeUser?.riotLinked && (
                     <p className="text-xs text-red-400 mt-2">Link your Riot ID to start competing!</p>
                   )}
                </div>
             )}
          </div>
        </div>

        {/* Right Column: Wallet & Quick Look */}
        <div className="space-y-6">
           <div className="card glass bg-primary/5 border border-primary/20 p-6">
              <h3 className="heading-sm mb-4">Mfalme Wallet</h3>
              <div className="space-y-6">
                 <div>
                    <div className="text-xs text-secondary uppercase tracking-widest mb-1">Available Balance</div>
                    <div className="text-2xl font-bold font-mono text-white">${formatUsdc(mfalmeUser?.usdcBalance)} <span className="text-xs text-secondary">USDC</span></div>
                 </div>
                 <div className="flex gap-2">
                    <button className="btn btn-primary flex-1 btn-sm">Deposit</button>
                    <button className="btn btn-secondary flex-1 btn-sm">Withdraw</button>
                 </div>
              </div>
           </div>

           <div className="card glass p-6">
              <h3 className="heading-sm mb-4">Platform News</h3>
              <div className="space-y-4">
                 <div className="text-xs leading-relaxed">
                    <div className="text-accent font-bold mb-1">UPDATE: RIOT API SIMULATION</div>
                    Arena initialization complete. All matches are currently in simulation mode. 
                    Set RIOT_API_KEY to move to mainnet production.
                 </div>
                 <div className="h-[1px] bg-white/5"></div>
                 <div className="text-xs leading-relaxed">
                    <div className="text-primary font-bold mb-1">PHASE 4 ACTIVE</div>
                    Structured brackets and UGT are now live. Host your community prize pool today!
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
