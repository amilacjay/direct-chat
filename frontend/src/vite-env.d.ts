/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Injected at build time by vite.config.ts (define).
declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_DEV_AUTH: string;
  readonly VITE_DONATE_XMR: string;
  readonly VITE_DONATE_BTC: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
