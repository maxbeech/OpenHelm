"""
CAPTCHA detection via DOM inspection.

Checks the current page for known CAPTCHA patterns (reCAPTCHA, hCaptcha,
Cloudflare Turnstile, Cloudflare challenge pages) and returns a structured
result indicating whether a blocking CAPTCHA was found and hints for solving.
"""

from typing import Any, Dict, List, Optional

# JavaScript that queries the DOM for known CAPTCHA indicators and checks visibility.
# Returns a JSON-serializable list of detected CAPTCHA elements.
_DETECTION_JS = """
(() => {
  const results = [];

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
    return true;
  }

  function check(selector, type, blocking, hint) {
    const els = document.querySelectorAll(selector);
    for (const el of els) {
      results.push({
        type: type,
        selector: selector,
        visible: isVisible(el),
        blocking: blocking,
        hint: hint,
        tag: el.tagName.toLowerCase(),
      });
    }
  }

  // reCAPTCHA v2 widget
  check('.g-recaptcha', 'recaptcha_v2', true, 'click_checkbox');
  check('iframe[src*="recaptcha/api2"]', 'recaptcha_v2', true, 'click_checkbox');
  check('iframe[src*="recaptcha/enterprise"]', 'recaptcha_v2', true, 'click_checkbox');

  // reCAPTCHA v3 badge (non-blocking, invisible score-based)
  check('.grecaptcha-badge', 'recaptcha_v3', false, 'none');

  // hCaptcha
  check('.h-captcha', 'hcaptcha', true, 'click_checkbox');
  check('iframe[src*="hcaptcha.com"]', 'hcaptcha', true, 'click_checkbox');

  // Cloudflare Turnstile
  check('.cf-turnstile', 'turnstile', true, 'wait');
  check('iframe[src*="challenges.cloudflare.com"]', 'turnstile', true, 'wait');

  // Cloudflare challenge page (full-page interstitial)
  check('#challenge-running', 'cloudflare_challenge', true, 'wait');
  check('#challenge-form', 'cloudflare_challenge', true, 'wait');

  // Check page title for Cloudflare interstitial
  if (document.title === 'Just a moment...' || document.title === 'Attention Required! | Cloudflare') {
    results.push({
      type: 'cloudflare_challenge',
      selector: 'title',
      visible: true,
      blocking: true,
      hint: 'wait',
      tag: 'title',
    });
  }

  // Generic captcha selectors (case-insensitive class/id match)
  const allEls = document.querySelectorAll('*');
  for (const el of allEls) {
    const cls = (el.className || '').toString().toLowerCase();
    const id = (el.id || '').toLowerCase();
    if ((cls.includes('captcha') || id.includes('captcha')) &&
        !cls.includes('grecaptcha-badge') &&
        !cls.includes('g-recaptcha') &&
        !cls.includes('h-captcha') &&
        !cls.includes('cf-turnstile')) {
      results.push({
        type: 'generic',
        selector: el.id ? '#' + el.id : '.' + el.className.split(' ')[0],
        visible: isVisible(el),
        blocking: true,
        hint: 'unknown',
        tag: el.tagName.toLowerCase(),
      });
    }
  }

  return results;
})()
"""


class CaptchaDetector:
    """Detects CAPTCHA challenges on a browser page via DOM inspection."""

    async def detect(self, tab: Any) -> Dict[str, Any]:
        """
        Inspect the current page for CAPTCHA indicators.

        Args:
            tab: A nodriver Tab object.

        Returns:
            Dict with keys:
              - detected (bool): Whether any CAPTCHA was found
              - captcha_type (str|None): Primary CAPTCHA type detected
              - selectors (list[str]): CSS selectors that matched
              - is_blocking (bool): Whether the CAPTCHA blocks page interaction
              - auto_solve_hint (str): "click_checkbox"|"wait"|"image_challenge"|"unknown"|"none"
              - details (list[dict]): All raw detection results
        """
        try:
            raw_results = await tab.evaluate(_DETECTION_JS)
        except Exception as e:
            return _empty_result(f"Detection script failed: {e}")

        if not raw_results:
            return _empty_result()

        # Filter to visible elements only (dormant badges are not actionable)
        visible = [r for r in raw_results if r.get("visible")]
        if not visible:
            return _empty_result()

        # Find the primary (most actionable) CAPTCHA
        blocking = [r for r in visible if r.get("blocking")]
        primary = blocking[0] if blocking else visible[0]

        selectors = list({r["selector"] for r in visible})

        return {
            "detected": True,
            "captcha_type": primary["type"],
            "selectors": selectors,
            "is_blocking": any(r.get("blocking") for r in visible),
            "auto_solve_hint": primary.get("hint", "unknown"),
            "details": visible,
        }


def _empty_result(error: Optional[str] = None) -> Dict[str, Any]:
    """Return a no-CAPTCHA-found result."""
    result: Dict[str, Any] = {
        "detected": False,
        "captcha_type": None,
        "selectors": [],
        "is_blocking": False,
        "auto_solve_hint": "none",
        "details": [],
    }
    if error:
        result["error"] = error
    return result
