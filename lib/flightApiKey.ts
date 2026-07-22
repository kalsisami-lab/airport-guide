// Known placeholder values shipped in .env.local templates. These are truthy strings
// but not real Aviationstack keys — treating them as "present" causes the UI to skip
// the fallback path and silently return empty results.
//
// TODO(§50): keep this list minimal — the correct long-term fix is to remove the
//   placeholder from .env.local entirely and require an explicit unset value.
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
