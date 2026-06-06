/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_DEV_AUTH: string;
  readonly VITE_DONATE_XMR: string;
  readonly VITE_DONATE_BTC: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
