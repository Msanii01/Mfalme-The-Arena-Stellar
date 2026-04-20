import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import * as challonge from '../services/challonge.js';
import { ugtPrizePool } from '../services/stellar.js';

const router = express.Router();

/**
 * 1. Create Platform Tournament (Admin)
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, entry_fee, prize_pool, bracket_size } = req.body;
    const db = getDb();

    // Create on Challonge first
    const { challongeTournamentId, challongeUrl } = await challonge.createTournament({
      name,
      maxParticipants: bracket_size
    });

    const result = await db.query(
      `INSERT INTO tournaments (name, tournament_type, entry_fee, prize_pool, bracket_size, challonge_tournament_id, challonge_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, 'platform_run', entry_fee, prize_pool, bracket_size, challongeTournamentId, challongeUrl, 'registration_open']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * 2. List Tournaments
 */
router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const result = await db.query('SELECT * FROM tournaments ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * 3. Host User-Generated Tournament (UGT)
 * Step 1: Create record and get Deposit XDR
 */
router.post('/host', requireAuth, async (req, res, next) => {
  try {
    const { name, prize_pool, prize_distribution, bracket_size } = req.body;
    const host_id = req.user.internalUserId;
    const db = getDb();

    // Get user stellar address
    const userRes = await db.query('SELECT stellar_address FROM users WHERE user_id = $1', [host_id]);
    const hostAddress = userRes.rows[0].stellar_address;

    if (!hostAddress) return res.status(400).json({ error: 'No Stellar wallet linked' });

    // Create pending tournament record
    const result = await db.query(
      `INSERT INTO tournaments (name, tournament_type, host_user_id, prize_pool, prize_distribution, bracket_size, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, 'user_generated', host_id, prize_pool, prize_distribution, bracket_size, 'pending']
    );

    const tournament = result.rows[0];

    // Generate Soroban Deposit XDR
    const xdr = await ugtPrizePool.buildHostDepositTx(
      tournament.tournament_id,
      hostAddress,
      prize_pool,
      prize_distribution
    );

    res.status(201).json({ tournament, xdr });
  } catch (err) {
    next(err);
  }
});

/**
 * 4. Verify UGT Deposit Polling
 */
router.post('/:id/verify-deposit', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const tRes = await db.query('SELECT * FROM tournaments WHERE tournament_id = $1', [id]);
    const t = tRes.rows[0];

    if (t.status !== 'pending') return res.json(t);

    const balance = await ugtPrizePool.getBalance(id);
    if (Number(balance) >= Number(t.prize_pool)) {
      // Activate on Challonge
      const { challongeTournamentId, challongeUrl } = await challonge.createTournament({
        name: t.name,
        maxParticipants: t.bracket_size
      });

      const updated = await db.query(
        'UPDATE tournaments SET status = $1, challonge_tournament_id = $2, challonge_url = $3 WHERE tournament_id = $4 RETURNING *',
        ['registration_open', challongeTournamentId, challongeUrl, id]
      );
      return res.json(updated.rows[0]);
    }

    res.json({ status: 'pending', current_balance: balance });
  } catch (err) {
    next(err);
  }
});

/**
 * 5. Register for Tournament
 */
router.post('/:id/register', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const user_id = req.user.internalUserId;
    const db = getDb();

    // 1. Checks
    const tRes = await db.query('SELECT * FROM tournaments WHERE tournament_id = $1', [id]);
    const t = tRes.rows[0];

    if (t.status !== 'registration_open') return res.status(400).json({ error: 'Registration is not open' });
    if (t.registered_count >= t.bracket_size) return res.status(400).json({ error: 'Tournament is full' });

    // 2. Add to participant table
    await db.query(
      'INSERT INTO tournament_participants (tournament_id, user_id, entry_fee_paid) VALUES ($1, $2, $3)',
      [id, user_id, true]
    );

    // 3. Update count
    const updatedRes = await db.query(
      'UPDATE tournaments SET registered_count = registered_count + 1 WHERE tournament_id = $1 RETURNING *',
      [id]
    );

    const updatedT = updatedRes.rows[0];

    // 4. If full, Start Tournament
    if (updatedT.registered_count === updatedT.bracket_size) {
      // Fetch all participants
      const pRes = await db.query(`
        SELECT tp.*, u.riot_game_name, u.riot_tag_line 
        FROM tournament_participants tp 
        JOIN users u ON tp.user_id = u.user_id 
        WHERE tp.tournament_id = $1`, [id]);

      const participants = pRes.rows.map(p => ({
        name: `${p.riot_game_name}#${p.riot_tag_line}`,
        user_id: p.user_id
      }));

      // Add to Challonge
      const cParticipants = await challonge.addParticipants(t.challonge_tournament_id, participants);

      // Store challonge IDs back to tp table
      for (const cp of cParticipants) {
        await db.query(
          'UPDATE tournament_participants SET challonge_participant_id = $1 WHERE tournament_id = $2 AND user_id = $3',
          [cp.challongeParticipantId, id, cp.user_id]
        );
      }

      // Start bracket
      await challonge.startTournament(t.challonge_tournament_id);
      
      await db.query('UPDATE tournaments SET status = $1, started_at = NOW() WHERE tournament_id = $2', ['in_progress', id]);
    }

    res.json(updatedT);
  } catch (err) {
    next(err);
  }
});

