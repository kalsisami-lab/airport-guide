// Known placeholder values shipped in .env.local templates. These are truthy
// strings but not real Aviationstack keys — treating them as "present" makes
// /api/config return hasFlightKey:true in local dev, which misrepresents the
// system state. Production (Vercel) is unaffected because it provisions a
// real key via env vars.
const PLACEHOLDERS = new Set([
  'YOUR_AVIATIONSTACK_KEY_HERE',
  'YOUR_API_KEY_HERE',
  'REPLACE_ME',
  'TODO',
  '',
]);

export function hasRealFlightKey(raw: string | undefined | null): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  return !PLACEHOLDERS.has(trimmed);
}
