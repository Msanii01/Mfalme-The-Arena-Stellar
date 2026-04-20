import { usePrivy } from '@privy-io/react-auth';

const features = [
  { icon: '⚔️', title: '1v1 Wager Matches', desc: 'Challenge any player. Stake USDC. Winner takes all — automatically.' },
  { icon: '🏆', title: 'Platform Tournaments', desc: 'Compete in structured brackets with real prize pools on the line.' },
  { icon: '👑', title: 'Host Your Own', desc: 'Deposit a prize pool, run a tournament. No trust required — it\'s all on-chain.' },
];

export default function Login() {
  const { login, ready } = usePrivy();

  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', overflow: 'hidden' }}>
      {/* ── Animated background ── */}
      <div className="hero-bg">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />
        <div className="hero-grid" />
      </div>

      {/* ── Left panel — Hero ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '64px 80px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '64px' }}>
          <span style={{ fontSize: '40px', filter: 'drop-shadow(0 0 16px rgba(245,166,35,0.8))', animation: 'float 3s ease-in-out infinite' }}>
            👑
          </span>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '28px',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              background: 'var(--gradient-gold-text)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'shimmer 4s linear infinite',
            }}>
              MFALME
            </div>
            <div style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
              The Arena
            </div>
          </div>
        </div>

        {/* Hero text */}
        <h1 className="display-xl" style={{ maxWidth: '600px', marginBottom: '24px' }}>
          The Skill Wagering{' '}
          <span className="text-gold">Arena</span>{' '}
          for Competitive Gamers
        </h1>

        <p className="body-lg" style={{ color: 'var(--text-secondary)', maxWidth: '480px', marginBottom: '48px' }}>
          Challenge real players. Stake USDC. The Riot API verifies the result.
          The blockchain pays the winner. No human in the loop.
        </p>

        {/* Tagline */}
        <div style={{
          display: 'flex',
          gap: '24px',
          marginBottom: '64px',
          flexWrap: 'wrap',
        }}>
          {['Compete.', 'Wager.', 'Win.'].map((word, i) => (
            <span
              key={word}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '20px',
                fontWeight: 800,
                color: i === 1 ? 'var(--gold)' : i === 2 ? 'var(--teal)' : 'var(--text-primary)',
              }}
            >
              {word}
            </span>
          ))}
        </div>

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '480px' }}>
          {features.map(({ icon, title, desc }) => (
            <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'var(--gold-muted)',
                border: '1px solid rgba(245,166,35,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0,
              }}>
                {icon}
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>
                  {title}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div style={{ marginTop: '64px', fontSize: '12px', color: 'var(--text-muted)' }}>
          Built on Stellar · Powered by Riot Tournament API · Secured by Soroban smart contracts
        </div>
      </div>

      {/* ── Right panel — Auth card ── */}
      <div style={{
        width: '440px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 48px',
        position: 'relative',
        zIndex: 1,
        borderLeft: '1px solid var(--border-subtle)',
        background: 'rgba(8, 10, 18, 0.8)',
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{ width: '100%' }}>
          {/* Card header */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', filter: 'drop-shadow(0 0 20px rgba(245,166,35,0.5))', animation: 'float 3s ease-in-out infinite' }}>
              👑
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 800, marginBottom: '8px' }}>
              Enter the Arena
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Sign in or create your account to start competing
            </p>
          </div>

          {/* Main CTA */}
          <button
            id="login-btn"
            className="btn btn-primary btn-xl btn-full"
            onClick={login}
            disabled={!ready}
            style={{ marginBottom: '24px', letterSpacing: '0.02em' }}
          >
            {ready ? '⚡ Enter the Arena' : 'Loading...'}
          </button>

          {/* Methods */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
            {[
              { icon: '📧', label: 'Email OTP' },
              { icon: '🔵', label: 'Google' },
              { icon: '🍎', label: 'Apple' },
            ].map(({ icon, label }) => (
              <div
                key={label}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  textAlign: 'center',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                }}
              >
                <div style={{ fontSize: '18px', marginBottom: '4px' }}>{icon}</div>
                {label}
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="divider-text" style={{ marginBottom: '28px' }}>Testnet MVP</div>

          {/* Info cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { title: 'Stellar Testnet', desc: 'No real money — this is the MVP testnet build', icon: '⛓️' },
              { title: 'USDC Payments', desc: 'Settle in under 5 seconds via x402 protocol', icon: '💸' },
              { title: 'Riot Verified', desc: 'Match results come from the official Riot API only', icon: '🎮' },
            ].map(({ title, desc, icon }) => (
              <div key={title} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
              }}>
                <span style={{ fontSize: '18px' }}>{icon}</span>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600 }}>{title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '24px', lineHeight: 1.6 }}>
            By entering, you agree that this is a skill-based wagering platform.
            Not available where prohibited.
          </p>
        </div>
      </div>
    </div>
  );
}
