import React from 'react';
import { useTheme } from '../hooks/useTheme';

interface ThemeToggleProps {
  size?: 'md' | 'lg';
  className?: string;
}

/**
 * Animated dark/light switch. Reads + writes the global theme store,
 * which flips the [data-theme] attribute on <html>.
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({ size = 'md', className = '' }) => {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  const big = size === 'lg';

  const track = big ? 'w-16 h-[34px]' : 'w-14 h-[30px]';

  return (
    <button
      data-testid="theme-toggle"
      onClick={toggle}
      aria-label="Toggle theme"
      title={dark ? 'Switch to light' : 'Switch to dark'}
      className={`relative ${track} flex-shrink-0 rounded-full p-[3px] bg-surface2 border border-line transition-colors ${className}`}
    >
      <span
        className="grid place-items-center rounded-full text-accent-ink shadow-[0_2px_8px_rgba(0,0,0,.3)] transition-transform duration-300"
        style={{
          width: (big ? 34 : 30) - 6,
          height: (big ? 34 : 30) - 6,
          background: 'linear-gradient(180deg, var(--accent-hi), var(--accent-lo))',
          transform: dark ? 'translateX(0)' : `translateX(${big ? 30 : 26}px)`,
          transitionTimingFunction: 'cubic-bezier(.5,1.4,.5,1)',
        }}
      >
        {dark ? (
          <svg width={big ? 15 : 13} height={big ? 15 : 13} viewBox="0 0 24 24" fill="none">
            <path
              d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width={big ? 15 : 13} height={big ? 15 : 13} viewBox="0 0 24 24" fill="none">
            <path
              d="M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </button>
  );
};
