/* Smart-glasses remote support simulator. State is shared between panes, and between tabs of the
   same browser through BroadcastChannel where available. No network video is involved. */
{
  const $ = id => document.getElementById(id);
  if ($('sg-stageT')) {
    const DEV = {
      monitor: {
        name: 'Patient monitor (generic)',
        svg: `<svg viewBox="0 0 400 300"><rect width="400" height="300" fill="#13263F"/><rect x="40" y="40" width="320" height="210" rx="16" fill="#C9D2DC"/><rect x="58" y="56" width="220" height="150" rx="6" fill="#06121F"/>
          <path d="M66 90 l20 0 6-18 8 36 6-18 30 0 6-18 8 36 6-18 30 0 6-18 8 36 6-18 20 0" fill="none" stroke="#3CE07A" stroke-width="2"/>
          <path d="M66 140 q14-20 28 0 t28 0 t28 0 t28 0 t28 0 t28 0" fill="none" stroke="#3CC8FF" stroke-width="2"/>
          <text x="232" y="88" fill="#3CE07A" font-size="20" font-family="Arial">72</text><text x="232" y="138" fill="#3CC8FF" font-size="20" font-family="Arial" id="sgspo2">--</text><text x="66" y="192" fill="#FFD23F" font-size="12" font-family="Arial">SpO2 PROBE OFF</text>
          <rect x="292" y="60" width="54" height="22" rx="4" fill="#1565C0"/><rect x="292" y="92" width="54" height="22" rx="4" fill="#1565C0"/><rect x="292" y="124" width="54" height="22" rx="4" fill="#1565C0"/><circle cx="319" cy="186" r="14" fill="#1565C0"/><circle cx="319" cy="186" r="6" fill="#3CE07A"/>
          <circle cx="84" cy="228" r="9" fill="#1565C0"/><circle cx="124" cy="228" r="9" fill="#1565C0"/><circle cx="164" cy="228" r="9" fill="#1565C0"/><rect x="240" y="220" width="40" height="14" rx="3" fill="#1565C0"/>
          <text x="74" y="248" font-size="9" fill="#1565C0" font-family="Arial">ECG</text><text x="112" y="248" font-size="9" fill="#1565C0" font-family="Arial">SpO2</text><text x="152" y="248" font-size="9" fill="#1565C0" font-family="Arial">NIBP</text><text x="244" y="248" font-size="9" fill="#1565C0" font-family="Arial">BATT</text></svg>`,
        parts: [['Display', .42, .43, 'Waveforms and numerics. Check that each parameter channel is enabled.'], ['ECG port', .21, .76, 'Lead cable input. Inspect pins for bending or corrosion.'],
          ['SpO2 port', .31, .76, 'Pulse oximetry probe input. A loose connector here is a common cause of PROBE OFF.'], ['NIBP port', .41, .76, 'Blood pressure hose connector. Listen for leaks during inflation.'],
          ['Power button / mains indicator', .8, .62, 'Green when on mains. Off means no mains; check socket and cable.'], ['Battery indicator', .65, .76, 'Shows charge. Monitors should run on battery during transport.'], ['Menu keys', .8, .32, 'Soft keys for alarms, settings and parameter set-up.']]
      },
      pump: {
        name: 'Volumetric infusion pump (generic)',
        svg: `<svg viewBox="0 0 400 300"><rect width="400" height="300" fill="#13263F"/><rect x="70" y="30" width="260" height="240" rx="18" fill="#D5DCE4"/><rect x="92" y="50" width="150" height="60" rx="6" fill="#06121F"/>
          <text x="104" y="76" fill="#FFD23F" font-size="13" font-family="Arial">OCCLUSION</text><text x="104" y="98" fill="#9FE8FF" font-size="12" font-family="Arial">DOWNSTREAM  125 ml/h</text>
          <rect x="92" y="128" width="150" height="112" rx="8" fill="#AEB9C6" stroke="#1565C0" stroke-width="2"/><path d="M167 128 V240" stroke="#E8F4FF" stroke-width="6"/><rect x="152" y="236" width="30" height="16" rx="3" fill="#00B3A4"/>
          <g fill="#1565C0">${[0, 1, 2].map(r => [0, 1].map(c => `<rect x="${262 + c * 30}" y="${56 + r * 32}" width="24" height="24" rx="5"/>`).join('')).join('')}</g>
          <rect x="262" y="160" width="54" height="30" rx="6" fill="#00B3A4"/><text x="270" y="180" fill="#fff" font-size="12" font-family="Arial">START</text><rect x="262" y="200" width="54" height="30" rx="6" fill="#A1262E"/><text x="272" y="220" fill="#fff" font-size="12" font-family="Arial">STOP</text>
          <path d="M167 20 V128 M167 252 V300" stroke="#E8F4FF" stroke-width="4"/></svg>`,
        parts: [['Alarm display', .42, .27, 'Shows alarm type and rate. Note the exact message before acting.'], ['Pump door / set channel', .42, .6, 'The administration set must sit fully in the channel before the door closes.'],
          ['Anti-free-flow clamp', .42, .81, 'Must be engaged in the clamp slot; an unseated clamp can trigger alarms.'], ['Line below pump', .42, .93, 'Downstream line: check roller clamps, three-way taps and kinks.'],
          ['Keypad', .72, .3, 'Rate and volume entry. Confirm settings against the prescription.'], ['Start / Stop', .72, .65, 'Stop before opening the door. Restart only after the cause is cleared.']]
      }
    };
    const SCN = {
      monitor: {
        'SpO2 reading missing (PROBE OFF)': [
          ['Is the probe on the patient finger, with the light facing the nail?', 1, 'Place the probe correctly, then wait 10 seconds for a reading.'],
          ['Is the probe cable firmly seated in the SpO2 port?', 2, 'Reseat the connector until it clicks.'],
          ['Does a known-good spare probe give a reading?', 'Fault is in the original probe or its cable. Tag it out and record it for repair.', 3],
          ['Escalate: the SpO2 module or port may be faulty. Remove the monitor from service and log a breakdown report.', null, null]],
        'Monitor will not power on': [
          ['Is the mains indicator lit?', 3, 1],
          ['Try another wall socket and a known-good power cable. Does the indicator light now?', 'Fault was the socket or cable. Report the socket to facilities.', 2],
          ['Does the battery icon show charge when you press power?', 'Unit runs on battery: mains supply path suspected. Do not open the casing on the ward.', 3],
          ['Escalate: suspected internal power supply fault. Remove from service and log a breakdown.', null, null]]
      },
      pump: {
        'Downstream occlusion alarm': [
          ['Press STOP. Are all roller clamps and taps below the pump open?', 1, 'Open the closed clamp or tap, then restart.'],
          ['Is the line free of kinks all the way to the cannula?', 2, 'Straighten the line and restart.'],
          ['Open the door. Is the set seated fully in the channel and the clamp in its slot?', 3, 'Reload the set correctly, close the door, prime if required by local policy.'],
          ['Does the alarm persist with the line disconnected at the patient end (per clinical policy)?', 'Suspect pump sensor fault: replace the pump and log it for calibration.', 'Line or cannula problem: refer to the nurse or clinician.']]
      }
    };
    let dev = 'monitor', scn = null, step = 0, strokes = [], tool = 'pen', live = false, identify = false, feed = null;
    const log = [];
    let bc = null;
    try { bc = new BroadcastChannel('gnk-smartglasses'); } catch (e) { bc = null; }
    const send = m => { try { bc?.postMessage(m); } catch (e) { /* ignore */ } };

    const stages = ['sg-stageT', 'sg-stageE'].map(id => $(id));
    const canv = {};
    const build = () => {
      for (const s of stages) {
        const bg = feed ? (feed.kind === 'img' ? `<img alt="Uploaded scene" src="${feed.url}">` : '') : DEV[dev].svg;
        s.innerHTML = bg + '<canvas></canvas>';
        if (feed && feed.kind === 'video') s.prepend(feed.cloneFor());
        canv[s.id] = s.querySelector('canvas');
      }
      if (!feed) for (const [n, x, y, info] of DEV[dev].parts) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'hs'; b.style.left = x * 100 + '%'; b.style.top = y * 100 + '%'; b.hidden = !identify;
        b.setAttribute('aria-label', n);
        b.addEventListener('click', () => { $('sg-part').textContent = `${n}: ${info}`; add(`Technician identified: ${n}`); send({ t: 'log', m: `Technician identified: ${n}` }); });
        stages[0].appendChild(b);
      }
      draw();
    };
    const draw = () => {
      for (const s of stages) {
        const c = canv[s.id]; if (!c) continue;
        const W = s.clientWidth, H = s.clientHeight; if (!W) continue;
        const r = devicePixelRatio || 1; c.width = W * r; c.height = H * r;
        const g = c.getContext('2d'); g.scale(r, r); g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 4;
        for (const k of strokes) {
          g.strokeStyle = k.col; g.beginPath();
          const P = k.pts.map(([x, y]) => [x * W, y * H]);
          if (k.tool === 'pen') P.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
          else if (P.length > 1) {
            const [a, b] = [P[0], P[P.length - 1]];
            if (k.tool === 'circle') { g.arc(a[0], a[1], Math.hypot(b[0] - a[0], b[1] - a[1]), 0, 7); }
            else { g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); const an = Math.atan2(b[1] - a[1], b[0] - a[0]); for (const s2 of [-.5, .5]) { g.moveTo(b[0], b[1]); g.lineTo(b[0] - 16 * Math.cos(an + s2), b[1] - 16 * Math.sin(an + s2)); } }
          }
          g.stroke();
        }
      }
    };
    const ro = new ResizeObserver(draw); stages.forEach(s => ro.observe(s));

    // expert drawing
    const st = stages[1];
    let cur = null;
    const pt = e => { const b = st.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), Math.min(1, Math.max(0, (e.clientY - b.top) / b.height))]; };
    st.addEventListener('pointerdown', e => { cur = { tool, col: $('sg-col').value, pts: [pt(e)] }; strokes.push(cur); st.setPointerCapture(e.pointerId); });
    st.addEventListener('pointermove', e => { if (!cur) return; if (cur.tool === 'pen') cur.pts.push(pt(e)); else cur.pts[1] = pt(e); draw(); });
    const end = () => { if (!cur) return; add(`Expert drew a ${cur.tool === 'pen' ? 'mark' : cur.tool}`); send({ t: 'strokes', s: strokes }); cur = null; };
    st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
    for (const b of document.querySelectorAll('#sg-tools [data-tool]')) b.addEventListener('click', () => { tool = b.dataset.tool; for (const x of document.querySelectorAll('#sg-tools [data-tool]')) x.setAttribute('aria-pressed', String(x === b)); });
    $('sg-undo').addEventListener('click', () => { strokes.pop(); draw(); send({ t: 'strokes', s: strokes }); });
    $('sg-clear').addEventListener('click', () => { strokes = []; draw(); send({ t: 'strokes', s: strokes }); add('Expert cleared annotations'); });

    // log
    const add = m => { const t = new Date().toLocaleTimeString('en-GB'); log.push(`${t}  ${m}`); const li = document.createElement('li'); li.textContent = `${t} ${m}`; $('sg-log').appendChild(li); $('sg-log').scrollTop = 1e6; };
    const hud = (m, from = 'Expert') => { $('sg-hud').textContent = m; add(`${from} → technician: ${m}`); };

    // scenarios
    const fillScn = () => { $('sg-scn').innerHTML = Object.keys(SCN[dev]).map(k => `<option>${k}</option>`).join(''); scn = $('sg-scn').value; step = 0; renderStep(); };
    const renderStep = () => {
      const S = SCN[dev][scn]; const [q, yes, no] = S[step];
      const end = yes === null;
      const btn = (lab, nx) => `<button class="btn small${lab === 'No' ? ' ghost' : ''}" type="button" data-next="${typeof nx === 'number' ? nx : 'msg'}" data-msg="${typeof nx === 'string' ? nx.replace(/"/g, '&quot;') : ''}">${lab}</button>`;
      $('sg-step').innerHTML = `<p><b>Step ${step + 1} of ${S.length}:</b> ${q}</p>` + (end ? '<div class="btns"><button class="btn small" type="button" data-send="1">Send to technician</button><button class="btn ghost small" type="button" data-restart="1">Restart scenario</button></div>' :
        `<div class="btns"><button class="btn ghost small" type="button" data-send="1">Send question</button>${btn('Yes', yes)}${btn('No', no)}</div>`);
    };
    $('sg-step').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const S = SCN[dev][scn];
      if (b.dataset.send) { const m = S[step][0]; hud(m); send({ t: 'hud', m }); return; }
      if (b.dataset.restart) { step = 0; renderStep(); return; }
      add(`Answer recorded: ${b.textContent} at step ${step + 1}`);
      if (b.dataset.next === 'msg') { hud(b.dataset.msg); send({ t: 'hud', m: b.dataset.msg }); $('sg-step').insertAdjacentHTML('beforeend', '<p class="statl">Resolution sent. Choose Restart or another scenario.</p>'); }
      else { step = +b.dataset.next; renderStep(); }
    });
    $('sg-send').addEventListener('click', () => { const m = $('sg-msg').value.trim(); if (!m) return; hud(m); send({ t: 'hud', m }); $('sg-msg').value = ''; });
    $('sg-msg').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('sg-send').click(); } });

    $('sg-start').addEventListener('click', () => {
      live = !live; $('sg-live').textContent = live ? 'session active (simulated)' : 'session idle'; $('sg-live').className = 'tag' + (live ? ' done' : '');
      $('sg-start').textContent = live ? 'End session' : 'Call expert';
      add(live ? `Session started · ${DEV[dev].name} · ${scn}` : 'Session ended'); send({ t: 'log', m: live ? 'Technician started a session' : 'Technician ended the session' });
    });
    $('sg-id').addEventListener('click', () => { identify = !identify; $('sg-id').setAttribute('aria-pressed', String(identify)); $('sg-id').textContent = 'Identify parts: ' + (identify ? 'on' : 'off'); for (const b of stages[0].querySelectorAll('.hs')) b.hidden = !identify; if (!identify) $('sg-part').textContent = ''; });
    $('sg-dev').addEventListener('change', () => { dev = $('sg-dev').value; strokes = []; feed = null; build(); fillScn(); add(`Equipment changed to ${DEV[dev].name}`); });
    $('sg-scn').addEventListener('change', () => { scn = $('sg-scn').value; step = 0; renderStep(); add(`Scenario: ${scn}`); });
    $('sg-role').addEventListener('change', () => { const v = $('sg-role').value; $('sg-tech').hidden = v === 'expert'; $('sg-expert').hidden = v === 'tech'; draw(); });
    $('sg-file').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      if (!f.type.startsWith('image/') || f.size > 15e6) { $('sg-camst').textContent = 'Please choose an image under 15 MB.'; return; }
      feed = { kind: 'img', url: URL.createObjectURL(f) }; strokes = []; build(); add('Technician feed: uploaded photo (local only)');
    });
    $('sg-reset').addEventListener('click', () => { feed = null; strokes = []; build(); $('sg-camst').textContent = ''; });
    $('sg-cam').addEventListener('click', async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        const mk = () => { const v = document.createElement('video'); v.autoplay = true; v.muted = true; v.playsInline = true; v.srcObject = stream; return v; };
        feed = { kind: 'video', el: mk(), cloneFor: mk }; strokes = []; build();
        $('sg-camst').textContent = 'Camera on. Video stays on this device.'; add('Technician feed: device camera (local only)');
      } catch (e) { $('sg-camst').textContent = 'Camera not available here. Use “your own photo” instead.'; }
    });
    $('sg-copy').addEventListener('click', async () => {
      const txt = `Remote support session report (simulated)\nEquipment: ${DEV[dev].name}\nScenario: ${scn}\n\n` + log.join('\n');
      try { await navigator.clipboard.writeText(txt); $('sg-copied').textContent = 'Copied.'; } catch (e) { $('sg-copied').textContent = 'Copy blocked by the browser; select the log text instead.'; }
    });
    if (bc) bc.onmessage = ({ data: d }) => { if (d.t === 'strokes') { strokes = d.s; draw(); } else if (d.t === 'hud') { $('sg-hud').textContent = d.m; add(`(other tab) Expert → technician: ${d.m}`); } else if (d.t === 'log') add(`(other tab) ${d.m}`); };
    build(); fillScn();
  }
}
