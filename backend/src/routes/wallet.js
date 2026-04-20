import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { matchEscrow } from '../services/stellar.js';
import { getDb } from '../db/index.js';

const router = Router();

/**
 * 1. Generate the Soroban Deposit Transaction Payload
 * The frontend fetches this XDR and passes it to the Privy Wallet to sign/submit
 */
router.post('/deposit/match', requireAuth, async (req, res, next) => {
  try {
    const { matchId, amount } = req.body;
    const { internalUserId } = req.user;

    const db = getDb();
    
    // Validate match exists and user is part of it
    const matchRes = await db.query('SELECT * FROM matches WHERE id = $1', [matchId]);
    if (matchRes.rows.length === 0) return res.status(404).json({ error: 'Match not found' });
    const match = matchRes.rows[0];

    const currentUserId = internalUserId;
    if (match.player1_id !== currentUserId && match.player2_id !== currentUserId) {
      return res.status(403).json({ error: 'You are not a participant in this match' });
    }

    if (match.status !== 'pending' && match.status !== 'accepted') {
      return res.status(400).json({ error: 'Match cannot receive deposits right now' });
    }

    // Get the user's stellar address
    const userRes = await db.query('SELECT stellar_address FROM users WHERE id = $1', [currentUserId]);
    const stellarAddress = userRes.rows[0].stellar_address;

    if (!stellarAddress) {
      return res.status(400).json({ error: 'No Stellar wallet linked to account' });
    }

    // Build unsigned XDR using our stellar service
    const xdr = await matchEscrow.buildDepositTx(matchId, stellarAddress, amount || match.stake_amount);

    res.json({ matchId, xdr, amount: amount || match.stake_amount });
  } catch (err) {
    next(err);
  }
});

// Mock balance route since in Phase 2 it's just reading from db, not on chain mapping yet
router.get('/balance', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const userRes = await db.query('SELECT usdc_balance FROM users WHERE id = $1', [req.user.internalUserId]);
    res.json({ balance: userRes.rows[0].usdc_balance });
  } catch(e) {
    next(e);
  }
});

export default router;
