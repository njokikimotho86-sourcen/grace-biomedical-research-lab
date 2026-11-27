/* Equipment management UI. Logic in eqcore.js. Data in this browser's localStorage only. */
{
  const C = window.EqCore, $ = id => document.getElementById(id);
  if (C && $('eq-form')) {
    const KEY = 'gnk-equipment-v1';
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    let db;
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* storage unavailable: session only */ } };
    try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { db = null; }
    if (!db || !Array.isArray(db.equipment)) { db = C.seed(); save(); }
    const fields = ['name', 'category', 'manufacturer', 'model', 'serial', 'department', 'location', 'status', 'risk', 'pmInterval', 'installDate', 'lastPM', 'notes'];
    const byId = id => db.equipment.find(e => e.id === id);
    const msg = (id, t) => { const m = $(id); m.textContent = t; m.classList.toggle('on', !!t); };
    const opts = (el, list, first) => { el.innerHTML = (first ? `<option value="">${first}</option>` : '') + list.map(s => `<option>${esc(s)}</option>`).join(''); };
    opts($('ef-status'), C.STATUSES); opts($('ef-risk'), C.RISK); opts($('eq-fs'), C.STATUSES, 'All'); opts($('ev-status'), C.STATUSES, 'Leave unchanged');
    const badge = s => `<span class="tag ${s === 'In service' || s === 'Scheduled' ? 'done' : s === 'Decommissioned' || s === 'n/a' ? '' : 'wip'}">${esc(s)}</span>`;
    const bars = (rows, unit = '') => { const mx = Math.max(...rows.map(r => r[1]), 1); return rows.map(([k, v]) => `<div class="bar"><span>${esc(k)}</span><i style="width:${Math.max(v ? 2 : 0, 100 * v / mx)}%"></i><span>${v.toLocaleString('en-GB', { maximumFractionDigits: 1 })}${unit}</span></div>`).join('') || '<p class="statl">No data.</p>'; };

    const dash = () => {
      const now = Date.now(), days = +$('eq-win').value, from = now - days * 864e5;
      const r = C.reliability(db.equipment, db.events, from, now);
      const due = db.equipment.map(e => C.pmDue(e, now));
      const k = [[db.equipment.filter(e => e.status !== 'Decommissioned').length, 'active equipment'], [due.filter(d => d.state === 'Overdue').length, 'PM overdue'],
        [r.breakdowns, `breakdowns, last ${days} days`], [Math.round(r.downtimeHours).toLocaleString('en-GB'), 'downtime hours'],
        [r.mttrHours === null ? '–' : r.mttrHours.toFixed(1) + ' h', 'MTTR'], [r.availability === null ? '–' : (100 * r.availability).toFixed(2) + '%', 'fleet availability']];
      $('eq-kpi').innerHTML = k.map(([v, l]) => `<div class="card"><div class="stat">${v}</div><div class="statl">${l}</div></div>`).join('');
      $('eq-status').innerHTML = bars(C.STATUSES.map(s => [s, db.equipment.filter(e => e.status === s).length]));
      const deps = [...new Set(db.equipment.map(e => e.department))].sort();
      $('eq-dept').innerHTML = bars(deps.map(d => [d, db.equipment.filter(e => e.department === d).length]));
      $('eq-trend').innerHTML = bars(C.monthly(db.events, 'Breakdown', 12, now).map(m => [m.month, m.n]));
      const per = db.equipment.map(e => [`${e.id} ${e.name}`, db.events.filter(v => v.eqId === e.id && Date.parse(v.start) >= from).reduce((s, v) => s + C.downtimeHours(v, now), 0)]).sort((a, b) => b[1] - a[1]).slice(0, 5);
      $('eq-worst').innerHTML = bars(per, ' h');
    };

    const inv = () => {
      const q = $('eq-q').value.trim().toLowerCase(), fs = $('eq-fs').value, fp = $('eq-fp').value;
      const rows = db.equipment.filter(e => (!q || [e.id, e.name, e.serial, e.department, e.category].join(' ').toLowerCase().includes(q)) && (!fs || e.status === fs) && (!fp || C.pmDue(e).state === fp));
      $('eq-count').textContent = `${rows.length} of ${db.equipment.length} items`;
      $('eq-tab').tBodies[0].innerHTML = rows.map(e => { const d = C.pmDue(e); return `<tr><td>${esc(e.id)}</td><td>${esc(e.name)}<br><span class="statl">${esc(e.model)} · SN ${esc(e.serial)}</span></td><td>${esc(e.department)}</td><td>${badge(e.status)}</td><td>${esc(d.due)} ${badge(d.state)}</td><td><button class="btn small ghost" type="button" data-view="${esc(e.id)}">View</button></td></tr>`; }).join('') || '<tr><td colspan="6">No equipment matches.</td></tr>';
    };

    const detail = id => {
      const e = byId(id); if (!e) return;
      const d = C.pmDue(e), hist = db.events.filter(v => v.eqId === id).sort((a, b) => b.start.localeCompare(a.start));
      let qr = '';
      try { const q = window.qrcode(0, 'M'); q.addData(`${e.id} | ${e.name} | SN ${e.serial} | ${e.department}`); q.make(); qr = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch (err) { qr = '<p class="statl">QR library unavailable.</p>'; }
      const down = hist.reduce((s, v) => s + C.downtimeHours(v), 0);
      $('eq-detail').hidden = false;
      $('eq-detail').innerHTML = `<div class="g2"><div><h3>${esc(e.id)} · ${esc(e.name)}</h3><dl class="kv">
        <dt>Category</dt><dd>${esc(e.category)}</dd><dt>Make / model</dt><dd>${esc(e.manufacturer)} ${esc(e.model)}</dd><dt>Serial</dt><dd>${esc(e.serial)}</dd>
        <dt>Location</dt><dd>${esc(e.location || e.department)}</dd><dt>Status</dt><dd>${badge(e.status)}</dd><dt>Risk class</dt><dd>${esc(e.risk)}</dd>
        <dt>Installed</dt><dd>${esc(e.installDate)}</dd><dt>PM</dt><dd>every ${esc(e.pmInterval)} days · next ${esc(d.due)} ${badge(d.state)}</dd><dt>Total downtime</dt><dd>${down.toFixed(1)} h</dd><dt>Notes</dt><dd>${esc(e.notes)}</dd></dl>
        <div class="btns"><button class="btn small" type="button" data-edit="${esc(e.id)}">Edit</button><button class="btn small ghost" type="button" data-log="${esc(e.id)}">Log event</button><button class="btn small ghost" type="button" data-close="1">Close</button></div></div>
        <div><div style="max-width:180px;background:#fff;padding:6px;border-radius:8px" aria-label="QR code for ${esc(e.id)}">${qr}</div><p class="statl">QR encodes the ID, name, serial and department for asset labels.</p></div></div>
        <h3 class="sec">Service history</h3><div class="scroll"><table class="stack"><thead><tr><th>Date</th><th>Type</th><th>Description</th><th class="n">Downtime</th></tr></thead><tbody>
        ${hist.map(v => `<tr><td>${esc(v.start.replace('T', ' '))}</td><td>${esc(v.type)}</td><td>${esc(v.description)}${v.tech ? `<br><span class="statl">${esc(v.tech)}</span>` : ''}</td><td class="n">${v.type === 'Breakdown' ? C.downtimeHours(v).toFixed(1) + ' h' + (v.end ? '' : ' (open)') : ''}</td></tr>`).join('') || '<tr><td colspan="4">No records.</td></tr>'}</tbody></table></div>`;
      $('eq-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const tab = id => document.querySelector(`.tabs[data-tabs="eq"] [data-tab="${id}"]`).click();

    const fillForm = e => {
      $('ef-id').value = e ? e.id : ''; $('eq-ftitle').textContent = e ? `Edit ${e.id}` : 'Register new equipment';
      for (const f of fields) $('ef-' + f).value = e ? (e[f] ?? '') : (f === 'status' ? 'In service' : f === 'risk' ? 'Medium' : f === 'pmInterval' ? 180 : '');
      msg('ef-err', ''); msg('ef-ok', '');
    };
    $('eq-form').addEventListener('submit', ev => {
      ev.preventDefault();
      const e = { id: $('ef-id').value || null };
      for (const f of fields) e[f] = $('ef-' + f).value.trim();
      e.pmInterval = Number(e.pmInterval);
      const err = C.validate(e, db.equipment);
      if (err.length) { msg('ef-ok', ''); msg('ef-err', 'Please fix: ' + err.join('; ') + '.'); return; }
      if (e.id) Object.assign(byId(e.id), e); else { e.id = C.nextId(db.equipment); db.equipment.push(e); }
      save(); refresh(); fillForm(byId(e.id)); msg('ef-ok', `Saved ${e.id}.`);
    });
    $('ef-new').addEventListener('click', () => fillForm(null));

    const due = () => {
      const now = Date.now();
      const list = db.equipment.filter(e => e.status !== 'Decommissioned').map(e => [e, C.pmDue(e, now)]).sort((a, b) => a[1].days - b[1].days).slice(0, 10);
      $('eq-due').innerHTML = `<table class="stack"><thead><tr><th>Equipment</th><th>Due</th><th></th></tr></thead><tbody>${list.map(([e, d]) => `<tr><td>${esc(e.id)} ${esc(e.name)}</td><td>${esc(d.due)} ${badge(d.state)} <span class="statl">${d.days < 0 ? -d.days + ' days late' : 'in ' + d.days + ' days'}</span></td><td><button class="btn small ghost" type="button" data-pm="${esc(e.id)}">Record PM</button></td></tr>`).join('')}</tbody></table>`;
      const open = db.events.filter(v => v.type === 'Breakdown' && !v.end);
      $('eq-open').innerHTML = open.length ? `<table class="stack"><thead><tr><th>Equipment</th><th>Reported</th><th>Fault</th><th class="n">Down so far</th><th></th></tr></thead><tbody>${open.map(v => `<tr><td>${esc(v.eqId)} ${esc(byId(v.eqId)?.name)}</td><td>${esc(v.start.replace('T', ' '))}</td><td>${esc(v.description)}</td><td class="n">${C.downtimeHours(v).toFixed(1)} h</td><td><button class="btn small" type="button" data-resolve="${db.events.indexOf(v)}">Mark resolved now</button></td></tr>`).join('')}</tbody></table>` : '<p>No open breakdowns.</p>';
      $('ev-eq').innerHTML = db.equipment.map(e => `<option value="${esc(e.id)}">${esc(e.id)} · ${esc(e.name)} · ${esc(e.department)}</option>`).join('');
    };
    const localNow = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
    $('ev-form').addEventListener('submit', ev => {
      ev.preventDefault();
      const r = { eqId: $('ev-eq').value, type: $('ev-type').value, start: $('ev-start').value, end: $('ev-type').value === 'Breakdown' ? $('ev-end').value : '', description: $('ev-desc').value.trim(), tech: $('ev-tech').value.trim() };
      const err = C.validateEvent(r);
      if (!byId(r.eqId)) err.push('choose equipment');
      if (err.length) { msg('ev-ok', ''); msg('ev-err', 'Please fix: ' + err.join('; ') + '.'); return; }
      db.events.push(r);
      const e = byId(r.eqId);
      if (r.type === 'PM') e.lastPM = r.start.slice(0, 10);
      if ($('ev-status').value) e.status = $('ev-status').value; else if (r.type === 'Breakdown' && !r.end) e.status = 'Out of service';
      save(); refresh(); msg('ev-err', ''); msg('ev-ok', `${r.type} recorded for ${e.id}. Status: ${e.status}.`); $('ev-desc').value = '';
    });

    document.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b || !b.closest('#view-equipment, main')) return;
      if (b.dataset.view) detail(b.dataset.view);
      else if (b.dataset.close) $('eq-detail').hidden = true;
      else if (b.dataset.edit) { fillForm(byId(b.dataset.edit)); tab('reg'); }
      else if (b.dataset.log || b.dataset.pm) { tab('mnt'); $('ev-eq').value = b.dataset.log || b.dataset.pm; $('ev-type').value = b.dataset.pm ? 'PM' : 'Breakdown'; $('ev-start').value = localNow(); if (b.dataset.pm) $('ev-desc').value = 'Planned preventive maintenance completed'; $('ev-form').scrollIntoView({ block: 'start' }); }
      else if (b.dataset.resolve !== undefined) { const v = db.events[+b.dataset.resolve]; if (v) { v.end = localNow(); const e = byId(v.eqId); if (e && !db.events.some(x => x.eqId === e.id && x.type === 'Breakdown' && !x.end)) e.status = 'In service'; save(); refresh(); } }
      else if (b.dataset.exp) exportData(b.dataset.exp);
    });

    const exportData = kind => {
      let txt, name, type = 'text/csv';
      if (kind === 'inv') { txt = C.toCSV(db.equipment.map(e => Object.assign({}, e, { nextPM: C.pmDue(e).due, pmState: C.pmDue(e).state })), [['id', 'ID'], ['name', 'Name'], ['category', 'Category'], ['manufacturer', 'Manufacturer'], ['model', 'Model'], ['serial', 'Serial'], ['department', 'Department'], ['location', 'Location'], ['status', 'Status'], ['risk', 'Risk'], ['pmInterval', 'PM interval (days)'], ['installDate', 'Installed'], ['lastPM', 'Last PM'], ['nextPM', 'Next PM'], ['pmState', 'PM state']]); name = 'equipment-inventory.csv'; }
      else if (kind === 'ev') { txt = C.toCSV(db.events, [['eqId', 'Equipment ID'], ['type', 'Type'], ['start', 'Start'], ['end', 'End'], [v => C.downtimeHours(v).toFixed(2), 'Downtime (h)'], ['description', 'Description'], ['tech', 'Technician']]); name = 'maintenance-history.csv'; }
      else { txt = JSON.stringify(db, null, 1); name = 'equipment-backup.json'; type = 'application/json'; }
      $('ex-out').value = txt;
      try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { /* download blocked */ }
      navigator.clipboard?.writeText(txt).then(() => msg('ex-ok', `${name}: copied to clipboard (download started if your browser allows it).`), () => msg('ex-ok', `${name}: shown below; select and copy it.`));
    };
    $('ex-restore').addEventListener('click', () => {
      try {
        const d = JSON.parse($('ex-in').value);
        if (!Array.isArray(d.equipment) || !Array.isArray(d.events)) throw new Error('missing equipment or events arrays');
        for (const e of d.equipment) { const err = C.validate(e, d.equipment.filter(x => x !== e)); if (err.length) throw new Error(`${e.id || 'record'}: ${err[0]}`); }
        db = d; save(); refresh(); msg('ex-err', '');
      } catch (e) { msg('ex-err', 'Backup not restored: ' + e.message); }
    });
    let armed = false;
    $('ex-reset').addEventListener('click', () => {
      if (!armed) { armed = true; $('ex-reset').textContent = 'Press again to confirm reset'; $('ex-reset-q').textContent = 'This replaces every record in this browser with the demonstration data.'; return; }
      db = C.seed(); save(); refresh(); armed = false; $('ex-reset').textContent = 'Reset to demonstration data'; $('ex-reset-q').textContent = 'Demonstration data restored.';
    });

    const refresh = () => { dash(); inv(); due(); };
    for (const id of ['eq-q', 'eq-fs', 'eq-fp']) $(id).addEventListener('input', inv);
    $('eq-win').addEventListener('change', dash);
    $('ev-start').value = localNow();
    fillForm(null); refresh();
  }
}
