# Mfalme The Arena

The Skill Wagering Platform for Competitive Gamers. MVP focused on League of Legends 1v1s via the Riot Tournament API, with instant USDC settlement on Stellar via Soroban and x402.

## Monorepo Structure

- `frontend/` — Vite + React + Privy SDK (Port 5173)
- `backend/` — Node.js + Express + PostgreSQL (Port 3001)
- `contracts/` — Soroban smart contracts (Phase 2+)

## Quickstart

1. Make sure you have Node 18+ installed.
2. Run `npm install` in the root (installs workspaces).
3. Copy `.env.example` to `.env` and fill in your Supabase connection string.
4. Setup the database schema in Supabase using the SQL editor.
5. Run `npm run dev` in the root to start both servers.

## Riot API & Services

The backend handles the Riot API via a service layer. If `RIOT_API_KEY` is not present in your `.env`, it will run in **Simulation Mode** (generating deterministic, fake PUUIDs and Tournament Codes for local dev).

To setup the real Riot API:

1. Add your dev key to `.env` as `RIOT_API_KEY`.
2. Run `npm run riot:provider`. Add the returned ID to `.env`.
3. Run `npm run riot:tournament`. Add the returned ID to `.env`.

> ⚠️ Note: Never commit `.env` files. The project root is set to ignore them.
