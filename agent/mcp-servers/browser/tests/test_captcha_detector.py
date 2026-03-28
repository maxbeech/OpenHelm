"""Tests for captcha_detector.py — CAPTCHA detection via DOM inspection."""

import asyncio
import sys
import os
import pytest

# Add src to path so we can import the module
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from captcha_detector import CaptchaDetector, _empty_result


class MockTab:
    """Mock nodriver Tab that returns controlled JS evaluation results."""

    def __init__(self, js_result=None, error=None):
        self._js_result = js_result
        self._error = error

    async def evaluate(self, script):
        if self._error:
            raise self._error
        return self._js_result


@pytest.fixture
def detector():
    return CaptchaDetector()


# ── Empty / no CAPTCHA ──


@pytest.mark.asyncio
async def test_no_captcha_returns_not_detected(detector):
    tab = MockTab(js_result=[])
    result = await detector.detect(tab)
    assert result["detected"] is False
    assert result["captcha_type"] is None
    assert result["selectors"] == []
    assert result["is_blocking"] is False
    assert result["auto_solve_hint"] == "none"


@pytest.mark.asyncio
async def test_none_result_returns_not_detected(detector):
    tab = MockTab(js_result=None)
    result = await detector.detect(tab)
    assert result["detected"] is False


@pytest.mark.asyncio
async def test_js_error_returns_not_detected_with_error(detector):
    tab = MockTab(error=RuntimeError("CDP connection lost"))
    result = await detector.detect(tab)
    assert result["detected"] is False
    assert "error" in result
    assert "CDP connection lost" in result["error"]


# ── reCAPTCHA v2 ──


@pytest.mark.asyncio
async def test_recaptcha_v2_checkbox(detector):
    tab = MockTab(js_result=[
        {
            "type": "recaptcha_v2",
            "selector": ".g-recaptcha",
            "visible": True,
            "blocking": True,
            "hint": "click_checkbox",
            "tag": "div",
        }
    ])
    result = await detector.detect(tab)
    assert result["detected"] is True
    assert result["captcha_type"] == "recaptcha_v2"
    assert result["is_blocking"] is True
    assert result["auto_solve_hint"] == "click_checkbox"
    assert ".g-recaptcha" in result["selectors"]


@pytest.mark.asyncio
async def test_recaptcha_v2_iframe(detector):
    tab = MockTab(js_result=[
        {
            "type": "recaptcha_v2",
            "selector": 'iframe[src*="recaptcha/api2"]',
            "visible": True,
            "blocking": True,
            "hint": "click_checkbox",
            "tag": "iframe",
        }
    ])
    result = await detector.detect(tab)
    assert result["detected"] is True
    assert result["captcha_type"] == "recaptcha_v2"


# ── reCAPTCHA v3 (non-blocking) ──


@pytest.mark.asyncio
async def test_recaptcha_v3_badge_non_blocking(detector):
    tab = MockTab(js_result=[
        {
            "type": "recaptcha_v3",
            "selector": ".grecaptcha-badge",
            "visible": True,
            "blocking": False,
            "hint": "none",
            "tag": "div",
        }
    ])
    result = await detector.detect(tab)
    assert result["detected"] is True
    assert result["captcha_type"] == "recaptcha_v3"
    assert result["is_blocking"] is False
    assert result["auto_solve_hint"] == "none"


# ── hCaptcha ──


@pytest.mark.asyncio
async def test_hcaptcha_detected(detector):
    tab = MockTab(js_result=[
        {
            "type": "hcaptcha",
            "selector": ".h-captcha",
            "visible": True,
            "blocking": True,
            "hint": "click_checkbox",
            "tag": "div",
        }
    ])
    result = await detector.detect(tab)
    assert result["detected"] is True
    assert result["captcha_type"] == "hcaptcha"
    assert result["auto_solve_hint"] == "click_checkbox"


# ── Cloudflare Turnstile ──


@pytest.mark.asyncio
async def test_turnstile_detected(detector):
    tab = MockTab(js_result=[
        {
            "type": "turnstile",
            "selector": ".cf-turnstile",
            "visible": True,
            "blocking": True,
            "hint": "wait",
            "tag": "div",
        }
    ])
    result = await detector.detect(tab)
    assert result["detected"] is True
    assert result["captcha_type"] == "turnstile"
    assert result["auto_solve_hint"] == "wait"


