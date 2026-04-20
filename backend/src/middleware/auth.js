import { PrivyClient } from '@privy-io/server-auth';

let privyClient = null;

function getPrivyClient() {
  if (!privyClient) {
    if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
      console.warn('⚠️  PRIVY_APP_ID or PRIVY_APP_SECRET not set — auth will reject all requests');
      return null;
    }
    privyClient = new PrivyClient(
      process.env.PRIVY_APP_ID,
      process.env.PRIVY_APP_SECRET
    );
  }
  return privyClient;
}

/**
 * Middleware: Verifies Privy auth token from Authorization header.
 * Attaches req.privyUserId on success.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing authorization header',
      hint: 'Include: Authorization: Bearer <privy-access-token>',
    });
  }

  const token = authHeader.slice(7);
  const client = getPrivyClient();

  if (!client) {
    return res.status(503).json({
      error: 'Auth service not configured',
      hint: 'Set PRIVY_APP_ID and PRIVY_APP_SECRET in .env',
    });
  }

  try {
    const verifiedClaims = await client.verifyAuthToken(token);
    req.privyUserId = verifiedClaims.userId;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Invalid or expired auth token',
      hint: 'Re-authenticate via Privy to get a fresh token',
    });
  }
}

/**
 * Optional auth — attaches privyUserId if valid token present, but does not block.
 */
export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();

  try {
    const token = authHeader.slice(7);
    const client = getPrivyClient();
    if (client) {
      const verifiedClaims = await client.verifyAuthToken(token);
      req.privyUserId = verifiedClaims.userId;
    }
  } catch {
    // Not authenticated — continue without privyUserId
  }
  next();
}
