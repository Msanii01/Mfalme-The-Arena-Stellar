import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import walletRoutes from './routes/wallet.js';
import matchRoutes from './routes/matches.js';
import tournamentRoutes from './routes/tournaments.js';
import webhookRoutes from './routes/webhooks.js';
import { errorHandler } from './middleware/errorHandler.js';
import { testConnection } from './db/index.js';
import { startTimeoutCron } from './services/cron.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Raw body for Riot webhook validation (must come before express.json)
app.use('/webhooks', express.raw({ type: 'application/json' }));

// JSON body parsing for all other routes
app.use((req, res, next) => {
  if (req.path.startsWith('/webhooks')) return next();
  express.json()(req, res, next);
});

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    modes: {
      riot: process.env.RIOT_API_KEY ? 'real' : 'simulation',
      challonge: process.env.CHALLONGE_API_KEY ? 'real' : 'simulation',
    },
  });
});

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/wallet', walletRoutes);
app.use('/matches', matchRoutes);
app.use('/tournaments', tournamentRoutes);
app.use('/webhooks', webhookRoutes);

// ── Error handler (must be last) ────────────────────────────────────────────
app.use(errorHandler);

// ── Startup ─────────────────────────────────────────────────────────────────
async function start() {
  // Test DB connection
  await testConnection();

  app.listen(PORT, () => {
    console.log('');
    console.log('  🏆  Mfalme Arena Backend');
    console.log('  ─────────────────────────────────────────');
    console.log(`  🌐  Listening on  http://localhost:${PORT}`);
    console.log(`  🗄️   Database      ${process.env.DATABASE_URL ? '✅ Connected' : '❌ DATABASE_URL missing'}`);
    console.log(`  👁️   Riot API      ${process.env.RIOT_API_KEY ? '✅ Real mode' : '🔵 Simulation mode'}`);
    console.log(`  🏅  Challonge     ${process.env.CHALLONGE_API_KEY ? '✅ Real mode' : '🔵 Simulation mode'}`);
    console.log(`  🔐  Privy         ${process.env.PRIVY_APP_ID ? '✅ Configured' : '⚠️  PRIVY_APP_ID missing'}`);
    console.log(`  ⛓️   Soroban       ${process.env.SOROBAN_CONTRACT_ADDRESS ? '✅ Deployed' : '⏳ Phase 2'}`);
    console.log('  ─────────────────────────────────────────');
    console.log('');
  });

  // Start timeout cron job (3-hour match timeout refunds) — Phase 3
  startTimeoutCron();
}

start().catch((err) => {
  console.error('❌ Failed to start backend:', err.message);
  process.exit(1);
});

export default app;
