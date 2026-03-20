import type {
  UsageType,
  EmailVerificationResult,
  EmailVerificationStatus,
} from "@openhelm/shared";

const WEBSITE_URL =
  process.env.OPENHELM_WEBSITE_URL ?? "https://www.openhelm.ai";

const FETCH_TIMEOUT_MS = 15_000;

/** Convert a low-level fetch network error into a user-friendly message */
function toNetworkError(err: unknown, context: string): Error {
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return new Error(`${context}: request timed out. Please check your internet connection.`);
  }
  // Node.js undici wraps the underlying socket error in err.cause
  const cause = err instanceof Error && (err as Error & { cause?: unknown }).cause;
  const detail = cause instanceof Error ? cause.message : (err instanceof Error ? err.message : String(err));
  return new Error(`${context}: ${detail}. Please check your internet connection.`);
}

/** Request an email verification link from the website API */
export async function requestEmailVerification(
  email: string,
  usageType: UsageType | undefined,
  newsletterOptIn: boolean,
): Promise<EmailVerificationResult> {
  const body: Record<string, unknown> = { email, newsletterOptIn };
  if (usageType !== undefined) body.usageType = usageType;

  let res: Response;
  try {
    res = await fetch(`${WEBSITE_URL}/api/license/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    throw toNetworkError(err, "Unable to reach OpenHelm servers");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Email verification request failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<EmailVerificationResult>;
}

/** Poll the website API to check if a verification token has been clicked */
export async function checkEmailVerification(
  token: string,
): Promise<EmailVerificationStatus> {
  const url = new URL(`${WEBSITE_URL}/api/license/check-email`);
  url.searchParams.set("token", token);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    throw toNetworkError(err, "Unable to reach OpenHelm servers");
  }

  if (!res.ok) {
    throw new Error(`Email verification check failed (${res.status})`);
  }

  return res.json() as Promise<EmailVerificationStatus>;
}
