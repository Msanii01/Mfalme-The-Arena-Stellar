import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import { generateTournamentCode } from '../services/riot.js';
import { matchEscrow } from '../services/stellar.js';

const router = express.Router();

// Phase 3 — 1v1 match core loop endpoints
// INVARIANT: Tournament code NEVER generated until both players' USDC is locked in escrow.

/**
 * 1. Create Challenge
 * Player A creates a 1v1 wager challenge
 */
router.post('/challenge', requireAuth, async (req, res, next) => {
  try {
    const { player_b_id, stake_amount } = req.body;
    const player_a_id = req.user.internalUserId;

    if (!player_b_id || stake_amount === undefined) {
      return res.status(400).json({ error: 'Missing player_b_id or stake_amount' });
    }

    if (player_a_id === player_b_id) {
      return res.status(400).json({ error: 'You cannot challenge yourself' });
    }

    const db = getDb();
    const matchRes = await db.query(
      'INSERT INTO matches (player_a_id, player_b_id, stake_amount, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [player_a_id, player_b_id, stake_amount, 'pending']
    );

    res.status(201).json(matchRes.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * 2. Accept Challenge
 * Player B accepts a pending challenge
 */
router.post('/:id/accept', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const player_b_id = req.user.internalUserId;

    const db = getDb();
    const matchRes = await db.query('SELECT * FROM matches WHERE match_id = $1', [id]);
    
    if (matchRes.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchRes.rows[0];

    if (match.player_b_id !== player_b_id) {
      return res.status(403).json({ error: 'Only the challenged player can accept this match' });
    }

    if (match.status !== 'pending') {
      return res.status(400).json({ error: 'Match is already accepted or invalid' });
    }

    const updatedRes = await db.query(
      'UPDATE matches SET status = $1 WHERE match_id = $2 RETURNING *',
      ['accepted', id]
    );

    res.json(updatedRes.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * 3. Verify Escrow (Polling endpoint)
 * Checks if both players have deposited USDC into Soroban contract.
 * If yes, generates Riot Tournament Code and activates match.
 */
router.post('/:id/verify-escrow', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const matchRes = await db.query(`
      SELECT m.*, 
             u1.riot_puuid as puuid_a, 
             u2.riot_puuid as puuid_b 
      FROM matches m
      JOIN users u1 ON m.player_a_id = u1.user_id
      JOIN users u2 ON m.player_b_id = u2.user_id
      WHERE m.match_id = $1
    `, [id]);

    if (matchRes.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchRes.rows[0];

    if (match.status === 'active') {
      return res.json(match); // Already verified
    }

    if (match.status !== 'accepted') {
      return res.status(400).json({ error: 'Match must be accepted before verifying escrow' });
    }

    // Check Soroban Contract Balance
    const totalDeposited = await matchEscrow.getBalance(id);
    const requiredAmount = Number(match.stake_amount) * 2;

    // Convert to BigInt if needed or handle precisely. 
    // matchEscrow.getBalance returns native number/BigInt depending on SDK
    if (Number(totalDeposited) >= requiredAmount) {
      console.log(`[Match ${id}] Escrow verified. Generating Riot code...`);

      // Both players have deposited. Generate Riot Tournament Code.
      const { code } = await generateTournamentCode(id, match.puuid_a, match.puuid_b);

      const activeRes = await db.query(
        'UPDATE matches SET status = $1, tournament_code = $2, code_generated_at = NOW() WHERE match_id = $3 RETURNING *',
        ['active', code, id]
      );

      return res.json(activeRes.rows[0]);
    }

    res.json({ 
      status: match.status, 
      deposited: totalDeposited, 
      required: requiredAmount,
      is_ready: false 
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 4. Get Match Details
 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const matchRes = await db.query(`
      SELECT m.*, 
             u1.riot_game_name as u1_name, u1.riot_tag_line as u1_tag,
             u2.riot_game_name as u2_name, u2.riot_tag_line as u2_tag
      FROM matches m
      JOIN users u1 ON m.player_a_id = u1.user_id
      JOIN users u2 ON m.player_b_id = u2.user_id
      WHERE m.match_id = $1
    `, [id]);

    if (matchRes.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json(matchRes.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * 5. Match History
 */
router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.internalUserId;
    const db = getDb();

    const matchesRes = await db.query(`
      SELECT m.*, 
             u1.riot_game_name as u1_name, u1.riot_tag_line as u1_tag,
             u2.riot_game_name as u2_name, u2.riot_tag_line as u2_tag
      FROM matches m
      JOIN users u1 ON m.player_a_id = u1.user_id
      JOIN users u2 ON m.player_b_id = u2.user_id
      WHERE m.player_a_id = $1 OR m.player_b_id = $1
      ORDER BY m.created_at DESC
    `, [userId]);

    res.json(matchesRes.rows);
  } catch (err) {
    next(err);
  }
});

export default router;
