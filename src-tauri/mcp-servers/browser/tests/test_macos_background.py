"""Tests for macos_background.py — macOS background browser launch utilities."""

import asyncio
import os
import sys
import pytest
from unittest.mock import patch, MagicMock, AsyncMock

# Add src to path so we can import the module
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from macos_background import (
    is_macos,
    free_port,
    get_app_bundle_path,
    get_app_name,
    find_pid_on_port,
    deactivate_app,
    launch_browser_background,
)


# ── Pure functions ──


class TestGetAppBundlePath:
    def test_chrome_macos(self):
        path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        assert get_app_bundle_path(path) == "/Applications/Google Chrome.app"

    def test_edge_macos(self):
        path = "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
        assert get_app_bundle_path(path) == "/Applications/Microsoft Edge.app"

    def test_chromium_macos(self):
        path = "/Applications/Chromium.app/Contents/MacOS/Chromium"
        assert get_app_bundle_path(path) == "/Applications/Chromium.app"

    def test_no_app_bundle(self):
        assert get_app_bundle_path("/usr/bin/google-chrome") is None

    def test_empty_path(self):
        assert get_app_bundle_path("") is None

    def test_nested_bundle(self):
        path = "/Users/me/Apps/Google Chrome.app/Contents/MacOS/Google Chrome"
        assert get_app_bundle_path(path) == "/Users/me/Apps/Google Chrome.app"


class TestGetAppName:
    def test_chrome(self):
        assert get_app_name("/Applications/Google Chrome.app") == "Google Chrome"

    def test_edge(self):
        assert get_app_name("/Applications/Microsoft Edge.app") == "Microsoft Edge"

    def test_chromium(self):
        assert get_app_name("/Applications/Chromium.app") == "Chromium"


class TestFreePort:
    def test_returns_int(self):
        port = free_port()
        assert isinstance(port, int)
        assert port > 0

    def test_returns_different_ports(self):
        ports = {free_port() for _ in range(5)}
        # At least 2 unique ports (system may reuse, but highly unlikely for all 5)
        assert len(ports) >= 2


class TestIsMacos:
    @patch("macos_background.platform.system", return_value="Darwin")
    def test_true_on_darwin(self, _mock):
        assert is_macos() is True

    @patch("macos_background.platform.system", return_value="Linux")
    def test_false_on_linux(self, _mock):
        assert is_macos() is False

    @patch("macos_background.platform.system", return_value="Windows")
    def test_false_on_windows(self, _mock):
        assert is_macos() is False


# ── Async functions ──


@pytest.mark.asyncio
async def test_find_pid_on_port_success():
    """find_pid_on_port returns PID when lsof finds a listener."""

    async def fake_subprocess(*args, **kwargs):
        mock_proc = AsyncMock()
        mock_proc.communicate = AsyncMock(return_value=(b"12345\n", b""))
        mock_proc.wait = AsyncMock(return_value=0)
        return mock_proc

    with patch("macos_background.asyncio.create_subprocess_exec", fake_subprocess):
        pid = await find_pid_on_port(9222, retries=1, delay=0.01)
    assert pid == 12345


@pytest.mark.asyncio
async def test_find_pid_on_port_not_found():
    """find_pid_on_port returns None when nothing is listening."""

    async def fake_subprocess(*args, **kwargs):
        mock_proc = AsyncMock()
        mock_proc.communicate = AsyncMock(return_value=(b"", b""))
        mock_proc.wait = AsyncMock(return_value=1)
        return mock_proc

    with patch("macos_background.asyncio.create_subprocess_exec", fake_subprocess):
        pid = await find_pid_on_port(9222, retries=2, delay=0.01)
    assert pid is None


@pytest.mark.asyncio
async def test_find_pid_on_port_multiple_pids():
    """When lsof returns multiple PIDs, the first one is used."""

    async def fake_subprocess(*args, **kwargs):
        mock_proc = AsyncMock()
        mock_proc.communicate = AsyncMock(return_value=(b"111\n222\n333\n", b""))
        return mock_proc

    with patch("macos_background.asyncio.create_subprocess_exec", fake_subprocess):
        pid = await find_pid_on_port(9222, retries=1, delay=0.01)
    assert pid == 111


