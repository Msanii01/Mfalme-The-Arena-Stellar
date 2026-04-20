import axios from 'axios';

// All API calls go through /api prefix — proxied to Express backend by Vite in dev
// In production, set VITE_API_URL to your Render backend URL
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// Attach Privy auth token to every request
let _getAccessToken = null;
export function setTokenProvider(getAccessToken) {
  _getAccessToken = getAccessToken;
}

api.interceptors.request.use(async (config) => {
  if (_getAccessToken) {
    try {
      const token = await _getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Token fetch failed — request proceeds without auth
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  syncPrivyUser: (data) => api.post('/auth/privy/sync', data),
  linkRiotId: (data) => api.post('/auth/riot/link', data),
  getMe: () => api.get('/auth/me'),
  getDashboardStats: () => api.get('/auth/dashboard-stats'),
};

// ── Wallet ────────────────────────────────────────────────────────────────────
export const wallet = {
  getMatchDepositXdr: (matchId, amount) => api.post('/wallet/deposit/match', { matchId, amount }),
  getBalance: () => api.get('/wallet/balance'),
};

// ── Matches ───────────────────────────────────────────────────────────────────
export const matches = {
  createChallenge: (data) => api.post('/matches/challenge', data),
  acceptChallenge: (id) => api.post(`/matches/${id}/accept`),
  verifyEscrow: (id) => api.post(`/matches/${id}/verify-escrow`),
  cancelMatch: (id) => api.post(`/matches/${id}/cancel`),
  getMatch: (id) => api.get(`/matches/${id}`),
  getHistory: () => api.get('/matches/history'),
};

// ── Tournaments ───────────────────────────────────────────────────────────────
export const tournaments = {
  list: () => api.get('/tournaments'),
  getMy: () => api.get('/tournaments/my'),
  get: (id) => api.get(`/tournaments/${id}`),
  getBracket: (id) => api.get(`/tournaments/${id}/bracket`),
  register: (id) => api.post(`/tournaments/${id}/register`),
  host: (data) => api.post('/tournaments/host', data),
  create: (data) => api.post('/tournaments', data), // admin
};

export default api;
