// node --test tests/
const test = require('node:test'), assert = require('node:assert/strict');
const C = require('../assets/js/eqcore.js');
const now = Date.parse('2026-11-27T12:00:00Z');
const base = { name: 'Pump', category: 'Therapeutic', department: 'ICU', serial: 'A1', status: 'In service', risk: 'High', pmInterval: 180, installDate: '2025-01-01' };

test('valid record passes', () => assert.deepEqual(C.validate(base, [], now), []));
test('required fields and ranges', () => {
  const e = C.validate({ ...base, name: '', pmInterval: 3, installDate: '2027-01-01' }, [], now);
  assert.ok(e.some(m => m.includes('name')) && e.some(m => m.includes('PM interval')) && e.some(m => m.includes('future')));
});
test('duplicate serial rejected, case-insensitive', () => {
  const e = C.validate({ ...base, serial: 'a1' }, [{ ...base, id: 'GNL-EQ-0001' }], now);
  assert.match(e.join(), /already registered to GNL-EQ-0001/);
});
test('last PM before install rejected', () => assert.ok(C.validate({ ...base, lastPM: '2024-01-01' }, [], now).length));
test('next id increments', () => assert.equal(C.nextId([{ id: 'GNL-EQ-0009' }, { id: 'GNL-EQ-0003' }]), 'GNL-EQ-0010'));
test('PM due states', () => {
  assert.equal(C.pmDue({ ...base, lastPM: '2026-01-01' }, now).state, 'Overdue');
  assert.equal(C.pmDue({ ...base, lastPM: '2026-06-05' }, now).state, 'Due soon');
  assert.equal(C.pmDue({ ...base, lastPM: '2026-11-01' }, now).state, 'Scheduled');
});
test('downtime hours and open breakdowns', () => {
  assert.equal(C.downtimeHours({ type: 'Breakdown', start: '2026-11-01T00:00Z', end: '2026-11-02T06:00Z' }), 30);
  assert.equal(C.downtimeHours({ type: 'Breakdown', start: '2026-11-27T02:00Z', end: '' }, now), 10);
  assert.equal(C.downtimeHours({ type: 'PM', start: '2026-11-01T00:00Z' }), 0);
});
test('reliability metrics hand check', () => {
  const eq = [{ status: 'In service' }, { status: 'In service' }];
  const ev = [{ type: 'Breakdown', start: '2026-11-20T00:00Z', end: '2026-11-21T00:00Z' }, { type: 'Breakdown', start: '2026-11-25T00:00Z', end: '2026-11-25T12:00Z' }];
  const from = Date.parse('2026-11-17T12:00Z'); // 10 days * 2 units = 480 h
  const r = C.reliability(eq, ev, from, now);
  assert.equal(r.breakdowns, 2); assert.equal(r.downtimeHours, 36); assert.equal(r.mttrHours, 18);
  assert.equal(r.mtbfHours, (480 - 36) / 2); assert.ok(Math.abs(r.availability - (1 - 36 / 480)) < 1e-12);
});
test('event validation', () => {
  assert.ok(C.validateEvent({ type: 'Breakdown', start: '2026-11-02T00:00', end: '2026-11-01T00:00', description: 'x' }, now).some(m => m.includes('before')));
  assert.deepEqual(C.validateEvent({ type: 'PM', start: '2026-11-02T00:00', description: 'done' }, now), []);
});
test('CSV escapes commas, quotes and formula injection', () => {
  const csv = C.toCSV([{ a: 'x,y', b: 'say "hi"', c: '=SUM(A1)' }], [['a', 'A'], ['b', 'B'], ['c', 'C']]);
  assert.equal(csv.split('\n')[1], '"x,y","say ""hi""","\'=SUM(A1)"');
});
test('seed data is fictional and valid', () => {
  const d = C.seed(now);
  assert.ok(d.equipment.length >= 12);
  for (const e of d.equipment) { assert.equal(e.manufacturer, 'Demo Medical Co.'); assert.deepEqual(C.validate(e, d.equipment.filter(x => x !== e), now), []); }
});
