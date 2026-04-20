import nodeCron from 'node-cron';
import { query } from '../db/index.js';
import { matchEscrow } from './stellar.js';

/**
 * Cleanup / Timeout Service
 * Runs every hour to check for matches that timed out (3 hours with no result).
 */
export function startTimeoutCron() {
  console.log('⏰  Timeout Cron: Monitoring active matches for 3-hour timeouts...');

  // Run every 30 minutes
  nodeCron.schedule('*/30 * * * *', async () => {
    console.log('[Cron] Checking for timed out matches...');
    
    try {
      // Find matches in 'active' status for more than 3 hours
      const timedOutMatches = await query(`
        SELECT match_id, player_a_id, player_b_id, stake_amount
        FROM matches
        WHERE status = 'active'
          AND code_generated_at < NOW() - INTERVAL '3 hours'
      `);

      for (const match of timedOutMatches.rows) {
        console.log(`[Cron] Match ${match.match_id} timed out. Refunding...`);

        try {
          // Get player addresses for refund
          const playersRes = await query(`
            SELECT user_id, stellar_address FROM users 
            WHERE user_id IN ($1, $2)
          `, [match.player_a_id, match.player_b_id]);

          const playerA = playersRes.rows.find(u => u.user_id === match.player_a_id);
          const playerB = playersRes.rows.find(u => u.user_id === match.player_b_id);

          if (playerA?.stellar_address && playerB?.stellar_address) {
            // Trigger on-chain refund via Soroban
            await matchEscrow.refund(match.match_id, playerA.stellar_address, playerB.stellar_address);
            console.log(`[Cron] On-chain refund triggered for match ${match.match_id}`);
          }

          // Mark as cancelled in DB
          await query(`
            UPDATE matches 
            SET status = 'cancelled', completed_at = NOW() 
            WHERE match_id = $1
          `, [match.match_id]);

          console.log(`[Cron] Match ${match.match_id} marked as cancelled.`);
        } catch (matchErr) {
          console.error(`[Cron] Failed to process refund for match ${match.match_id}:`, matchErr.message);
        }
      }
    } catch (err) {
      console.error('[Cron] Error querying timed out matches:', err.message);
    }
  });
}
