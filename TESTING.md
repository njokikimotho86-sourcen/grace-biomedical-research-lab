# Testing report · 27/11/2026

All tests below were actually run in the build environment (Linux, Python 3.13, Node 22, Chromium via Playwright 1.63).

| Suite | Tests | Passed | Failed |
|---|---|---|---|
| Website: equipment core unit tests (node:test) | 11 | 11 | 0 |
| Website: Playwright browser tests | 57 | 57 | 0 |
| medical-imaging-ai-research (pytest) | 5 | 5 | 0 |
| computational-hip-implant-biomechanics (pytest, incl. JS/Python parity) | 9 | 9 | 0 |
| hospital-equipment-intelligence (node:test) | 11 | 11 | 0 |
| **Total** | **93** | **93** | **0** |

## What the browser tests cover
- Every one of the 22 pages: loads with no JavaScript errors, one `<h1>`, title and meta description.
- Mobile: no horizontal scrolling at 360 px width on all 22 pages.
- Every internal link resolves to an existing page.
- Accessibility: axe-core WCAG 2 A/AA checks on 7 key pages, no serious or critical violations.
- AI lab: displayed metrics match the experiment output; browser probability matches the Python probability for the same case (within 0.0006); threshold slider recalculates.
- Biomechanics: results update on input; invalid input shows an error; mesh-study verdict; sensitivity chart.
- Equipment: validation, register, duplicate-serial rejection, search, QR rendering, breakdown logging, status change, persistence after reload.
- Smart glasses: expert annotation appears on the technician canvas; instruction reaches the HUD; part identification; scenario branching.
- Single-file version: hash routing between views.

## Errors found and fixed during testing
1. Header overflowed phone screens (brand + menu): fixed layout.
2. White text on the teal buttons failed WCAG contrast (3.25:1): darker teal (#0A7C78).
3. Cycles-per-year input rejected its own default value (step mismatch), which blanked the biomechanics results: fixed.
4. Desktop navigation wrapped onto two lines: moved to a single row.

## Not tested / known limitations
- Real devices (iOS Safari, Android Chrome) not tested; only Chromium emulation.
- Camera in the smart-glasses simulator not tested (no camera in the build environment); falls back to photo upload.
- Performance measured informally only: no server, no frameworks, the largest page is the AI lab (~60 KB plus data).
- Google Fonts could not load in the build environment; pages fall back to system fonts.
- The PneumoniaMNIST CNN was tested on random tensors only; it has not been trained.
- In the claude.ai preview, file downloads are blocked; the export tab also shows and copies the data.
