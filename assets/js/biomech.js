/* Biomechanics dashboard UI. All maths lives in hipcalc.js (unit-tested against Python). */
{
  const H = window.HipCalc, $ = id => document.getElementById(id);
  if (H && $('bm-form')) {
    const fmt = (v, d = 1) => Number.isFinite(v) ? v.toLocaleString('en-GB', { maximumFractionDigits: d, minimumFractionDigits: d }) : '–';
    const sci = v => Number.isFinite(v) ? v.toExponential(2) : '–';
    const opt = (el, list, sel) => { el.innerHTML = list.map(k => `<option${k === sel ? ' selected' : ''}>${k}</option>`).join(''); };
    const metals = Object.keys(H.MATERIALS).filter(k => H.MATERIALS[k].ductile);
    opt($('bm-stem'), metals, 'Ti-6Al-4V');
    opt($('bm-head'), ['CoCrMo', 'Alumina', 'Ti-6Al-4V', '316L SS'], 'CoCrMo');
    opt($('bm-cup'), ['UHMWPE', 'Alumina', 'CoCrMo'], 'UHMWPE');
    $('bm-act').innerHTML = '<option value="">Custom force</option>' + Object.entries(H.ACTIVITIES).map(([k, v]) => `<option value="${v}"${v === 2077 ? ' selected' : ''}>${k}: ${v.toLocaleString('en-GB')} N</option>`).join('');
    $('bm-act').addEventListener('change', e => { if (e.target.value) { $('bm-F').value = e.target.value; calc(); } });

    const ids = { F: 'bm-F', thetaDeg: 'bm-th', d: 'bm-d', L: 'bm-L', R: 'bm-R', D: 'bm-D', c: 'bm-c', k: 'bm-k', arc: 'bm-arc', cycles: 'bm-cyc', years: 'bm-yr', tp: 'bm-tp', delta: 'bm-dl', dT: 'bm-dT', LT: 'bm-LT' };
    const KEY = 'gnk-biomech-v1';
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) for (const k in ids) if (s[k] !== undefined) $(ids[k]).value = s[k]; if (s?.stem) $('bm-stem').value = s.stem; } catch (e) { /* storage unavailable */ }

    const read = () => {
      const p = { stem: $('bm-stem').value, head: $('bm-head').value, cup: $('bm-cup').value };
      for (const k in ids) { const el = $(ids[k]); if (el.value === '' || !el.checkValidity()) throw new RangeError(`Check “${el.labels[0].textContent}”`); p[k] = +el.value; }
      return p;
    };
    let last = null;
    const calc = () => {
      let p, r;
      try { p = read(); r = H.run(p); $('bm-err').classList.remove('on'); }
      catch (e) { $('bm-err').textContent = e.message; $('bm-err').classList.add('on'); return; }
      last = p;
      try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* ignore */ }
      const m = H.MATERIALS[p.stem], n = r.fat?.n;
      const verdict = n >= 2 ? 'comfortable margin' : n >= 1 ? 'positive but thin margin' : 'below 1: finite life predicted';
      $('bm-out').innerHTML = `<h3>Results <span class="tag sim">Python/JS calculation</span></h3>
        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,140px),1fr))">
        <div><div class="stat">${fmt(r.neck.sMax)}</div><div class="statl">peak neck stress, MPa</div></div>
        <div><div class="stat">${fmt(n, 2)}</div><div class="statl">Goodman safety factor (${verdict})</div></div>
        <div><div class="stat">${fmt(r.eps * 1e6, 0)}</div><div class="statl">peak strain, µε</div></div></div>
        <div class="scroll sec"><table><tbody>
        <tr><td>Cross-section area</td><td class="n">${fmt(r.neck.A)} mm²</td></tr>
        <tr><td>Axial stress</td><td class="n">${fmt(r.neck.sAx)} MPa</td></tr>
        <tr><td>Bending stress (M = ${fmt(r.neck.M / 1000)} N·m)</td><td class="n">${fmt(r.neck.sB)} MPa</td></tr>
        <tr><td>Equivalent stress / ultimate strength margin</td><td class="n">${fmt(r.neck.vm)} MPa · ×${fmt(r.yieldMargin, 1)}</td></tr>
        <tr><td>Alternating / mean stress</td><td class="n">${fmt(r.fat.sa)} / ${fmt(r.fat.sm)} MPa</td></tr>
        <tr><td>${p.stem}: E, Su, Se</td><td class="n">${m.E} GPa, ${m.Su}, ${m.Se} MPa</td></tr>
        <tr><td>Hertz contact radius / peak pressure</td><td class="n">${fmt(r.con.a, 2)} mm / ${fmt(r.con.p0, 2)} MPa</td></tr>
        <tr><td>Bearing sliding distance (${p.years} y)</td><td class="n">${fmt(r.wear.s / 1000, 1)} km</td></tr>
        <tr><td>Bearing volumetric wear (${p.years} y)</td><td class="n">${fmt(r.wear.V, 1)} mm³</td></tr>
        <tr><td>Taper linear wear (${p.years} y)</td><td class="n">${sci(r.taper.h * 1000)} µm</td></tr>
        <tr><td>Taper volumetric wear (${p.years} y)</td><td class="n">${sci(r.taper.V)} mm³</td></tr>
        </tbody></table></div>
        ${r.con.valid ? '' : '<p class="note"><strong>Hertz assumption broken:</strong> the contact patch is large compared with the head radius (highly conforming ball and cup). Treat the contact pressure as indicative only; use the FEA contact result.</p>'}
        ${H.MATERIALS[p.head].ductile === false || H.MATERIALS[p.cup].ductile === false ? '<p class="statl">Ceramic and polyethylene parts are not assessed with Goodman; only the metal stem is.</p>' : ''}`;
      drawCurve(); drawSens();
    };

    const svg = $('bm-curve');
    const drawCurve = () => {
      if (!last) return;
      const W = svg.clientWidth, Ht = svg.clientHeight; if (!W) return;
      const Fs = [], pad = 42;
      for (let F = 500; F <= 5000; F += 50) Fs.push([F, H.run(Object.assign({}, last, { F })).fat.n]);
      const nMax = Math.min(Math.max(...Fs.map(v => v[1])), 40), x = F => pad + (F - 500) / 4500 * (W - pad - 12), y = n => Ht - 30 - Math.min(n, nMax) / nMax * (Ht - 50);
      const d = Fs.map(([F, n], i) => `${i ? 'L' : 'M'}${x(F).toFixed(1)} ${y(n).toFixed(1)}`).join('');
      const acts = Object.entries(H.ACTIVITIES).map(([k, F]) => { const n = H.run(Object.assign({}, last, { F })).fat.n; return `<circle cx="${x(F)}" cy="${y(n)}" r="5" fill="#1565C0" stroke="#fff"/>${W > 520 ? `<text x="${x(F) + 8}" y="${y(n) - 8}">${k}</text>` : ''}`; }).join('');
      svg.innerHTML = `<g stroke="currentColor" stroke-opacity=".25"><path d="M${pad} ${Ht - 30}H${W - 12}M${pad} 20V${Ht - 30}"/></g>
        <path d="M${pad} ${y(1)}H${W - 12}" stroke="#A1262E" stroke-dasharray="5 4"/>
        <path d="${d}" fill="none" stroke="#00B3A4" stroke-width="2.5"/>
        <g font-size="12" fill="currentColor">${acts}<text x="${pad}" y="${Ht - 10}">500 N</text><text x="${W - 12}" y="${Ht - 10}" text-anchor="end">5,000 N</text>
        <text x="${pad + 4}" y="${y(1) - 6}" fill="#A1262E">n = 1</text><text x="4" y="24">n ${nMax.toFixed(0)}</text></g>`;
    };
    new ResizeObserver(drawCurve).observe(svg);

    const drawSens = () => {
      const s = H.sensitivity(last, 10); if (!s.length) return;
      const base = s[0].base, span = Math.max(...s.map(v => Math.max(Math.abs(v.lo - base), Math.abs(v.hi - base))), 1e-9);
      $('bm-sens').innerHTML = s.map(v => `<div class="bar"><span>${v.label}</span><span style="position:relative;height:16px;display:block;background:var(--silver2);border-radius:3px">
        <i style="position:absolute;top:1px;height:14px;left:${50 + 50 * Math.min(0, Math.min(v.lo, v.hi) - base) / span}%;width:${50 * Math.abs(v.hi - v.lo) / span}%"></i>
        <b style="position:absolute;left:50%;top:-2px;bottom:-2px;width:2px;background:var(--ink)"></b></span><span>${fmt(v.lo, 2)} – ${fmt(v.hi, 2)}</span></div>`).join('') + `<p class="statl">Baseline n = ${fmt(base, 2)}.</p>`;
    };

    $('bm-form').addEventListener('input', e => { if (e.target.id === 'bm-F') $('bm-act').value = ''; calc(); });
    $('bm-form').addEventListener('submit', e => e.preventDefault());
    calc();

    // mesh study
    const ms = () => {
      const v = ['ms1', 'ms2', 'ms3'].map(id => $(id).value).filter(x => x !== '').map(Number);
      if (v.length < 2 || v.some(x => !Number.isFinite(x) || x === 0)) { $('ms-out').innerHTML = '<p class="statl">Enter at least the first two values (non-zero).</p>'; return; }
      const rows = H.meshStudy(v.map((value, i) => ({ size: ['1.5 mm', '1.0 mm', '0.75 mm'][i], value })));
      const ok = rows.findIndex(r => r.ok);
      $('ms-out').innerHTML = `<table><thead><tr><th>Mesh</th><th class="n">Value</th><th class="n">Change</th><th>&lt; 5%?</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.size}</td><td class="n">${r.value}</td><td class="n">${r.change === null ? '–' : fmt(r.change, 2) + '%'}</td><td>${r.ok === null ? '' : r.ok ? 'Yes' : 'No'}</td></tr>`).join('')}</tbody></table>
        <p>${ok > 0 ? `Converged: the ${rows[ok].size} result changed by ${fmt(rows[ok].change, 2)}% from the coarser mesh. Use the ${rows[ok - 1].size} mesh or finer.` : 'Not converged yet: refine further or check the contact region.'}</p>`;
    };
    for (const id of ['ms1', 'ms2', 'ms3']) $(id).addEventListener('input', ms);
  }
}
