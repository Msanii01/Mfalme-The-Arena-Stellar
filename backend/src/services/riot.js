import axios from 'axios';

// ── Mode detection ────────────────────────────────────────────────────────────
const RIOT_API_KEY = process.env.RIOT_API_KEY;
const RIOT_REGION_CLUSTER = process.env.RIOT_REGION_CLUSTER || 'americas';

export const SIMULATION_MODE = !RIOT_API_KEY;

if (SIMULATION_MODE) {
  console.log('🔵  Riot service: SIMULATION mode active. Set RIOT_API_KEY to use real Riot API.');
} else {
  console.log('✅  Riot service: Real API mode. Using cluster:', RIOT_REGION_CLUSTER);
}

// ── Riot API client ───────────────────────────────────────────────────────────
const riotAxios = axios.create({
  headers: { 'X-Riot-Token': RIOT_API_KEY || '' },
  timeout: 10000,
});

// ── Simulation helpers ────────────────────────────────────────────────────────

/**
 * Generate a deterministic fake PUUID from gameName + tagLine.
 * Same inputs always produce same output — stable across restarts.
 */
function simulatePuuid(gameName, tagLine) {
  const seed = `${gameName.toLowerCase()}#${tagLine.toLowerCase()}`;

  // Simple deterministic hash → hex string
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h2 = Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  const combined = (h1 ^ h2) >>> 0;

  const part = combined.toString(16).padStart(8, '0');
  const part2 = (combined * 16807).toString(16).padStart(8, '0').slice(0, 8);
  const part3 = (combined * 48271).toString(16).padStart(8, '0').slice(0, 8);

  return `sim-${part}-${part.slice(0, 4)}-${part2.slice(0, 4)}-${part3.slice(0, 4)}-${part}${part2}${part3}`.slice(0, 78);
}

function simulateTournamentCode(matchId) {
  const suffix = matchId.replace(/-/g, '').toUpperCase().slice(0, 12);
  return `SIM-MFALME-${suffix.slice(0, 4)}-${suffix.slice(4, 8)}-${suffix.slice(8, 12)}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve a Riot ID (gameName + tagLine) to a permanent PUUID.
 * Simulation mode: returns a deterministic fake PUUID — same input always = same PUUID.
 */
export async function getPuuidByRiotId(gameName, tagLine) {
  if (SIMULATION_MODE) {
    console.log(`[Riot SIM] Resolving PUUID for ${gameName}#${tagLine}`);
    return {
      puuid: simulatePuuid(gameName, tagLine),
      gameName,
      tagLine,
      simulated: true,
    };
  }

  const url = `https://${RIOT_REGION_CLUSTER}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;

  try {
    const { data } = await riotAxios.get(url);
    return { ...data, simulated: false };
  } catch (err) {
    if (err.response?.status === 404) {
      throw Object.assign(new Error(`Riot account "${gameName}#${tagLine}" not found`), { status: 404 });
    }
    if (err.response?.status === 403) {
      throw Object.assign(new Error('Riot API key is invalid or expired'), { status: 503 });
    }
    if (err.response?.status === 429) {
      throw Object.assign(new Error('Riot API rate limit exceeded — try again shortly'), { status: 429 });
    }
    throw Object.assign(new Error(`Riot API error: ${err.message}`), { status: 502 });
  }
}

/**
 * Register the tournament provider (one-time setup).
 * Called via: node scripts/riot-setup.js provider
 */
export async function registerProvider(callbackUrl, region = 'AMERICAS') {
  if (SIMULATION_MODE) {
    console.log('[Riot SIM] Registering provider → returning fake providerId: 99999');
    return { providerId: 99999, simulated: true };
  }

  const { data } = await riotAxios.post(
    `https://${RIOT_REGION_CLUSTER}.api.riotgames.com/lol/tournament/v5/providers`,
    { region: region.toUpperCase(), url: callbackUrl }
  );
  return { providerId: data, simulated: false };
}

/**
 * Register a tournament (per event or per day).
 * Called via: node scripts/riot-setup.js tournament
 */
export async function registerTournament(providerId, name = 'Mfalme 1v1 Wager Pool') {
  if (SIMULATION_MODE) {
    console.log('[Riot SIM] Registering tournament → returning fake tournamentId: 88888');
    return { tournamentId: 88888, simulated: true };
  }

  const { data } = await riotAxios.post(
    `https://${RIOT_REGION_CLUSTER}.api.riotgames.com/lol/tournament/v5/tournaments`,
    { providerId: Number(providerId), name }
  );
  return { tournamentId: data, simulated: false };
}

/**
 * Generate a Tournament Code for a 1v1 match.
 * INVARIANT: Only called after both players' USDC is locked in Soroban escrow.
 *
 * @param {string} matchId   Internal Mfalme match UUID — embedded in metadata
 * @param {string} puuidA    Player A's Riot PUUID
 * @param {string} puuidB    Player B's Riot PUUID
 * @returns {string}         The tournament code string
 */
export async function generateTournamentCode(matchId, puuidA, puuidB) {
  if (SIMULATION_MODE) {
    const code = simulateTournamentCode(matchId);
    console.log(`[Riot SIM] Generated tournament code: ${code}`);
    return { code, simulated: true };
  }

  const tournamentId = process.env.RIOT_TOURNAMENT_ID;
  if (!tournamentId) {
    throw Object.assign(
      new Error('RIOT_TOURNAMENT_ID not set. Run: node scripts/riot-setup.js tournament'),
      { status: 503 }
    );
  }

  const url = `https://${RIOT_REGION_CLUSTER}.api.riotgames.com/lol/tournament/v5/codes?count=1&tournamentId=${tournamentId}`;

  const { data } = await riotAxios.post(url, {
    mapType: 'SUMMONERS_RIFT',
    pickType: 'TOURNAMENT_DRAFT',
    spectatorType: 'ALL',
    teamSize: 1,
    allowedSummonerIds: [puuidA, puuidB],
    metadata: matchId,  // Embed internal match_id — used for callback validation
  });

  return { code: data[0], simulated: false };
}

/**
 * Simulate a Riot callback for a match (development/testing only).
 * Useful for integration testing end-to-end without playing a real game.
 */
export function simulateCallback(matchId, tournamentCode, winnerPuuid, loserPuuid) {
  return {
    startTime: Date.now(),
    shortCode: tournamentCode,
    metaData: matchId,
    region: 'NA1',
    gameId: Math.floor(Math.random() * 9000000) + 1000000,
    gameName: `teambuilder-match-${Date.now()}`,
    gameType: 'MATCHED',
    gameMap: 11,
    gameMode: 'CLASSIC',
    winnersTeam: 'TEAM1',
    losersTeam: 'TEAM2',
    teams: [
      { teamId: 'TEAM1', players: [{ summonerId: 'sim_summoner_1', puuid: winnerPuuid }] },
      { teamId: 'TEAM2', players: [{ summonerId: 'sim_summoner_2', puuid: loserPuuid }] },
    ],
  };
}
