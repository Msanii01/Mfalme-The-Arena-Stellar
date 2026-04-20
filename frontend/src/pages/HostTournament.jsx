import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tournaments, auth } from '../lib/api';
import { usePrivy, useWallets } from '../lib/privy';

export default function HostTournament() {
  const navigate = useNavigate();
  const { user } = usePrivy();
  const { wallets } = useWallets();

  const [formData, setFormData] = useState({
    name: '',
    bracketSize: '8',
    prizePool: '100.00',
    distribution: 'top3' // Preset for MVP
  });

  const [step, setStep] = useState(1); // 1: Info, 2: Deposit, 3: Verifying
  const [createdTournament, setCreatedTournament] = useState(null);
  const [xdr, setXdr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCreateInfo = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      
      const dist = formData.distribution === 'top3' 
        ? { "1": 60, "2": 30, "3": 10 }
        : { "1": 70, "2": 30 };

      const resp = await tournaments.host({
        name: formData.name,
        prize_pool: parseFloat(formData.prizePool),
        bracket_size: parseInt(formData.bracketSize),
        prize_distribution: dist
      });

      setCreatedTournament(resp.tournament);
      setXdr(resp.xdr);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    try {
      setLoading(true);
      setError(null);

      const stellarWallet = wallets.find(w => w.chainType === 'stellar');
      if (!stellarWallet) throw new Error('Stellar wallet not found. Please relink account.');

      // Request Privy signature and submission
      console.log('Depositing prize pool via Privy...');
      await stellarWallet.sendTransaction({ xdr });

      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 3 polling
  useEffect(() => {
    let interval;
    if (step === 3 && createdTournament) {
      interval = setInterval(async () => {
        try {
          const resp = await tournaments.verifyDeposit(createdTournament.tournament_id);
          if (resp.status === 'registration_open') {
            clearInterval(interval);
            navigate(`/tournaments/${createdTournament.tournament_id}`);
          }
        } catch (e) {
          console.error('Polling failed:', e);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [step, createdTournament, navigate]);

  return (
    <div className="fade-in max-w-2xl mx-auto">
      <div className="page-header text-center">
        <h1 className="page-title">Host Arena</h1>
        <p className="page-subtitle">Standardize your community competition with an automated prize pool.</p>
      </div>

      <div className="card glass p-8 mt-8 border-primary/20">
        {step === 1 && (
          <form onSubmit={handleCreateInfo} className="space-y-6">
            <div className="form-group">
              <label className="label">Tournament Name</label>
              <input 
                type="text" 
                className="input dark w-full" 
                placeholder="e.g. Nairobi Nexus Open"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="form-group">
                <label className="label">Bracket Size</label>
                <select 
                  className="input dark w-full"
                  value={formData.bracketSize}
                  onChange={(e) => setFormData({...formData, bracketSize: e.target.value})}
                >
                  <option value="4">4 Players</option>
                  <option value="8">8 Players</option>
                  <option value="16">16 Players</option>
                </select>
              </div>
              <div className="form-group">
                <label className="label">Prize Pool (USDC)</label>
                <input 
                  type="number" 
                  className="input dark w-full"
                  min="10"
                  step="1"
                  value={formData.prizePool}
                  onChange={(e) => setFormData({...formData, prizePool: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="label">Prize Distribution</label>
              <div className="grid grid-cols-2 gap-4">
                <div 
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${formData.distribution === 'top3' ? 'border-primary bg-primary/10' : 'border-white/5 bg-white/5'}`}
                  onClick={() => setFormData({...formData, distribution: 'top3'})}
                >
                  <div className="font-bold">Top 3</div>
                  <div className="text-xs text-secondary">60% / 30% / 10%</div>
                </div>
                <div 
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${formData.distribution === 'top2' ? 'border-primary bg-primary/10' : 'border-white/5 bg-white/5'}`}
                  onClick={() => setFormData({...formData, distribution: 'top2'})}
                >
                  <div className="font-bold">Top 2</div>
                  <div className="text-xs text-secondary">70% / 30%</div>
                </div>
              </div>
            </div>

            {error && <div className="text-red-500 text-sm">{error}</div>}

            <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
              {loading ? 'Creating Draft...' : 'Next: Fund Prize Pool'}
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto text-3xl">💰</div>
            <h2 className="heading text-2xl">Deposit Prize Pool</h2>
            <p className="text-secondary">
              To activate <strong>{formData.name}</strong>, you must deposit <strong>${formData.prizePool} USDC</strong> into the Mfalme Soroban Escrow.
            </p>
            <div className="bg-black/30 p-4 rounded text-left text-sm space-y-2 border border-white/5">
              <div className="flex justify-between"><span>Tournament Type:</span> <span className="text-white">Community UGT</span></div>
              <div className="flex justify-between"><span>Contract:</span> <span className="text-primary font-mono text-xs">CD7DODG6...MUE</span></div>
              <div className="flex justify-between"><span>Wager:</span> <span className="text-white">${formData.prizePool} USDC</span></div>
            </div>
            
            {error && <div className="text-red-500 text-sm">{error}</div>}

            <div className="flex gap-4">
              <button onClick={() => setStep(1)} className="btn btn-secondary flex-1">Back</button>
              <button onClick={handleDeposit} disabled={loading} className="btn btn-primary flex-2">
                {loading ? 'Confirming...' : 'Sign & Deposit'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center py-12 space-y-6">
            <div className="animate-spin text-4xl">⚔️</div>
            <h2 className="heading text-2xl">Verifying On-Chain Deposit</h2>
            <p className="text-secondary">
              Mfalme is monitoring the Stellar Testnet for your deposit transaction.
              Once confirmed, your tournament will go live automatically.
            </p>
            <div className="text-xs text-primary font-mono animate-pulse">
              POLLING SOROBAN CONTRACT...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Add verifyDeposit to api.js tournaments object if not present
import api from '../lib/api';
const tournamentsExt = {
  ...tournaments,
  verifyDeposit: (id) => api.post(`/tournaments/${id}/verify-deposit`)
};
