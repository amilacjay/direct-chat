import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'gray' | 'green' | 'red' | 'yellow' | 'accent';
  className?: string;
}

// Token-based, theme-aware. `blue` is kept as an alias of `accent` for compatibility.
const variantMap: Record<NonNullable<BadgeProps['variant']>, string> = {
  accent: 'bg-accent-soft text-accent',
  blue: 'bg-accent-soft text-accent',
  gray: 'bg-surface2 text-ink-3',
  green: 'text-good',
  red: 'text-warn',
  yellow: 'text-warn',
};

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'gray', className = '' }) => {
  const tinted = variant === 'green' || variant === 'red' || variant === 'yellow';
  return (
    <span
      className={`mono inline-flex items-center px-1.5 py-0.5 rounded-md text-[10.5px] font-semibold tracking-wide uppercase ${variantMap[variant]} ${className}`}
      style={tinted ? { background: 'color-mix(in oklch, currentColor 14%, transparent)' } : undefined}
    >
      {children}
    </span>
  );
};
