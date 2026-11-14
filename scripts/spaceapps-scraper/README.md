# Space Apps Resources Scraper

Scrapes the **Resources** tab of a NASA Space Apps Challenge page, then **crawls every linked
resource** — and the links inside those pages — saving readable text, metadata and any files
(PDF, CSV, images...) it finds.

## Setup
```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m playwright install chromium                # for JS-rendered pages (the Resources tab is one)
```

## Usage
```bash
# Default: 2026 "Health Monitoring Software" challenge, crawl 2 levels deep
python scrape_resources.py

# Also download the PDFs/images/etc. found while crawling
python scrape_resources.py --download

# Go deeper, with a bigger page budget
python scrape_resources.py --depth 3 --max-pages 400

# Only the Resources tab, no crawling
python scrape_resources.py --depth 0

# Another challenge
python scrape_resources.py --url "https://www.spaceappschallenge.org/2026/challenges/<slug>/?tab=resources"

# Parse a Resources page you saved from your browser (Ctrl+S -> "Webpage, Complete")
python scrape_resources.py --from-file saved_page.html
```

### Crawl options
| Option | Default | Meaning |
|---|---|---|
| `--depth N` | `2` | 0 = Resources tab only, 1 = the resource pages, 2 = also the links inside them, ... |
| `--max-pages N` | `150` | Stop after this many crawled pages |
| `--scope` | `domain` | `domain`: stay on each resource's own site · `path`: same site and folder · `any`: follow everything |
| `--render` | `auto` | Use headless Chromium for crawled pages: `auto` (only when static HTML has little text), `never`, `always` |
| `--delay S` | `1.0` | Seconds between requests to the same host |
| `--download` | off | Download discovered files into `output/files/` |

## Output (`output/`)
| File | Contents |
|---|---|
| `resources.json` / `.csv` / `.md` | Links listed on the Resources tab |
| `crawl/pages.json` | Every crawled page: URL, depth, parent, title, description, full text, links, files |
| `crawl/pages.csv` | One-line summary per page (status, chars, errors, text file) |
| `crawl/pages/NNN_<title>.md` | Readable text of each page |
| `crawl/files.csv` | Every downloadable file found and the page it was found on |
| `files/` | Downloaded files (with `--download`) |

## SSL errors ("unable to get local issuer certificate")
Some servers (including spaceappschallenge.org) send an incomplete certificate chain. Browsers
quietly fetch the missing intermediate certificate; Python does not. The scraper now does the same
automatically: it downloads the intermediate from the certificate's AIA URL, **verifies every
signature up to a root already trusted by `certifi`**, and caches it in `.certs/`. Certificate
verification is never turned off — a certificate that doesn't chain to a trusted root is rejected.

## Notes
- `robots.txt` is checked for every site. Use `--ignore-robots` only if you accept responsibility.
- Use `--headed` to watch the browser if a page isn't parsing as expected.
