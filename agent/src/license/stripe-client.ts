import type {
  EmployeeCount,
  CheckoutSessionResult,
  PollCheckoutSessionResult,
  CustomerPortalResult,
  PricingResult,
} from "@openhelm/shared";

const WEBSITE_URL =
  process.env.OPENHELM_WEBSITE_URL ?? "https://www.openhelm.ai";

const FETCH_TIMEOUT_MS = 15_000;

/** Convert a low-level fetch network error into a user-friendly message */
function toNetworkError(err: unknown, context: string): Error {
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return new Error(`${context}: request timed out. Please check your internet connection.`);
  }
  const cause = err instanceof Error && (err as Error & { cause?: unknown }).cause;
  const detail = cause instanceof Error ? cause.message : (err instanceof Error ? err.message : String(err));
  return new Error(`${context}: ${detail}. Please check your internet connection.`);
}

/** Fetch product pricing from Stripe via the website proxy */
export async function getPricing(): Promise<PricingResult> {
  let res: Response;
  try {
    res = await fetch(`${WEBSITE_URL}/api/stripe/pricing`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    throw toNetworkError(err, "Unable to reach OpenHelm servers");
  }

  if (!res.ok) {
    throw new Error(`Pricing fetch failed (${res.status})`);
  }

  return res.json() as Promise<PricingResult>;
}

/** Create a Stripe Checkout Session via the website proxy */
export async function createCheckoutSession(
  email: string,
  employeeCount: EmployeeCount,
  currency?: string,
): Promise<CheckoutSessionResult> {
  let res: Response;
  try {
    res = await fetch(`${WEBSITE_URL}/api/stripe/create-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, employeeCount, currency }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    throw toNetworkError(err, "Unable to reach OpenHelm servers");
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Checkout session creation failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<CheckoutSessionResult>;
}

/** Poll the Stripe session status via the website proxy */
export async function pollCheckoutSession(
  sessionId: string,
): Promise<PollCheckoutSessionResult> {
  let res: Response;
  try {
    res = await fetch(`${WEBSITE_URL}/api/stripe/check-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    throw toNetworkError(err, "Unable to reach OpenHelm servers");
  }

  if (!res.ok) {
    throw new Error(`Session poll failed (${res.status})`);
  }

  return res.json() as Promise<PollCheckoutSessionResult>;
}

/** Create a Stripe Customer Portal session via the website proxy */
export async function createPortalSession(
  customerId: string,
): Promise<CustomerPortalResult> {
  let res: Response;
  try {
    res = await fetch(`${WEBSITE_URL}/api/stripe/create-portal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    throw toNetworkError(err, "Unable to reach OpenHelm servers");
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Portal session creation failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<CustomerPortalResult>;
}

/** Verify a Stripe subscription status via the website proxy */
export async function verifySubscription(
  subscriptionId: string,
): Promise<{ status: string; trialEnd: string | null; currentPeriodEnd: string | null }> {
  let res: Response;
  try {
    res = await fetch(`${WEBSITE_URL}/api/stripe/verify-subscription`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    throw toNetworkError(err, "Unable to reach OpenHelm servers");
  }

  if (!res.ok) {
    throw new Error(`Subscription verification failed (${res.status})`);
  }

  return res.json();
}
