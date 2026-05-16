// Re-export shim — all lounge data now lives in data/lounges/.
// Importing from this file continues to work for backward compatibility.
export type { StaticLounge } from './lounges/types';
export { LOUNGE_DATABASE } from './lounges/index';