# ── Cloudflare challenge page ──


@pytest.mark.asyncio
async def test_cloudflare_challenge_page(detector):
    tab = MockTab(js_result=[
        {
            "type": "cloudflare_challenge",
            "selector": "#challenge-running",
            "visible": True,
            "blocking": True,
            "hint": "wait",
            "tag": "div",
        },
        {
            "type": "cloudflare_challenge",
            "selector": "title",
            "visible": True,
            "blocking": True,
            "hint": "wait",
            "tag": "title",
        },
    ])
    result = await detector.detect(tab)
    assert result["detected"] is True
    assert result["captcha_type"] == "cloudflare_challenge"
    assert result["is_blocking"] is True
    assert result["auto_solve_hint"] == "wait"


# ── Generic CAPTCHA ──


@pytest.mark.asyncio
async def test_generic_captcha(detector):
    tab = MockTab(js_result=[
        {
            "type": "generic",
            "selector": "#captcha-form",
            "visible": True,
            "blocking": True,
            "hint": "unknown",
            "tag": "form",
        }
    ])
    result = await detector.detect(tab)
    assert result["detected"] is True
    assert result["captcha_type"] == "generic"
    assert result["auto_solve_hint"] == "unknown"


# ── Visibility filtering ──


@pytest.mark.asyncio
async def test_hidden_captcha_not_detected(detector):
    """Dormant/hidden CAPTCHA elements should be ignored."""
    tab = MockTab(js_result=[
        {
            "type": "recaptcha_v2",
            "selector": ".g-recaptcha",
            "visible": False,
            "blocking": True,
            "hint": "click_checkbox",
            "tag": "div",
        }
    ])
    result = await detector.detect(tab)
    assert result["detected"] is False


@pytest.mark.asyncio
async def test_mixed_visible_and_hidden(detector):
    """Only visible elements should be included in results."""
    tab = MockTab(js_result=[
        {
            "type": "recaptcha_v2",
            "selector": ".g-recaptcha",
            "visible": False,
            "blocking": True,
            "hint": "click_checkbox",
            "tag": "div",
        },
        {
            "type": "turnstile",
            "selector": ".cf-turnstile",
            "visible": True,
            "blocking": True,
            "hint": "wait",
            "tag": "div",
        },
    ])
    result = await detector.detect(tab)
    assert result["detected"] is True
    assert result["captcha_type"] == "turnstile"
    assert len(result["details"]) == 1


# ── Blocking priority ──


@pytest.mark.asyncio
async def test_blocking_takes_priority_over_non_blocking(detector):
    """Blocking CAPTCHA should be the primary type even if non-blocking is listed first."""
    tab = MockTab(js_result=[
        {
            "type": "recaptcha_v3",
            "selector": ".grecaptcha-badge",
            "visible": True,
            "blocking": False,
            "hint": "none",
            "tag": "div",
        },
        {
            "type": "hcaptcha",
            "selector": ".h-captcha",
            "visible": True,
            "blocking": True,
            "hint": "click_checkbox",
            "tag": "div",
        },
    ])
    result = await detector.detect(tab)
    assert result["captcha_type"] == "hcaptcha"
    assert result["is_blocking"] is True
    assert result["auto_solve_hint"] == "click_checkbox"


# ── _empty_result helper ──


def test_empty_result_no_error():
    r = _empty_result()
    assert r["detected"] is False
    assert "error" not in r


def test_empty_result_with_error():
    r = _empty_result("something broke")
    assert r["detected"] is False
    assert r["error"] == "something broke"


# ── Multiple selectors deduplication ──


@pytest.mark.asyncio
async def test_duplicate_selectors_deduplicated(detector):
    tab = MockTab(js_result=[
        {
            "type": "turnstile",
            "selector": ".cf-turnstile",
            "visible": True,
            "blocking": True,
            "hint": "wait",
            "tag": "div",
        },
        {
            "type": "turnstile",
            "selector": ".cf-turnstile",
            "visible": True,
            "blocking": True,
            "hint": "wait",
            "tag": "div",
        },
    ])
    result = await detector.detect(tab)
    assert result["selectors"] == [".cf-turnstile"]
