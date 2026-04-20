// Re-export Privy hooks with convenient wrappers for Mfalme Arena
// All Privy usage in the app should import from here, not directly from @privy-io/react-auth

export { usePrivy, useWallets } from '@privy-io/react-auth';

/**
 * Get the user's Stellar wallet address from Privy's linked accounts.
 * Privy creates an embedded wallet automatically on signup.
 */
export function getStellarAddress(user) {
  if (!user) return null;

  // Check linked accounts for a Stellar wallet
  // Privy tier-2 Stellar wallets appear in linkedAccounts with chainType 'stellar'
  const stellarWallet = user.linkedAccounts?.find(
    (account) =>
      account.type === 'wallet' &&
      (account.chainType === 'stellar' || account.walletClientType === 'privy')
  );

  return stellarWallet?.address || null;
}

/**
 * Get the user's email from Privy's linked accounts.
 */
export function getUserEmail(user) {
  if (!user) return null;
  const emailAccount = user.linkedAccounts?.find((a) => a.type === 'email');
  return emailAccount?.address || user.email || null;
}

/**
 * Check if user has completed onboarding (Riot ID linked).
 * Used to redirect to AccountLinking page when needed.
 */
export function needsOnboarding(mfalmeUser) {
  return mfalmeUser && !mfalmeUser.riotLinked;
}
