/// <reference types="vite/client" />

// SVG imports return the asset URL as a string by default in Vite
declare module "*.svg" {
  const src: string;
  export default src;
}
