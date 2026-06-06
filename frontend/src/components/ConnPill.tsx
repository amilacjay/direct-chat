import React from 'react';

export type ConnState = 'p2p' | 'relay' | 'connecting';

interface ConnPillProps {
  state: ConnState;
  compact?: boolean;
}

const MAP: Record<ConnState, { label: string; color: string; pulse: boolean }> = {
  p2p: { label: 'P2P · DIRECT', color: 'var(--good)', pulse: true },
  relay: { label: 'RELAYED', color: 'var(--warn)', pulse: false },
  connecting: { label: 'CONNECTING', color: 'var(--text-3)', pulse: false },
};

/** Live connection status — P2P (WebRTC) vs server relay vs connecting. */
export const ConnPill: React.FC<ConnPillProps> = ({ state, compact = false }) => {
  const s = MAP[state] ?? MAP.connecting;
  return (
    <span
      data-testid="conn-pill"
      className="mono inline-flex items-center gap-1.5 h-6 rounded-full whitespace-nowrap"
      style={{
        padding: compact ? '0 8px' : '0 10px',
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '.08em',
        color: s.color,
        background: 'color-mix(in oklch, currentColor 12%, transparent)',
        border: '1px solid color-mix(in oklch, currentColor 26%, transparent)',
      }}
    >
      <span
        className="rounded-full"
        style={{
          width: 6,
          height: 6,
          background: 'currentColor',
          animation: s.pulse ? 'pulseDot 1.6s ease-in-out infinite' : 'none',
          opacity: state === 'connecting' ? 0.6 : 1,
        }}
      />
      {!compact && s.label}
    </span>
  );
};
