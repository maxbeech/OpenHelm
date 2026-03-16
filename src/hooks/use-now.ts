import { useState, useEffect } from "react";

/**
 * Returns the current Date and re-renders the component on a regular interval.
 * Use this whenever relative timestamps (e.g. "in 4h", "3m ago") must stay
 * up-to-date while the view remains open.
 *
 * @param intervalMs - How often to tick (default: 60 000 ms = 1 minute)
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
