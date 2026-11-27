#!/usr/bin/env python3
"""Static site builder (no dependencies).

src/pages/<id>.html  -> page bodies; first line is a JSON comment with title/desc.
Links inside pages are written as href="@id" or href="@id#anchor".

Outputs:
  dist/      multi-page site for GitHub Pages / Cloudflare Pages / Vercel (SEO, sitemap)
  spa/       single-file version (index.html) with hash routing, used for the
             claude.ai artifact preview where page-to-page navigation is not guaranteed
Usage: python3 build.py [--base https://your-domain]
"""
import json
import os
import re
import shutil
import sys
from datetime import date

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
BASE = sys.argv[sys.argv.index("--base") + 1].rstrip("/") if "--base" in sys.argv else ""  # set to the live URL so canonical links and the sitemap are absolute

NAV = [("index", "Home"), ("about", "About"), ("research", "Research"), ("projects", "Projects"),
       ("ai-lab", "AI lab"), ("biomechanics", "Biomechanics"), ("smart-glasses", "Smart glasses"),
       ("equipment", "Equipment"), ("devices", "Devices"), ("publications", "Publications"),
       ("open-source", "Open source"), ("collaborate", "Collaborate"), ("contact", "Contact")]

SCRIPTS = {  # page id -> extra scripts (relative to assets/)
    "ai-lab": ["js/ai.js"],
    "biomechanics": ["js/hipcalc.js", "js/biomech.js"],
    "smart-glasses": ["js/glasses.js"],
    "equipment": ["vendor/qrcode.js", "js/eqcore.js", "js/equipment.js"],
}
INLINE_DATA = {"ai-lab": [("wdbc-model", "data/wdbc_model.json"), ("wdbc-results", "data/wdbc_results.json")]}


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def pages():
    out = []
    for fn in sorted(os.listdir(os.path.join(SRC, "pages"))):
        if not fn.endswith(".html"):
            continue
        raw = read(os.path.join(SRC, "pages", fn))
        m = re.match(r"<!--(\{.*?\})-->\n", raw, re.S)
        meta = json.loads(m.group(1))
        out.append(dict(id=fn[:-5], body=raw[m.end():], **meta))
    return out


def nav_html(active, link):
    items = "".join(
        f'<a href="{link(i)}"{" aria-current=page" if i == active or (active.startswith(("research-", "project-")) and i == active.split("-")[0] + ("" if i == "research" else "s")) else ""}>{t}</a>'
        for i, t in NAV)
    return items


def shell(p, body, link, css, scripts, inline_css=False, data_blocks=""):
    title = p["title"] if p["id"] == "index" else f'{p["title"]} | Grace Njoki Kimotho'
    canonical = f'{BASE}/{"" if p["id"] == "index" else p["id"] + ".html"}'
    navs = nav_html(p["id"], link)
    style = f"<style>{css}</style>" if inline_css else '<link rel="stylesheet" href="assets/style.css">'
    ld = json.dumps({"@context": "https://schema.org", "@type": "Person", "name": "Grace Njoki Kimotho",
                     "jobTitle": "Biomedical Engineer", "alumniOf": "Kirinyaga University",
                     "worksFor": "Paula Solutions Limited", "address": {"@type": "PostalAddress", "addressCountry": "KE"},
                     "email": "mailto:gnjoki705@gmail.com"})
    return f"""<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{p['desc']}">
<meta name="author" content="Grace Njoki Kimotho">
{"<link rel=canonical href=" + chr(34) + canonical + chr(34) + ">" if BASE else ""}
<meta property="og:title" content="{title}"><meta property="og:description" content="{p['desc']}">
<meta property="og:type" content="website">
<meta name="theme-color" content="#0B2545">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230E9F9A'/%3E%3Ctext x='16' y='22' font-family='Arial' font-weight='700' font-size='15' fill='white' text-anchor='middle'%3EGN%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@400;700&family=Red+Hat+Text:wght@400;600&display=swap" rel="stylesheet">
{style}
<script type="application/ld+json">{ld}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="wrap">
<a class="brand" href="{link('index')}"><span class="mono" aria-hidden="true">GN</span><span>Grace Njoki Kimotho<small>Biomedical Engineering Research &amp; Innovation Lab</small></span></a>
<nav class="main" aria-label="Main">{navs}</nav>
<details class="menu"><summary aria-label="Open menu">Menu</summary><nav aria-label="Mobile">{navs}</nav></details>
</div></header>
<main id="main">
{body}
</main>
<footer><div class="wrap g2">
<div><strong>Grace Njoki Kimotho</strong><br>Biomedical Engineer · Nairobi, Kenya<br>Email: <a href="mailto:gnjoki705@gmail.com">gnjoki705@gmail.com</a></div>
<div>Research demonstrations on this site are not clinically validated and are not medical devices. Equipment records are fictional. Last built {date.today().strftime('%d/%m/%Y')}.</div>
</div></footer>
{data_blocks}
<script src="assets/js/site.js"></script>
<script src="assets/js/forms.js"></script>
{scripts}
</body>
</html>
"""


