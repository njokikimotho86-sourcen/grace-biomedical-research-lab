"""Browser tests with Playwright (Chromium). Run: python3 -m pytest tests/test_browser.py
Serves dist/ on a local port, then checks every page and each application."""
import http.server
import os
import re
import socketserver
import threading
from functools import partial

import pytest
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST, SPA = os.path.join(ROOT, "dist"), os.path.join(ROOT, "spa")
AXE = os.path.join(ROOT, "tests", "node_modules", "axe-core", "axe.min.js")
PAGES = sorted(f for f in os.listdir(DIST) if f.endswith(".html"))


def serve(d):
    h = partial(http.server.SimpleHTTPRequestHandler, directory=d)
    h.log_message = lambda *a: None
    s = socketserver.TCPServer(("127.0.0.1", 0), h)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s, f"http://127.0.0.1:{s.server_address[1]}"


@pytest.fixture(scope="session")
def base():
    s, url = serve(DIST)
    yield url
    s.shutdown()


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH", "/usr/bin/google-chrome"), args=["--no-sandbox"])
        yield b
        b.close()


@pytest.fixture
def page(browser):
    ctx = browser.new_context(reduced_motion="reduce")
    pg = ctx.new_page()
    pg.errors = []
    pg.on("pageerror", lambda e: pg.errors.append(str(e)))
    pg.on("console", lambda m: pg.errors.append(m.text) if m.type == "error" and "fonts.g" not in m.text and "ERR_" not in m.text else None)
    yield pg
    ctx.close()


@pytest.mark.parametrize("name", PAGES)
def test_page_loads_cleanly(page, base, name):
    page.goto(f"{base}/{name}")
    assert page.locator("h1").count() == 1
    assert page.title()
    assert page.locator('meta[name="description"]').get_attribute("content")
    assert not page.errors, page.errors


@pytest.mark.parametrize("name", PAGES)
def test_no_horizontal_overflow_on_phone(browser, base, name):
    ctx = browser.new_context(viewport={"width": 360, "height": 740}, is_mobile=True)
    pg = ctx.new_page()
    pg.goto(f"{base}/{name}")
    pg.wait_for_timeout(150)
    sw = pg.evaluate("document.documentElement.scrollWidth")
    ctx.close()
    assert sw <= 361, f"{name} scrollWidth {sw}"


def test_internal_links_resolve(page, base):
    bad = []
    for name in PAGES:
        page.goto(f"{base}/{name}")
        for href in set(page.eval_on_selector_all("a[href]", "as => as.map(a => a.getAttribute('href'))")):
            if href.startswith(("http", "mailto:", "#")):
                continue
            target = href.split("#")[0]
            if target and not os.path.exists(os.path.join(DIST, target)):
                bad.append((name, href))
    assert not bad, bad


@pytest.mark.parametrize("name", ["index.html", "ai-lab.html", "biomechanics.html", "equipment.html", "smart-glasses.html", "collaborate.html", "research-hip-implant.html"])
def test_accessibility_axe(page, base, name):
    page.goto(f"{base}/{name}")
    page.add_script_tag(path=AXE)
    res = page.evaluate("axe.run(document, {runOnly: ['wcag2a','wcag2aa']})")
    serious = [(v["id"], v["help"], len(v["nodes"])) for v in res["violations"] if v["impact"] in ("serious", "critical")]
    assert not serious, serious


def test_ai_lab_real_metrics_and_threshold(page, base):
    page.goto(f"{base}/ai-lab.html")
    assert "97.4%" in page.inner_text("#ai-stats")  # accuracy from results.json
    assert "0.995" in page.inner_text("#ai-stats")
    page.click('[data-tab="run"]')
    p0 = page.inner_text("#ai-p")
    assert re.match(r"\d+\.\d%", p0)
    # browser probability equals the Python-recorded probability for the case
    rec = float(re.search(r"Python recorded p = ([\d.]+)", page.inner_text("#ai-verdict")).group(1))
    assert abs(float(p0.rstrip("%")) / 100 - rec) < 0.0006
    page.fill("#ai-thr", "0.2")
    page.dispatch_event("#ai-thr", "input")
    assert "0.20" in page.inner_text("#ai-thrv")
    assert "false negatives" in page.inner_text("#ai-thrm")
    assert not page.errors


