#!/usr/bin/env python3
"""
Scrape the Resources tab of a NASA Space Apps Challenge page.

Default target:
  https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=resources

Strategy (mode=auto):
  1. Fetch the page with requests and parse the HTML (and __NEXT_DATA__ if present).
  2. If no resources are found (the tab is rendered by JavaScript), load the page in
     a headless Chromium via Playwright, open the "Resources" tab and parse again.
  3. Or parse a page you saved yourself from the browser with --from-file.

Outputs (in --out): resources.json, resources.csv, resources.md, and optionally
downloaded files in files/ when --download is passed.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup, Tag

DEFAULT_URL = (
    "https://www.spaceappschallenge.org/2026/challenges/"
    "health-monitoring-software/?tab=resources"
)
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0 Safari/537.36 SpaceAppsResourceScraper/1.0"
)
DOWNLOADABLE = {
    ".pdf", ".zip", ".csv", ".json", ".xlsx", ".xls", ".txt", ".nc", ".h5",
    ".hdf5", ".tar", ".gz", ".docx", ".pptx", ".png", ".jpg", ".jpeg",
}
SKIP_HREF = re.compile(r"^(#|javascript:|mailto:|tel:)", re.I)
HEADINGS = ["h1", "h2", "h3", "h4", "h5", "h6"]


@dataclass
class Resource:
    title: str
    url: str
    section: str = ""
    description: str = ""
    domain: str = ""
    file_type: str = ""
    source: str = "html"  # html | next_data
    local_file: str = ""

    def __post_init__(self) -> None:
        parsed = urlparse(self.url)
        self.domain = parsed.netloc
        ext = Path(unquote(parsed.path)).suffix.lower()
        self.file_type = ext.lstrip(".") if ext in DOWNLOADABLE else ""


@dataclass
class PageResult:
    url: str
    challenge_title: str = ""
    challenge_summary: str = ""
    method: str = ""
    resources: list[Resource] = field(default_factory=list)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def clean(text: str | None) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def log(msg: str) -> None:
    print(f"[scraper] {msg}", file=sys.stderr)


def robots_allows(url: str, session: requests.Session) -> bool | None:
    """True/False from robots.txt, or None if robots.txt could not be read."""
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    try:
        resp = session.get(robots_url, timeout=15)
        if resp.status_code >= 400:
            return None
        rp = RobotFileParser()
        rp.parse(resp.text.splitlines())
        return rp.can_fetch(USER_AGENT, url)
    except requests.RequestException:
        return None


def fetch_static(url: str, session: requests.Session) -> str:
    resp = session.get(url, timeout=30)
    resp.raise_for_status()
    return resp.text


def fetch_with_browser(url: str, headless: bool = True) -> str:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:  # pragma: no cover
        raise SystemExit(
            "Playwright is not installed. Run:\n"
            "  pip install playwright && python -m playwright install chromium"
        ) from exc

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        page = browser.new_page(user_agent=USER_AGENT)
        page.goto(url, wait_until="networkidle", timeout=60_000)

        # Make sure the Resources tab is the active one.
        tab_pattern = re.compile(r"^\s*resources\s*$", re.I)
        for locator in (
            page.get_by_role("tab", name=tab_pattern),
            page.get_by_role("link", name=tab_pattern),
            page.get_by_role("button", name=tab_pattern),
        ):
            try:
                if locator.count():
                    locator.first.click(timeout=3_000)
                    break
            except Exception:
                continue

        # Expand any "show more" / "view all" toggles.
        for label in ("Show more", "Load more", "View all", "See more"):
            try:
                buttons = page.get_by_role("button", name=re.compile(label, re.I))
                for i in range(buttons.count()):
                    buttons.nth(i).click(timeout=2_000)
            except Exception:
                pass

        page.wait_for_timeout(1_500)
        html = page.content()
        browser.close()
        return html


# --------------------------------------------------------------------------- #
# Parsing
# --------------------------------------------------------------------------- #
def page_meta(soup: BeautifulSoup) -> tuple[str, str]:
    title = ""
    h1 = soup.find("h1")
    if h1:
        title = clean(h1.get_text(" "))
    if not title:
        og = soup.find("meta", property="og:title")
        title = clean(og.get("content")) if og else clean(soup.title.string if soup.title else "")
    desc_tag = soup.find("meta", attrs={"name": "description"}) or soup.find(
        "meta", property="og:description"
    )
    summary = clean(desc_tag.get("content")) if desc_tag else ""
    return title, summary


def find_resources_root(soup: BeautifulSoup) -> Tag | None:
    """Locate the container that holds the Resources tab content."""
    # 1. A tab panel labelled by a "Resources" tab.
    for tab in soup.find_all(attrs={"role": "tab"}):
        if clean(tab.get_text()).lower() == "resources":
            panel_id = tab.get("aria-controls")
            if panel_id and (panel := soup.find(id=panel_id)):
                return panel
    # 2. Element whose id/class mentions "resource" and contains links.
    for el in soup.find_all(True):
        attrs = " ".join([el.get("id") or "", " ".join(el.get("class") or [])]).lower()
        if "resource" in attrs and el.name not in ("a", "span", "button") and el.find("a", href=True):
            return el
    # 3. A heading literally called "Resources" -> its enclosing section.
    for h in soup.find_all(HEADINGS):
        if clean(h.get_text()).lower() in {"resources", "nasa data & resources", "resources tab"}:
            section = h.find_parent(["section", "article", "div"])
            if section and section.find("a", href=True):
                return section
    return None


def describe(anchor: Tag, title: str) -> str:
    """Text of the anchor's nearest block container, minus the title itself."""
    block = anchor.find_parent(["li", "p", "tr", "article"]) or anchor.parent
    if not block:
        return ""
    text = clean(block.get_text(" "))
    if len(text) > 800:  # container too big to be one resource
        return ""
    text = text.replace(title, "", 1).strip(" -–—:|")
    return clean(text)


