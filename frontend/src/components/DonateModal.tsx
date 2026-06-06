import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ENABLED_COINS, coinUri, type DonateCoin } from '../lib/donate';

interface Props {
  onClose: () => void;
}

export const DonateModal: React.FC<Props> = ({ onClose }) => {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<DonateCoin>(ENABLED_COINS[0]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(active.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be unavailable; user can still select the text */
    }
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-line bg-bg shadow-2xl">
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-surface2 text-ink-3 transition-colors hover:text-ink"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
            <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
        </button>

        <div className="px-6 pb-6 pt-8 text-center">
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-accent-soft text-accent">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 20.5S3.5 14.8 3.5 9.3A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 8.5 1.7c0 5.5-8.5 11.2-8.5 11.2Z"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-ink">Support Direct</h2>
          <p className="mx-auto mt-2 max-w-[18rem] text-[13.5px] leading-relaxed text-ink-3">
            Direct is free and ad-free, forever. If it’s useful to you, a small crypto tip — even $1 —
            helps cover the servers. Thank you.
          </p>

          {/* Coin tabs (only if more than one) */}
          {ENABLED_COINS.length > 1 && (
            <div className="mt-5 inline-flex rounded-full border border-line bg-surface p-1">
              {ENABLED_COINS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => {
                    setActive(c);
                    setCopied(false);
                  }}
                  className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                    active.key === c.key ? 'bg-accent text-accent-ink' : 'text-ink-3 hover:text-ink'
                  }`}
                >
                  {c.ticker}
                </button>
              ))}
            </div>
          )}

          {/* QR — kept on a white card so any wallet can scan it in either theme */}
          <div className="mt-5 flex justify-center">
            <div className="rounded-2xl bg-white p-3 shadow-soft">
              <QRCodeSVG value={coinUri(active)} size={176} level="M" />
            </div>
          </div>

          <p className="mono mt-4 text-[11px] uppercase tracking-[0.12em] text-ink-4">
            {active.name} ({active.ticker})
          </p>

          {/* Address + copy */}
          <button
            onClick={handleCopy}
            className="mt-2 flex w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-lineHi"
            title="Copy address"
          >
            <span className="mono flex-1 break-all text-[12px] leading-relaxed text-ink-2">
              {active.address}
            </span>
            <span className="flex-shrink-0 text-ink-4">
              {copied ? (
                <svg className="h-4 w-4 text-good" fill="none" viewBox="0 0 24 24">
                  <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth={2} />
                  <path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                </svg>
              )}
            </span>
          </button>
          <p className="mt-2 text-[11px] text-ink-4">
            {copied ? 'Copied to clipboard' : 'Scan the QR or tap the address to copy'}
          </p>
        </div>
      </div>
    </div>
  );
};
