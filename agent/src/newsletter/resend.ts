/** Posts an email to the OpenHelm website's newsletter endpoint.
 *  The website holds the Resend API key so it never lives in the desktop binary. */
const WEBSITE_URL =
  process.env.OPENHELM_WEBSITE_URL ?? 'https://www.openhelm.ai';

const FETCH_TIMEOUT_MS = 15_000;

export async function subscribeToNewsletter(email: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${WEBSITE_URL}/api/newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    const cause = err instanceof Error && (err as Error & { cause?: unknown }).cause;
    const detail = cause instanceof Error ? cause.message : (err instanceof Error ? err.message : String(err));
    throw new Error(`Unable to reach OpenHelm servers: ${detail}`);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Newsletter subscribe failed (${res.status}): ${body}`);
  }
}
