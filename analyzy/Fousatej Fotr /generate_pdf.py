#!/usr/bin/env python3
from playwright.sync_api import sync_playwright
import os

# Get absolute path
html_path = os.path.abspath('fousatej_fotr_final.html')
pdf_path = os.path.abspath('Fousatej_Fotr_Influencer_Analysis.pdf')

print(f"Converting HTML to PDF...")
print(f"HTML: {html_path}")
print(f"PDF: {pdf_path}")

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto(f'file://{html_path}')

    # Wait for charts to render
    page.wait_for_timeout(2500)

    # Generate PDF
    page.pdf(
        path=pdf_path,
        format='A4',
        print_background=True,
        margin={'top': '0mm', 'right': '0mm', 'bottom': '0mm', 'left': '0mm'}
    )

    browser.close()

print(f"✅ PDF created successfully: {pdf_path}")
