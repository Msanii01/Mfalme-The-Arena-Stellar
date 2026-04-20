import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tournaments } from '../lib/api';
import StatusBadge from '../components/StatusBadge';

export default function MyTournaments() {
  const navigate = useNavigate();
  const [data, setData] = useState({ hosting: [], competing: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('competing');

  useEffect(() => {
    const fetchMyTournaments = async () => {
      try {
        const resp = await tournaments.getMy();
        setData(resp);
      } catch (err) {
        console.error('Failed to fetch personal tournaments:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMyTournaments();
  }, []);

  if (loading) return <div className="loading">Retrieving Arena Schedules...</div>;

  const list = activeTab === 'competing' ? data.competing : data.hosting;

  return (
    <div className="fade-in space-y-8">
      <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="page-title">Personal Bracket Board</h1>
          <p className="page-subtitle">Manage the events you are competing in or hosting.</p>
        </div>
        <div className="flex bg-white/5 p-1 rounded-lg">
           <button 
             className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'competing' ? 'bg-primary text-white shadow-lg' : 'text-secondary hover:text-white'}`}
             onClick={() => setActiveTab('competing')}
           >
             Competing
           </button>
           <button 
             className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'hosting' ? 'bg-accent text-white shadow-lg' : 'text-secondary hover:text-white'}`}
             onClick={() => setActiveTab('hosting')}
           >
             Hosting
           </button>
        </div>
      </div>

      <div className="space-y-4">
        {list.length > 0 ? (
           list.map(t => (
             <div 
               key={t.tournament_id} 
               className="card glass flex flex-col md:flex-row items-center justify-between p-6 hover:bg-white/5 cursor-pointer transition-all border-l-4 border-white/10"
               onClick={() => navigate(`/tournaments/${t.tournament_id}`)}
             >
               <div className="flex flex-col md:flex-row md:items-center gap-6 flex-1">
                 <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-xl shrink-0">
                    {activeTab === 'competing' ? '🛡️' : '👑'}
                 </div>
                 
                 <div>
                   <div className="font-bold text-lg uppercase italic tracking-tighter">{t.name}</div>
                   <div className="text-xs text-secondary mt-1 uppercase tracking-tighter">
                      Size: {t.bracket_size} Players • Prize: ${Number(t.prize_pool)} USDC
                   </div>
                 </div>
               </div>

               <div className="flex items-center gap-12 mt-4 md:mt-0">
                 <div className="text-center">
                   <div className="text-xs text-secondary uppercase mb-1">Participants</div>
                   <div className="font-bold">{t.registered_count} / {t.bracket_size}</div>
                 </div>

                 <div className="text-center w-24">
                    <StatusBadge status={t.status} size="sm" />
                 </div>
                 
                 <button className="btn btn-ghost btn-sm hidden md:block">Launch Terminal</button>
               </div>
             </div>
           ))
        ) : (
           <div className="card glass py-24 text-center">
              <div className="text-6xl mb-6 opacity-20">{activeTab === 'competing' ? '⚔️' : '🏘️'}</div>
              <h2 className="heading">No Active Events</h2>
              <p className="text-secondary mb-8">
                {activeTab === 'competing' 
                  ? "You haven't registered for any tournaments yet." 
                  : "You are not hosting any prize pools."}
              </p>
              <button 
                onClick={() => navigate(activeTab === 'competing' ? '/tournaments' : '/tournaments/host')} 
                className={activeTab === 'competing' ? "btn btn-primary" : "btn btn-accent"}
              >
                {activeTab === 'competing' ? "View Tournament Lobby" : "Host New Tournament"}
              </button>
           </div>
        )}
      </div>
    </div>
  );
}
