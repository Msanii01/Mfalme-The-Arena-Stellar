import 'dotenv/config';
import { Keypair, Contract, rpc, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = join(__dirname, '..', '..', '.env');
const rpcUrl = 'https://soroban-testnet.stellar.org:443';
const server = new rpc.Server(rpcUrl);
const networkPassphrase = Networks.TESTNET;

const deployer = Keypair.random();

async function fundAccount(publicKey) {
  console.log(`Funding deployer account ${publicKey} on testnet...`);
  const response = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
  if (!response.ok) {
    throw new Error('Failed to fund deployer account.');
  }
  console.log(`Funded!`);
}

async function sendAndConfirmTransaction(server, tx) {
  const sendResult = await server.sendTransaction(tx);
  if (sendResult.status === 'ERROR') {
    throw new Error(`Transaction failed: ${JSON.stringify(sendResult)}`);
  }

  const hash = sendResult.hash;
  console.log(`  Tx sent: ${hash}. Waiting for confirmation...`);

  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const getResult = await server.getTransaction(hash);
    
    if (getResult.status === 'SUCCESS') {
      return getResult;
    } else if (getResult.status === 'FAILED') {
      throw new Error(`Transaction failed heavily: ${JSON.stringify(getResult)}`);
    } else if (getResult.status !== 'NOT_FOUND') {
      // still pending? Actually NOT_FOUND is the only pending state sometimes
    }
  }
  throw new Error("Timeout waiting for transaction confirmation.");
}

async function uploadAndDeploy(contractName, wasmPath) {
  console.log(`\n--- Deploying ${contractName} ---`);
  const wasm = readFileSync(wasmPath);

  let account = await server.getAccount(deployer.publicKey());

  console.log(`Uploading WASM...`);
  const uploadOperation = Operation.uploadContractWasm({ wasm });
  let uploadTx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase,
  })
    .addOperation(uploadOperation)
    .setTimeout(30)
    .build();

  const preparedUploadTx = await server.prepareTransaction(uploadTx);
  preparedUploadTx.sign(deployer);
  
  const sdk = await import('@stellar/stellar-sdk');
  const scValToNative = sdk.scValToNative;

  let uploadResult = await sendAndConfirmTransaction(server, preparedUploadTx);
  const wasmIdNative = scValToNative(uploadResult.returnValue);
  const wasmId = Buffer.from(wasmIdNative).toString('hex');
  console.log(`Uploaded! WASM ID: ${wasmId}`);

  account = await server.getAccount(deployer.publicKey());

  const { Address } = await import('@stellar/stellar-sdk');
  const createOperation = Operation.createCustomContract({
    address: Address.fromString(deployer.publicKey()),
    wasmHash: Buffer.from(wasmId, 'hex'),
  });

  let createTx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase,
  })
    .addOperation(createOperation)
    .setTimeout(30)
    .build();

  const preparedCreateTx = await server.prepareTransaction(createTx);
  preparedCreateTx.sign(deployer);

  let createResult = await sendAndConfirmTransaction(server, preparedCreateTx);

  const contractId = scValToNative(createResult.returnValue);

  console.log(`Deployed! Contract ID: ${contractId}`);
  return contractId;
}

function updateEnvFile(key, value) {
  try {
    let content = readFileSync(rootEnvPath, 'utf8');
    const regex = new RegExp(`^(${key}=).*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `$1${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
    writeFileSync(rootEnvPath, content);
    console.log(`Updated root .env: ${key}=${value}`);
  } catch (err) {
    console.error(`Could not update .env:`, err.message);
  }
}

async function main() {
  await fundAccount(deployer.publicKey());

  const matchEscrowPath = join(__dirname, '..', '..', 'contracts', 'target', 'wasm32-unknown-unknown', 'release', 'match_escrow.wasm');
  const ugtPrizePoolPath = join(__dirname, '..', '..', 'contracts', 'target', 'wasm32-unknown-unknown', 'release', 'ugt_prize_pool.wasm');

  try {
    readFileSync(matchEscrowPath);
  } catch(e) {
    console.error('WASM not found. Did you run `cargo build`?');
    process.exit(1);
  }

  const matchContractId = await uploadAndDeploy('match-escrow', matchEscrowPath);
  updateEnvFile('SOROBAN_MATCH_ESCROW_CONTRACT_ID', matchContractId);

  const ugtContractId = await uploadAndDeploy('ugt-prize-pool', ugtPrizePoolPath);
  updateEnvFile('SOROBAN_UGT_PRIZE_POOL_CONTRACT_ID', ugtContractId);
  
  console.log('\nDeployment completely finished!');
}

main().catch(err => {
  console.error("Runtime error:");
  console.error(err);
  process.exit(1);
});
