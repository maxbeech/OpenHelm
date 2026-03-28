"""
Per-tool-call timeout decorator for MCP tool handlers.

Wraps async tool handlers with asyncio.wait_for() to prevent indefinite hangs.
When a tool exceeds its timeout, returns a structured error dict instead of
blocking forever — this lets Claude Code see the failure and try a different
approach, rather than going silent and triggering the 600s silence timeout.
"""

import asyncio
import functools
from typing import Any, Callable, Coroutine

# Tools that get an extended timeout (heavy operations)
EXTENDED_TIMEOUT_TOOLS = frozenset({
    "take_screenshot",
    "clone_element_complete",
    "clone_element_progressive",
    "clone_element_to_file",
    "extract_complete_element_cdp",
    "extract_complete_element_to_file",
    "get_page_content",
})

DEFAULT_TIMEOUT_S = 60
EXTENDED_TIMEOUT_S = 120


def with_timeout(timeout_s: float | None = None):
    """
    Decorator that wraps an async function with asyncio.wait_for().

    If timeout_s is None, auto-selects based on the function name:
    - Functions in EXTENDED_TIMEOUT_TOOLS get EXTENDED_TIMEOUT_S (120s)
    - All others get DEFAULT_TIMEOUT_S (60s)

    On timeout, returns an error dict instead of raising — so the MCP
    response is well-formed and Claude Code can react to it.
    """

    def decorator(func: Callable[..., Coroutine]) -> Callable[..., Coroutine]:
        effective = timeout_s
        if effective is None:
            effective = (
                EXTENDED_TIMEOUT_S
                if func.__name__ in EXTENDED_TIMEOUT_TOOLS
                else DEFAULT_TIMEOUT_S
            )

        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            try:
                return await asyncio.wait_for(
                    func(*args, **kwargs), timeout=effective
                )
            except asyncio.TimeoutError:
                return {
                    "error": True,
                    "message": (
                        f"Tool '{func.__name__}' timed out after {effective}s. "
                        f"The browser operation took too long — try a simpler "
                        f"approach or check if the browser is responding."
                    ),
                    "timed_out": True,
                    "timeout_seconds": effective,
                }

        return wrapper

    return decorator
