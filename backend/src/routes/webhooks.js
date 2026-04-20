import express from 'express';
import { query } from '../db/index.js';
import { settleMatchPayment } from '../services/x402.js';

const router = express.Router();

/**
 * Validates UUID format
 */
function isValidUUID(uuid) {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

// ── POST /webhooks/riot/result ────────────────────────────────────────────────
// Riot Tournament API fires an HTTP POST to this endpoint when a tournament
// code game completes. We MUST always return 200, even for ignored events.
//
// Security:
//  - Validate metaData field contains a known internal match_id
//  - Look up shortCode OR metaData in matches table
//  - Trigger Soroban release ONLY after callback is validated
//
// Phase 3: Full settlement logic implemented here.

router.post('/riot/result', async (req, res) => {
  // Always return 200 immediately — Riot retries on non-200 responses
  res.status(200).json({ received: true });

  try {
    // Parse body (raw buffer from express.raw middleware)
    let payload;
    try {
      payload = JSON.parse(req.body.toString());
    } catch {
      console.warn('[Riot Callback] Failed to parse body — ignoring');
      return;
    }

    const { shortCode, metaData, winnersTeam, teams, gameId } = payload;

    console.log(`[Riot Callback] Received result:`);
    console.log(`  shortCode: ${shortCode}`);
    console.log(`  metaData (match_id): ${metaData}`);
    console.log(`  winnersTeam: ${winnersTeam}`);
    console.log(`  gameId: ${gameId}`);

    // 1. Validate metaData contains a valid match_id (UUID format)
    if (!metaData || !isValidUUID(metaData)) {
      console.warn('[Riot Callback] Invalid metaData — ignoring');
      return;
    }

    // 2. Look up match — use shortCode OR metaData
    // Check 1v1 matches first
    const matchResult = await query(
      `SELECT m.*, u.stellar_address as winner_stellar_address
       FROM matches m
       LEFT JOIN users u ON m.winner_id = u.user_id
       WHERE m.tournament_code = $1 OR m.match_id::text = $2`,
      [shortCode, metaData]
    );

    if (matchResult.rows.length > 0) {
      const match = matchResult.rows[0];
      if (match.status === 'completed') {
        console.warn(`[Riot Callback] Match ${match.match_id} already completed — ignoring duplicate`);
        return;
      }

      // Handle 1v1 settlement (already implemented)
      const winnerTeam = teams.find(t => t.teamId === winnersTeam);
      const winnerPuuid = winnerTeam?.players[0]?.puuid;
      const winnerUser = await query('SELECT user_id, stellar_address FROM users WHERE riot_puuid = $1', [winnerPuuid]);
      
      if (winnerUser.rows.length) {
        const winnerId = winnerUser.rows[0].user_id;
        const winnerAddress = winnerUser.rows[0].stellar_address;

        await query(
          'UPDATE matches SET winner_id = $1, winner_puuid = $2, riot_match_id = $3 WHERE match_id = $4',
          [winnerId, winnerPuuid, gameId?.toString(), match.match_id]
        );

        await settleMatchPayment({ 
          matchId: match.match_id, 
          winnerAddress: winnerAddress,
          amountUsdc: match.stake_amount 
        });
      }
      return;
    }

    // ─────────────────────────────────────────────────────────────────
    // Phase 4: Handle Tournament Match Result
    // ─────────────────────────────────────────────────────────────────
    const tMatchResult = await query(
      `SELECT tm.*, t.challonge_tournament_id, t.tournament_id
       FROM tournament_matches tm
       JOIN tournaments t ON tm.tournament_id = t.tournament_id
       WHERE tm.tournament_code = $1 OR tm.id::text = $2`,
      [shortCode, metaData]
    );

    if (tMatchResult.rows.length > 0) {
      const tm = tMatchResult.rows[0];
      if (tm.status === 'completed') return;

      const winnerTeam = teams.find(t => t.teamId === winnersTeam);
      const winnerPuuid = winnerTeam?.players[0]?.puuid;
      const winnerUser = await query('SELECT user_id FROM users WHERE riot_puuid = $1', [winnerPuuid]);
      
      if (winnerUser.rows.length) {
        const winnerId = winnerUser.rows[0].user_id;

        // 1. Update internal match
        await query(
          'UPDATE tournament_matches SET status = $1, winner_id = $2, riot_match_id = $3, completed_at = NOW() WHERE id = $4',
          ['completed', winnerId, gameId?.toString(), tm.id]
        );

        // 2. Advance Challonge bracket
        const winnerTP = await query(
          'SELECT challonge_participant_id FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2',
          [tm.tournament_id, winnerId]
        );

        if (winnerTP.rows.length) {
           const cpId = winnerTP.rows[0].challonge_participant_id;
           await challonge.reportMatchResult(tm.challonge_tournament_id, tm.challonge_match_id, cpId);
           console.log(`[Tournament] Match ${tm.id} completed. Advanced Challonge bracket.`);
        }
      }
    }

  } catch (err) {
    // Never throw — just log. Response was already sent.
    console.error('[Riot Callback] Processing error:', err.message);
  }
});

// ── POST /webhooks/riot/simulate ──────────────────────────────────────────────
// Development only — simulate a Riot callback for a given match.
// Body: { matchId, winnerPuuid, loserPuuid }

router.post('/riot/simulate', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  const { matchId, winnerPuuid, loserPuuid } = req.body;

  if (!matchId || !winnerPuuid || !loserPuuid) {
    return res.status(400).json({ error: 'matchId, winnerPuuid, and loserPuuid required' });
  }

  // Get match
  const matchResult = await query(
    'SELECT tournament_code FROM matches WHERE match_id = $1',
    [matchId]
  );

  if (!matchResult.rows.length) {
    return res.status(404).json({ error: 'Match not found' });
  }

  const { simulateCallback } = await import('../services/riot.js');
  const payload = simulateCallback(matchId, matchResult.rows[0].tournament_code, winnerPuuid, loserPuuid);

  // Fire to our own webhook handler (local)
  console.log(`[Riot SIM] Simulating callback for match ${matchId}`);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  res.json({ message: 'Simulation payload generated', payload });
});

export default router;
