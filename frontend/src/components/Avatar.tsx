import React, { useState } from 'react';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  /** Show an accent ring (e.g. for the current user). */
  ring?: boolean;
}

const PX: Record<NonNullable<AvatarProps['size']>, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 64,
};

// Gradient tones — picked deterministically from the name.
const TONES: [string, string][] = [
  ['#7c6cff', '#b9a3ff'],
  ['#19c37d', '#7ee6b8'],
  ['#ff7a59', '#ffb59c'],
  ['#2f9bff', '#9fd0ff'],
  ['#f25fb0', '#ffa9d6'],
  ['#f5b942', '#ffe08a'],
  ['#16c2c2', '#8af0f0'],
  ['#d98cff', '#efc6ff'],
];

export const Avatar: React.FC<AvatarProps> = ({ src, name, size = 'md', className = '', ring = false }) => {
  const [imgError, setImgError] = useState(false);
  const px = PX[size];
  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const [a, b] = TONES[(name.charCodeAt(0) || 0) % TONES.length];
  const radius = px * 0.34;

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setImgError(true)}
        className={`object-cover flex-shrink-0 ${className}`}
        style={{
          width: px,
          height: px,
          borderRadius: radius,
          boxShadow: ring ? '0 0 0 2px var(--accent-line)' : undefined,
        }}
      />
    );
  }

  return (
    <div
      className={`grid place-items-center text-white font-display font-semibold select-none flex-shrink-0 ${className}`}
      style={{
        width: px,
        height: px,
        borderRadius: radius,
        fontSize: px * 0.36,
        letterSpacing: '-.02em',
        background: `linear-gradient(140deg, ${a}, ${b})`,
        boxShadow: ring ? '0 0 0 2px var(--accent-line)' : 'inset 0 0 0 1px rgba(255,255,255,.14)',
      }}
    >
      {initials}
    </div>
  );
};
