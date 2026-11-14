# Space Health Resources (scraped data)

Data collected by [`scripts/spaceapps-scraper`](../scripts/spaceapps-scraper) from the Resources tab of the
NASA Space Apps 2026 challenge **"Create Health Monitoring Software for Astronauts on Space Missions"**,
plus a 2-level crawl of the linked NASA and CSA pages (scraped 2026-11-14).

| Path | Contents |
|---|---|
| `resources.md` / `.json` / `.csv` | The 5 links listed on the challenge's Resources tab |
| `crawl/pages/` | Readable text of 71 crawled pages (nasa.gov: 57, asc-csa.gc.ca: 14) |
| `crawl/pages.json` / `pages.csv` | Full crawl data: URL, depth, parent page, title, summary, text, links |
| `crawl/files.csv` | 57 files found while crawling, with the page each came from |
| `files/` | The downloaded files (17 PDFs, 39 images, 1 XML) |

Content belongs to its original publishers (NASA, Canadian Space Agency); see each source URL.
To refresh: `cd scripts/spaceapps-scraper && python scrape_resources.py --download`, then copy `output/` here.
