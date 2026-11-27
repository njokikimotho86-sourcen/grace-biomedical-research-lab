/* Hip implant engineering calculations (closed-form, simplified).
   These are hand-calculation estimates for teaching and sensitivity studies.
   They are NOT a substitute for the validated ANSYS finite element model.
   Units: force N, length mm, stress MPa (N/mm^2), modulus GPa, wear coefficient mm^3/(N.m). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HipCalc = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Typical handbook values. Confirm against ANSYS Engineering Data or the supplier datasheet before use.
  const MATERIALS = {
    'Ti-6Al-4V':  { E: 114, nu: 0.34, Su: 900,  Se: 500, ductile: true,  note: 'Titanium alloy stem; low modulus reduces stress shielding' },
    'CoCrMo':     { E: 210, nu: 0.30, Su: 900,  Se: 450, ductile: true,  note: 'Cobalt-chromium-molybdenum; heads and stems' },
    '316L SS':    { E: 193, nu: 0.30, Su: 590,  Se: 260, ductile: true,  note: 'Stainless steel; lower-cost stems' },
    'Alumina':    { E: 380, nu: 0.22, Su: null, Se: null, ductile: false, note: 'Ceramic head; brittle, Goodman method does not apply' },
    'UHMWPE':     { E: 0.9, nu: 0.46, Su: null, Se: null, ductile: false, note: 'Polyethylene cup liner; contact partner only' }
  };

  // Peak resultant hip loads used in Grace's project (from Bergmann et al. standardised loads)
  const ACTIVITIES = { 'Sitting down': 1360, 'Standing up': 1600, 'Stance': 2077 };

  function req(cond, msg) { if (!cond) throw new RangeError(msg); }

  /** Neck stresses: axial + bending, solid circular section treated as a cantilever. */
  function neckStress({ F, d, L, thetaDeg }) {
    req(F > 0, 'Force must be positive');
    req(d > 0, 'Neck diameter must be positive');
    req(L >= 0, 'Lever arm cannot be negative');
    req(thetaDeg >= 0 && thetaDeg <= 90, 'Load angle must be between 0 and 90 degrees');
    const th = thetaDeg * Math.PI / 180;
    const A = Math.PI * d * d / 4;
    const Fa = F * Math.cos(th), Ft = F * Math.sin(th);
    const sAx = Fa / A;
    const M = Ft * L;                       // N.mm
    const sB = 32 * M / (Math.PI * d ** 3);
    const tau = 4 * Ft / (3 * A);           // peak transverse shear, solid circle
    const sMax = sAx + sB;
    const vm = Math.sqrt(sMax ** 2 + 3 * tau ** 2); // conservative: max normal + max shear combined
    return { A, Fa, Ft, M, sAx, sB, tau, sMax, vm };
  }

  function strain(sigma, E_GPa) { req(E_GPa > 0, 'Elastic modulus must be positive'); return sigma / (E_GPa * 1000); }

  /** Goodman safety factor for a load cycling between R*Fmax and Fmax. */
  function goodman({ sMax, R, Su, Se }) {
    req(Su > 0 && Se > 0, 'Goodman needs ultimate and endurance strength (ductile metals only)');
    req(R >= 0 && R < 1, 'Load ratio R must be in [0, 1)');
    const sMin = R * sMax;
    const sa = (sMax - sMin) / 2, sm = (sMax + sMin) / 2;
    const n = 1 / (sa / Se + sm / Su);
    return { sa, sm, n, infinite: n >= 1 };
  }

  /** Hertz contact, sphere in a conforming spherical cup with radial clearance c. */
  function hertz({ F, D, c, m1, m2 }) {
    req(D > 0 && c > 0, 'Head diameter and radial clearance must be positive');
    const R1 = D / 2, R2 = R1 + c;
    const Reff = R1 * R2 / (R2 - R1);
    const Es = 1 / ((1 - m1.nu ** 2) / (m1.E * 1000) + (1 - m2.nu ** 2) / (m2.E * 1000)); // MPa
    const a = Math.cbrt(3 * F * Reff / (4 * Es));
    const p0 = 3 * F / (2 * Math.PI * a * a);
    const pMean = F / (Math.PI * a * a);
    return { R1, R2, Reff, Es, a, p0, pMean, valid: a / R1 < 0.3 };
  }

  /** Modified Archard: linear wear h = k p s ; volumetric V = k F s. */
  function archard({ k, F, pMean, R1, arcDeg, cyclesPerYear, years }) {
    req(k > 0, 'Wear coefficient must be positive');
    req(arcDeg > 0 && cyclesPerYear > 0 && years > 0, 'Arc, cycles and years must be positive');
    const sCycle = R1 * arcDeg * Math.PI / 180 / 1000;     // m per cycle
    const s = sCycle * cyclesPerYear * years;              // m
    return { sCycle, s, V: k * F * s, h: k * pMean * s };  // mm^3, mm
  }

  /** Head-stem taper (trunnion) fretting wear, modified Archard: h = k * p * delta * N.
      p (MPa) and micromotion delta (um/cycle) should come from the ANSYS contact results. */
  function taperWear({ k, p, deltaUm, cyclesPerYear, years, dTaper, LTaper }) {
    req(k > 0 && p > 0 && deltaUm > 0, 'Wear coefficient, pressure and micromotion must be positive');
    req(dTaper > 0 && LTaper > 0, 'Taper dimensions must be positive');
    const N = cyclesPerYear * years;
    const s = deltaUm * 1e-6 * N;            // m of cumulative slip
    const h = k * p * s;                     // mm
    const Ac = Math.PI * dTaper * LTaper;    // mm^2 nominal engaged area
    return { N, s, h, Ac, V: h * Ac };
  }

  function run(p) {
    const stem = MATERIALS[p.stem], head = MATERIALS[p.head], cup = MATERIALS[p.cup];
    req(stem && head && cup, 'Unknown material');
    const neck = neckStress(p);
    const eps = strain(neck.sMax, stem.E);
    const fat = stem.ductile ? goodman({ sMax: neck.sMax, R: p.R, Su: stem.Su, Se: stem.Se }) : null;
    const con = hertz({ F: p.F, D: p.D, c: p.c, m1: head, m2: cup });
    const wear = archard({ k: p.k, F: p.F, pMean: con.pMean, R1: con.R1, arcDeg: p.arc, cyclesPerYear: p.cycles, years: p.years });
    const yieldMargin = stem.Su ? stem.Su / neck.vm : null;
    const taper = p.tp ? taperWear({ k: p.k, p: p.tp, deltaUm: p.delta, cyclesPerYear: p.cycles, years: p.years, dTaper: p.dT, LTaper: p.LT }) : null;
    return { neck, eps, fat, con, wear, taper, yieldMargin };
  }

  /** One-at-a-time sensitivity of the Goodman safety factor to +/- pct changes. */
  function sensitivity(p, pct = 10) {
    const base = run(p).fat;
    if (!base) return [];
    const keys = [['F', 'Applied force'], ['d', 'Neck diameter'], ['L', 'Lever arm'], ['thetaDeg', 'Load angle'], ['R', 'Load ratio']];
    return keys.map(([k, label]) => {
      const f = s => { const q = Object.assign({}, p); q[k] = p[k] * (1 + s * pct / 100); if (k === 'thetaDeg') q[k] = Math.min(90, q[k]); if (k === 'R') q[k] = Math.min(0.99, q[k]); return run(q).fat.n; };
      return { key: k, label, lo: f(-1), hi: f(1), base: base.n };
    }).sort((a, b) => Math.abs(b.hi - b.lo) - Math.abs(a.hi - a.lo));
  }

  /** Mesh independence: percentage change between successive refinements. */
  function meshStudy(rows, tolPct = 5) {
    req(rows.length >= 2, 'Need at least two mesh levels');
    return rows.map((r, i) => {
      if (i === 0) return Object.assign({}, r, { change: null, ok: null });
      const prev = rows[i - 1].value;
      req(prev !== 0, 'Previous value cannot be zero');
      const change = Math.abs((r.value - prev) / prev) * 100;
      return Object.assign({}, r, { change, ok: change < tolPct });
    });
  }

  return { MATERIALS, ACTIVITIES, neckStress, strain, goodman, hertz, archard, taperWear, run, sensitivity, meshStudy };
}));
