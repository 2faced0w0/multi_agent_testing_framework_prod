import subprocess
import asyncio
from playwright.async_api import async_playwright
from typing import Dict, Any

async def run_with_telemetry(url: str, locator_fix: dict) -> Dict[str, Any]:
    """
    Launches a headless Playwright browser, injects console/network listeners
    to capture browser telemetry, and returns logs alongside the pass/fail result.
    """
    browser_logs = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Capture JS console output
        page.on('console', lambda msg: browser_logs.append(f'[CONSOLE {msg.type.upper()}] {msg.text}'))

        # Capture network failures (4xx/5xx)
        async def on_response(response):
            if response.status >= 400:
                browser_logs.append(f'[NETWORK {response.status}] {response.url}')
        page.on('response', on_response)

        passed = False
        try:
            await page.goto(url, timeout=10000)
            element = page.locator(locator_fix.get('locator', ''))
            await element.wait_for(timeout=5000)
            passed = True
        except Exception as e:
            browser_logs.append(f'[PLAYWRIGHT ERROR] {str(e)}')

        await browser.close()

    return {
        'passed': passed,
        'browser_logs': '\n'.join(browser_logs)
    }

def run_isolated_test(locator_fix: dict) -> bool:
    """Sync wrapper for backwards compatibility."""
    try:
        result = asyncio.run(run_with_telemetry('http://localhost:3000', locator_fix))
        return result['passed']
    except Exception:
        return False