def parse_html(html: str, base_url: str) -> list[Resource]:
    soup = BeautifulSoup(html, "lxml")
    for t in soup(["script", "style", "noscript", "svg", "template"]):
        t.decompose()
    for t in soup.select("header, footer, nav, [role=navigation], [role=banner], [role=contentinfo]"):
        t.decompose()

    root = find_resources_root(soup) or soup.find("main") or soup.body or soup
    resources: list[Resource] = []
    section = ""
    for el in root.find_all(HEADINGS + ["a"]):
        if el.name in HEADINGS:
            text = clean(el.get_text(" "))
            if text:
                section = text
            continue
        href = (el.get("href") or "").strip()
        if not href or SKIP_HREF.match(href):
            continue
        url = urljoin(base_url, href)
        # Skip links back to other tabs of the same challenge page.
        if "?tab=" in url and urlparse(url).path == urlparse(base_url).path:
            continue
        title = clean(el.get_text(" ")) or clean(el.get("aria-label")) or clean(el.get("title")) or url
        resources.append(Resource(title=title, url=url, section=section,
                                  description=describe(el, title)))
    return resources


def parse_next_data(html: str, base_url: str) -> list[Resource]:
    """Pull resource-like objects out of Next.js __NEXT_DATA__ (pages router)."""
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    if not m:
        return []
    try:
        data = json.loads(m.group(1))
    except json.JSONDecodeError:
        return []

    found: list[Resource] = []

    def link_of(d: dict) -> str | None:
        for k in ("url", "link", "href", "uri"):
            v = d.get(k)
            if isinstance(v, str) and v and not SKIP_HREF.match(v):
                return v
            if isinstance(v, dict) and isinstance(v.get("url"), str):
                return v["url"]
        return None

    def collect(node, section: str) -> None:
        if isinstance(node, dict):
            url = link_of(node)
            title = next((clean(node[k]) for k in ("title", "name", "label", "text")
                          if isinstance(node.get(k), str)), "")
            if url and title:
                desc = next((clean(BeautifulSoup(node[k], "lxml").get_text(" "))
                             for k in ("description", "summary", "body")
                             if isinstance(node.get(k), str)), "")
                found.append(Resource(title=title, url=urljoin(base_url, url),
                                      section=section, description=desc, source="next_data"))
            for k, v in node.items():
                collect(v, section or (k if "resource" in k.lower() else ""))
        elif isinstance(node, list):
            for item in node:
                collect(item, section)

    def walk(node) -> None:
        # Only harvest subtrees whose key mentions "resource" to avoid nav noise.
        if isinstance(node, dict):
            for k, v in node.items():
                if "resource" in k.lower():
                    collect(v, k)
                else:
                    walk(v)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(data)
    return found


def dedupe(resources: list[Resource]) -> list[Resource]:
    seen: dict[str, Resource] = {}
    for r in resources:
        key = r.url.rstrip("/")
        if key not in seen:
            seen[key] = r
        else:  # keep the richer record
            old = seen[key]
            if len(r.description) > len(old.description):
                old.description = r.description
            if not old.section and r.section:
                old.section = r.section
    return list(seen.values())


