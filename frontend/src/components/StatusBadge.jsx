/**
 * StatusBadge — renders a colored badge for match/tournament status.
 */
export default function StatusBadge({ status }) {
  const config = {
    pending:           { label: 'Pending',       cls: 'badge-neutral',  dot: false },
    accepted:          { label: 'Accepted',      cls: 'badge-purple',   dot: true  },
    active:            { label: 'Live',          cls: 'badge-gold',     dot: true, pulse: true },
    completed:         { label: 'Completed',     cls: 'badge-teal',     dot: false },
    cancelled:         { label: 'Cancelled',     cls: 'badge-neutral',  dot: false },
    disputed:          { label: 'Disputed',      cls: 'badge-danger',   dot: true  },
    registration_open: { label: 'Registration',  cls: 'badge-purple',   dot: true, pulse: true },
    in_progress:       { label: 'In Progress',   cls: 'badge-gold',     dot: true, pulse: true },
  };

  const { label, cls, dot, pulse } = config[status] || { label: status, cls: 'badge-neutral', dot: false };

  return (
    <span className={`badge ${cls} ${dot ? (pulse ? 'badge-dot-pulse' : 'badge-dot') : ''}`}>
      {label}
    </span>
  );
}
