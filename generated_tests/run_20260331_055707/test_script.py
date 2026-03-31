import pytest
from playwright.sync_api import sync_playwright

def test_place_order():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context()
        page = context.new_page()
        
        # Navigate to the target URL
        page.goto("http://localhost:5173")
        
        # Assuming the form fields and button IDs are as follows based on typical naming conventions
        page.fill('input[name="name"]', "John Doe")  # Replace with actual field names if different
        page.fill('input[name="email"]', "john.doe@example.com")  # Replace with actual field names if different
        page.fill('input[name="address"]', "1234 Elm St, Anytown, USA")  # Replace with actual field names if different
        
        # Click the place order button
        page.click('#submit-order-btn')  # Adjust selector based on actual element ID
        
        # Assuming success is indicated by a message or state change
        assert page.is_visible('.order-success-message'), "Order was not placed successfully"
        
        browser.close()