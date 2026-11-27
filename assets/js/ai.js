/* AI lab: renders the real WDBC experiment outputs and runs the fitted model in the browser. */
{
  const M = JSON.parse(document.getElementById('wdbc-model')?.textContent || 'null');
  const R = JSON.parse(document.getElementById('wdbc-results')?.textContent || 'null');
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = v => (100 * v).toFixed(1) + '%';
  if (M && R && $('ai-stats')) {
    const t = R.test;
    $('ai-summary').textContent = `${R.model}, trained on ${R.dataset.split.train} cases and reported once on ${R.dataset.split.test} held-out cases (positive class = malignant, threshold 0.5). Five-fold cross-validated AUC on the training set: ${R.cv_auc_train_5fold.mean.toFixed(3)} ± ${R.cv_auc_train_5fold.std.toFixed(3)}.`;
    const stats = [['Accuracy', t.accuracy], ['Sensitivity (recall)', t.sensitivity], ['Specificity', t.specificity], ['Precision', t.precision], ['F1-score', t.f1], ['AUC', t.auc]];
    $('ai-stats').innerHTML = stats.map(([l, v]) => `<div class="card"><div class="stat">${l === 'AUC' ? v.toFixed(3) : pct(v)}</div><div class="statl">${l}</div></div>`).join('');
    const cm = t.confusion_matrix;
    $('ai-cm').innerHTML = `<div class="scroll"><table><thead><tr><th></th><th class="n">Predicted benign</th><th class="n">Predicted malignant</th></tr></thead><tbody>
      <tr><th>True benign</th><td class="n">${cm.tn} <span class="statl">true neg.</span></td><td class="n">${cm.fp} <span class="statl">false pos.</span></td></tr>
      <tr><th>True malignant</th><td class="n">${cm.fn} <span class="statl">false neg.</span></td><td class="n">${cm.tp} <span class="statl">true pos.</span></td></tr></tbody></table></div>`;
    const perm = R.permutation_importance, pmax = Math.max(...perm.map(p => p.mean), 1e-9);
    $('ai-perm').innerHTML = perm.map(p => `<div class="bar"><span>${esc(p.feature)}</span><i style="width:${Math.max(1, 100 * p.mean / pmax)}%"></i><span>${p.mean.toFixed(4)}</span></div>`).join('');
    $('ai-err').innerHTML = R.errors.length ? `<table class="stack"><thead><tr><th>Test case</th><th>Error</th><th class="n">P(malignant)</th></tr></thead><tbody>${R.errors.map(e => `<tr><td>#${e.index}</td><td>${e.type}</td><td class="n">${e.prob_malignant.toFixed(3)}</td></tr>`).join('')}</tbody></table>` : '<p>No errors at threshold 0.5.</p>';

    // ROC
    const roc = $('ai-roc');
    const drawRoc = () => {
      const W = roc.clientWidth, H = roc.clientHeight; if (!W) return;
      const p = 36, x = v => p + v * (W - p - 10), y = v => H - p - v * (H - p - 10);
      const d = t.roc.fpr.map((f, i) => `${i ? 'L' : 'M'}${x(f).toFixed(1)} ${y(t.roc.tpr[i]).toFixed(1)}`).join('');
      roc.innerHTML = `<g stroke="currentColor" stroke-opacity=".25"><path d="M${x(0)} ${y(0)}H${x(1)}M${x(0)} ${y(0)}V${y(1)}"/></g>
        <path d="M${x(0)} ${y(0)}L${x(1)} ${y(1)}" stroke="currentColor" stroke-opacity=".35" stroke-dasharray="4 4"/>
        <path d="${d}" fill="none" stroke="#00B3A4" stroke-width="2.5"/>
        <g font-size="12" fill="currentColor"><text x="${x(.5)}" y="${H - 8}" text-anchor="middle">1 − specificity</text><text x="12" y="${y(.5)}" transform="rotate(-90 12 ${y(.5)})" text-anchor="middle">sensitivity</text>
        <text x="${x(.55)}" y="${y(.2)}">AUC ${t.auc.toFixed(3)}</text></g>`;
    };
    new ResizeObserver(drawRoc).observe(roc);

    // live model
    const sig = z => 1 / (1 + Math.exp(-z));
    const predict = x => { let z = M.intercept; const c = []; for (let i = 0; i < x.length; i++) { const s = (x[i] - M.mean[i]) / M.scale[i]; c.push(M.coef[i] * s); z += M.coef[i] * s; } return { p: sig(z), c }; };
    const sel = $('ai-case');
    sel.innerHTML = M.test_cases.map((c, i) => `<option value="${i}">Case #${i} · recorded diagnosis: ${c.y ? 'malignant' : 'benign'}</option>`).join('');
    const top = R.coefficients.slice(0, 8).map(c => M.features.indexOf(c.feature));
    let cur = [];
    const fs = R.feature_summary;
    const renderSliders = () => {
      $('ai-sliders').innerHTML = top.map(i => {
        const f = fs[i], step = (f.max - f.min) / 200;
        return `<label for="ai-f${i}">${esc(M.features[i])}: <b id="ai-fv${i}">${cur[i].toPrecision(4)}</b></label><input type="range" id="ai-f${i}" data-i="${i}" min="${f.min}" max="${f.max}" step="${step}" value="${cur[i]}">`;
      }).join('');
    };
    const update = () => {
      const { p, c } = predict(cur);
      const thr = +$('ai-thr').value;
      $('ai-p').textContent = pct(p);
      $('ai-pbar').style.width = (100 * p) + '%';
      const tc = M.test_cases[+sel.value];
      const unchanged = cur.every((v, i) => v === tc.x[i]);
      $('ai-verdict').textContent = `Model output at threshold ${thr.toFixed(2)}: ${p >= thr ? 'malignant' : 'benign'}. Recorded diagnosis: ${tc.y ? 'malignant' : 'benign'}.` + (unchanged ? ` Python recorded p = ${tc.p.toFixed(4)} for this case.` : ' (features edited)');
      const order = c.map((v, i) => [v, i]).sort((a, b) => Math.abs(b[0]) - Math.abs(a[0])).slice(0, 8), cm = Math.max(...order.map(o => Math.abs(o[0])), 1e-9);
      $('ai-contrib').innerHTML = order.map(([v, i]) => `<div class="bar"><span>${esc(M.features[i])}</span><i style="width:${100 * Math.abs(v) / cm}%;background:${v > 0 ? '#00B3A4' : '#9FB0C2'}"></i><span>${v > 0 ? '+' : ''}${v.toFixed(2)}</span></div>`).join('');
    };
    const thrMetrics = () => {
      const thr = +$('ai-thr').value; $('ai-thrv').textContent = thr.toFixed(2);
      let tp = 0, tn = 0, fp = 0, fn = 0;
      for (const c of M.test_cases) { const yp = c.p >= thr; if (c.y && yp) tp++; else if (c.y) fn++; else if (yp) fp++; else tn++; }
      $('ai-thrm').textContent = `On the 114 test cases: sensitivity ${pct(tp / (tp + fn))}, specificity ${pct(tn / (tn + fp))}, ${fn} false negatives, ${fp} false positives.`;
      update();
    };
    const load = () => { cur = M.test_cases[+sel.value].x.slice(); renderSliders(); update(); };
    sel.addEventListener('change', load);
    $('ai-reset').addEventListener('click', load);
    $('ai-sliders').addEventListener('input', e => { const i = +e.target.dataset.i; if (Number.isNaN(i)) return; cur[i] = +e.target.value; $('ai-fv' + i).textContent = cur[i].toPrecision(4); update(); });
    $('ai-thr').addEventListener('input', thrMetrics);
    load(); thrMetrics();

    // dataset explorer
    $('ai-feat').innerHTML = M.features.map((f, i) => `<option value="${i}">${esc(f)}</option>`).join('');
    $('ai-feat').value = String(M.features.indexOf('worst concave points'));
    $('ai-ftab').tBodies[0].innerHTML = fs.map(f => `<tr><td>${esc(f.feature)}</td><td class="n">${f.mean_benign.toPrecision(4)}</td><td class="n">${f.mean_malignant.toPrecision(4)}</td><td class="n">${f.min.toPrecision(3)} – ${f.max.toPrecision(3)}</td></tr>`).join('');
    const hist = $('ai-hist');
    const drawHist = () => {
      const W = hist.clientWidth, H = hist.clientHeight; if (!W) return;
      const i = +$('ai-feat').value, vals = M.test_cases.map(c => [c.x[i], c.y]);
      const lo = Math.min(...vals.map(v => v[0])), hi = Math.max(...vals.map(v => v[0])), nb = W < 520 ? 12 : 20, w = (hi - lo) / nb || 1;
      const b = [Array(nb).fill(0), Array(nb).fill(0)];
      for (const [v, y] of vals) b[y][Math.min(nb - 1, Math.floor((v - lo) / w))]++;
      const mx = Math.max(...b[0], ...b[1], 1), p = 30, bw = (W - p - 10) / nb;
      let s = '';
      for (let k = 0; k < nb; k++) for (const y of [0, 1]) { const h = (H - p - 24) * b[y][k] / mx; s += `<rect x="${p + k * bw + (y ? bw / 2 : 1)}" y="${H - p - h}" width="${bw / 2 - 1}" height="${h}" fill="${y ? '#00B3A4' : '#9FB0C2'}"/>`; }
      hist.innerHTML = s + `<g font-size="12" fill="currentColor"><text x="${p}" y="${H - 10}">${lo.toPrecision(3)}</text><text x="${W - 10}" y="${H - 10}" text-anchor="end">${hi.toPrecision(3)}</text>
        <rect x="${W - 190}" y="4" width="10" height="10" fill="#9FB0C2"/><text x="${W - 176}" y="13">benign</text><rect x="${W - 110}" y="4" width="10" height="10" fill="#00B3A4"/><text x="${W - 96}" y="13">malignant</text></g>`;
    };
    $('ai-feat').addEventListener('change', drawHist);
    new ResizeObserver(drawHist).observe(hist);
  }
}
