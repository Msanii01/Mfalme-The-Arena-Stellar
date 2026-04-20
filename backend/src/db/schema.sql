-- ============================================================
-- MFALME ARENA — Database Schema
-- Target: Supabase PostgreSQL (pgcrypto extension available)
-- Run via: node backend/src/db/migrate.js
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUM Types ──────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE match_status AS ENUM(
    'pending',
    'accepted',
    'active',
    'completed',
    'cancelled',
    'disputed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tournament_type AS ENUM(
    'platform_run',
    'user_generated'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tournament_status AS ENUM(
    'pending',
    'registration_open',
    'in_progress',
    'completed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bracket_type AS ENUM(
    'single_elimination',
    'double_elimination',
    'round_robin',
    'swiss'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tournament_match_status AS ENUM(
    'pending',
    'active',
    'completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── users ───────────────────────────────────────────────────
-- NOTE: No password_hash — Privy handles all authentication.
-- NOTE: No manual wallet connection — Privy auto-creates Stellar wallet at signup.

CREATE TABLE IF NOT EXISTS users (
  user_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  privy_user_id      VARCHAR UNIQUE NOT NULL,        -- Privy's permanent user identifier
  email              VARCHAR,                         -- from Privy user object
  riot_game_name     VARCHAR,                         -- e.g. "Mfalme" (entered manually on MVP)
  riot_tag_line      VARCHAR,                         -- e.g. "KE1" (entered manually on MVP)
  riot_puuid         VARCHAR UNIQUE,                  -- permanent Riot ID — resolved via Account API
  stellar_address    VARCHAR,                         -- auto-created by Privy at signup — stored here
  usdc_balance       DECIMAL(18,7) DEFAULT 0,         -- platform balance in USDC (Phase 2+)
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── matches ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS matches (
  match_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_a_id        UUID REFERENCES users(user_id) ON DELETE RESTRICT,
  player_b_id        UUID REFERENCES users(user_id) ON DELETE RESTRICT,
  stake_amount       DECIMAL(18,7) NOT NULL,          -- USDC each player stakes
  status             match_status DEFAULT 'pending',
  tournament_code    VARCHAR,                         -- Riot Tournament Code — CRITICAL LINKING FIELD
  riot_match_id      VARCHAR,                         -- match ID from Riot callback
  winner_id          UUID REFERENCES users(user_id) ON DELETE RESTRICT,
  winner_puuid       VARCHAR,                         -- PUUID from Riot callback — cross-reference
  result_source      VARCHAR DEFAULT 'riot_callback',
  escrow_tx_id       VARCHAR,                         -- Soroban contract transaction reference
  settlement_tx_id   VARCHAR,                         -- x402 settlement transaction hash
  code_generated_at  TIMESTAMP WITH TIME ZONE,        -- When tournament code was sent (for 3h timeout)
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at       TIMESTAMP WITH TIME ZONE
);

-- ── tournaments ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tournaments (
  tournament_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challonge_tournament_id VARCHAR,
  tournament_type         tournament_type NOT NULL,
  host_user_id            UUID REFERENCES users(user_id) ON DELETE RESTRICT,  -- NULL for platform_run
  name                    VARCHAR NOT NULL,
  game                    VARCHAR DEFAULT 'league_of_legends',
  bracket_type            bracket_type DEFAULT 'single_elimination',
  bracket_size            INTEGER,
  entry_fee               DECIMAL(18,7) DEFAULT 0,
  prize_pool              DECIMAL(18,7) DEFAULT 0,
  prize_distribution      JSONB,                      -- {"1": 0.50, "2": 0.25, "3": 0.15, "4": 0.10}
  status                  tournament_status DEFAULT 'pending',
  escrow_tx_id            VARCHAR,
  challonge_url           VARCHAR,
  max_participants        INTEGER,
  registered_count        INTEGER DEFAULT 0,
  created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at              TIMESTAMP WITH TIME ZONE,
  completed_at            TIMESTAMP WITH TIME ZONE
);

-- ── tournament_participants ──────────────────────────────────

CREATE TABLE IF NOT EXISTS tournament_participants (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id            UUID REFERENCES tournaments(tournament_id) ON DELETE CASCADE,
  user_id                  UUID REFERENCES users(user_id) ON DELETE RESTRICT,
  challonge_participant_id VARCHAR,
  entry_fee_paid           BOOLEAN DEFAULT false,
  final_rank               INTEGER,
  prize_amount             DECIMAL(18,7),
  prize_paid               BOOLEAN DEFAULT false,
  registered_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)                      -- one registration per user per tournament
);

-- ── tournament_matches ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS tournament_matches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id       UUID REFERENCES tournaments(tournament_id) ON DELETE CASCADE,
  challonge_match_id  VARCHAR,
  round_number        INTEGER,
  player_a_id         UUID REFERENCES users(user_id) ON DELETE RESTRICT,
  player_b_id         UUID REFERENCES users(user_id) ON DELETE RESTRICT,
  tournament_code     VARCHAR,                        -- Riot Tournament Code for this bracket match
  riot_match_id       VARCHAR,                        -- from Riot callback
  winner_id           UUID REFERENCES users(user_id) ON DELETE RESTRICT,
  status              tournament_match_status DEFAULT 'pending',
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at        TIMESTAMP WITH TIME ZONE
);

-- ── Indexes ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_privy_user_id         ON users(privy_user_id);
CREATE INDEX IF NOT EXISTS idx_users_riot_puuid            ON users(riot_puuid);
CREATE INDEX IF NOT EXISTS idx_users_stellar_address       ON users(stellar_address);

CREATE INDEX IF NOT EXISTS idx_matches_player_a            ON matches(player_a_id);
CREATE INDEX IF NOT EXISTS idx_matches_player_b            ON matches(player_b_id);
CREATE INDEX IF NOT EXISTS idx_matches_tournament_code     ON matches(tournament_code);
CREATE INDEX IF NOT EXISTS idx_matches_status              ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_riot_match_id       ON matches(riot_match_id);

CREATE INDEX IF NOT EXISTS idx_tournaments_status          ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_type            ON tournaments(tournament_type);
CREATE INDEX IF NOT EXISTS idx_tournaments_host            ON tournaments(host_user_id);

CREATE INDEX IF NOT EXISTS idx_tp_tournament               ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tp_user                     ON tournament_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_tm_tournament               ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tm_tournament_code          ON tournament_matches(tournament_code);

-- ── updated_at auto-update trigger ──────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
