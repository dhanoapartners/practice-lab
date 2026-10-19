// Small helpers shared by the specs.
export const UI = process.env.LAB_UI === 'v2' ? 'v2' : 'v1';

/** URL for a Practice Lab screen, pinned to the UI version under test. */
export const labUrl = (view: 'hub' | 'shop' | 'cart' | 'playground' | 'api' | 'help' = 'hub') => `/?ui=${UI}#${view}`;

/** A fresh session id isolates the cart for each API test. */
export const sessionHeaders = () => ({ 'X-Session-Id': 'pw' + crypto.randomUUID().replace(/-/g, '') });
