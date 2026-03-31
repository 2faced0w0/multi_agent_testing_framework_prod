import pytest
from playwright.sync_api import sync_playwright

@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        yield browser
        browser.close()

def test_fill_form_and_submit(browser):
    page = browser.new_page()
    page.goto("http://localhost:5173")

    # Fill form fields
    page.fill("#firstName", "John")
    page.fill("#lastName", "Doe")
    page.fill("#email", "john@example.com")
    page.fill("#address", "123 Elm St")
    page.fill("#city", "Springfield")
    page.fill("#state", "IL")
    page.fill("#zip", "62704")
    page.fill("#cardNumber", "4111111111111111")
    page.fill("#expiry", "12/25")
    page.fill("#cvv", "123")
    page.fill("#cardName", "John Doe")

    # Click submit order button
    page.click("#submit-order-btn")

    # Verify success screen is displayed
    assert page.is_visible('text=Order Confirmed!')