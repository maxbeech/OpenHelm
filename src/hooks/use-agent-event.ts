import { useEffect } from "react";

/**
 * Subscribe to an agent event dispatched on window.
 * Events follow the pattern `agent:<event>` with data in `event.detail`.
 */
export function useAgentEvent<T = unknown>(
  eventName: string,
  handler: (data: T) => void,
) {
  useEffect(() => {
    const listener = (e: Event) => {
      const custom = e as CustomEvent<T>;
      handler(custom.detail);
    };
    window.addEventListener(`agent:${eventName}`, listener);
    return () => window.removeEventListener(`agent:${eventName}`, listener);
  }, [eventName, handler]);
}
