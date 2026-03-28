"""Tests for intervention.py — user help request file writing."""

import asyncio
import json
import os
import sys
import tempfile
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from intervention import write_intervention_request, _interventions_dir


class MockTab:
    """Mock nodriver Tab for screenshot and URL evaluation."""

    def __init__(self, url="https://example.com/login", screenshot_error=None):
        self._url = url
        self._screenshot_error = screenshot_error
        self.saved_screenshot_path = None

    async def evaluate(self, script):
        return self._url

    async def save_screenshot(self, path):
        if self._screenshot_error:
            raise self._screenshot_error
        self.saved_screenshot_path = path
        # Create a dummy file so it exists
        with open(path, "wb") as f:
            f.write(b"PNG_FAKE")


class MockBrowserManager:
    """Mock BrowserManager that returns a MockTab."""

    def __init__(self, tab=None, error=None):
        self._tab = tab or MockTab()
        self._error = error

    async def get_tab(self, instance_id):
        if self._error:
            raise self._error
        return self._tab


@pytest.fixture
def temp_dir(tmp_path, monkeypatch):
    """Redirect interventions to a temp directory."""
    monkeypatch.setenv("OPENHELM_DATA_DIR", str(tmp_path))
    return tmp_path


# ── Successful request ──


@pytest.mark.asyncio
async def test_writes_request_file(temp_dir):
    tab = MockTab(url="https://example.com/captcha")
    mgr = MockBrowserManager(tab=tab)

    result = await write_intervention_request(
        run_id="run-123",
        instance_id="inst-1",
        reason="Solve reCAPTCHA",
        browser_manager=mgr,
    )

    assert result["success"] is True
    assert result["request_id"]
    assert result["page_url"] == "https://example.com/captcha"
    assert "message" in result

    # Verify file was written
    interventions = temp_dir / "interventions"
    files = list(interventions.glob("req-*.json"))
    assert len(files) == 1

    with open(files[0]) as f:
        data = json.load(f)
    assert data["id"] == result["request_id"]
    assert data["runId"] == "run-123"
    assert data["reason"] == "Solve reCAPTCHA"
    assert data["pageUrl"] == "https://example.com/captcha"
    assert data["timestamp"]


@pytest.mark.asyncio
async def test_screenshot_saved(temp_dir):
    tab = MockTab()
    mgr = MockBrowserManager(tab=tab)

    result = await write_intervention_request(
        run_id="run-456",
        instance_id="inst-1",
        reason="Need help",
        browser_manager=mgr,
    )

    assert result["screenshot_path"] is not None
    assert os.path.exists(result["screenshot_path"])


# ── Screenshot failure (non-fatal) ──


@pytest.mark.asyncio
async def test_screenshot_error_still_writes_request(temp_dir):
    tab = MockTab(screenshot_error=RuntimeError("CDP screenshot failed"))
    mgr = MockBrowserManager(tab=tab)

    result = await write_intervention_request(
        run_id="run-789",
        instance_id="inst-1",
        reason="CAPTCHA blocking",
        browser_manager=mgr,
    )

    assert result["success"] is True
    assert result["screenshot_path"] is None

    # File should still be written
    interventions = temp_dir / "interventions"
    files = list(interventions.glob("req-*.json"))
    assert len(files) == 1


# ── No run ID (standalone mode) ──


@pytest.mark.asyncio
async def test_null_run_id(temp_dir):
    tab = MockTab()
    mgr = MockBrowserManager(tab=tab)

    result = await write_intervention_request(
        run_id=None,
        instance_id="inst-1",
        reason="Help needed",
        browser_manager=mgr,
    )

    assert result["success"] is True

    interventions = temp_dir / "interventions"
    files = list(interventions.glob("req-*.json"))
    data = json.load(open(files[0]))
    assert data["runId"] is None


# ── Browser manager error ──


@pytest.mark.asyncio
async def test_browser_error_still_writes_request(temp_dir):
    mgr = MockBrowserManager(error=RuntimeError("No browser instance"))

    result = await write_intervention_request(
        run_id="run-err",
        instance_id="nonexistent",
        reason="CAPTCHA detected",
        browser_manager=mgr,
    )

    assert result["success"] is True
    assert result["page_url"] == "unknown"

    interventions = temp_dir / "interventions"
    files = list(interventions.glob("req-*.json"))
    assert len(files) == 1


# ── Unique request IDs ──


@pytest.mark.asyncio
async def test_unique_request_ids(temp_dir):
    mgr = MockBrowserManager()

    r1 = await write_intervention_request("run-1", "inst-1", "A", mgr)
    r2 = await write_intervention_request("run-1", "inst-1", "B", mgr)

    assert r1["request_id"] != r2["request_id"]

    interventions = temp_dir / "interventions"
    files = list(interventions.glob("req-*.json"))
    assert len(files) == 2


# ── Directory creation ──


def test_interventions_dir_created(temp_dir, monkeypatch):
    d = _interventions_dir()
    assert d.exists()
    assert d.is_dir()
