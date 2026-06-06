// ─────────────────────────────────────────────────────────────────────────
// DONATIONS — addresses are configured via env vars, NOT in this file.
//
//   VITE_DONATE_XMR   your Monero  receive address
//   VITE_DONATE_BTC   your Bitcoin receive address
//
// Set them in frontend/.env.production (committed, used by the Docker build)
// or frontend/.env.development for local `npm run dev`.
//
// • Leave a var empty to hide that coin.
// • The "Support Direct" button only appears once at least one address is set.
// • Vite bakes these in at BUILD time, so changing a value needs a rebuild.
//
// ⚠️  Addresses are public, but a typo means funds are lost forever — paste
//     straight from your wallet's "Receive" screen.
// ─────────────────────────────────────────────────────────────────────────

export interface DonateCoin {
  key: string;
  name: string;
  ticker: string;
  address: string;
  /** URI scheme so a phone wallet can parse the QR (e.g. monero:..., bitcoin:...) */
  uriScheme: string;
}

const DONATE_ADDRESSES = {
  xmr: (import.meta.env.VITE_DONATE_XMR ?? '').trim(),
  btc: (import.meta.env.VITE_DONATE_BTC ?? '').trim(),
};

export const DONATE_COINS: DonateCoin[] = [
  { key: 'xmr', name: 'Monero', ticker: 'XMR', address: DONATE_ADDRESSES.xmr, uriScheme: 'monero' },
  { key: 'btc', name: 'Bitcoin', ticker: 'BTC', address: DONATE_ADDRESSES.btc, uriScheme: 'bitcoin' },
];

export const ENABLED_COINS = DONATE_COINS.filter((c) => c.address !== '');
export const DONATE_ENABLED = ENABLED_COINS.length > 0;

/** Value encoded into the QR — wallet apps understand the URI scheme. */
export const coinUri = (c: DonateCoin) => `${c.uriScheme}:${c.address}`;
