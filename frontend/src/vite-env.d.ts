/// <reference types="vite/client" />

// vite/client declares lowercase image extensions only. The brand logo is
// committed as `.PNG` (uppercase), so declare that variant too.
declare module '*.PNG' {
  const src: string;
  export default src;
}
