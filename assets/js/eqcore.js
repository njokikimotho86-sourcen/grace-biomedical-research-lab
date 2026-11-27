/* Equipment management core: validation, scheduling and reliability metrics. No DOM. Unit-tested with node:test. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EqCore = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DAY = 864e5;
  const STATUSES = ['In service', 'Under maintenance', 'Out of service', 'Decommissioned'];
  const RISK = ['High', 'Medium', 'Low'];
  const iso = d => new Date(d).toISOString().slice(0, 10);
  const parse = s => { const t = Date.parse(s); return Number.isNaN(t) ? null : t; };

  function nextId(list, prefix = 'GNL-EQ-') {
    const n = list.reduce((m, e) => Math.max(m, +(String(e.id).match(/(\d+)$/) || [0, 0])[1]), 0) + 1;
    return prefix + String(n).padStart(4, '0');
  }

  function validate(e, list, now = Date.now()) {
    const err = [];
    for (const k of ['name', 'category', 'department', 'serial']) if (!String(e[k] || '').trim()) err.push(`${k} is required`);
    if (!STATUSES.includes(e.status)) err.push('status is invalid');
    if (!RISK.includes(e.risk)) err.push('risk class is invalid');
    const iv = Number(e.pmInterval);
    if (!Number.isInteger(iv) || iv < 7 || iv > 730) err.push('PM interval must be a whole number of days between 7 and 730');
    const inst = parse(e.installDate);
    if (inst === null) err.push('installation date is required');
    else if (inst > now) err.push('installation date cannot be in the future');
    if (e.lastPM) { const l = parse(e.lastPM); if (l === null || l > now) err.push('last PM date is invalid or in the future'); else if (inst !== null && l < inst) err.push('last PM cannot be before installation'); }
    const dup = list.find(x => x.serial.trim().toLowerCase() === String(e.serial || '').trim().toLowerCase() && x.id !== e.id);
    if (dup) err.push(`serial number already registered to ${dup.id}`);
    return err;
  }

  function pmDue(e, now = Date.now()) {
    const base = parse(e.lastPM || e.installDate);
    const due = base + Number(e.pmInterval) * DAY;
    const days = Math.round((due - now) / DAY);
    return { due: iso(due), days, state: e.status === 'Decommissioned' ? 'n/a' : days < 0 ? 'Overdue' : days <= 14 ? 'Due soon' : 'Scheduled' };
  }

  function validateEvent(ev, now = Date.now()) {
    const err = [];
    if (!['PM', 'Breakdown', 'Repair'].includes(ev.type)) err.push('event type is invalid');
    const s = parse(ev.start);
    if (s === null) err.push('start date/time is required'); else if (s > now) err.push('start cannot be in the future');
    if (ev.end) { const e = parse(ev.end); if (e === null) err.push('end date/time is invalid'); else if (e < s) err.push('end cannot be before start'); else if (e > now) err.push('end cannot be in the future'); }
    if (!String(ev.description || '').trim()) err.push('description is required');
    return err;
  }

  /** Downtime hours of a breakdown; open breakdowns count up to `now`. */
  function downtimeHours(ev, now = Date.now()) {
    if (ev.type !== 'Breakdown') return 0;
    const s = parse(ev.start), e = ev.end ? parse(ev.end) : now;
    return Math.max(0, (e - s) / 36e5);
  }

  /** Reliability over a window [from, to]. */
  function reliability(equipment, events, from, to) {
    const span = (to - from) / 36e5;
    const active = equipment.filter(e => e.status !== 'Decommissioned');
    const bd = events.filter(v => v.type === 'Breakdown' && parse(v.start) >= from && parse(v.start) <= to);
    const down = bd.reduce((s, v) => s + Math.min(downtimeHours(v, to), (to - parse(v.start)) / 36e5), 0);
    const fleetHours = span * active.length;
    const closed = bd.filter(v => v.end);
    return {
      breakdowns: bd.length,
      downtimeHours: down,
      mttrHours: closed.length ? closed.reduce((s, v) => s + downtimeHours(v), 0) / closed.length : null,
      mtbfHours: bd.length ? (fleetHours - down) / bd.length : null,
      availability: fleetHours ? 1 - down / fleetHours : null
    };
  }

  function monthly(events, type, months, now = Date.now()) {
    const out = [];
    const d = new Date(now); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0);
    for (let i = months - 1; i >= 0; i--) {
      const a = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1), b = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i + 1, 1);
      out.push({ month: new Date(a).toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }), n: events.filter(v => v.type === type && parse(v.start) >= a && parse(v.start) < b).length });
    }
    return out;
  }

  function toCSV(rows, cols) {
    const q = v => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? '"' + (/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""') + '"' : s; };
    return [cols.map(c => q(c[1])).join(','), ...rows.map(r => cols.map(c => q(typeof c[0] === 'function' ? c[0](r) : r[c[0]])).join(','))].join('\n');
  }

  /** Fictional demonstration data, deterministic, dated relative to `now`. */
  function seed(now = Date.now()) {
    let x = 20261127; const rnd = () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
    const items = [
      ['Patient monitor', 'Monitoring', 'ICU', 'High', 180], ['Patient monitor', 'Monitoring', 'ICU', 'High', 180], ['Infusion pump', 'Therapeutic', 'Paediatric ward', 'High', 180],
      ['Infusion pump', 'Therapeutic', 'Medical ward', 'High', 180], ['Defibrillator', 'Life support', 'Emergency', 'High', 90], ['Anaesthesia machine', 'Life support', 'Theatre', 'High', 90],
      ['Oxygen concentrator', 'Respiratory', 'Medical ward', 'Medium', 90], ['Suction machine', 'Therapeutic', 'Theatre', 'Medium', 180], ['Autoclave', 'Sterilisation', 'CSSD', 'Medium', 90],
      ['Ultrasound scanner', 'Imaging', 'Radiology', 'Medium', 365], ['Digital X-ray unit', 'Imaging', 'Radiology', 'High', 180], ['Haematology analyser', 'Laboratory', 'Laboratory', 'Medium', 90],
      ['Centrifuge', 'Laboratory', 'Laboratory', 'Low', 365], ['Infant incubator', 'Life support', 'Newborn unit', 'High', 90], ['Spirometer', 'Diagnostic', 'Outpatients', 'Low', 365],
      ['ECG machine', 'Diagnostic', 'Outpatients', 'Medium', 365]
    ];
    const equipment = items.map(([name, category, department, risk, pm], i) => {
      const inst = now - (400 + Math.floor(rnd() * 1400)) * DAY;
      const last = now - Math.floor(rnd() * pm * 1.3) * DAY;
      return { id: 'GNL-EQ-' + String(i + 1).padStart(4, '0'), name, category, department, risk, pmInterval: pm,
        manufacturer: 'Demo Medical Co.', model: `DM-${100 + i * 7}`, serial: `DEMO-${(70000 + i * 137).toString(36).toUpperCase()}`,
        location: `${department}, room ${1 + (i % 6)}`, installDate: iso(inst), lastPM: iso(Math.max(last, inst + 7 * DAY)), status: 'In service', notes: 'Fictional demonstration record' };
    });
    const events = [];
    const faults = ['Display flickering', 'Battery not holding charge', 'Occlusion alarm on every set', 'Error code on start-up', 'Mains cable damaged', 'Temperature not reached', 'Probe cable fault', 'Pump noisy'];
    for (let k = 0; k < 26; k++) {
      const e = equipment[Math.floor(rnd() * equipment.length)];
      const s = now - Math.floor(10 + rnd() * 360) * DAY - Math.floor(rnd() * 20) * 36e5;
      const hrs = 2 + Math.floor(rnd() * 70);
      const f = faults[Math.floor(rnd() * faults.length)];
      events.push({ eqId: e.id, type: 'Breakdown', start: new Date(s).toISOString().slice(0, 16), end: new Date(s + hrs * 36e5).toISOString().slice(0, 16), description: f, tech: 'Demo technician' });
      events.push({ eqId: e.id, type: 'Repair', start: new Date(s + hrs * 36e5).toISOString().slice(0, 16), end: '', description: `Repaired: ${f.toLowerCase()}; function test passed`, tech: 'Demo engineer' });
    }
    // two open breakdowns
    for (const [i, h] of [[4, 30], [10, 6]]) { events.push({ eqId: equipment[i].id, type: 'Breakdown', start: new Date(now - h * 36e5).toISOString().slice(0, 16), end: '', description: i === 4 ? 'Fails self-test' : 'Detector not responding', tech: 'Demo technician' }); equipment[i].status = 'Out of service'; }
    equipment[7].status = 'Under maintenance';
    for (const e of equipment) events.push({ eqId: e.id, type: 'PM', start: e.lastPM + 'T09:00', end: '', description: 'Planned preventive maintenance completed; electrical safety test passed', tech: 'Demo engineer' });
    return { equipment, events };
  }

  return { STATUSES, RISK, nextId, validate, validateEvent, pmDue, downtimeHours, reliability, monthly, toCSV, seed, iso };
}));
