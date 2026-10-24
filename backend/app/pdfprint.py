"""Prints a frontend page to PDF in its own process (uvicorn's event loop cannot spawn Chromium on Windows).

Usage: python -m app.pdfprint <url> <out.pdf> <landscape:0|1>
"""
from __future__ import annotations

import sys

from playwright.sync_api import sync_playwright


def main(url: str, out: str, landscape: bool) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1400 if landscape else 1000, "height": 1000})
        page.goto(url, wait_until="networkidle", timeout=45000)
        page.wait_for_selector("[data-print-ready='true']", timeout=30000)
        page.wait_for_timeout(1500)  # let charts and the graph settle
        page.pdf(path=out, format="A4", landscape=landscape, print_background=True,
                 margin={"top": "10mm", "bottom": "10mm", "left": "10mm", "right": "10mm"})
        browser.close()


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3] == "1")
