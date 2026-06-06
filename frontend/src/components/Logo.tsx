import React from 'react';

interface LogoProps {
  size?: number;
  live?: boolean;
  className?: string;
}

/**
 * Direct brand mark — two peer nodes joined by a direct line (P2P).
 * Uses currentColor, so set text color on the wrapper.
 */
export const Logo: React.FC<LogoProps> = ({ size = 28, live = false, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <line x1="9" y1="16" x2="23" y2="16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity="0.9" />
    <circle cx="9" cy="16" r="4.4" fill="currentColor" />
    <circle cx="23" cy="16" r="4.4" fill="none" stroke="currentColor" strokeWidth="2.4" />
    {live && (
      <circle
        cx="23"
        cy="16"
        r="4.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        style={{ transformOrigin: '23px 16px', animation: 'ring 1.8s ease-out infinite' }}
      />
    )}
  </svg>
);
