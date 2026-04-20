import { matchEscrow } from './stellar.js';
import { getDb } from '../db/index.js';

/**
 * x402 Payment Service — Phase 3
 *
 * Handles USDC settlement via the Built on Stellar x402 Facilitator.
 * (In this implementation, it wraps our matchEscrow.release logic).
 */

export async function settleMatchPayment({ matchId, winnerAddress, amountUsdc, platformFeePercent }) {
  console.log(`[x402] Settling match ${matchId} for winner ${winnerAddress}`);

  try {
    // 1. Release funds on-chain via Soroban
    const txHash = await matchEscrow.release(matchId, winnerAddress);

    // 2. Update match status in DB
    const db = getDb();
    await db.query(`
      UPDATE matches 
      SET status = 'completed', 
          settlement_tx_id = $1, 
          completed_at = NOW() 
      WHERE match_id = $2
    `, [txHash, matchId]);

    console.log(`[x402] Settlement successful. Tx: ${txHash}`);
    return txHash;
  } catch (err) {
    console.error(`[x402] Settlement failed for match ${matchId}:`, err.message);
    throw err;
  }
}

export async function distributeTournamentPrizes({ tournamentId, rankings, prizePoolUsdc, platformFeePercent }) {
  // Phase 4 implementation pending
  throw new Error('Tournament prize distribution not yet implemented');
}
