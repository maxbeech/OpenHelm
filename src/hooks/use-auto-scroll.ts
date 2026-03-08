import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Auto-scroll hook for the log viewer.
 * Stays at bottom during live updates. If user scrolls up,
 * auto-scroll pauses and a "Jump to latest" indicator shows.
 */
export function useAutoScroll(deps: unknown[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const userScrolledRef = useRef(false);

  const checkIfAtBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    // 40px threshold for "close enough" to bottom
    return el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      userScrolledRef.current = false;
      setIsAtBottom(true);
    }
  }, []);

  // Handle user scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      const atBottom = checkIfAtBottom();
      setIsAtBottom(atBottom);
      if (!atBottom) {
        userScrolledRef.current = true;
      } else {
        userScrolledRef.current = false;
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [checkIfAtBottom]);

  // Auto-scroll when deps change (new logs) if at bottom
  useEffect(() => {
    if (!userScrolledRef.current) {
      scrollToBottom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { containerRef, isAtBottom, scrollToBottom };
}
