import axios from 'axios';

// ── Mode detection ────────────────────────────────────────────────────────────
const CHALLONGE_API_KEY = process.env.CHALLONGE_API_KEY;
const CHALLONGE_API_URL = process.env.CHALLONGE_API_URL || 'https://api.challonge.com/v2.1';

export const SIMULATION_MODE = !CHALLONGE_API_KEY;

if (SIMULATION_MODE) {
  console.log('🔵  Challonge service: SIMULATION mode. Set CHALLONGE_API_KEY to use real Challonge API.');
}

// ── Challonge API client ──────────────────────────────────────────────────────
const challongeAxios = axios.create({
  baseURL: CHALLONGE_API_URL,
  headers: {
    Authorization: CHALLONGE_API_KEY || '',
    'Content-Type': 'application/vnd.api+json',
  },
  timeout: 10000,
});

// ── Simulation state (in-memory for dev) ─────────────────────────────────────
let simTournamentCounter = 1000;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a tournament on Challonge.
 * Phase 4 — full implementation. Simulation available immediately.
 */
export async function createTournament({ name, bracketType = 'single elimination', maxParticipants = 8 }) {
  if (SIMULATION_MODE) {
    const id = `sim_tournament_${++simTournamentCounter}`;
    console.log(`[Challonge SIM] Created tournament: ${id} — "${name}"`);
    return {
      challongeTournamentId: id,
      challongeUrl: `https://challonge.com/sim/${id}`,
      simulated: true,
    };
  }

  const { data } = await challongeAxios.post('/tournaments.json', {
    data: {
      type: 'tournament',
      attributes: {
        name,
        tournament_type: bracketType,
        private: true,
        registration_options: { open_signup: false, signup_cap: maxParticipants },
      },
    },
  });

  const t = data.data;
  return {
    challongeTournamentId: t.id,
    challongeUrl: t.attributes.full_challonge_url,
    simulated: false,
  };
}

export async function addParticipants(challongeTournamentId, participants) {
  if (SIMULATION_MODE) {
    return participants.map((p, i) => ({
      ...p,
      challongeParticipantId: `sim_participant_${challongeTournamentId}_${i + 1}`,
    }));
  }

  // Participants array: [{ name: 'User#TAG', misc: 'user_id' }]
  const { data } = await challongeAxios.post(`/tournaments/${challongeTournamentId}/participants.json`, {
    data: participants.map(p => ({
      type: 'participant',
      attributes: {
        name: p.name,
        misc: p.user_id // Store internal user_id for callback mapping
      }
    }))
  });

  // Depending on whether it's bulk or single, response format varies. 
  // Let's assume we handle the return to extract IDs.
  return data.data.map(item => ({
    user_id: item.attributes.misc,
    challongeParticipantId: item.id
  }));
}

export async function startTournament(challongeTournamentId) {
  if (SIMULATION_MODE) {
    console.log(`[Challonge SIM] Started tournament: ${challongeTournamentId}`);
    return { simulated: true };
  }

  const { data } = await challongeAxios.post(`/tournaments/${challongeTournamentId}/actions/start.json`);
  return data.data;
}

export async function getOpenMatches(challongeTournamentId) {
  if (SIMULATION_MODE) {
    return [];
  }

  const { data } = await challongeAxios.get(`/tournaments/${challongeTournamentId}/matches.json`, {
    params: { 'filter[state]': 'open' }
  });

  return data.data.map(m => ({
    challongeMatchId: m.id,
    p1Id: m.relationships.player1.data?.id,
    p2Id: m.relationships.player2.data?.id,
    round: m.attributes.round
  }));
}

export async function reportMatchResult(challongeTournamentId, challongeMatchId, winnerParticipantId) {
  if (SIMULATION_MODE) {
    console.log(`[Challonge SIM] Reported result for match ${challongeMatchId}: winner is ${winnerParticipantId}`);
    return { simulated: true };
  }

  // Challonge V2 match update for result
  const { data } = await challongeAxios.put(`/tournaments/${challongeTournamentId}/matches/${challongeMatchId}.json`, {
    data: {
      type: 'match',
      attributes: {
        match_result: [
          { participant_id: winnerParticipantId, score: 1, rank: 1 }
          // In 1v1 knockout, simplicity: 1-0 win
        ]
      }
    }
  });

  return data.data;
}

export async function finalizeTournament(challongeTournamentId) {
  if (SIMULATION_MODE) {
    console.log(`[Challonge SIM] Finalizing tournament ${challongeTournamentId}`);
    return { simulated: true };
  }

  const { data } = await challongeAxios.post(`/tournaments/${challongeTournamentId}/actions/finalize.json`);
  return data.data;
}

export async function getParticipantsWithRankings(challongeTournamentId) {
  if (SIMULATION_MODE) {
    return [];
  }

  const { data } = await challongeAxios.get(`/tournaments/${challongeTournamentId}/participants.json`);
  
  return data.data.map(p => ({
    user_id: p.attributes.misc,
    rank: p.attributes.final_rank,
    challongeParticipantId: p.id
  }));
}
