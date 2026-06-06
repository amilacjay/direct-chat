import React from 'react';
import { useAuthStore } from '../store/auth';
import { Logo } from '../components/Logo';
import { ConnPill } from '../components/ConnPill';

export const Home: React.FC = () => {
  const { user } = useAuthStore();
  const firstName = user?.display_name?.split(' ')[0];

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-bg p-8 text-center">
      <div
        aria-hidden
        className="absolute left-1/2 top-[20%] -translate-x-1/2"
        style={{
          width: 460,
          height: 460,
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--accent-soft), transparent 60%)',
          filter: 'blur(20px)',
        }}
      />
      <div className="relative flex flex-col items-center">
        <div className="mb-6 text-accent">
          <Logo size={64} live />
        </div>
        <h2 className="font-display text-[27px] font-semibold tracking-tight text-ink">
          You’re connected{firstName ? `, ${firstName}` : ''}
        </h2>
        <p className="mt-2.5 max-w-sm text-[15.5px] leading-relaxed text-ink-3" style={{ textWrap: 'pretty' }}>
          Pick someone who’s online to open a direct line. Every conversation is peer-to-peer and
          vanishes the moment you leave.
        </p>
        <div className="mt-5 flex gap-2">
          <ConnPill state="p2p" />
          <span className="mono inline-flex h-6 items-center gap-1.5 rounded-full border border-line px-2.5 text-[10.5px] font-semibold tracking-[0.08em] text-ink-3">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path
                d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 2.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            NO HISTORY
          </span>
        </div>
      </div>
    </div>
  );
};
