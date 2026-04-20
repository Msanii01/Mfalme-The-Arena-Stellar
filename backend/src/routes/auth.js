import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../db/index.js';
import { getPuuidByRiotId, SIMULATION_MODE } from '../services/riot.js';

const router = express.Router();

// ── POST /auth/privy/sync ─────────────────────────────────────────────────────
// Called immediately after user logs in via Privy on the frontend.
// Creates or updates the user record in our DB with Privy ID + Stellar address.
// Frontend sends: { email, stellarAddress }

router.post('/privy/sync', requireAuth, async (req, res, next) => {
  try {
    const { email, stellarAddress } = req.body;
    const privyUserId = req.privyUserId;

    // Check if user already exists
    const existing = await query(
      'SELECT * FROM users WHERE privy_user_id = $1',
      [privyUserId]
    );

    if (existing.rows.length > 0) {
      // Update email and stellar address if provided (these can change)
      const updates = [];
      const values = [];
      let paramIdx = 1;

      if (email) {
        updates.push(`email = $${paramIdx++}`);
        values.push(email);
      }
      if (stellarAddress) {
        updates.push(`stellar_address = $${paramIdx++}`);
        values.push(stellarAddress);
      }

      let user = existing.rows[0];

      if (updates.length > 0) {
        values.push(privyUserId);
        const result = await query(
          `UPDATE users SET ${updates.join(', ')} WHERE privy_user_id = $${paramIdx} RETURNING *`,
          values
        );
        user = result.rows[0];
      }

      return res.json({ user: sanitizeUser(user), created: false });
    }

    // Create new user
    const result = await query(
      `INSERT INTO users (privy_user_id, email, stellar_address, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [privyUserId, email || null, stellarAddress || null]
    );

    return res.status(201).json({ user: sanitizeUser(result.rows[0]), created: true });

  } catch (err) {
    next(err);
  }
});

// ── POST /auth/riot/link ──────────────────────────────────────────────────────
// Player enters their Riot ID → platform resolves PUUID → stores permanently.
// Security: One PUUID per Mfalme account — enforced here AND at DB level (UNIQUE constraint).

router.post('/riot/link', requireAuth, async (req, res, next) => {
  try {
    const { gameName, tagLine } = req.body;

    if (!gameName?.trim() || !tagLine?.trim()) {
      return res.status(400).json({
        error: 'gameName and tagLine are required',
        example: { gameName: 'Mfalme', tagLine: 'KE1' },
      });
    }

    // Validate format — gameName max 16 chars, no # in either field
    if (gameName.includes('#') || tagLine.includes('#')) {
      return res.status(400).json({
        error: 'Enter gameName and tagLine separately — do not include the # symbol',
        example: { gameName: 'Mfalme', tagLine: 'KE1' },
      });
    }

    // Resolve PUUID via Riot API (or simulation)
    let riotData;
    try {
      riotData = await getPuuidByRiotId(gameName.trim(), tagLine.trim());
    } catch (riotErr) {
      return res.status(riotErr.status || 502).json({ error: riotErr.message });
    }

    const { puuid, simulated } = riotData;

    // Find the current user
    const currentUserResult = await query(
      'SELECT user_id FROM users WHERE privy_user_id = $1',
      [req.privyUserId]
    );

    if (currentUserResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found. Call /auth/privy/sync first.',
      });
    }

    const currentUserId = currentUserResult.rows[0].user_id;

    // Check if PUUID is already linked to a DIFFERENT account
    const existingPuuid = await query(
      'SELECT user_id FROM users WHERE riot_puuid = $1',
      [puuid]
    );

    if (existingPuuid.rows.length > 0 && existingPuuid.rows[0].user_id !== currentUserId) {
      return res.status(409).json({
        error: 'This Riot account is already linked to another Mfalme account',
        code: 'PUUID_ALREADY_LINKED',
      });
    }

    // Update user with Riot info
    const result = await query(
      `UPDATE users
       SET riot_game_name = $1, riot_tag_line = $2, riot_puuid = $3
       WHERE user_id = $4
       RETURNING *`,
      [gameName.trim(), tagLine.trim(), puuid, currentUserId]
    );

    res.json({
      success: true,
      puuid,
      gameName: gameName.trim(),
      tagLine: tagLine.trim(),
      riotId: `${gameName.trim()}#${tagLine.trim()}`,
      simulated,
      user: sanitizeUser(result.rows[0]),
    });

  } catch (err) {
    // Handle DB unique constraint violation (PUUID already exists)
    if (err.code === '23505' && err.constraint === 'users_riot_puuid_key') {
      return res.status(409).json({
        error: 'This Riot account is already linked to another Mfalme account',
        code: 'PUUID_ALREADY_LINKED',
      });
    }
    next(err);
  }
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────
// Get the current user's profile.

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM users WHERE privy_user_id = $1',
      [req.privyUserId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found. Call /auth/privy/sync first.' });
    }

    res.json({
      user: sanitizeUser(result.rows[0]),
      riotMode: SIMULATION_MODE ? 'simulation' : 'real',
    });
  } catch (err) {
    next(err);
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function sanitizeUser(user) {
  // Never expose internal DB IDs or sensitive fields to frontend
  return {
    userId: user.user_id,
    email: user.email,
    riotGameName: user.riot_game_name,
    riotTagLine: user.riot_tag_line,
    riotPuuid: user.riot_puuid,
    stellarAddress: user.stellar_address,
    usdcBalance: user.usdc_balance,
    riotLinked: !!user.riot_puuid,
    createdAt: user.created_at,
  };
}

/**
 * 4. Get all users (for challenge lobby)
 */
router.get('/users', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const usersRes = await db.query(
      'SELECT user_id, privy_user_id, riot_game_name, riot_tag_line FROM users WHERE riot_puuid IS NOT NULL'
    );
    res.json(usersRes.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * 5. Dashboard Stats
 */
router.get('/dashboard-stats', requireAuth, async (req, res, next) => {
  try {
    const user_id = req.user.internalUserId;
    const db = getDb();

    // 1v1 Stats
    const statsRes = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE winner_id = $1) as wins,
        COUNT(*) FILTER (WHERE status = 'completed' AND winner_id != $1 AND (player_a_id = $1 OR player_b_id = $1)) as losses,
        SUM(stake_amount) FILTER (WHERE winner_id = $1) as total_earned,
        COUNT(*) FILTER (WHERE status IN ('pending', 'accepted', 'active')) as active_count
      FROM matches
      WHERE player_a_id = $1 OR player_b_id = $1
    `, [user_id]);

    const stats = statsRes.rows[0];

    res.json({
      wins: parseInt(stats.wins || 0),
      losses: parseInt(stats.losses || 0),
      total_earned: parseFloat(stats.total_earned || 0),
      active_count: parseInt(stats.active_count || 0)
    });
  } catch (err) {
    next(err);
  }
});

export default router;
