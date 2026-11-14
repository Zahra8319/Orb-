# Space Apps Resources Scraper

Scrapes the **Resources** tab of a NASA Space Apps Challenge page into JSON, CSV and Markdown.

## Setup
```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m playwright install chromium                # only for JS-rendered pages
```

## Usage
```bash
# Default target: 2026 "Health Monitoring Software" challenge
python scrape_resources.py

# Another challenge, force the headless browser, download PDFs/CSVs
python scrape_resources.py --url "https://www.spaceappschallenge.org/2026/challenges/<slug>/?tab=resources" --mode browser --download

# Parse a page you saved from your browser (Ctrl+S → "Webpage, Complete")
python scrape_resources.py --from-file saved_page.html
```

Output goes to `output/`: `resources.json`, `resources.csv`, `resources.md`, plus `files/` with `--download`.

## Notes
- The script checks `robots.txt` first and stops if the URL is disallowed. Use `--from-file`
  (works on a page you opened yourself) or `--ignore-robots` if you accept responsibility.
- `--mode auto` tries a plain HTTP fetch first, then falls back to Playwright if fewer than 3 links are found.
- Use `--headed` to watch the browser if a page isn't parsing as expected.
