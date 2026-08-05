/// <reference types="vite/client" />

// Stamped at build time by vite.config.ts and compared against the deployed
// version.json — see lib/app-version.ts.
declare const __BUILD_ID__: string;

// vite/client declares lowercase image extensions only. The brand logo is
// committed as `.PNG` (uppercase), so declare that variant too.
declare module '*.PNG' {
  const src: string;
  export default src;
}
