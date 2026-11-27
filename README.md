# Grace Njoki Kimotho · Biomedical Engineering Research & Innovation Lab

Source of the lab website: academic profile, research write-ups, project pages and four working web applications.

| Section | What it is | Evidence type |
|---|---|---|
| Research: hip implant FEA | Write-up of the CATIA V5 / ANSYS reproduction study | Completed work (ANSYS figures to be released) |
| Research: smart glasses | Final-year project, Top 4 of ~60 groups | Completed work |
| AI lab | Breast-mass classifier trained on WDBC, running in the browser; PneumoniaMNIST CNN pipeline | Real experiment; CNN not yet trained |
| Biomechanics lab | Neck stress, Goodman fatigue, Hertz contact, Archard wear, sensitivity, mesh-study checker | Python/JS calculations, not FEA |
| Smart glasses simulator | Technician view + expert console, annotation, part identification, troubleshooting scripts | Simulation, no live video |
| Equipment intelligence | Inventory, QR, PM scheduling, breakdowns, MTTR/MTBF/availability, CSV/JSON export | Working app, fictional data |
| Devices lab | Focus areas and 12-section documentation template | Template |

## Structure
```
src/pages/*.html   page bodies (first line: JSON title/description)
src/style.css      design system (bright blue, teal, white)
assets/js/         site.js, forms.js, ai.js, hipcalc.js, biomech.js, glasses.js, eqcore.js, equipment.js
assets/data/       WDBC model and results exported by medical-imaging-ai-research
assets/vendor/     qrcode.js (Kazuhiko Arase, MIT)
build.py           builds dist/ (multi-page, for hosting) and spa/ (single file)
tests/             node:test unit tests and Playwright browser tests
```

## Build and preview
```bash
python3 build.py                                   # no dependencies
python3 -m http.server -d dist 8000                # open http://localhost:8000
```

## Test
```bash
node --test tests/eqcore.test.js
pip install pytest playwright && python -m playwright install chromium
cd tests && npm install && cd ..                   # axe-core for accessibility checks
CHROME_PATH=$(python -c "from playwright.sync_api import sync_playwright as s; p=s().start(); print(p.chromium.executable_path); p.stop()") python -m pytest -q tests/test_browser.py
```

## Deploy
See `DEPLOY.md`. GitHub Pages deploys automatically through `.github/workflows/deploy.yml`.

## Editing content
Edit a file in `src/pages/`, run `python3 build.py`, commit. Links between pages are written `href="@page-id"`.

## Licence
Code MIT. Text, CV content and research write-ups © 2026 Grace Njoki Kimotho.
