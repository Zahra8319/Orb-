#!/usr/bin/env python3
"""
Scrape the Resources tab of a NASA Space Apps Challenge page, then crawl the
linked resources (and the links inside them, up to --depth levels).

Default target:
  https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=resources

Pipeline:
  1. Resources tab  - fetch with requests (falls back to headless Chromium via
                      Playwright when the tab is rendered by JavaScript), or parse
                      a page you saved yourself with --from-file.
  2. Crawl          - breadth-first fetch of every resource link. Each page's main
                      text, title, description and outgoing links are saved; links
                      found inside are followed until --depth / --max-pages is hit.
                      Crawling stays on each resource's own site (--scope).
  3. SSL            - servers that send an incomplete certificate chain are handled
                      the way browsers do: the missing intermediate is downloaded
                      from the certificate's AIA URL, its signatures are verified up
                      to a root already trusted by certifi, and only then is it added
                      to a local CA bundle (.certs/). Verification is never disabled.

Outputs (in --out):
  resources.json / .csv / .md     links from the Resources tab
  crawl/pages.json                every crawled page (text, links, metadata)
  crawl/pages.csv                 one-line summary per page
  crawl/files.csv                 downloadable files discovered (PDF, CSV, ...)
  crawl/pages/NNN_<slug>.md       readable text of each page
  files/                          downloaded files (with --download)
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import socket
import ssl
import sys
import time
from collections import deque
from dataclasses import asdict, dataclass, field
from pathlib import Path
from urllib.parse import unquote, urldefrag, urljoin, urlparse
from urllib.robotparser import RobotFileParser

import certifi
import requests
from bs4 import BeautifulSoup, Tag

DEFAULT_URL = (
    "https://www.spaceappschallenge.org/2026/challenges/"
    "health-monitoring-software/?tab=resources"
)
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0 Safari/537.36 SpaceAppsResourceScraper/2.0"
)
DOWNLOADABLE = {
    ".pdf", ".zip", ".csv", ".json", ".xlsx", ".xls", ".txt", ".nc", ".h5",
    ".hdf5", ".tar", ".gz", ".docx", ".doc", ".pptx", ".ppt", ".png", ".jpg",
    ".jpeg", ".gif", ".mp4", ".mp3", ".xml",
}
SKIP_HREF = re.compile(r"^(#|javascript:|mailto:|tel:|data:)", re.I)
HEADINGS = ["h1", "h2", "h3", "h4", "h5", "h6"]
NOISE_TAGS = ["script", "style", "noscript", "svg", "template", "iframe", "form"]
NOISE_SELECTORS = (
    "header, footer, nav, aside, [role=navigation], [role=banner], "
    "[role=contentinfo], [aria-hidden=true], .skip-link, .breadcrumb, .breadcrumbs"
)
SCRIPT_DIR = Path(__file__).resolve().parent


def log(msg: str) -> None:
    print(f"[scraper] {msg}", file=sys.stderr, flush=True)


def clean(text: str | None) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


# --------------------------------------------------------------------------- #
# SSL: complete broken certificate chains via AIA, safely
# --------------------------------------------------------------------------- #
class ChainFixer:
    """Keeps a CA bundle = certifi roots + intermediates fetched via AIA.

    An intermediate is only added when the full chain leaf -> fetched certs ->
    certifi root verifies signature by signature, so a hostile server cannot
    smuggle in its own CA.
    """

    MAX_HOPS = 4

    def __init__(self, cache_dir: Path) -> None:
        self.cache_dir = cache_dir
        self.extra_file = cache_dir / "intermediates.pem"
        self.tried: set[str] = set()
        self._roots = None

    # -- bundle -------------------------------------------------------------
    def bundle_path(self) -> str:
        if not self.extra_file.exists():
            return certifi.where()
        extra = self.extra_file.read_bytes()
        base = Path(certifi.where()).read_bytes()
        digest = hashlib.sha256(base + extra).hexdigest()[:12]
        path = self.cache_dir / f"ca-bundle-{digest}.pem"
        if not path.exists():
            for old in self.cache_dir.glob("ca-bundle-*.pem"):
                old.unlink(missing_ok=True)
            path.write_bytes(base + b"\n" + extra)
        return str(path)

    # -- repair -------------------------------------------------------------
    def repair(self, host: str, port: int = 443) -> bool:
        """Try to complete the chain for host. True if the bundle changed."""
        if host in self.tried:
            return False
        self.tried.add(host)
        try:
            from cryptography import x509
            from cryptography.hazmat.primitives.serialization import Encoding
            from cryptography.x509.oid import AuthorityInformationAccessOID, ExtensionOID
        except ImportError:
            log("install 'cryptography' to auto-fix incomplete certificate chains")
            return False

        try:
            leaf = x509.load_der_x509_certificate(self._peer_cert(host, port))
        except (OSError, ValueError) as exc:
            log(f"ssl-fix: cannot read certificate of {host}: {exc}")
            return False

        roots = self._certifi_roots(x509)
        chain: list = []
        current = leaf
        for _ in range(self.MAX_HOPS):
            anchor = self._find_issuer(current, roots)
            if anchor is not None:
                break  # current chains straight to a trusted root
            url = self._aia_url(current, x509, ExtensionOID, AuthorityInformationAccessOID)
            if not url:
                log(f"ssl-fix: {host}: no AIA issuer URL to follow")
                return False
            issuer = self._download_cert(url, x509)
            if issuer is None or issuer.subject == issuer.issuer:
                # Never import a self-signed cert: that would be a new root.
                log(f"ssl-fix: {host}: AIA did not yield a usable intermediate")
                return False
            try:
                current.verify_directly_issued_by(issuer)
            except Exception:
                log(f"ssl-fix: {host}: fetched issuer does not sign the certificate")
                return False
            chain.append(issuer)
            current = issuer
        else:
            log(f"ssl-fix: {host}: chain too long, giving up")
            return False

        if not chain:
            return False  # already chains to a root; error is something else
        try:
            current.verify_directly_issued_by(anchor)
        except Exception:
            log(f"ssl-fix: {host}: chain does not verify against a trusted root")
            return False

        existing = self.extra_file.read_bytes() if self.extra_file.exists() else b""
        added = 0
        for cert in chain:
            pem = cert.public_bytes(Encoding.PEM)
            if pem not in existing:
                existing += pem
                added += 1
        if not added:
            return False
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.extra_file.write_bytes(existing)
        names = ", ".join(c.subject.rfc4514_string() for c in chain)
        log(f"ssl-fix: {host}: added verified intermediate(s): {names}")
        return True

    @staticmethod
    def _peer_cert(host: str, port: int) -> bytes:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE  # only to *read* the leaf; never to fetch data
        with socket.create_connection((host, port), timeout=15) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as tls:
                return tls.getpeercert(binary_form=True)

    def _certifi_roots(self, x509):
        if self._roots is None:
            self._roots = x509.load_pem_x509_certificates(Path(certifi.where()).read_bytes())
        return self._roots

    @staticmethod
    def _find_issuer(cert, roots):
        for root in roots:
            if root.subject == cert.issuer:
                try:
                    cert.verify_directly_issued_by(root)
                    return root
                except Exception:
                    continue
        return None

    @staticmethod
    def _aia_url(cert, x509, ExtensionOID, AIAOID) -> str | None:
        try:
            aia = cert.extensions.get_extension_for_oid(ExtensionOID.AUTHORITY_INFORMATION_ACCESS)
        except x509.ExtensionNotFound:
            return None
        for desc in aia.value:
            if desc.access_method == AIAOID.CA_ISSUERS:
                return desc.access_location.value
        return None

    @staticmethod
    def _download_cert(url: str, x509):
        try:
            # AIA URLs are plain http by design; the cert is verified by signature.
            data = requests.get(url, timeout=15, headers={"User-Agent": USER_AGENT}).content
        except requests.RequestException:
            return None
        for loader in (x509.load_der_x509_certificate, x509.load_pem_x509_certificate):
            try:
                return loader(data)
            except ValueError:
                continue
        return None


# --------------------------------------------------------------------------- #
# HTTP client (robots.txt, SSL repair, polite delay)
# --------------------------------------------------------------------------- #
class Client:
    def __init__(self, delay: float, respect_robots: bool, cert_dir: Path) -> None:
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "en"})
        self.fixer = ChainFixer(cert_dir)
        self.session.verify = self.fixer.bundle_path()
        self.delay = delay
        self.respect_robots = respect_robots
        self.robots: dict[str, RobotFileParser | None] = {}
        self.last_hit: dict[str, float] = {}

    def get(self, url: str, **kw) -> requests.Response:
        host = urlparse(url).hostname or ""
        wait = self.delay - (time.monotonic() - self.last_hit.get(host, 0.0))
        if wait > 0:
            time.sleep(wait)
        kw.setdefault("timeout", 30)
        try:
            return self._get(url, host, **kw)
        except requests.exceptions.SSLError:
            port = urlparse(url).port or 443
            if self.fixer.repair(host, port):
                self.session.verify = self.fixer.bundle_path()
                return self._get(url, host, **kw)
            raise

    def _get(self, url: str, host: str, **kw) -> requests.Response:
        try:
            return self.session.get(url, **kw)
        finally:
            self.last_hit[host] = time.monotonic()

    def allowed(self, url: str) -> bool:
        if not self.respect_robots:
            return True
        p = urlparse(url)
        base = f"{p.scheme}://{p.netloc}"
        if base not in self.robots:
            rp: RobotFileParser | None = None
            try:
                resp = self.get(f"{base}/robots.txt", timeout=15)
                if resp.status_code < 400:
                    rp = RobotFileParser()
                    rp.parse(resp.text.splitlines())
            except requests.RequestException:
                rp = None
            self.robots[base] = rp
        rp = self.robots[base]
        return True if rp is None else rp.can_fetch(USER_AGENT, url)


# --------------------------------------------------------------------------- #
# Headless browser (lazy, shared across pages)
# --------------------------------------------------------------------------- #
class Browser:
    def __init__(self, headless: bool = True) -> None:
        self.headless = headless
        self._pw = self._browser = None

    @staticmethod
    def available() -> bool:
        try:
            import playwright.sync_api  # noqa: F401
            return True
        except ImportError:
            return False

    def _page(self):
        if self._browser is None:
            try:
                from playwright.sync_api import sync_playwright
            except ImportError as exc:
                raise SystemExit(
                    "Playwright is not installed. Run:\n"
                    "  pip install playwright && python -m playwright install chromium"
                ) from exc
            self._pw = sync_playwright().start()
            self._browser = self._pw.chromium.launch(headless=self.headless)
        return self._browser.new_page(user_agent=USER_AGENT)

    def render(self, url: str, open_resources_tab: bool = False) -> str:
        page = self._page()
        try:
            page.goto(url, wait_until="networkidle", timeout=60_000)
            if open_resources_tab:
                tab = re.compile(r"^\s*resources\s*$", re.I)
                for loc in (page.get_by_role("tab", name=tab),
                            page.get_by_role("link", name=tab),
                            page.get_by_role("button", name=tab)):
                    try:
                        if loc.count():
                            loc.first.click(timeout=3_000)
                            break
                    except Exception:
                        continue
            for label in ("Show more", "Load more", "View all", "See more"):
                try:
                    buttons = page.get_by_role("button", name=re.compile(label, re.I))
                    for i in range(min(buttons.count(), 10)):
                        buttons.nth(i).click(timeout=2_000)
                except Exception:
                    pass
            page.wait_for_timeout(1_500)
            return page.content()
        finally:
            page.close()

    def close(self) -> None:
        if self._browser is not None:
            self._browser.close()
            self._pw.stop()
            self._browser = self._pw = None


# --------------------------------------------------------------------------- #
# Resources tab parsing
# --------------------------------------------------------------------------- #
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
        self.domain = urlparse(self.url).netloc
        self.file_type = file_ext(self.url)


@dataclass
class PageResult:
    url: str
    challenge_title: str = ""
    challenge_summary: str = ""
    method: str = ""
    resources: list[Resource] = field(default_factory=list)


def file_ext(url: str) -> str:
    ext = Path(unquote(urlparse(url).path)).suffix.lower()
    return ext.lstrip(".") if ext in DOWNLOADABLE else ""


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
    for tab in soup.find_all(attrs={"role": "tab"}):
        if clean(tab.get_text()).lower() == "resources":
            panel_id = tab.get("aria-controls")
            if panel_id and (panel := soup.find(id=panel_id)):
                return panel
    for el in soup.find_all(True):
        attrs = " ".join([el.get("id") or "", " ".join(el.get("class") or [])]).lower()
        if "resource" in attrs and el.name not in ("a", "span", "button") and el.find("a", href=True):
            return el
    for h in soup.find_all(HEADINGS):
        if clean(h.get_text()).lower() in {"resources", "nasa data & resources", "resources tab"}:
            section = h.find_parent(["section", "article", "div"])
            if section and section.find("a", href=True):
                return section
    return None


def describe(anchor: Tag, title: str) -> str:
    block = anchor.find_parent(["li", "p", "tr", "article"]) or anchor.parent
    if not block:
        return ""
    text = clean(block.get_text(" "))
    if len(text) > 800:
        return ""
    return clean(text.replace(title, "", 1).strip(" -–—:|"))


def strip_noise(soup: BeautifulSoup) -> None:
    for t in soup(NOISE_TAGS):
        t.decompose()
    for t in soup.select(NOISE_SELECTORS):
        t.decompose()


def parse_html(html: str, base_url: str) -> list[Resource]:
    soup = BeautifulSoup(html, "lxml")
    strip_noise(soup)
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
        if "?tab=" in url and urlparse(url).path == urlparse(base_url).path:
            continue
        title = clean(el.get_text(" ")) or clean(el.get("aria-label")) or clean(el.get("title")) or url
        resources.append(Resource(title=title, url=url, section=section,
                                  description=describe(el, title)))
    return resources


def parse_next_data(html: str, base_url: str) -> list[Resource]:
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
        else:
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
# Crawling the resource links
# --------------------------------------------------------------------------- #
@dataclass
class CrawledPage:
    url: str
    depth: int
    seed: str                 # resource URL this page was reached from
    parent: str = ""
    final_url: str = ""
    status: int = 0
    content_type: str = ""
    method: str = ""          # static | browser
    title: str = ""
    description: str = ""
    text: str = ""
    links: list[str] = field(default_factory=list)
    files: list[str] = field(default_factory=list)
    error: str = ""


def normalize(url: str) -> str:
    url, _ = urldefrag(url)
    p = urlparse(url)
    if p.scheme not in ("http", "https"):
        return ""
    path = p.path or "/"
    return p._replace(netloc=p.netloc.lower(), path=path).geturl()


def content_root(soup: BeautifulSoup) -> Tag:
    return (soup.find("main") or soup.find(attrs={"role": "main"})
            or soup.find("article") or soup.body or soup)


def page_text(root: Tag) -> str:
    blocks = []
    for el in root.find_all(HEADINGS + ["p", "li", "td", "th", "blockquote", "pre", "dd", "dt"]):
        if el.find_parent(["li", "td", "blockquote"]) and el.name in ("p",):
            continue  # avoid duplicating paragraphs inside list items
        text = clean(el.get_text(" "))
        if not text:
            continue
        if el.name in HEADINGS:
            blocks.append(f"{'#' * int(el.name[1])} {text}")
        elif el.name == "li":
            blocks.append(f"- {text}")
        else:
            blocks.append(text)
    deduped, seen = [], set()
    for b in blocks:
        if b not in seen:
            seen.add(b)
            deduped.append(b)
    out = "\n\n".join(deduped)
    return out or clean(root.get_text(" "))


def parse_page(html: str, url: str) -> tuple[str, str, str, list[str], list[str]]:
    soup = BeautifulSoup(html, "lxml")
    title, desc = page_meta(soup)
    if soup.title and soup.title.string and not title:
        title = clean(soup.title.string)
    strip_noise(soup)
    root = content_root(soup)
    links, files = [], []
    for a in root.find_all("a", href=True):
        href = a["href"].strip()
        if not href or SKIP_HREF.match(href):
            continue
        absolute = normalize(urljoin(url, href))
        if not absolute:
            continue
        (files if file_ext(absolute) else links).append(absolute)
    return title, desc, page_text(root), list(dict.fromkeys(links)), list(dict.fromkeys(files))


def in_scope(url: str, seed: str, scope: str) -> bool:
    if scope == "any":
        return True
    u, s = urlparse(url), urlparse(seed)
    same_site = u.netloc.removeprefix("www.") == s.netloc.removeprefix("www.")
    if scope == "domain":
        return same_site
    prefix = s.path if s.path.endswith("/") else s.path.rsplit("/", 1)[0] + "/"
    return same_site and u.path.startswith(prefix)


def crawl(seeds: list[Resource], client: Client, browser: Browser, *, depth: int,
          max_pages: int, scope: str, render: str, max_chars: int,
          exclude: set[str]) -> tuple[list[CrawledPage], dict[str, str]]:
    """BFS from the resource links. Returns pages and {file_url: found_on_page}."""
    queue: deque[tuple[str, int, str, str]] = deque()
    seen: set[str] = set(exclude)
    files: dict[str, str] = {}
    for r in seeds:
        u = normalize(r.url)
        if not u or u in seen:
            continue
        seen.add(u)
        if r.file_type:
            files.setdefault(u, "(resources tab)")
        else:
            queue.append((u, 1, u, ""))

    pages: list[CrawledPage] = []
    while queue and len(pages) < max_pages:
        url, d, seed, parent = queue.popleft()
        page = CrawledPage(url=url, depth=d, seed=seed, parent=parent)
        pages.append(page)
        log(f"[{len(pages)}/{max_pages}] depth {d}: {url}")

        if not client.allowed(url):
            page.error = "disallowed by robots.txt"
            continue
        html = ""
        try:
            if render == "always":
                raise _Render()
            resp = client.get(url)
            page.status = resp.status_code
            page.final_url = resp.url
            page.content_type = resp.headers.get("Content-Type", "").split(";")[0].strip()
            if resp.status_code >= 400:
                page.error = f"HTTP {resp.status_code}"
                continue
            if "html" not in page.content_type:
                files.setdefault(url, parent or "(resources tab)")
                page.error = f"not HTML ({page.content_type or 'unknown'}) - listed as file"
                continue
            html = resp.text
            page.method = "static"
        except _Render:
            pass
        except requests.RequestException as exc:
            page.error = f"{type(exc).__name__}: {exc}"
            if render == "never" or not Browser.available():
                continue

        parsed = parse_page(html, page.final_url or url) if html else None
        too_thin = parsed is None or len(parsed[2]) < 300
        if too_thin and render != "never" and Browser.available():
            try:
                html = browser.render(url)
                page.method, page.error = "browser", ""
                parsed = parse_page(html, url)
            except Exception as exc:  # playwright raises many types
                page.error = page.error or f"browser render failed: {exc}"
        if parsed is None:
            continue

        page.title, page.description, text, page.links, page.files = parsed
        page.text = text[:max_chars]
        for f in page.files:
            files.setdefault(f, url)
        if d < depth:
            for link in page.links:
                if link not in seen and in_scope(link, seed, scope):
                    seen.add(link)
                    queue.append((link, d + 1, seed, url))

    if queue:
        log(f"stopped at --max-pages {max_pages}; {len(queue)} queued links not fetched")
    return pages, files


class _Render(Exception):
    """Internal signal: skip the static fetch and render in the browser."""


# --------------------------------------------------------------------------- #
# Output
# --------------------------------------------------------------------------- #
def safe_name(name: str, limit: int = 80) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("_")[:limit] or "file"


def download(urls: dict[str, str], folder: Path, client: Client) -> dict[str, str]:
    folder.mkdir(parents=True, exist_ok=True)
    saved: dict[str, str] = {}
    for url in urls:
        if not client.allowed(url):
            log(f"robots.txt disallows {url}")
            continue
        name = safe_name(Path(unquote(urlparse(url).path)).name)
        target = folder / name
        if target.exists():
            target = folder / f"{hashlib.sha1(url.encode()).hexdigest()[:8]}_{name}"
        try:
            with client.get(url, stream=True, timeout=120) as resp:
                resp.raise_for_status()
                with open(target, "wb") as fh:
                    for chunk in resp.iter_content(65_536):
                        fh.write(chunk)
            saved[url] = str(target)
            log(f"downloaded {target.name}")
        except requests.RequestException as exc:
            log(f"could not download {url}: {exc}")
    return saved


def write_resources(result: PageResult, out: Path) -> None:
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


def write_crawl(pages: list[CrawledPage], files: dict[str, str], saved: dict[str, str],
                out: Path) -> None:
    folder = out / "crawl"
    pages_dir = folder / "pages"
    pages_dir.mkdir(parents=True, exist_ok=True)
    for old in pages_dir.glob("*.md"):
        old.unlink()

    (folder / "pages.json").write_text(json.dumps(
        {"crawled_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
         "count": len(pages), "pages": [asdict(p) for p in pages]},
        indent=2, ensure_ascii=False), "utf-8")

    with open(folder / "pages.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["n", "depth", "status", "method", "title", "url", "parent", "seed",
                    "chars", "links", "files", "error", "text_file"])
        for i, p in enumerate(pages, 1):
            text_file = ""
            if p.text:
                text_file = f"pages/{i:03d}_{safe_name(p.title or urlparse(p.url).path, 60)}.md"
                body = [f"# {p.title or p.url}", "", f"- URL: {p.final_url or p.url}",
                        f"- Depth: {p.depth} (from {p.parent or 'Resources tab'})"]
                if p.description:
                    body.append(f"- Summary: {p.description}")
                body += ["", p.text, ""]
                if p.files:
                    body += ["## Files on this page", ""] + [f"- {f}" for f in p.files] + [""]
                (folder / text_file).write_text("\n".join(body), "utf-8")
            w.writerow([i, p.depth, p.status, p.method, p.title, p.url, p.parent, p.seed,
                        len(p.text), len(p.links), len(p.files), p.error, text_file])

    with open(folder / "files.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["url", "type", "found_on", "local_file"])
        for url, found_on in files.items():
            w.writerow([url, file_ext(url), found_on, saved.get(url, "")])


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass

    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default=DEFAULT_URL, help="challenge page URL")
    ap.add_argument("--out", default="output", help="output folder (default: output)")
    ap.add_argument("--mode", choices=["auto", "static", "browser"], default="auto",
                    help="how to load the Resources tab (default: auto)")
    ap.add_argument("--from-file", help="parse a saved Resources page instead of fetching it")
    ap.add_argument("--depth", type=int, default=2,
                    help="crawl depth: 0 = Resources tab only, 1 = the resource pages, "
                         "2 = also links inside them, ... (default: 2)")
    ap.add_argument("--max-pages", type=int, default=150, help="crawl page budget (default: 150)")
    ap.add_argument("--scope", choices=["path", "domain", "any"], default="domain",
                    help="which links to follow: same site as the resource (domain, default), "
                         "same site and folder (path), or anything (any)")
    ap.add_argument("--render", choices=["auto", "never", "always"], default="auto",
                    help="use headless Chromium for crawled pages: auto = only when static "
                         "HTML has little text (default)")
    ap.add_argument("--max-chars", type=int, default=50_000, help="max text stored per page")
    ap.add_argument("--download", action="store_true", help="download linked files (PDF, CSV, ZIP...)")
    ap.add_argument("--delay", type=float, default=1.0, help="seconds between requests to the same host")
    ap.add_argument("--headed", action="store_true", help="show the browser window")
    ap.add_argument("--ignore-robots", action="store_true",
                    help="skip robots.txt checks (your responsibility)")
    ap.add_argument("--cert-cache", default=str(SCRIPT_DIR / ".certs"),
                    help="where verified intermediate certificates are cached")
    args = ap.parse_args(argv)

    out = Path(args.out)
    client = Client(args.delay, not args.ignore_robots, Path(args.cert_cache))
    browser = Browser(headless=not args.headed)
    try:
        # 1. Resources tab ---------------------------------------------------
        if args.from_file:
            result = extract(Path(args.from_file).read_text("utf-8", errors="ignore"), args.url)
            result.method = "file"
        else:
            if not client.allowed(args.url):
                log("robots.txt disallows automated access to this URL. Save the page "
                    "from your browser and use --from-file, or pass --ignore-robots.")
                return 2
            result = PageResult(url=args.url)
            if args.mode in ("auto", "static"):
                try:
                    resp = client.get(args.url)
                    resp.raise_for_status()
                    result = extract(resp.text, args.url)
                    result.method = "static"
                    log(f"static fetch found {len(result.resources)} links")
                except requests.RequestException as exc:
                    log(f"static fetch failed: {exc}")
            if args.mode == "browser" or (args.mode == "auto" and len(result.resources) < 3):
                log("rendering Resources tab in headless Chromium...")
                result = extract(browser.render(args.url, open_resources_tab=True), args.url)
                result.method = "browser"

        if not result.resources:
            log("no resources found - try --mode browser --headed, or --from-file.")
        write_resources(result, out)
        log(f"{len(result.resources)} resources -> {out.resolve()}")
        for r in result.resources:
            print(f"[{r.section or '-'}] {r.title} -> {r.url}")

        # 2. Crawl -----------------------------------------------------------
        pages, files = [], {}
        if args.depth > 0 and result.resources:
            log(f"crawling resources: depth={args.depth} scope={args.scope} "
                f"max-pages={args.max_pages}")
            pages, files = crawl(result.resources, client, browser, depth=args.depth,
                                 max_pages=args.max_pages, scope=args.scope,
                                 render=args.render, max_chars=args.max_chars,
                                 exclude={normalize(args.url)})
        else:
            files = {normalize(r.url): "(resources tab)" for r in result.resources if r.file_type}

        # 3. Files -----------------------------------------------------------
        saved: dict[str, str] = {}
        if args.download and files:
            saved = download(files, out / "files", client)
            for r in result.resources:
                if normalize(r.url) in saved:
                    r.local_file = str(Path(saved[normalize(r.url)]).relative_to(out))
            write_resources(result, out)

        if pages or files:
            write_crawl(pages, files, saved, out)
            ok = sum(1 for p in pages if p.text)
            failed = [p for p in pages if p.error and not p.text]
            log(f"crawl done: {ok} pages with text, {len(failed)} failed/skipped, "
                f"{len(files)} files found -> {(out / 'crawl').resolve()}")
            for p in failed:
                log(f"  ! {p.url}: {p.error}")
    finally:
        browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