def build_multi(ps):
    dist = os.path.join(ROOT, "dist")
    shutil.rmtree(dist, ignore_errors=True)
    shutil.copytree(os.path.join(ROOT, "assets"), os.path.join(dist, "assets"))
    shutil.copy(os.path.join(SRC, "style.css"), os.path.join(dist, "assets", "style.css"))
    link = lambda i: ("index.html" if i.split("#")[0] == "index" else i.split("#")[0] + ".html") + ("#" + i.split("#")[1] if "#" in i else "")
    for p in ps:
        body = re.sub(r'href="@([\w-]+(?:#[\w-]+)?)"', lambda m: f'href="{link(m.group(1))}"', p["body"])
        scripts = "".join(f'<script src="assets/{s}"></script>' for s in SCRIPTS.get(p["id"], []))
        data = "".join(f'<script type="application/json" id="{k}">{read(os.path.join(ROOT, "assets", f))}</script>' for k, f in INLINE_DATA.get(p["id"], []))
        with open(os.path.join(dist, p["id"] + ".html"), "w", encoding="utf-8") as f:
            f.write(shell(p, body, link, "", scripts, data_blocks=data))
    today = date.today().isoformat()
    urls = "".join(f"<url><loc>{BASE}/{'' if p['id'] == 'index' else p['id'] + '.html'}</loc><lastmod>{today}</lastmod></url>" for p in ps if p["id"] != "404")
    if not BASE:
        print("note: no --base given; sitemap.xml lists relative paths. Rebuild with --base https://your-site to make it valid.")
    with open(os.path.join(dist, "sitemap.xml"), "w") as f:
        f.write(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>\n')
    with open(os.path.join(dist, "robots.txt"), "w") as f:
        f.write("User-agent: *\nAllow: /\n" + (f"Sitemap: {BASE}/sitemap.xml\n" if BASE else ""))
    with open(os.path.join(dist, "_headers"), "w") as f:  # Cloudflare Pages / Netlify security headers
        f.write("/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n"
                "  Permissions-Policy: camera=(self), microphone=(), geolocation=()\n"
                "  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'self'\n")
    with open(os.path.join(dist, ".nojekyll"), "w") as f:
        f.write("")
    return dist


def build_spa(ps):
    spa = os.path.join(ROOT, "spa")
    shutil.rmtree(spa, ignore_errors=True)
    os.makedirs(spa)
    link = lambda i: "#" + (i.split("#")[0] if "#" not in i else i.split("#")[0])
    sections = []
    for p in ps:
        if p["id"] == "404":
            continue
        body = re.sub(r'href="@([\w-]+(?:#[\w-]+)?)"', lambda m: f'href="{link(m.group(1))}"', p["body"])
        sections.append(f'<div class="view" id="view-{p["id"]}" data-title="{p["title"]}" hidden>{body}</div>')
    allscripts = []
    for p in ps:
        for s in SCRIPTS.get(p["id"], []):
            if s not in allscripts:
                allscripts.append(s)
    scripts = "".join(f"<script>{read(os.path.join(ROOT, 'assets', s))}</script>" for s in allscripts)
    data = "".join(f'<script type="application/json" id="{k}">{read(os.path.join(ROOT, "assets", f))}</script>' for p in ps for k, f in INLINE_DATA.get(p["id"], []))
    home = next(p for p in ps if p["id"] == "index")
    html = shell(dict(home, title="Grace Njoki Kimotho | Biomedical Engineering Research & Innovation Lab"), "\n".join(sections), link,
                 read(os.path.join(SRC, "style.css")), scripts, inline_css=True, data_blocks=data)
    html = html.replace('<script src="assets/js/site.js"></script>', f"<script>{read(os.path.join(ROOT, 'assets/js/site.js'))}</script>")
    html = html.replace('<script src="assets/js/forms.js"></script>', f"<script>{read(os.path.join(ROOT, 'assets/js/forms.js'))}</script>")
    with open(os.path.join(spa, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)
    return spa


if __name__ == "__main__":
    ps = pages()
    print("pages:", len(ps), "->", build_multi(ps), build_spa(ps))