def test_biomechanics_updates_and_validates(page, base):
    page.goto(f"{base}/biomechanics.html")
    before = page.inner_text("#bm-out .stat >> nth=0")
    page.fill("#bm-F", "4000")
    assert page.inner_text("#bm-out .stat >> nth=0") != before
    page.fill("#bm-d", "-3")
    assert page.is_visible("#bm-err")
    page.fill("#bm-d", "18")
    page.fill("#ms1", "300"); page.fill("#ms2", "318"); page.fill("#ms3", "322")
    assert "Converged" in page.inner_text("#ms-out")
    assert page.locator("#bm-sens .bar").count() == 5
    assert not page.errors


def test_equipment_crud_breakdown_and_qr(page, base):
    page.goto(f"{base}/equipment.html")
    page.click('[data-tab="reg"]')
    page.click('#ef-save')
    assert "required" in page.inner_text("#ef-err")
    for k, v in {"ef-name": "Test ventilator", "ef-category": "Life support", "ef-serial": "TEST-123", "ef-department": "ICU", "ef-installDate": "2025-03-01"}.items():
        page.fill(f"#{k}", v)
    page.click("#ef-save")
    assert "Saved GNL-EQ-0017" in page.inner_text("#ef-ok")
    page.click("#ef-new")
    for k, v in {"ef-name": "Duplicate", "ef-category": "x", "ef-serial": "test-123", "ef-department": "ICU", "ef-installDate": "2025-03-01"}.items():
        page.fill(f"#{k}", v)
    page.click("#ef-save")
    assert "already registered" in page.inner_text("#ef-err")
    page.click('[data-tab="inv"]')
    page.fill("#eq-q", "ventilator")
    assert "1 of 17" in page.inner_text("#eq-count")
    page.click('[data-view="GNL-EQ-0017"]')
    assert page.locator("#eq-detail svg").count() >= 1
    page.click('[data-log="GNL-EQ-0017"]')
    page.fill("#ev-desc", "Fails to power on")
    page.click('#ev-form button[type="submit"]')
    assert "Out of service" in page.inner_text("#ev-ok")
    assert "GNL-EQ-0017" in page.inner_text("#eq-open")
    page.reload()  # persisted in localStorage
    page.click('[data-tab="inv"]')
    page.fill("#eq-q", "ventilator")
    assert "1 of 17" in page.inner_text("#eq-count")
    assert not page.errors


def test_smart_glasses_annotation_reaches_technician_view(page, base):
    page.goto(f"{base}/smart-glasses.html")
    page.locator("#sg-stageE").scroll_into_view_if_needed()
    box = page.locator("#sg-stageE").bounding_box()
    page.mouse.move(box["x"] + 40, box["y"] + 40); page.mouse.down()
    page.mouse.move(box["x"] + 160, box["y"] + 120, steps=8); page.mouse.up()
    lit = page.evaluate("""() => { const c = document.querySelector('#sg-stageT canvas'); const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for (let i=3;i<d.length;i+=4) if (d[i]) n++; return n; }""")
    assert lit > 50
    page.fill("#sg-msg", "Reseat the SpO2 connector")
    page.click("#sg-send")
    assert page.inner_text("#sg-hud") == "Reseat the SpO2 connector"
    page.click("#sg-id")
    page.click('#sg-stageT .hs[aria-label="SpO2 port"]')
    assert "SpO2 port" in page.inner_text("#sg-part")
    page.click('#sg-step button:has-text("Yes")')
    assert "Step 2" in page.inner_text("#sg-step")
    assert not page.errors


def test_spa_routing(browser):
    s, url = serve(SPA)
    pg = browser.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(url + "/index.html#equipment")
    pg.wait_for_selector("#view-equipment", state="visible", timeout=10000)
    assert not pg.is_visible("#view-index")
    pg.click('nav.main a[href="#ai-lab"]')
    assert pg.is_visible("#view-ai-lab")
    assert "97.4%" in pg.inner_text("#ai-stats")
    pg.goto(url + "/index.html#biomechanics")
    assert pg.locator("#bm-out .stat").count() >= 3
    pg.close(); s.shutdown()
    assert not errs, errs
