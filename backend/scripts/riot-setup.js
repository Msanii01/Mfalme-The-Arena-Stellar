#!/usr/bin/env node
/**
 * MFALME ARENA — Riot Tournament Setup CLI
 *
 * Usage:
 *   node scripts/riot-setup.js provider     — Register tournament provider (one-time)
 *   node scripts/riot-setup.js tournament   — Register a tournament (per event)
 *   node scripts/riot-setup.js status       — Show current IDs from .env
 *
 * After running each command, copy the returned ID into your .env file.
 */

import 'dotenv/config';
import { registerProvider, registerTournament, SIMULATION_MODE } from '../src/services/riot.js';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '..', '.env');  // root .env

const command = process.argv[2];

if (!command) {
  console.log(`
  🏆  Mfalme Arena — Riot Tournament Setup
  ─────────────────────────────────────────
  Usage:
    node scripts/riot-setup.js provider     Register provider (one-time)
    node scripts/riot-setup.js tournament   Register tournament (per event)
    node scripts/riot-setup.js status       Show current IDs

  Note: Set RIOT_API_KEY in .env before running 'provider' or 'tournament'.
        Without RIOT_API_KEY, commands run in SIMULATION mode.
  `);
  process.exit(0);
}

function updateEnvFile(key, value) {
  try {
    let content = readFileSync(envPath, 'utf8');
    const regex = new RegExp(`^(${key}=).*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `$1${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
    writeFileSync(envPath, content);
    console.log(`  ✅  Updated .env: ${key}=${value}`);
  } catch {
    console.log(`  ℹ️   Could not auto-update .env. Add this to your .env manually:`);
    console.log(`      ${key}=${value}`);
  }
}

async function runCommand() {
  const callbackUrl = process.env.RIOT_CALLBACK_URL;
  const region = process.env.RIOT_REGION_CLUSTER || 'americas';

  console.log('');
  console.log(`  🏆  Riot Setup — Command: ${command}`);
  console.log(`  API Mode: ${SIMULATION_MODE ? '🔵 Simulation' : '✅ Real (RIOT_API_KEY set)'}`);
  console.log('');

  switch (command) {
    case 'provider': {
      if (!callbackUrl && !SIMULATION_MODE) {
        console.error('  ❌  RIOT_CALLBACK_URL must be set before registering a provider.');
        console.error('      Example: https://your-render-url.onrender.com/webhooks/riot/result');
        process.exit(1);
      }

      const url = callbackUrl || 'https://placeholder.mfalmearena.com/webhooks/riot/result';
      console.log(`  Registering provider...`);
      console.log(`  Callback URL: ${url}`);
      console.log(`  Region: ${region.toUpperCase()}`);

      const result = await registerProvider(url, region.toUpperCase());

      console.log('');
      console.log(`  ✅  Provider registered!`);
      console.log(`      providerId: ${result.providerId}`);
      if (result.simulated) console.log(`      (Simulated — add real RIOT_API_KEY for production)`);
      console.log('');

      updateEnvFile('RIOT_PROVIDER_ID', result.providerId);
      break;
    }

    case 'tournament': {
      const providerId = process.env.RIOT_PROVIDER_ID;
      if (!providerId) {
        console.error('  ❌  RIOT_PROVIDER_ID not set. Run provider command first:');
        console.error('      node scripts/riot-setup.js provider');
        process.exit(1);
      }

      console.log(`  Registering tournament...`);
      console.log(`  ProviderId: ${providerId}`);

      const result = await registerTournament(providerId, 'Mfalme 1v1 Wager Pool');

      console.log('');
      console.log(`  ✅  Tournament registered!`);
      console.log(`      tournamentId: ${result.tournamentId}`);
      if (result.simulated) console.log(`      (Simulated — add real RIOT_API_KEY for production)`);
      console.log('');

      updateEnvFile('RIOT_TOURNAMENT_ID', result.tournamentId);
      break;
    }

    case 'status': {
      console.log('  Current Riot configuration:');
      console.log(`  RIOT_API_KEY:       ${process.env.RIOT_API_KEY ? '✅ Set' : '❌ Not set (simulation mode)'}`);
      console.log(`  RIOT_PROVIDER_ID:   ${process.env.RIOT_PROVIDER_ID || '❌ Not set — run: riot-setup.js provider'}`);
      console.log(`  RIOT_TOURNAMENT_ID: ${process.env.RIOT_TOURNAMENT_ID || '❌ Not set — run: riot-setup.js tournament'}`);
      console.log(`  RIOT_CALLBACK_URL:  ${process.env.RIOT_CALLBACK_URL || '❌ Not set'}`);
      console.log(`  RIOT_REGION:        ${region}`);
      break;
    }

    default:
      console.error(`  ❌  Unknown command: ${command}`);
      console.error('      Valid commands: provider, tournament, status');
      process.exit(1);
  }
}

runCommand().catch((err) => {
  console.error(`  ❌  Error: ${err.message}`);
  process.exit(1);
});
