import { Keypair, Contract, rpc, Networks, Operation, TransactionBuilder, Asset, StrKey } from '@stellar/stellar-sdk';
import { getDb } from '../db/index.js';

const rpcUrl = process.env.XLM_RPC_URL || 'https://soroban-testnet.stellar.org:443';
const server = new rpc.Server(rpcUrl);
const networkPassphrase = Networks.TESTNET;

const MATCH_ESCROW_ID = process.env.SOROBAN_MATCH_ESCROW_CONTRACT_ID;
const UGT_PRIZE_POOL_ID = process.env.SOROBAN_UGT_PRIZE_POOL_CONTRACT_ID;

// The platform's fee collection account (also admin of contracts)
const ADMIN_SECRET = process.env.STELLAR_ADMIN_SECRET;

/**
 * Validates Stellar address
 */
export function isValidStellarAddress(address) {
  return StrKey.isValidEd25519PublicKey(address);
}

/**
 * Escrow operations wrapper
 */
export const matchEscrow = {
  /**
   * Generates a deposit XDR payload for the frontend to sign using Privy embedding wallet
   * Since Privy triggers the user signature, we just need to build the transaction envelope.
   */
  async buildDepositTx(matchId, playerAddress, amountUsdc) {
    if (!MATCH_ESCROW_ID) throw new Error('Match escrow contract not configured');
    
    // Validate player
    if (!isValidStellarAddress(playerAddress)) throw new Error('Invalid Stellar address');

    let account;
    try {
      account = await server.getAccount(playerAddress);
    } catch(e) {
      throw new Error(`Player account ${playerAddress} not found or unfunded on Testnet`);
    }

    const contract = new Contract(MATCH_ESCROW_ID);
    
    // Build the invoke host function operation
    // For Soroban V22+ / v13 SDK: Contract.call() creates the operation
    const op = contract.call('deposit', ...[
      // In SDK v13, arguments are passed mapped to native
      matchId,
      playerAddress,
      BigInt(amountUsdc)
    ]);
    
    const tx = new TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(300)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    // Convert to base64 XDR for frontend Privy signing
    return preparedTx.toXDR();
  },

  /**
   * Release funds to winner (invoked by backend admin on match completion)
   */
  async release(matchId, winnerAddress) {
    if (!ADMIN_SECRET) throw new Error('Admin secret not configured');
    const admin = Keypair.fromSecret(ADMIN_SECRET);
    let account = await server.getAccount(admin.publicKey());

    const contract = new Contract(MATCH_ESCROW_ID);
    const op = contract.call('release', ...[
      matchId,
      winnerAddress
    ]);

    const tx = new TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(300)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    preparedTx.sign(admin);
    
    const sendResult = await server.sendTransaction(preparedTx);
    if (sendResult.status === 'ERROR') throw new Error('Failed to send release tx');

    return sendResult.hash; // backend will poll it or fire and forget
  },

  /**
   * Refund both players (invoked by cron on timeout or admin on cancellation)
   */
  async refund(matchId, playerAAddress, playerBAddress) {
    if (!ADMIN_SECRET) throw new Error('Admin secret not configured');
    const admin = Keypair.fromSecret(ADMIN_SECRET);
    let account = await server.getAccount(admin.publicKey());

    const contract = new Contract(MATCH_ESCROW_ID);
    const op = contract.call('refund', ...[
      matchId,
      playerAAddress,
      playerBAddress
    ]);

    const tx = new TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(300)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    preparedTx.sign(admin);
    
    const sendResult = await server.sendTransaction(preparedTx);
    if (sendResult.status === 'ERROR') throw new Error('Failed to send refund tx');

    return sendResult.hash;
  },

  /**
   * Simulates/reads the current balance
   */
  async getBalance(matchId) {
    if (!MATCH_ESCROW_ID) return 0;
    
    const contract = new Contract(MATCH_ESCROW_ID);
    // Since this is a view-only call, we simulate the transaction
    const op = contract.call('get_balance', ...[matchId]);
    
    // Provide a dummy sournce account for simulation
    const dummyAccount = Keypair.random().publicKey();
    const tx = new TransactionBuilder(new rpc.Account(dummyAccount, "1"), {
      fee: '100',
      networkPassphrase,
    })
    .addOperation(op)
    .setTimeout(30)
    .build();

    try {
      const response = await server.simulateTransaction(tx);
      if (response.results && response.results[0]) {
        const { scValToNative } = await import('@stellar/stellar-sdk');
        return scValToNative(response.results[0].xdr);
      }
    } catch(e) {
      console.error(e);
      return 0;
    }
    return 0;
  }
};

/**
 * UGT operations wrapper
 */
export const ugtPrizePool = {
  /**
   * Generates a deposit XDR for the UGT host to fund the prize pool
   */
  async buildHostDepositTx(tournamentId, hostAddress, amountUsdc, distribution) {
    if (!UGT_PRIZE_POOL_ID) throw new Error('UGT prize pool contract not configured');
    
    let account = await server.getAccount(hostAddress);
    const contract = new Contract(UGT_PRIZE_POOL_ID);
    
    // distribution: JSON/Map -> ScVal
    // For MVP, we'll pass it as a string or handle conversion
    const op = contract.call('deposit_prize_pool', ...[
      tournamentId,
      hostAddress,
      BigInt(amountUsdc),
      JSON.stringify(distribution) 
    ]);
    
    const tx = new TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(300)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    return preparedTx.toXDR();
  },

  /**
   * Distribute prizes to winners (invoked by backend admin on tournament finalization)
   */
  async distribute(tournamentId) {
    if (!ADMIN_SECRET) throw new Error('Admin secret not configured');
    const admin = Keypair.fromSecret(ADMIN_SECRET);
    let account = await server.getAccount(admin.publicKey());

    const contract = new Contract(UGT_PRIZE_POOL_ID);
    const op = contract.call('distribute_prizes', ...[tournamentId]);

    const tx = new TransactionBuilder(account, {
      fee: '200000',
      networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(300)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    preparedTx.sign(admin);
    
    const sendResult = await server.sendTransaction(preparedTx);
    return sendResult.hash;
  },

  async getBalance(tournamentId) {
    if (!UGT_PRIZE_POOL_ID) return 0;
    const contract = new Contract(UGT_PRIZE_POOL_ID);
    const op = contract.call('get_balance', ...[tournamentId]);
    
    const dummyAccount = Keypair.random().publicKey();
    const tx = new TransactionBuilder(new rpc.Account(dummyAccount, "1"), {
      fee: '100',
      networkPassphrase,
    })
    .addOperation(op)
    .setTimeout(30)
    .build();

    try {
      const response = await server.simulateTransaction(tx);
      if (response.results && response.results[0]) {
        const { scValToNative } = await import('@stellar/stellar-sdk');
        return scValToNative(response.results[0].xdr);
      }
    } catch(e) {
      return 0;
    }
    return 0;
  }
}
