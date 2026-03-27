/** Loose UUID v4-style check — enough to avoid PostgREST 400 on RPC params */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidString(value: string | null | undefined): boolean {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}
