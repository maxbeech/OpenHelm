"""Tests for the per-tool-call timeout decorator."""

import asyncio
import sys
from pathlib import Path

import pytest

# Add src to path so we can import tool_timeout
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from tool_timeout import (
    DEFAULT_TIMEOUT_S,
    EXTENDED_TIMEOUT_S,
    EXTENDED_TIMEOUT_TOOLS,
    with_timeout,
)


@pytest.mark.asyncio
async def test_completes_within_timeout():
    """Functions that complete before the timeout return normally."""

    @with_timeout(timeout_s=5.0)
    async def fast_fn():
        return "ok"

    result = await fast_fn()
    assert result == "ok"


@pytest.mark.asyncio
async def test_returns_error_on_timeout():
    """Functions that exceed the timeout return an error dict (not raise)."""

    @with_timeout(timeout_s=0.1)
    async def slow_fn():
        await asyncio.sleep(10)
        return "should not reach"

    result = await slow_fn()
    assert isinstance(result, dict)
    assert result["error"] is True
    assert result["timed_out"] is True
    assert "timed out" in result["message"]
    assert result["timeout_seconds"] == 0.1


@pytest.mark.asyncio
async def test_preserves_function_name():
    """The wrapper preserves the original function name (functools.wraps)."""

    @with_timeout(timeout_s=1.0)
    async def my_named_function():
        return "ok"

    assert my_named_function.__name__ == "my_named_function"


@pytest.mark.asyncio
async def test_auto_default_timeout():
    """Functions not in EXTENDED_TIMEOUT_TOOLS get DEFAULT_TIMEOUT_S."""

    @with_timeout()
    async def regular_tool():
        return "ok"

    # We can't easily inspect the effective timeout from outside,
    # but we verify the decorator works without explicit timeout_s
    result = await regular_tool()
    assert result == "ok"


@pytest.mark.asyncio
async def test_auto_extended_timeout_for_screenshot():
    """Functions named 'take_screenshot' get EXTENDED_TIMEOUT_S."""

    @with_timeout()
    async def take_screenshot():
        return "screenshot data"

    assert "take_screenshot" in EXTENDED_TIMEOUT_TOOLS
    result = await take_screenshot()
    assert result == "screenshot data"


@pytest.mark.asyncio
async def test_error_dict_includes_function_name():
    """Timeout error message includes the function name for debugging."""

    @with_timeout(timeout_s=0.05)
    async def navigate():
        await asyncio.sleep(10)

    result = await navigate()
    assert "navigate" in result["message"]


def test_constants():
    """Verify timeout constants are reasonable."""
    assert DEFAULT_TIMEOUT_S == 60
    assert EXTENDED_TIMEOUT_S == 120
    assert "take_screenshot" in EXTENDED_TIMEOUT_TOOLS
    assert "get_page_content" in EXTENDED_TIMEOUT_TOOLS