/**
 * 6. My Tournaments (Competing and Hosting)
 */
router.get('/my', requireAuth, async (req, res, next) => {
  try {
    const user_id = req.user.internalUserId;
    const db = getDb();

    // Hosting
    const hosting = await db.query('SELECT * FROM tournaments WHERE host_user_id = $1', [user_id]);

    // Competing
    const competing = await db.query(`
      SELECT t.* 
      FROM tournaments t
      JOIN tournament_participants tp ON t.tournament_id = tp.tournament_id
      WHERE tp.user_id = $1
    `, [user_id]);

    res.json({ hosting: hosting.rows, competing: competing.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * 7. Sync Matches from Challonge
 * Fetches "open" matches from Challonge, generates Riot codes, and stores in tournament_matches.
 */
async function syncTournamentMatches(tournamentId) {
  const db = getDb();
  const tRes = await db.query('SELECT * FROM tournaments WHERE tournament_id = $1', [tournamentId]);
  const t = tRes.rows[0];

  if (!t.challonge_tournament_id) return;

  const openMatches = await challonge.getOpenMatches(t.challonge_tournament_id);
  const { generateTournamentCode } = await import('../services/riot.js');

  for (const om of openMatches) {
    // Check if we already have this match
    const existing = await db.query(
      'SELECT id FROM tournament_matches WHERE challonge_match_id = $1',
      [om.challongeMatchId]
    );

    if (existing.rows.length === 0) {
      // Find internal user IDs for the Challonge participant IDs
      const p1Res = await db.query('SELECT user_id, riot_puuid FROM users u JOIN tournament_participants tp ON u.user_id = tp.user_id WHERE tp.challonge_participant_id = $1', [om.p1Id]);
      const p2Res = await db.query('SELECT user_id, riot_puuid FROM users u JOIN tournament_participants tp ON u.user_id = tp.user_id WHERE tp.challonge_participant_id = $1', [om.p2Id]);
      
      const p1 = p1Res.rows[0];
      const p2 = p2Res.rows[0];

      if (p1 && p2) {
        // Generate Riot Tournament Code
        // tournament_matches.id is passed as metadata for callback
        const tempId = (await db.query('SELECT gen_random_uuid() as id')).rows[0].id;
        const { code } = await generateTournamentCode(tempId, p1.riot_puuid, p2.riot_puuid);

        await db.query(
          `INSERT INTO tournament_matches (id, tournament_id, challonge_match_id, round_number, player_a_id, player_b_id, tournament_code)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [tempId, tournamentId, om.challongeMatchId, om.round, p1.user_id, p2.user_id, code]
        );
      }
    }
  }
}

/**
 * 7. Get Tournament Bracket/Matches
 */
router.get('/:id/bracket', async (req, res, next) => {
  try {
    const { id } = req.params;
    await syncTournamentMatches(id);
    
    const db = getDb();
    const result = await db.query(`
      SELECT tm.*, 
             u1.riot_game_name as u1_name, u2.riot_game_name as u2_name,
             u1.riot_tag_line as u1_tag, u2.riot_tag_line as u2_tag
      FROM tournament_matches tm
      LEFT JOIN users u1 ON tm.player_a_id = u1.user_id
      LEFT JOIN users u2 ON tm.player_b_id = u2.user_id
      WHERE tm.tournament_id = $1
      ORDER BY tm.round_number ASC, tm.created_at ASC
    `, [id]);
    
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * 8. Get Tournament Details
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const result = await db.query('SELECT * FROM tournaments WHERE tournament_id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tournament not found' });
    
    const participants = await db.query(`
       SELECT tp.*, u.riot_game_name, u.riot_tag_line 
       FROM tournament_participants tp 
       JOIN users u ON tp.user_id = u.user_id 
       WHERE tp.tournament_id = $1`, [id]);

    res.json({ ...result.rows[0], participants: participants.rows });
  } catch (err) {
    next(err);
  }
});

export default router;
