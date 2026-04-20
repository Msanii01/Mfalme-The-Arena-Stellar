import { getDb } from '../src/db/index.js';
import * as challonge from '../src/services/challonge.js';
import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api';

/**
 * End-to-end Tournament Flow Test
 * 1. Create a tournament (as admin or host)
 * 2. Simulate binary registration (registration count = bracket size)
 * 3. Verify tournament starts and moves to 'in_progress'
 * 4. Verify Challonge tournament creation
 */
async function testTournamentFlow() {
  console.log('🚀 Starting Tournament Flow Test...');
  
  try {
    const db = getDb();
    
    // 1. Create tournament
    const { data: tournament } = await axios.post(`${BASE_URL}/tournaments`, {
      name: 'Test Nexus Cup',
      entry_fee: 5,
      prize_pool: 100,
      bracket_size: 2 // Smallest for testing
    }, {
      headers: { Authorization: `Bearer SIM_ADMIN_TOKEN` } // Implementation assumes valid auth
    });
    
    console.log('✅ Tournament created:', tournament.tournament_id);
    console.log('🔗 Challonge URL:', tournament.challonge_url);

    // 2. Simulate Registration
    console.log('👥 Registering players...');
    
    // Manually insert participants into DB to simulate registration for 2 dummy users
    // Assuming users 1 and 2 exist from setup scripts
    const users = await db.query('SELECT user_id FROM users LIMIT 2');
    
    for (const user of users.rows) {
       await axios.post(`${BASE_URL}/tournaments/${tournament.tournament_id}/register`, {}, {
         headers: { Authorization: `Bearer SIM_TOKEN_${user.user_id}` }
       });
       console.log(`   - Player ${user.user_id} registered`);
    }

    // 3. Verify Status
    const { data: updatedT } = await axios.get(`${BASE_URL}/tournaments/${tournament.tournament_id}`);
    console.log('📊 Status after full registration:', updatedT.status);
    
    if (updatedT.status === 'in_progress') {
       console.log('✅ PASS: Tournament automatically started');
    } else {
       console.log('❌ FAIL: Tournament status is', updatedT.status);
    }

    // 4. Verify bracket matches are synced
    const { data: bracket } = await axios.get(`${BASE_URL}/tournaments/${tournament.tournament_id}/bracket`);
    console.log(`🎾 Synced Matches: ${bracket.length}`);
    if (bracket.length > 0) {
      console.log('   - Match 1:', bracket[0].u1_name, 'vs', bracket[0].u2_name);
      console.log('   - Code:', bracket[0].tournament_code);
    }

  } catch (err) {
    console.error('❌ Test failed:', err.response?.data || err.message);
  }
}

testTournamentFlow();