@pytest.mark.asyncio
async def test_deactivate_app_does_not_raise():
    """deactivate_app should never raise even if osascript fails."""

    async def fake_subprocess(*args, **kwargs):
        mock_proc = AsyncMock()
        mock_proc.wait = AsyncMock(return_value=1)
        return mock_proc

    with patch("macos_background.asyncio.create_subprocess_exec", fake_subprocess):
        await deactivate_app("Google Chrome")  # Should not raise


@pytest.mark.asyncio
async def test_deactivate_app_timeout_does_not_raise():
    """deactivate_app should handle timeouts gracefully."""

    async def fake_subprocess(*args, **kwargs):
        mock_proc = AsyncMock()
        mock_proc.wait = AsyncMock(side_effect=asyncio.TimeoutError)
        return mock_proc

    with patch("macos_background.asyncio.create_subprocess_exec", fake_subprocess):
        await deactivate_app("Google Chrome")  # Should not raise


# ── launch_browser_background ──


@pytest.mark.asyncio
@patch("macos_background.is_macos", return_value=False)
async def test_launch_background_returns_none_on_non_macos(_mock):
    pid = await launch_browser_background("/usr/bin/chrome", ["--flag"], 9222)
    assert pid is None


@pytest.mark.asyncio
@patch("macos_background.is_macos", return_value=True)
async def test_launch_background_returns_none_if_no_bundle(_mock):
    """Returns None if we can't find a .app bundle in the executable path."""
    pid = await launch_browser_background("/usr/bin/chrome", ["--flag"], 9222)
    assert pid is None


@pytest.mark.asyncio
@patch("macos_background.is_macos", return_value=True)
@patch("macos_background.deactivate_app", new_callable=AsyncMock)
@patch("macos_background.find_pid_on_port", new_callable=AsyncMock, return_value=42)
@patch("macos_background.subprocess.Popen")
async def test_launch_background_success(
    mock_popen, mock_find, mock_deactivate, _mock_macos
):
    """Full happy-path: open -g launches Chrome, PID found, app deactivated."""
    mock_proc = MagicMock()
    mock_proc.wait = MagicMock(return_value=0)
    mock_popen.return_value = mock_proc

    exe = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    args = ["--remote-debugging-port=9222", "--user-data-dir=/tmp/test"]

    pid = await launch_browser_background(exe, args, 9222)

    assert pid == 42

    # Verify `open -g -n -a` was called
    call_args = mock_popen.call_args[0][0]
    assert call_args[0] == "open"
    assert "-g" in call_args
    assert "-n" in call_args
    assert "-a" in call_args
    assert "/Applications/Google Chrome.app" in call_args
    assert "--args" in call_args

    # Verify deactivation was called as safety net
    mock_deactivate.assert_awaited_once_with("Google Chrome")


@pytest.mark.asyncio
@patch("macos_background.is_macos", return_value=True)
@patch("macos_background.find_pid_on_port", new_callable=AsyncMock, return_value=None)
@patch("macos_background.subprocess.Popen")
async def test_launch_background_returns_none_when_chrome_fails(
    mock_popen, mock_find, _mock_macos
):
    """Returns None if Chrome doesn't start listening on the port."""
    mock_proc = MagicMock()
    mock_proc.wait = MagicMock(return_value=0)
    mock_popen.return_value = mock_proc

    exe = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    pid = await launch_browser_background(exe, ["--flag"], 9222)
    assert pid is None


@pytest.mark.asyncio
@patch("macos_background.is_macos", return_value=True)
@patch("macos_background.subprocess.Popen", side_effect=OSError("no such command"))
async def test_launch_background_popen_failure(mock_popen, _mock_macos):
    """Returns None if the open command fails entirely."""
    exe = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    pid = await launch_browser_background(exe, ["--flag"], 9222)
    assert pid is None
