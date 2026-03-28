"""Tests for background browser launch integration in browser_manager + process_cleanup."""

import os
import sys
import pytest
from unittest.mock import patch, MagicMock, AsyncMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from process_cleanup import ProcessCleanup
from browser_manager import BrowserManager
from models import BrowserOptions


# ── ProcessCleanup.track_browser_process_by_pid ──


class TestTrackBrowserProcessByPid:
    def setup_method(self):
        self.cleanup = ProcessCleanup.__new__(ProcessCleanup)
        self.cleanup.tracked_pids = set()
        self.cleanup.browser_processes = {}
        self.cleanup._save_tracked_pids = MagicMock()

    @patch("process_cleanup.psutil.pid_exists", return_value=True)
    def test_tracks_existing_pid(self, _mock):
        result = self.cleanup.track_browser_process_by_pid("inst-1", 12345)
        assert result is True
        assert self.cleanup.browser_processes["inst-1"] == 12345
        assert 12345 in self.cleanup.tracked_pids
        self.cleanup._save_tracked_pids.assert_called_once()

    @patch("process_cleanup.psutil.pid_exists", return_value=False)
    def test_rejects_nonexistent_pid(self, _mock):
        result = self.cleanup.track_browser_process_by_pid("inst-1", 99999)
        assert result is False
        assert "inst-1" not in self.cleanup.browser_processes

    @patch("process_cleanup.psutil.pid_exists", side_effect=Exception("boom"))
    def test_handles_exception(self, _mock):
        result = self.cleanup.track_browser_process_by_pid("inst-1", 12345)
        assert result is False


# ── BrowserManager._identify_browser_type ──


class TestIdentifyBrowserType:
    def test_chrome(self):
        assert BrowserManager._identify_browser_type(
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        ) == "Google Chrome"

    def test_edge(self):
        assert BrowserManager._identify_browser_type(
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
        ) == "Microsoft Edge"

    def test_chromium(self):
        assert BrowserManager._identify_browser_type(
            "/usr/bin/chromium"
        ) == "Chromium"

    def test_unknown(self):
        assert BrowserManager._identify_browser_type("/usr/bin/browser") == "Unknown"


# ── BrowserManager._try_background_launch ──


class TestTryBackgroundLaunch:
    def setup_method(self):
        self.mgr = BrowserManager()

    @pytest.mark.asyncio
    @patch("browser_manager.is_macos", return_value=False)
    async def test_skips_on_non_macos(self, _mock):
        config = MagicMock()
        opts = BrowserOptions(headless=False, background=True)
        result = await self.mgr._try_background_launch(config, "/path/chrome", opts)
        assert result is False

    @pytest.mark.asyncio
    @patch("browser_manager.is_macos", return_value=True)
    async def test_skips_when_headless(self, _mock):
        config = MagicMock()
        opts = BrowserOptions(headless=True, background=True)
        result = await self.mgr._try_background_launch(config, "/path/chrome", opts)
        assert result is False

    @pytest.mark.asyncio
    @patch("browser_manager.is_macos", return_value=True)
    async def test_skips_when_background_false(self, _mock):
        config = MagicMock()
        opts = BrowserOptions(headless=False, background=False)
        result = await self.mgr._try_background_launch(config, "/path/chrome", opts)
        assert result is False

    @pytest.mark.asyncio
    @patch("browser_manager.is_macos", return_value=True)
    @patch("browser_manager.macos_free_port", return_value=9222)
    @patch("browser_manager.launch_browser_background", new_callable=AsyncMock, return_value=42)
    async def test_success_sets_config(self, mock_launch, mock_port, _mock_macos):
        config = MagicMock()
        config.__call__ = MagicMock(return_value=["--arg1", "--arg2"])
        opts = BrowserOptions(headless=False, background=True)

        result = await self.mgr._try_background_launch(config, "/path/chrome", opts)

        assert result is True
        assert config.host == "127.0.0.1"
        assert config.port == 9222
        mock_launch.assert_awaited_once()

    @pytest.mark.asyncio
    @patch("browser_manager.is_macos", return_value=True)
    @patch("browser_manager.macos_free_port", return_value=9222)
    @patch("browser_manager.launch_browser_background", new_callable=AsyncMock, return_value=None)
    async def test_failure_resets_config(self, mock_launch, mock_port, _mock_macos):
        config = MagicMock()
        config.__call__ = MagicMock(return_value=["--arg1"])
        opts = BrowserOptions(headless=False, background=True)

        result = await self.mgr._try_background_launch(config, "/path/chrome", opts)

        assert result is False
        assert config.host is None
        assert config.port is None

    @pytest.mark.asyncio
    @patch("browser_manager.is_macos", return_value=True)
    @patch("browser_manager.macos_free_port", side_effect=OSError("no ports"))
    async def test_exception_resets_config(self, mock_port, _mock_macos):
        config = MagicMock()
        opts = BrowserOptions(headless=False, background=True)

        result = await self.mgr._try_background_launch(config, "/path/chrome", opts)

        assert result is False
        assert config.host is None
        assert config.port is None
