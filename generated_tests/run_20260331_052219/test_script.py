import pytest
from playwright.sync_api import sync_playwright

@pytest.fixture(scope="module")
def browser_context():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context()
        page = context.new_page()
        yield page
        page.close()
        context.close()
        browser.close()

def test_click_login_button(browser_context):
    page = browser_context
    page.goto("http://localhost:5173")
    
    login_button = page.query_selector('#submit-order-btn')
    assert login_button is not None, "Login button not found"
    
    login_button.click()
    
    success_message = page.wait_for_selector('text=Order Confirmed!', timeout=5000)
    assert success_message is not None, "Success message not found after clicking login button"