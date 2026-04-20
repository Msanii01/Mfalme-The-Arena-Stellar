/**
 * SimulationBanner — shows a teal notice when the backend is in simulation mode.
 * Pass isSimulated={true} when API response includes simulated: true.
 */
export default function SimulationBanner({ feature = 'Riot API', isSimulated = true }) {
  if (!isSimulated) return null;

  return (
    <div className="sim-banner">
      <span className="sim-banner-icon">🔵</span>
      <div>
        <strong>{feature} — Simulation Mode</strong>
        {' '}
        Set <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: '3px', fontSize: '12px' }}>
          {feature === 'Riot API' ? 'RIOT_API_KEY' : 'CHALLONGE_API_KEY'}
        </code>
        {' '}in <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: '3px', fontSize: '12px' }}>
          backend/.env
        </code>
        {' '}to switch to real data. All simulation responses are deterministic and stable.
      </div>
    </div>
  );
}
