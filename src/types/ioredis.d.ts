// Minimal ambient declaration to allow optional runtime import of ioredis
// The real package ships its own types; this file prevents TypeScript errors
// when `ioredis` isn't installed in local/dev environments.

declare module 'ioredis' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _default: any;
  export = _default;
}
