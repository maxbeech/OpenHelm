import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, ExternalLink, CheckCircle2, Loader2 } from "lucide-react";
import type { EmployeeCount, StripePriceEntry } from "@openhelm/shared";
import * as api from "@/lib/api";
import { open } from "@tauri-apps/plugin-shell";

interface PaymentStepProps {
  email: string;
  employeeCount: EmployeeCount;
  onNext: () => void;
}

const POLL_INTERVAL_MS = 3000;

/** Map locale to preferred currency (lowercase ISO 4217) */
function detectCurrency(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? navigator.language;
    const region = locale.split("-")[1]?.toUpperCase();
    if (region === "GB") return "gbp";
    const euroCountries = [
      "AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR",
      "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK",
    ];
    if (region && euroCountries.includes(region)) return "eur";
  } catch {
    // fallback below
  }
  return "usd";
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  usd: "$",
  gbp: "\u00a3",
  eur: "\u20ac",
};

function formatPrice(entry: StripePriceEntry): string {
  const symbol = CURRENCY_SYMBOLS[entry.currency] ?? entry.currency.toUpperCase() + " ";
  const amount = (entry.unitAmount / 100).toFixed(entry.unitAmount % 100 === 0 ? 0 : 2);
  return `${symbol}${amount}`;
}

export function PaymentStep({ email, employeeCount, onNext }: PaymentStepProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [complete, setComplete] = useState(false);
  const [priceDisplay, setPriceDisplay] = useState<string | null>(null);
  const [currency] = useState(() => detectCurrency());

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch pricing from Stripe on mount
  useEffect(() => {
    let cancelled = false;
    api.getPricing()
      .then((result) => {
        if (cancelled) return;
        const match = result.prices.find(
          (p) => p.currency === currency && p.interval === "month",
        );
        if (match) {
          setPriceDisplay(`${formatPrice(match)} per user / month`);
        } else {
          // Fallback: try USD
          const usd = result.prices.find(
            (p) => p.currency === "usd" && p.interval === "month",
          );
          if (usd) setPriceDisplay(`${formatPrice(usd)} per user / month`);
        }
      })
      .catch(() => {
        // Pricing endpoint not available — leave null (hidden)
      });
    return () => { cancelled = true; };
  }, [currency]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = (id: string) => {
    setPolling(true);
    pollRef.current = setInterval(async () => {
      try {
        const result = await api.pollCheckoutSession({ sessionId: id });
        if (result.complete) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setPolling(false);
          setComplete(true);
          setTimeout(() => onNext(), 1500);
        }
      } catch {
        // Ignore transient poll errors
      }
    }, POLL_INTERVAL_MS);
  };

  const handleStartTrial = async () => {
    setCreating(true);
    setError(null);
    try {
      const result = await api.createCheckoutSession({
        email,
        employeeCount,
        currency,
      });
      setSessionId(result.sessionId);
      await open(result.url);
      startPolling(result.sessionId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start checkout. Please try again.",
      );
    } finally {
      setCreating(false);
    }
  };

  if (complete) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="rounded-full bg-success/20 p-3">
          <CheckCircle2 className="size-10 text-success" />
        </div>
        <h2 className="mt-4 text-2xl font-semibold">You're all set!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your 14-day free trial has started.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="rounded-full bg-primary/10 p-3">
        <CreditCard className="size-10 text-primary" />
      </div>
      <h2 className="mt-4 text-2xl font-semibold">Business license</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Your team size requires a Business license.
      </p>

      <div className="mt-6 w-full max-w-sm rounded-lg border p-4 text-left">
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">Business</span>
          {priceDisplay && (
            <span className="font-display text-xl font-bold">
              {priceDisplay.split(" per ")[0]}
            </span>
          )}
        </div>
        {priceDisplay && (
          <p className="text-xs text-muted-foreground">per user / month</p>
        )}
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          {[
            "Full commercial use license",
            "All Community features",
            "Priority support",
          ].map((f) => (
            <li key={f} className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5 shrink-0 text-green-500" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 w-full max-w-sm rounded-lg bg-muted/50 px-4 py-3 text-left text-sm">
        <p className="font-medium">14-day free trial</p>
        <p className="text-xs text-muted-foreground">
          Enter your card details — you won't be charged until the trial ends.
          Cancel any time.
        </p>
      </div>

      {error && (
        <p className="mt-3 text-xs text-destructive">{error}</p>
      )}

      {!sessionId ? (
        <Button
          onClick={handleStartTrial}
          size="lg"
          className="mt-4 w-full max-w-sm gap-2"
          disabled={creating}
        >
          {creating ? (
            <><Loader2 className="size-4 animate-spin" /> Opening checkout…</>
          ) : (
            <><ExternalLink className="size-4" /> Start free trial</>
          )}
        </Button>
      ) : polling ? (
        <div className="mt-4 flex flex-col items-center gap-2">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Waiting for payment confirmation…
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={handleStartTrial}
          >
            Re-open checkout
          </Button>
        </div>
      ) : null}
    </div>
  );
}
