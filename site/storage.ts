/**
 * Object storage — in Manus production this uploads via Forge/S3.
 * Local / CI: returns a deterministic key so outreach tests can assert calls.
 */
export async function storagePut(
  relKey: string,
  buffer: Buffer,
  mimeType: string,
): Promise<{ key: string; url: string }> {
  const key = relKey.replace(/^\/+/, "");
  void buffer;
  void mimeType;
  return { key, url: `/manus-storage/${key}` };
}