def extract(html: str, url: str) -> PageResult:
    soup = BeautifulSoup(html, "lxml")
    title, summary = page_meta(soup)
    resources = dedupe(parse_next_data(html, url) + parse_html(html, url))
    return PageResult(url=url, challenge_title=title, challenge_summary=summary,
                      resources=resources)


# --------------------------------------------------------------------------- #
# Output
# --------------------------------------------------------------------------- #
def safe_name(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("_")[:120] or "file"


def download_files(result: PageResult, out: Path, session: requests.Session, delay: float) -> None:
    folder = out / "files"
    folder.mkdir(parents=True, exist_ok=True)
    for r in result.resources:
        if not r.file_type:
            continue
        target = folder / safe_name(Path(unquote(urlparse(r.url).path)).name)
        try:
            with session.get(r.url, stream=True, timeout=60) as resp:
                resp.raise_for_status()
                with open(target, "wb") as fh:
                    for chunk in resp.iter_content(65_536):
                        fh.write(chunk)
            r.local_file = str(target.relative_to(out))
            log(f"downloaded {target.name}")
        except requests.RequestException as exc:
            log(f"could not download {r.url}: {exc}")
        time.sleep(delay)


def write_outputs(result: PageResult, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    payload = asdict(result)
    payload["scraped_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    payload["count"] = len(result.resources)
    (out / "resources.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False), "utf-8")

    fields = ["section", "title", "url", "domain", "file_type", "description", "local_file", "source"]
    with open(out / "resources.csv", "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        for r in result.resources:
            writer.writerow({k: getattr(r, k) for k in fields})

    lines = [f"# {result.challenge_title or 'Space Apps Challenge'} — Resources", "",
             f"Source: {result.url}", ""]
    if result.challenge_summary:
        lines += [result.challenge_summary, ""]
    current = None
    for r in result.resources:
        if r.section != current:
            current = r.section
            lines += ["", f"## {current or 'Other'}", ""]
        desc = f" — {r.description}" if r.description else ""
        lines.append(f"- [{r.title}]({r.url}){desc}")
    (out / "resources.md").write_text("\n".join(lines) + "\n", "utf-8")


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default=DEFAULT_URL, help="challenge page URL")
    ap.add_argument("--out", default="output", help="output folder (default: output)")
    ap.add_argument("--mode", choices=["auto", "static", "browser"], default="auto")
    ap.add_argument("--from-file", help="parse a page saved from your browser instead of fetching")
    ap.add_argument("--download", action="store_true", help="download linked files (PDF, CSV, ZIP...)")
    ap.add_argument("--delay", type=float, default=1.0, help="seconds between downloads")
    ap.add_argument("--headed", action="store_true", help="show the browser window (browser mode)")
    ap.add_argument("--ignore-robots", action="store_true",
                    help="skip the robots.txt check (your responsibility)")
    args = ap.parse_args(argv)

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "en"})
    out = Path(args.out)

    if args.from_file:
        html = Path(args.from_file).read_text("utf-8", errors="ignore")
        result = extract(html, args.url)
        result.method = "file"
    else:
        if not args.ignore_robots:
            allowed = robots_allows(args.url, session)
            if allowed is False:
                log("robots.txt disallows automated access to this URL.")
                log("Options: save the page from your browser and use --from-file, "
                    "or pass --ignore-robots if you accept responsibility.")
                return 2
        result = PageResult(url=args.url)
        if args.mode in ("auto", "static"):
            try:
                result = extract(fetch_static(args.url, session), args.url)
                result.method = "static"
                log(f"static fetch found {len(result.resources)} links")
            except requests.RequestException as exc:
                log(f"static fetch failed: {exc}")
        if args.mode == "browser" or (args.mode == "auto" and len(result.resources) < 3):
            log("rendering page in headless Chromium…")
            result = extract(fetch_with_browser(args.url, headless=not args.headed), args.url)
            result.method = "browser"

    if not result.resources:
        log("no resources found — try --mode browser --headed, or --from-file.")
    if args.download and result.resources:
        download_files(result, out, session, args.delay)

    write_outputs(result, out)
    log(f"{len(result.resources)} resources -> {out.resolve()}")
    for r in result.resources:
        print(f"[{r.section or '-'}] {r.title} -> {r.url}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
