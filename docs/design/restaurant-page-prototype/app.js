/* Prototype of the MrCall restaurant owner page ("Prenotazioni Ristorante").
   Static, offline, no build. All data is invented and lives in memory; reloading resets it.
   The seating search is a simplified copy of the brief's: candidates are the single tables and
   the owner's joins whose range includes the party and whose tables are all free over
   [arrival, arrival + table time); ranking is single table first, fewest seats, fewest other
   joins. Re-seating (moving other bookings to make room) is NOT simulated. */
'use strict';
(function () {

  // ---------------------------------------------------------------- utilities
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const toMin = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const fmt = min => pad(Math.floor(min / 60)) + ':' + pad(min % 60);
  const keyOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const dateOf = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (key, n) => { const d = dateOf(key); d.setDate(d.getDate() + n); return keyOf(d); };
  const clone = o => JSON.parse(JSON.stringify(o));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const GG = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const MM = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const longDate = key => { const d = dateOf(key); return `${cap(GIORNI[d.getDay()])} ${d.getDate()} ${MESI[d.getMonth()]}`; };
  const shortDate = key => { const d = dateOf(key); return `${GG[d.getDay()]} ${d.getDate()} ${MM[d.getMonth()]}`; };
  const persone = n => n === 1 ? '1 persona' : `${n} persone`;
  let uidN = 1;
  const uid = p => (p || 'b') + (uidN++);

  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  const ICON = {
    left: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    right: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
    pin: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-label="tavolo fissato" role="img"><path d="M16 3l5 5-3 1-4 4 1 5-2 2-4-4-5 5-1-1 5-5-4-4 2-2 5 1 4-4z"/></svg>',
    close: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    alert: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#C81E1E" stroke-width="2.2" stroke-linecap="round" aria-label="allergie" role="img"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>',
    phone: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"/></svg>',
    chat: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"/></svg>',
    plus: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  };

  // ---------------------------------------------------------------- the restaurant's fixed rules
  const RESTAURANT = 'Trattoria del Borgo';
  const SERVICES = {
    pranzo: { label: 'Pranzo', open: toMin('12:00'), last: toMin('14:00'), close: toMin('15:30') },
    cena: { label: 'Cena', open: toMin('19:00'), last: toMin('22:00'), close: toMin('23:30') },
  };
  const durFor = party => party <= 4 ? 90 : 120;      // table time, minutes
  const TODAY = keyOf(new Date());
  const SIM_TIME = toMin('20:30');                     // the simulated "now" of the demo evening
  const CLOSED_WD = (dateOf(TODAY).getDay() + 2) % 7;  // weekly rest day, never today

  const isClosedDay = key => key !== TODAY && dateOf(key).getDay() === CLOSED_WD;
  const svcPast = (key, svc) => key < TODAY || (key === TODAY && SIM_TIME >= SERVICES[svc].close - 30);

  // ---------------------------------------------------------------- state
  const S = {
    scenario: 'configured',
    tab: 'day',
    date: TODAY,
    service: 'cena',
    time: SIM_TIME,
    mode: 'sala',
    strip: '14',
    stripStart: TODAY,
    monthKey: TODAY.slice(0, 7),
    find: 0,
    listFilter: 'tutte',
    layout: null,
    draft: null,
    bookings: {},
    requests: [],
    panel: null,
    moving: null,
    search: '',
    gen: { n: 6, size: 2, zone: null },
    joinPick: [],
    closeForm: {},
    preview: { mode: 'empty', svc: 'cena' },
    know: null,
    joinEdit: null,
    wizard: null,
  };

  // ---------------------------------------------------------------- demo data
  const NAMES = ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Mancini', 'Costa', 'Giordano', 'Rizzo', 'Lombardi', 'Moretti', 'Barbieri', 'Fontana', 'Santoro', 'Mariani', 'Rinaldi', 'Caruso', 'Ferrara', 'Galli', 'Martini', 'Leone', 'Longo', 'Gentile', 'Martinelli', 'Vitale', 'Serra', 'Coppola', 'De Santis', 'Marchetti', 'Parisi', 'Villa'];

  function fakePhone(r) { const d = () => Math.floor(r() * 10); return `+39 3${d()}${d()} ${d()}${d()}${d()} ${d()}${d()}${d()}${d()}`; }
  function fakeConv(r) { return 'CON-' + Math.floor(r() * 0xffffffff).toString(16).padStart(8, '0'); }

  function demoLayout() {
    const y = dateOf(TODAY).getFullYear();
    let from = `${y}-11-01`;
    if (from <= TODAY) from = addDays(TODAY, 21);
    const zones = [
      { id: 'z1', name: 'Sala', note: 'Sala interna, la più tranquilla', closures: [] },
      { id: 'z2', name: 'Dehors', note: 'All\'aperto, coperto e riscaldato', closures: [{ from, to: `${y + 1}-03-31` }] },
      { id: 'z3', name: 'Saletta', note: 'Saletta riservata, per gruppi', closures: [] },
    ];
    const tables = []; let id = 1;
    const add = (zone, name, min, max) => tables.push({ id: id++, zone, name, min, max, active: true });
    for (let i = 1; i <= 4; i++) add('z1', 'T' + i, 1, 2);
    for (let i = 5; i <= 8; i++) add('z1', 'T' + i, 2, 4);
    for (let i = 1; i <= 4; i++) add('z2', 'D' + i, 1, 2);
    for (let i = 5; i <= 6; i++) add('z2', 'D' + i, 2, 4);
    add('z3', 'S1', 6, 10); add('z3', 'S2', 4, 6);
    const byName = n => tables.find(t => t.name === n).id;
    let j = 1;
    const J = (names, min, max) => ({ id: 'j' + (j++), ids: names.map(byName), min, max });
    const joins = [J(['T1', 'T2'], 3, 4), J(['T3', 'T4'], 3, 4), J(['T5', 'T6'], 5, 8), J(['T7', 'T8'], 5, 8),
      J(['T5', 'T6', 'T7'], 7, 10), J(['D1', 'D2'], 3, 4), J(['D5', 'D6'], 5, 8)];
    return { zones, tables, joins, settings: { minFree: durFor(1) } };
  }

  function mkBooking(o) {
    return Object.assign({ id: uid('b'), state: 'booked', source: 'assistente', pinned: false, notes: '', allergies: '', noShows: 0, convId: null, leftAt: null, phone: '' }, o, { dur: durFor(o.party) });
  }

  function todayDinner(L) {
    const r = rng(7);
    const tid = n => L.tables.find(t => t.name === n).id;
    const B = (time, party, name, tabs, state, x) => {
      x = x || {};
      const source = x.source || 'assistente';
      return mkBooking({ service: 'cena', start: toMin(time), party, name, tables: tabs.map(tid), state, source,
        phone: source === 'walkin' ? '' : fakePhone(r), convId: source === 'assistente' ? fakeConv(r) : null,
        pinned: !!x.pinned, notes: x.notes || '', allergies: x.allergies || '', noShows: x.noShows || 0,
        leftAt: x.leftAt ? toMin(x.leftAt) : null });
    };
    return [
      B('19:00', 2, 'Mancini', ['D3'], 'left', { leftAt: '20:25' }),
      B('19:00', 2, 'Romano', ['D1'], 'left', { leftAt: '20:20', source: 'staff' }),
      B('19:30', 2, 'Rossi', ['T1'], 'seated'),
      B('19:30', 4, 'Esposito', ['T5'], 'seated', { allergies: 'Celiachia (1 persona)' }),
      B('19:45', 3, 'Ferrari', ['T3', 'T4'], 'seated', { source: 'staff' }),
      B('20:00', 6, 'Bianchi', ['S2'], 'seated'),
      B('20:00', 3, 'Costa', ['D5'], 'seated'),
      B('20:15', 2, 'Colombo', ['T2'], 'arrived'),
      B('20:15', 4, 'Ricci', ['T6'], 'booked', { notes: 'Un seggiolone per un bambino' }),
      B('20:20', 2, 'Walk-in', ['D4'], 'seated', { source: 'walkin' }),
      B('20:30', 8, 'Marino', ['S1'], 'booked', { pinned: true, notes: 'Compleanno: torta alle 22:00. Hanno chiesto la saletta.' }),
      B('20:45', 2, 'Greco', ['D2'], 'booked'),
      B('21:00', 5, 'Bruno', ['T7', 'T8'], 'booked'),
      B('21:15', 2, 'Gallo', ['T3'], 'booked', { source: 'staff' }),
      B('21:30', 4, 'Conti', ['D5'], 'booked', { noShows: 1 }),
      B('21:30', 2, 'De Luca', ['T1'], 'booked', { allergies: 'Frutta a guscio' }),
    ];
  }

  // Fills a day with plausible bookings through the same seating search the page uses.
  function genDay(key) {
    const out = [];
    S.bookings[key] = out;
    // a restaurant that has just been set up has no bookings yet
    if (S.scenario !== 'configured' || isClosedDay(key) || !S.layout.tables.length) return out;
    const r = rng(hashStr(key));
    const wd = dateOf(key).getDay();
    const load = { cena: [0.55, 0.35, 0.4, 0.45, 0.6, 1.1, 3.0][wd], pranzo: [0.9, 0.3, 0.3, 0.3, 0.35, 0.45, 0.6][wd] };
    const sizes = [2, 2, 2, 2, 2, 3, 4, 4, 4, 4, 5, 6, 2, 3, 4, 7, 8];
    ['pranzo', 'cena'].forEach(svc => {
      if (key === TODAY && svc === 'cena') return;
      const sv = SERVICES[svc];
      const slots = (sv.last - sv.open) / 15 + 1;
      const attempts = Math.round(load[svc] * 30);
      for (let i = 0; i < attempts; i++) {
        const party = sizes[Math.floor(r() * sizes.length)];
        const start = sv.open + 15 * Math.floor(r() * slots);
        const c = candidates(S.layout, key, svc, start, party, out, null);
        if (!c.length) continue;
        const roll = r();
        const source = roll < 0.6 ? 'assistente' : roll < 0.9 ? 'staff' : 'walkin';
        const b = mkBooking({ service: svc, start, party, tables: c[0].ids, source,
          name: source === 'walkin' ? 'Walk-in' : NAMES[Math.floor(r() * NAMES.length)],
          phone: source === 'walkin' ? '' : fakePhone(r), convId: source === 'assistente' ? fakeConv(r) : null,
          allergies: r() < 0.06 ? 'Lattosio' : '', noShows: r() < 0.04 ? 1 : 0, pinned: r() < 0.05 });
        if (svcPast(key, svc)) { b.state = 'left'; b.leftAt = start + b.dur - 10; }
        out.push(b);
      }
    });
    if (key === TODAY) out.push(...todayDinner(S.layout));
    return out;
  }

  function ensureDay(key) { if (!S.bookings[key]) genDay(key); return S.bookings[key]; }

  function initScenario() {
    S.bookings = {}; S.panel = null; S.moving = null; S.find = 0; S.requests = [];
    S.date = TODAY; S.service = 'cena'; S.time = SIM_TIME; S.stripStart = TODAY;
    if (S.scenario === 'configured') {
      S.layout = demoLayout();
      for (let i = -7; i <= 60; i++) ensureDay(addDays(TODAY, i));
      S.requests = [{ id: uid('r'), date: TODAY, service: 'cena', start: toMin('21:30'), party: 7, name: 'Fontana', phone: '+39 347 000 1122',
        reason: 'Vogliono portare un cane: l\'assistente ha lasciato decidere a voi', convId: 'CON-00000000' }];
    } else {
      S.layout = { zones: [], tables: [], joins: [], settings: { minFree: durFor(1) } };
      S.wizard = { step: 1, zones: ['Sala'], custom: '', rows: { Sala: [{ n: 6, size: 2 }, { n: 4, size: 4 }] }, pairs: {} };
    }
    S.draft = clone(S.layout);
    S.gen.zone = S.layout.zones.length ? S.layout.zones[0].id : null;
  }

  // ---------------------------------------------------------------- the seating model
  const zoneOpen = (z, key) => !z.closures.some(c => key >= c.from && key <= c.to);
  const live = (list, svc) => list.filter(b => b.service === svc && b.state !== 'cancelled' && b.state !== 'noshow');
  const endOf = b => (b.state === 'left' && b.leftAt != null) ? b.leftAt : b.start + b.dur;
  const tById = (L, id) => L.tables.find(t => t.id === id);
  const tName = (L, id) => { const t = tById(L, id); return t ? t.name : '?'; };
  const zName = (L, zid) => { const z = L.zones.find(x => x.id === zid); return z ? z.name : '?'; };
  const seatLabel = (L, ids) => ids.length ? ids.map(i => tName(L, i)).join('+') : 'senza tavolo';
  const sizeLabel = t => t.min === t.max ? `${t.max} posti` : `${t.min}-${t.max} posti`;

  function seatings(L, key) {
    const zones = Object.fromEntries(L.zones.map(z => [z.id, z]));
    const usable = t => t && t.active && zones[t.zone] && zoneOpen(zones[t.zone], key);
    const joinCount = {};
    L.joins.forEach(j => j.ids.forEach(i => { joinCount[i] = (joinCount[i] || 0) + 1; }));
    const out = [];
    L.tables.filter(usable).forEach(t => out.push({ ids: [t.id], min: t.min, max: t.max, zone: t.zone, join: false }));
    L.joins.forEach(j => {
      const ts = j.ids.map(i => tById(L, i));
      if (ts.length >= 2 && ts.every(usable) && new Set(ts.map(t => t.zone)).size === 1 && j.min <= j.max)
        out.push({ ids: j.ids.slice(), min: j.min, max: j.max, zone: ts[0].zone, join: true });
    });
    out.forEach(s => { s.flex = s.ids.reduce((a, i) => a + (joinCount[i] || 0), 0); s.label = seatLabel(L, s.ids); });
    return out;
  }

  function tablesFree(ids, list, svc, start, dur, excludeId) {
    return !live(list, svc).some(b => b.id !== excludeId && b.tables.some(t => ids.includes(t)) && b.start < start + dur && endOf(b) > start);
  }

  const rank = (a, b) => (a.join - b.join) || (a.max - b.max) || (a.flex - b.flex);

  function candidates(L, key, svc, start, party, list, excludeId) {
    const d = durFor(party);
    return seatings(L, key).filter(s => party >= s.min && party <= s.max && tablesFree(s.ids, list, svc, start, d, excludeId)).sort(rank);
  }

  function arrivalTimes(key, svc) {
    const sv = SERVICES[svc]; const out = [];
    for (let t = sv.open; t <= sv.last; t += 15) if (key !== TODAY || t >= SIM_TIME || svc !== 'cena') out.push(t);
    return out;
  }

  function bookableTimes(L, key, svc, party, list) {
    return arrivalTimes(key, svc).filter(t => candidates(L, key, svc, t, party, list, null).length);
  }

  function maxParty(L, key, svc, list) {
    let best = 0;
    const ss = seatings(L, key);
    arrivalTimes(key, svc).forEach(t => ss.forEach(s => {
      if (s.max > best && tablesFree(s.ids, list, svc, t, durFor(s.max), null)) best = s.max;
    }));
    return best;
  }

  function compactTimes(ts) {
    if (!ts.length) return 'nessun orario';
    const parts = []; let a = ts[0], p = ts[0];
    for (let i = 1; i <= ts.length; i++) {
      if (i < ts.length && ts[i] === p + 15) { p = ts[i]; continue; }
      parts.push(a === p ? fmt(a) : `${fmt(a)}-${fmt(p)}`);
      if (i < ts.length) { a = p = ts[i]; }
    }
    return parts.join(', ');
  }

  function periodCell(key, svc) {
    if (isClosedDay(key)) return { status: 'chiuso' };
    const list = ensureDay(key);
    const covers = live(list, svc).reduce((a, b) => a + b.party, 0);
    if (svcPast(key, svc)) return { status: 'passato', covers };
    const mp = maxParty(S.layout, key, svc, list);
    const slots = arrivalTimes(key, svc).length;
    const t2 = bookableTimes(S.layout, key, svc, 2, list).length;
    const status = mp === 0 ? 'pieno' : (mp <= 2 || t2 < slots * 0.4) ? 'quasi' : 'libero';
    return { status, covers, max: mp };
  }

  function tableAt(list, svc, tableId, t) {
    const bs = live(list, svc).filter(b => b.tables.includes(tableId)).sort((a, b) => a.start - b.start);
    return {
      cur: bs.find(b => b.start <= t && endOf(b) > t),
      next: bs.find(b => b.start > t),
      left: bs.find(b => b.state === 'left' && b.start <= t && endOf(b) <= t && b.start + b.dur > t),
    };
  }

  const KNOW = {
    allergie: { cls: 'red', title: 'Con allergie', label: n => `${n} con allergie`, pred: b => !!b.allergies, detail: b => b.allergies },
    gruppi: { cls: 'blue', title: 'Gruppi da 6 o più', label: n => `${n} ${n === 1 ? 'gruppo' : 'gruppi'} da 6+`, pred: b => b.party >= 6, detail: b => persone(b.party) },
    noshow: { cls: 'amber', title: 'Con no-show passati', label: n => `${n} con no-show passati`, pred: b => b.noShows > 0, detail: b => `${b.noShows} no-show in passato` },
  };

  const minFree = () => (S.layout.settings && S.layout.settings.minFree) || durFor(1);

  // The earliest time from t on at which the table stays free for at least the minimum free time.
  // Returns t itself when the table counts as free now, null when it never does in this service.
  // Only bookings end a free window: the end of the service does not, it is not a booking.
  function freeFrom(list, svc, tableId, t) {
    const bs = live(list, svc).filter(b => b.tables.includes(tableId));
    const mf = minFree();
    let s = t;
    for (let guard = 0; guard < 60; guard++) {
      const blocking = bs.filter(b => b.start < s + mf && endOf(b) > s);
      if (!blocking.length) return (s === t || s <= SERVICES[svc].last) ? s : null;
      s = Math.max.apply(null, blocking.map(endOf));
    }
    return null;
  }
  const isFreeAt = (list, svc, tableId, t) => freeFrom(list, svc, tableId, t) === t;

  const usableTables = (L, key) => {
    const open = new Set(L.zones.filter(z => zoneOpen(z, key)).map(z => z.id));
    return L.tables.filter(t => t.active && open.has(t.zone));
  };
  const freeCount = (key, svc, t) => { const list = ensureDay(key); return usableTables(S.layout, key).filter(tb => isFreeAt(list, svc, tb.id, t)).length; };
  const capacity = key => usableTables(S.layout, key).reduce((a, t) => a + t.max, 0);

  // ---------------------------------------------------------------- undo and toasts
  let toastTimer = null;
  let undoSnap = null;
  function snapshot() { undoSnap = { key: S.date, list: clone(S.bookings[S.date] || []), requests: clone(S.requests) }; }
  function toast(msg, withUndo, isErr) {
    const root = $('#toasts');
    root.innerHTML = `<div class="toast${isErr ? ' err' : ''}" role="status"><span>${msg}</span>${withUndo ? '<button data-act="undo">Annulla</button>' : ''}</div>`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { root.innerHTML = ''; }, withUndo ? 7000 : 4500);
  }

  // ---------------------------------------------------------------- render: shell
  function render() {
    $('#tab-day').setAttribute('aria-selected', S.tab === 'day');
    $('#tab-config').setAttribute('aria-selected', S.tab === 'config');
    const v = $('#view');
    const wizard = !S.layout.tables.length && S.wizard;
    if (wizard) v.innerHTML = renderWizard();
    else if (S.tab === 'day') v.innerHTML = renderDay();
    else v.innerHTML = renderConfig();
    if (S.tab === 'config' && !wizard) liveConfig();
    renderPanel();
  }

  // ---------------------------------------------------------------- render: period strip
  function stripCell(key, cls) {
    const d = dateOf(key);
    const svcLine = svc => {
      const c = periodCell(key, svc);
      const name = svc === 'pranzo' ? 'P' : 'C';
      let main, sub;
      if (c.status === 'chiuso') { main = 'chiuso'; sub = ''; }
      else if (c.status === 'passato') { main = 'finito'; sub = `${c.covers} cop.`; }
      else if (c.status === 'pieno') { main = 'pieno'; sub = `${c.covers} cop.`; }
      else { main = `max ${c.max}`; sub = `${c.covers} cop.`; }
      return `<span class="dc-svc st-${c.status}"><span class="dc-l"><span class="dc-s">${name}</span><b>${main}</b></span>${sub ? `<small>${sub}</small>` : ''}</span>`;
    };
    const title = isClosedDay(key) ? 'Chiuso: riposo settimanale' : ['pranzo', 'cena'].map(svc => {
      const list = ensureDay(key);
      return `${SERVICES[svc].label}: per 2 ${compactTimes(bookableTimes(S.layout, key, svc, 2, list))}; per 4 ${compactTimes(bookableTimes(S.layout, key, svc, 4, list))}; per 6 ${compactTimes(bookableTimes(S.layout, key, svc, 6, list))}`;
    }).join('\n');
    return `<button class="dcell ${cls || ''}${key === S.date ? ' sel' : ''}${key === TODAY ? ' today' : ''}" data-act="go-day" data-date="${key}" title="${esc(title)}" aria-label="${esc(longDate(key))}">
      <span class="dc-date"><b>${d.getDate()}</b>${GG[d.getDay()]}${key === TODAY ? ' · oggi' : ''}</span>
      ${svcLine('pranzo')}${svcLine('cena')}
    </button>`;
  }

  function renderStrip() {
    let cells = '', head;
    if (S.strip === '14') {
      for (let i = 0; i < 14; i++) cells += stripCell(addDays(S.stripStart, i));
      head = `<button class="icon-btn" data-act="strip-shift" data-n="-7" aria-label="Settimana precedente">${ICON.left}</button>
              <button class="icon-btn" data-act="strip-shift" data-n="7" aria-label="Settimana successiva">${ICON.right}</button>
              <span class="muted">${shortDate(S.stripStart)} - ${shortDate(addDays(S.stripStart, 13))}</span>`;
    } else {
      const [y, m] = S.monthKey.split('-').map(Number);
      const first = new Date(y, m - 1, 1);
      const days = new Date(y, m, 0).getDate();
      const lead = (first.getDay() + 6) % 7;
      ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'].forEach(n => { cells += `<div class="month-dow">${n}</div>`; });
      for (let i = 0; i < lead; i++) cells += '<div class="dcell blank"></div>';
      for (let d = 1; d <= days; d++) cells += stripCell(keyOf(new Date(y, m - 1, d)));
      head = `<button class="icon-btn" data-act="month-shift" data-n="-1" aria-label="Mese precedente">${ICON.left}</button>
              <button class="icon-btn" data-act="month-shift" data-n="1" aria-label="Mese successivo">${ICON.right}</button>
              <span class="muted">${cap(MESI[m - 1])} ${y}</span>`;
    }
    return `<section class="strip" aria-label="Disponibilità dei prossimi giorni">
      <div class="strip-head">
        <h2>Cosa resta libero</h2>
        <div class="seg" role="group" aria-label="Periodo">
          <button data-act="strip-mode" data-v="14" aria-pressed="${S.strip === '14'}">14 giorni</button>
          <button data-act="strip-mode" data-v="month" aria-pressed="${S.strip === 'month'}">Mese</button>
        </div>
        ${head}
        <div class="legend">
          <span><i class="st-libero"></i>libero</span>
          <span><i class="st-quasi"></i>quasi pieno</span>
          <span><i class="st-pieno"></i>pieno</span>
          <span><i class="st-chiuso"></i>chiuso</span>
          <span>P pranzo · C cena · "max 6" = il gruppo più grande che entra ancora</span>
        </div>
      </div>
      <div class="strip-days${S.strip === 'month' ? ' month' : ''}">${cells}</div>
    </section>`;
  }

  // ---------------------------------------------------------------- render: day
  function dayList() { return ensureDay(S.date); }

  function renderDay() {
    const key = S.date, svc = S.service, sv = SERVICES[svc];
    const list = dayList();
    const covers = s => live(list, s).reduce((a, b) => a + b.party, 0);
    let html = renderStrip();
    html += `<section class="day" aria-label="Giorno">
      <div class="day-head">
        <div class="day-nav">
          <button class="icon-btn" data-act="day-shift" data-n="-1" aria-label="Giorno precedente">${ICON.left}</button>
          <h2 class="day-title">${longDate(key)}</h2>
          <button class="icon-btn" data-act="day-shift" data-n="1" aria-label="Giorno successivo">${ICON.right}</button>
          <button class="btn ghost small" data-act="go-day" data-date="${TODAY}" ${key === TODAY ? 'disabled' : ''}>Oggi</button>
          <input class="date-input" type="date" value="${key}" data-bind="date" aria-label="Scegli una data">
        </div>
        <div class="svc-tabs" role="group" aria-label="Servizio">
          ${['pranzo', 'cena'].map(s => `<button class="svc-tab" data-act="svc" data-svc="${s}" aria-pressed="${svc === s}"><b>${SERVICES[s].label}</b><small>${isClosedDay(key) ? 'chiuso' : `${covers(s)} coperti`}</small></button>`).join('')}
        </div>
        <span class="spacer"></span>
        ${isClosedDay(key) ? '' : `<button class="btn" data-act="new-free">${ICON.plus} Prenotazione</button>`}
      </div>`;

    if (isClosedDay(key)) {
      return html + `<div class="card closed-day"><h3>Chiuso: riposo settimanale</h3><p class="muted">L'assistente risponde che il ${GIORNI[dateOf(key).getDay()]} siete chiusi e propone il giorno dopo.</p></div></section>`;
    }

    const sl = live(list, svc);
    const counts = Object.fromEntries(Object.keys(KNOW).map(k => [k, sl.filter(KNOW[k].pred)]));
    const free = freeCount(key, svc, S.time);
    const total = usableTables(S.layout, key).length;
    html += `<div class="summary">
        <span class="big-num"><b>${covers(svc)}</b> coperti ${key === TODAY ? 'stasera' : 'prenotati'} <small>(sala da ${capacity(key)} posti)</small></span>
        <span class="big-num"><b class="${free ? '' : 'err'}">${free}</b> ${free === 1 ? 'tavolo libero' : 'tavoli liberi'} su ${total} alle ${fmt(S.time)}</span>
        <span class="know"><span class="lbl">Da sapere:</span>
          ${Object.keys(KNOW).filter(k => counts[k].length).map(k => `<button class="pill ${KNOW[k].cls} know-chip" data-act="know" data-k="${k}" aria-pressed="${S.know === k}" aria-expanded="${S.know === k}" title="Mostra chi">${KNOW[k].label(counts[k].length)}</button>`).join('')}
          ${Object.keys(KNOW).every(k => !counts[k].length) ? '<span class="muted">niente di particolare</span>' : ''}
        </span>
      </div>
      ${S.know && counts[S.know] && counts[S.know].length ? `<div class="know-pop" role="status"><b>${KNOW[S.know].title}:</b> ${counts[S.know].sort((a, b) => a.start - b.start).map(b => `<button class="linkish" data-act="know-go" data-bid="${b.id}">${esc(b.name)}</button> <small>${fmt(b.start)} · ${seatLabel(S.layout, b.tables)} · ${esc(KNOW[S.know].detail(b))}</small>`).join('<span class="sep">;</span> ')}<button class="x-btn" data-act="know" data-k="${S.know}" aria-label="Chiudi">✕</button></div>` : ''}`;

    // time chips and the "posto per N" finder
    let chips = '';
    for (let t = sv.open; t <= sv.close - 30; t += 15) {
      const f = freeCount(key, svc, t);
      chips += `<button class="tchip${f ? '' : ' none'}${key === TODAY && t === SIM_TIME ? ' now' : ''}" data-act="time" data-t="${t}" aria-pressed="${t === S.time}"><b>${fmt(t)}</b><small>${f} ${f === 1 ? 'libero' : 'liberi'}</small></button>`;
    }
    // The finder uses the assistant's rule: a seating whose range includes the party and whose
    // tables stay free from the chosen time for the whole table time of that party.
    let fit = null, findLine;
    if (!S.find) findLine = `<span class="muted">Scegli quante persone: ti dico dove si siedono alle ${fmt(S.time)}.</span>`;
    else {
      fit = candidates(S.layout, key, svc, S.time, S.find, list, null);
      if (fit.length) {
        findLine = `<b>Per ${S.find} alle ${fmt(S.time)}:</b> ${fit.slice(0, 4).map((c, i) => `<button class="chip" data-act="fit-book" data-i="${i}" title="${esc(zName(S.layout, c.zone))}, libero fino ad almeno ${fmt(S.time + durFor(S.find))}">${c.label}${i === 0 ? ' (consigliato)' : ''}</button>`).join(', ')}${fit.length > 4 ? ` <small>e altri ${fit.length - 4}</small>` : ''}`;
      } else {
        const later = bookableTimes(S.layout, key, svc, S.find, list).filter(t => t > S.time);
        findLine = `<b>Per ${S.find} alle ${fmt(S.time)}: nessun tavolo;</b> ${later.length ? `primi orari liberi: ${later.slice(0, 4).map(t => `<button class="chip" data-act="time" data-t="${t}">${fmt(t)}</button>`).join(', ')}` : 'nessun orario in questo servizio, guarda i giorni sopra.'}`;
      }
    }
    html += `<div class="toolbar card">
        <div class="tb tb-time">
          <span class="tb-lbl">Ora <small>tavoli liberi per almeno ${minFree()} min</small></span>
          <div class="tchips" id="tchips">${chips}</div>
        </div>
        <div class="tb tb-find">
          <span class="tb-lbl">Cerca posto</span>
          <div class="tb-row">
            <span class="stepper"><button data-act="find" data-n="-1" aria-label="Una persona in meno">−</button><output aria-live="polite">${S.find || '–'}</output><button data-act="find" data-n="1" aria-label="Una persona in più">+</button></span>
            <span>persone</span>
            ${S.find ? '<button class="btn ghost small" data-act="find-clear">Azzera</button>' : ''}
          </div>
          <div class="find-line" role="status">${findLine}</div>
        </div>
      </div>`;

    if (S.moving) {
      const b = list.find(x => x.id === S.moving);
      html += `<div class="move-banner" role="status">Sposta <b>${esc(b.name)}</b> (${b.party}, ${fmt(b.start)}): tocca il tavolo libero che vuoi, in blu quelli dove entrano. <button class="btn ghost small" data-act="move-cancel">Annulla spostamento</button></div>`;
    }

    html += `<div class="mode-row">
        <div class="seg" role="group" aria-label="Vista">
          <button data-act="mode" data-v="sala" aria-pressed="${S.mode === 'sala'}">Sala</button>
          <button data-act="mode" data-v="timeline" aria-pressed="${S.mode === 'timeline'}">Linea del tempo</button>
        </div>
        <span class="hint">${S.mode === 'sala' ? 'Verde = libero alle ' + fmt(S.time) + ' per almeno ' + minFree() + ' min; grigio = si libera troppo poco. Tocca un tavolo verde per prenotarlo, uno occupato per aprirlo. Trascina per spostare.' : 'Una riga per tavolo. Tocca uno spazio vuoto per prenotare a quell\'ora, l\'intestazione per cambiare ora.'}</span>
      </div>`;

    html += `<div class="day-body${S.know ? ' knowing' : ''}"><div>${S.mode === 'sala' ? renderFloor(list, fit) : renderTimeline(list)}</div>${renderList(list)}</div></section>`;
    return html;
  }

  function renderFloor(list, fit) {
    const L = S.layout, key = S.date, svc = S.service, t = S.time;
    const fitIds = new Map();
    if (fit) fit.forEach((s, i) => s.ids.forEach(id => { if (!fitIds.has(id)) fitIds.set(id, { i, s }); }));
    let movingB = S.moving ? list.find(b => b.id === S.moving) : null;
    const moveOk = new Set();
    if (movingB) seatings(L, key).forEach(s => {
      if (movingB.party >= s.min && movingB.party <= s.max && tablesFree(s.ids, list, svc, movingB.start, movingB.dur, movingB.id)) s.ids.forEach(i => moveOk.add(i));
    });
    const q = S.search.trim().toLowerCase();
    const matches = b => q && (b.name.toLowerCase().includes(q) || (b.phone || '').replace(/\s/g, '').includes(q.replace(/\s/g, '')));
    const hits = S.know ? live(list, svc).filter(KNOW[S.know].pred) : [];
    const hitsOn = ids => hits.filter(b => b.tables.some(i => ids.includes(i)));

    return L.zones.map(z => {
      const ts = L.tables.filter(x => x.zone === z.id && x.active);
      if (!ts.length) return '';
      if (!zoneOpen(z, key)) return `<section class="zone"><div class="zone-head"><h3>${esc(z.name)}</h3></div><div class="zone-closed">Chiusa in questa data (${z.closures.map(c => `${shortDate(c.from)} - ${shortDate(c.to)}`).join(', ')}). L'assistente non la propone.</div></section>`;
      const infos = new Map(ts.map(x => [x.id, tableAt(list, svc, x.id, t)]));
      const ffs = new Map(ts.map(x => [x.id, freeFrom(list, svc, x.id, t)]));
      const freeN = ts.filter(x => !infos.get(x.id).cur && ffs.get(x.id) === t).length;
      const done = new Set();
      const tiles = [];
      ts.forEach(x => {
        if (done.has(x.id)) return;
        const info = infos.get(x.id);
        if (info.cur) {
          const members = info.cur.tables.map(id => tById(L, id)).filter(m => m && m.zone === z.id);
          members.forEach(m => done.add(m.id));
          const ms = members.length ? members : [x];
          tiles.push(busyTile(info.cur, ms, matches(info.cur), hitsOn(ms.map(m => m.id))));
        } else {
          done.add(x.id);
          tiles.push(freeTile(x, info, fitIds.get(x.id), movingB, moveOk, ffs.get(x.id), hitsOn([x.id])));
        }
      });
      return `<section class="zone">
        <div class="zone-head"><h3>${esc(z.name)}</h3><span class="pill ${freeN ? 'green' : 'red'}">${freeN} ${freeN === 1 ? 'libero' : 'liberi'} su ${ts.length}</span>${z.note ? `<span class="note">${esc(z.note)}</span>` : ''}</div>
        <div class="tiles">${tiles.join('')}</div></section>`;
    }).join('');
  }

  function stateLabel(b, t) {
    if (b.state === 'seated') return { cls: 'busy', text: `seduti · fino ${fmt(b.start + b.dur)}` };
    if (b.state === 'arrived') return { cls: 'arrived', text: 'arrivati, da far sedere' };
    if (b.state === 'left') return { cls: 'busy', text: `andati alle ${fmt(b.leftAt)}` };
    const late = t - b.start;
    if (late >= 10) return { cls: 'booked late', text: `in ritardo di ${late} min` };
    return { cls: 'booked', text: `in arrivo alle ${fmt(b.start)}` };
  }

  // bookings flagged by an open "Da sapere" chip that sit on this tile but are not the one shown
  const hitTag = (hits, shownId) => hits.filter(h => h.id !== shownId).map(h => `<span class="hit-tag">${esc(h.name)} ${fmt(h.start)}</span>`).join('');

  function busyTile(b, members, isMatch, hits) {
    const L = S.layout;
    const st = stateLabel(b, S.time);
    const joined = members.length > 1;
    const seats = joined ? `unione · ${members.reduce((a, m) => a + m.max, 0)} posti` : sizeLabel(members[0]);
    hits = hits || [];
    return `<button class="tile ${st.cls}${joined ? ' joined' : ''}${isMatch ? ' match' : ''}${hits.length ? ' hit' : ''}${S.moving ? ' nofit' : ''}" style="${joined && members.length > 2 ? 'grid-column: span 3' : ''}"
        data-act="open" data-bid="${b.id}" draggable="true" data-drag-bid="${b.id}"
        aria-label="${esc(`${seatLabel(L, b.tables)}, ${b.name}, ${persone(b.party)}, ${st.text}`)}">
      <span class="tname">${members.map(m => esc(m.name)).join(' + ')}${joined ? ' <span class="join-tag">uniti</span>' : ''}</span>
      <span class="seats">${seats}</span>
      <span class="corner">${b.allergies ? ICON.alert : ''}${b.pinned ? ICON.pin : ''}</span>
      <span class="who">${esc(b.name)} · ${b.party}</span>
      <span class="line">${fmt(b.start)}-${fmt(b.start + b.dur)}${b.source === 'walkin' ? ' · walk-in' : ''}</span>
      ${hitTag(hits, b.id)}
      <span class="foot">${st.text}</span>
    </button>`;
  }

  function freeTile(x, info, fitInfo, movingB, moveOk, ff, hits) {
    hits = hits || [];
    const short = ff !== S.time;
    let cls = short ? 'tile short' : 'tile free', extra = '';
    if (hits.length) cls += ' hit';
    if (fitInfo) {
      cls += ' fit' + (fitInfo.i === 0 && fitInfo.s.ids[0] === x.id ? ' fit-best' : '');
      if (fitInfo.s.join) extra = `<span class="with">con ${fitInfo.s.ids.filter(i => i !== x.id).map(i => tName(S.layout, i)).join('+')}</span>`;
    } else if (S.find) cls += ' nofit';
    if (movingB) cls += moveOk.has(x.id) ? ' fit' : ' nofit';
    const gap = info.next ? info.next.start - S.time : Infinity;
    // below the minimum free time the table is not offered as free: neutral, with when it frees up
    const until = short ? 'non disponibile' : !info.next ? 'libero' : `libero fino ${fmt(info.next.start)}`;
    const sub = short ? (ff != null ? `libero dalle ${fmt(ff)}` : 'non si libera più in questo servizio') : '';
    return `<button class="${cls}" data-act="tile-free" data-tid="${x.id}" data-drop-tid="${x.id}"
        aria-label="${esc(`${x.name}, ${sizeLabel(x)}, ${until}${sub ? ', ' + sub : ''}`)}">
      <span class="tname">${esc(x.name)}</span>
      <span class="seats">${sizeLabel(x)}</span>
      ${extra}
      ${info.left ? `<span class="line muted">${esc(info.left.name)} andati alle ${fmt(info.left.leftAt)}</span>` : ''}
      ${info.next ? `<span class="line">${short ? `solo ${gap} min, ` : ''}poi ${fmt(info.next.start)} ${esc(info.next.name)} · ${info.next.party}</span>` : ''}
      ${hitTag(hits, null)}
      <span class="foot">${until}</span>
      ${sub ? `<small class="line">${sub}</small>` : ''}
    </button>`;
  }

  function renderTimeline(list) {
    const L = S.layout, key = S.date, svc = S.service, sv = SERVICES[svc];
    const span = sv.close - sv.open, slots = span / 15;
    const pct = m => ((m - sv.open) / span * 100).toFixed(3) + '%';
    let ticks = '';
    for (let m = sv.open; m <= sv.close; m += 30) ticks += `<span class="tl-tick" style="left:${pct(m)}">${fmt(m)}</span>`;
    let html = `<div class="tl-wrap"><div class="tl" style="--slots:${slots}">
      <div class="tl-row tl-head"><div class="tl-label"></div><div class="tl-track" data-act="tl-time" title="Tocca per cambiare ora">${ticks}<span class="tl-now" style="left:${pct(S.time)}"></span></div></div>`;
    const lv = (list).filter(b => b.service === svc && b.state !== 'cancelled' && b.state !== 'noshow');
    L.zones.forEach(z => {
      const ts = L.tables.filter(x => x.zone === z.id && x.active);
      if (!ts.length) return;
      const open = zoneOpen(z, key);
      html += `<div class="tl-zone">${esc(z.name)}${open ? '' : ' · chiusa in questa data'}</div>`;
      if (!open) return;
      ts.forEach(x => {
        const bars = lv.filter(b => b.tables.includes(x.id)).map(b => {
          const end = b.state === 'left' && b.leftAt != null ? b.leftAt : b.start + b.dur;
          const cls = b.state === 'seated' ? '' : b.state;
          const jt = b.tables.length > 1 ? `<span class="join-tag">${seatLabel(L, b.tables)}</span>` : '';
          return `<button class="tl-bar ${cls}${S.know && KNOW[S.know].pred(b) ? ' hit' : ''}" style="left:${pct(b.start)};width:calc(${pct(Math.min(end, sv.close))} - ${pct(b.start)})" data-act="open" data-bid="${b.id}" title="${esc(`${b.name}, ${persone(b.party)}, ${fmt(b.start)}-${fmt(end)}`)}">${b.pinned ? ICON.pin : ''}${jt}${esc(b.name)} · ${b.party}</button>`;
        }).join('');
        html += `<div class="tl-row"><div class="tl-label">${esc(x.name)}<small>${x.min}-${x.max}</small></div>
          <div class="tl-track" data-act="tl-new" data-tid="${x.id}">${bars}<span class="tl-now" style="left:${pct(S.time)}"></span></div></div>`;
      });
    });
    const orphans = lv.filter(b => !b.tables.length);
    if (orphans.length) html += `<div class="tl-zone">Senza tavolo</div>` + orphans.map(b => `<div class="tl-row"><div class="tl-label">?</div><div class="tl-track"><button class="tl-bar arrived" style="left:${pct(b.start)};width:calc(${pct(b.start + b.dur)} - ${pct(b.start)})" data-act="open" data-bid="${b.id}">${esc(b.name)} · ${b.party}</button></div></div>`).join('');
    return html + '</div></div>';
  }

  function renderList(list) {
    const L = S.layout, svc = S.service;
    const all = list.filter(b => b.service === svc).sort((a, b) => a.start - b.start || a.name.localeCompare(b.name));
    const active = all.filter(b => b.state !== 'cancelled' && b.state !== 'noshow');
    const gone = all.filter(b => b.state === 'cancelled' || b.state === 'noshow');
    const groups = {
      tutte: active,
      attesi: active.filter(b => b.state === 'booked' || b.state === 'arrived'),
      seduti: active.filter(b => b.state === 'seated'),
      andati: active.filter(b => b.state === 'left'),
    };
    const q = S.search.trim().toLowerCase();
    const isMatch = b => q && (b.name.toLowerCase().includes(q) || (b.phone || '').replace(/\s/g, '').includes(q.replace(/\s/g, '')));
    const reqs = S.requests.filter(r => r.date === S.date && r.service === svc);
    const orphans = active.filter(b => !b.tables.length);
    const row = b => {
      const st = stateLabel(b, S.time);
      const quick = (b.state === 'booked' || b.state === 'arrived') ? `<button class="quick" data-act="st" data-bid="${b.id}" data-st="seated">Seduti</button>`
        : b.state === 'seated' ? `<button class="quick" data-act="st" data-bid="${b.id}" data-st="left">Andati</button>` : '';
      return `<div class="brow${b.state === 'left' || b.state === 'cancelled' || b.state === 'noshow' ? ' dim' : ''}${isMatch(b) ? ' match' : ''}${S.know && KNOW[S.know].pred(b) ? ' hit' : ''}" data-act="open" data-bid="${b.id}" role="button" tabindex="0">
        <span class="t">${fmt(b.start)}</span>
        <span class="n"><b>${esc(b.name)}${b.pinned ? ' ' + ICON.pin : ''}${b.allergies ? ' ' + ICON.alert : ''}</b>
          <small>${b.party} pers. · ${seatLabel(L, b.tables)} · ${b.state === 'cancelled' ? 'annullata' : b.state === 'noshow' ? 'no-show' : st.text}</small></span>
        ${quick}</div>`;
    };
    const shown = groups[S.listFilter];
    return `<aside class="list${S.know ? ' knowing' : ''}" aria-label="Prenotazioni del servizio">
      <h3>${SERVICES[svc].label} · ${active.length} prenotazioni</h3>
      ${reqs.length ? `<div class="requests"><h4>Da decidere (${reqs.length})</h4>${reqs.map(r => `<div class="req"><b>${fmt(r.start)} · ${esc(r.name)} · ${persone(r.party)}</b><br>${esc(r.reason)}
        <div class="acts"><button class="btn small" data-act="req-accept" data-rid="${r.id}">Accetta</button><button class="btn ghost small" data-act="req-decline" data-rid="${r.id}">Rifiuta</button><button class="btn ghost small" data-act="call" data-conv="${r.convId}" data-rid="${r.id}">Apri chiamata</button></div></div>`).join('')}</div>` : ''}
      ${orphans.length ? `<div class="unseated"><b>Senza tavolo (${orphans.length})</b>: tavoli tolti dalla sala. Apri la prenotazione e usa Sposta.</div>` : ''}
      <div class="filters" role="group" aria-label="Filtro">
        ${[['tutte', 'Tutte'], ['attesi', 'Da arrivare'], ['seduti', 'Al tavolo'], ['andati', 'Andati']].map(([k, l]) => `<button data-act="list-filter" data-v="${k}" aria-pressed="${S.listFilter === k}">${l} ${groups[k].length}</button>`).join('')}
      </div>
      ${shown.length ? shown.map(row).join('') : '<p class="muted">Nessuna prenotazione qui.</p>'}
      ${gone.length ? `<details class="gone"><summary>Annullate e no-show (${gone.length})</summary>${gone.map(row).join('')}</details>` : ''}
    </aside>`;
  }

  // ---------------------------------------------------------------- render: side panel
  function renderPanel() {
    const p = $('#panel'), scrim = $('#scrim');
    if (!S.panel) { p.hidden = true; scrim.hidden = true; p.innerHTML = ''; return; }
    p.hidden = false; scrim.hidden = false;
    p.innerHTML = S.panel.type === 'booking' ? bookingPanel() : newPanel();
  }

  function findBooking(id) { return dayList().find(b => b.id === id); }

  function bookingPanel() {
    const L = S.layout;
    const b = findBooking(S.panel.id);
    if (!b) { S.panel = null; return ''; }
    const zone = b.tables.length ? zName(L, tById(L, b.tables[0]) ? tById(L, b.tables[0]).zone : '') : '';
    const src = { assistente: 'Assistente MrCall (telefono)', staff: 'Inserita dallo staff', walkin: 'Walk-in' }[b.source];
    const closed = b.state === 'cancelled' || b.state === 'noshow';
    const stBtn = (st, label) => `<button data-act="st" data-bid="${b.id}" data-st="${st}" aria-pressed="${b.state === st}" ${closed ? 'disabled' : ''}>${label}</button>`;
    return `<div class="panel-top"><div><h2 tabindex="-1" id="panel-h">${esc(b.name)}</h2><span class="pill ${b.source === 'assistente' ? 'blue' : ''}">${src}</span></div>
        <button class="icon-btn" data-act="panel-close" aria-label="Chiudi">${ICON.close}</button></div>
      <div class="when">${longDate(S.date)} · ${fmt(b.start)}<small>${SERVICES[b.service].label} · ${persone(b.party)} · fino alle ${fmt(b.start + b.dur)}</small></div>
      ${closed ? `<div class="callout red">${b.state === 'cancelled' ? 'Prenotazione annullata.' : 'Segnata come no-show.'} <button class="btn ghost small" data-act="st" data-bid="${b.id}" data-st="booked">Ripristina</button></div>` : ''}
      ${b.allergies ? `<div class="callout red"><b>Allergie:</b> ${esc(b.allergies)}</div>` : ''}
      ${b.notes ? `<div class="callout amber">${esc(b.notes)}</div>` : ''}
      ${b.noShows ? `<div class="callout amber">${b.noShows} no-show in passato con questo numero.</div>` : ''}
      <dl class="kv">
        <dt>Tavolo</dt><dd>${seatLabel(L, b.tables)}${zone ? ` · ${esc(zone)}` : ''}${b.pinned ? ' · fissato' : ''}</dd>
        <dt>Telefono</dt><dd>${b.phone ? esc(b.phone) : '<span class="muted">non lasciato</span>'}</dd>
      </dl>
      ${b.phone ? `<div class="contact-row"><a class="btn ghost small" href="tel:${esc(b.phone.replace(/\s/g, ''))}">${ICON.phone} Chiama</a><button class="btn ghost small" data-act="fake" data-msg="Aprirebbe WhatsApp verso ${esc(b.phone)}">${ICON.chat} WhatsApp</button>${b.convId ? `<button class="btn ghost small" data-act="call" data-bid="${b.id}">Apri chiamata</button>` : ''}</div>` : ''}
      <div class="section-title">Stato</div>
      <div class="states" role="group" aria-label="Stato della prenotazione">
        ${stBtn('booked', 'In arrivo')}${stBtn('arrived', 'Arrivati')}${stBtn('seated', 'Seduti')}${stBtn('left', 'Andati')}
      </div>
      <div class="section-title">Azioni</div>
      <div class="actions">
        <button class="btn ghost" data-act="move-start" data-bid="${b.id}" ${closed ? 'disabled' : ''}>Sposta</button>
        <button class="btn ghost" data-act="pin" data-bid="${b.id}" ${closed ? 'disabled' : ''} title="Un tavolo fissato non viene mai spostato dal sistema per fare posto ad altri">${b.pinned ? 'Sblocca tavolo' : 'Fissa tavolo'}</button>
        <button class="btn ghost" data-act="st" data-bid="${b.id}" data-st="noshow" ${closed || b.state === 'seated' || b.state === 'left' ? 'disabled' : ''}>No-show</button>
        <button class="btn danger" data-act="cancel-ask" data-bid="${b.id}" ${closed ? 'disabled' : ''}>Annulla prenotazione</button>
      </div>
      <p class="muted" style="font-size:13px">Ogni azione si può annullare dal messaggio in basso.${b.source === 'assistente' ? ' Al telefono l\'assistente ha detto "un tavolo per ' + b.party + (zone ? ' in ' + esc(zone) : '') + '", mai il nome del tavolo.' : ''}</p>`;
  }

  function newPanel() {
    const p = S.panel, L = S.layout;
    const fixed = p.tables && p.tables.length ? p.tables : null;
    const seatInfo = fixed ? seatings(L, S.date).find(s => s.ids.join() === fixed.join()) || { min: 1, max: 99, ids: fixed, label: seatLabel(L, fixed) } : null;
    const times = []; for (let t = SERVICES[S.service].open; t <= SERVICES[S.service].last + 30; t += 15) times.push(t);
    if (!times.includes(p.start)) times.push(p.start), times.sort((a, b) => a - b);
    let walk = '';
    if (S.date === TODAY) {
      const lo = seatInfo ? seatInfo.min : 1, hi = seatInfo ? Math.min(seatInfo.max, 8) : 6;
      let bs = ''; for (let n = lo; n <= hi; n++) bs += `<button class="btn" data-act="walkin" data-p="${n}">${n}</button>`;
      walk = `<div class="walkin"><b>Walk-in adesso</b> · si siedono subito${fixed ? ' a ' + seatInfo.label : ''}. Quante persone?<div class="row">${bs}</div></div>`;
    }
    let pc = ''; for (let n = 1; n <= 10; n++) pc += `<button data-act="nb-party" data-p="${n}" aria-pressed="${p.party === n}">${n}</button>`;
    return `<div class="panel-top"><div><h2 tabindex="-1" id="panel-h">Nuova prenotazione</h2>
        <span class="muted">${fixed ? `${seatInfo.label} · ${zName(L, tById(L, fixed[0]).zone)} · ${seatInfo.min}-${seatInfo.max} persone` : 'Tavolo scelto dal sistema'}</span>
        ${fixed ? ' <button class="btn ghost small" data-act="nb-auto">Lascia scegliere il tavolo al sistema</button>' : ''}</div>
        <button class="icon-btn" data-act="panel-close" aria-label="Chiudi">${ICON.close}</button></div>
      ${walk}
      <div class="section-title">Prenotazione telefonica</div>
      <div class="when" id="nb-when"></div>
      <div class="field"><span>Persone</span><div class="pchips">${pc}<input class="input" type="number" min="1" max="40" value="${p.party}" data-bind="nb-party" aria-label="Persone, oltre 10" style="width:72px"></div></div>
      <label class="field"><span>Ora</span><select data-bind="nb-time">${times.map(t => `<option value="${t}" ${t === p.start ? 'selected' : ''}>${fmt(t)}</option>`).join('')}</select></label>
      <label class="field"><span>Nome *</span><input data-bind="nb-name" value="${esc(p.name)}" autocomplete="off" id="nb-name"></label>
      <label class="field"><span>Telefono</span><input data-bind="nb-phone" value="${esc(p.phone)}" inputmode="tel" autocomplete="off"></label>
      <label class="field"><span>Note e allergie</span><input data-bind="nb-notes" value="${esc(p.notes)}" autocomplete="off"></label>
      <div id="nb-check"></div>
      <button class="btn save-btn" data-act="nb-save" id="nb-save">Salva</button>`;
  }

  function checkNew() {
    const p = S.panel, L = S.layout, list = dayList();
    const fixed = p.tables && p.tables.length ? p.tables : null;
    const errs = [];
    let seat = null;
    if (fixed) {
      const s = seatings(L, S.date).find(x => x.ids.join() === fixed.join());
      const label = seatLabel(L, fixed);
      if (s && (p.party < s.min || p.party > s.max)) errs.push(`Persone: ${label} accoglie da ${s.min} a ${s.max} persone. Tocca "Lascia scegliere il tavolo al sistema".`);
      else if (!tablesFree(fixed, list, S.service, p.start, durFor(p.party), null)) {
        const clash = live(list, S.service).find(b => b.tables.some(t => fixed.includes(t)) && b.start < p.start + durFor(p.party) && endOf(b) > p.start);
        const alt = candidates(L, S.date, S.service, p.start, p.party, list, null).slice(0, 3);
        errs.push(`Ora: ${label} serve a ${esc(clash.name)} dalle ${fmt(clash.start)}, e ${persone(p.party)} lo tengono fino alle ${fmt(p.start + durFor(p.party))}.`
          + (alt.length ? ` Liberi alle ${fmt(p.start)}: ${alt.map(a => `<button class="btn ghost small" data-act="nb-seat" data-ids="${a.ids.join(',')}">${a.label}</button>`).join(' ')}` : ' Cambia ora.'));
      } else seat = { ids: fixed, label };
    } else {
      const c = candidates(L, S.date, S.service, p.start, p.party, list, null);
      if (c.length) seat = c[0];
      else {
        const later = bookableTimes(L, S.date, S.service, p.party, list);
        errs.push(`Ora: alle ${fmt(p.start)} non c'è un tavolo per ${p.party}. ${later.length ? 'Orari liberi: ' + compactTimes(later) + '.' : 'Nessun orario libero in questo servizio.'}`);
      }
    }
    if (p.touched && !p.name.trim()) errs.push('Nome: scrivi il nome di chi prenota.');
    if (p.phone && p.phone.replace(/\D/g, '').length < 6) errs.push('Telefono: sembra incompleto (almeno 6 cifre).');
    return { errs, seat };
  }

  function updateNewCheck() {
    if (!S.panel || S.panel.type !== 'new') return;
    const p = S.panel;
    const { errs, seat } = checkNew();
    const box = $('#nb-check'), when = $('#nb-when'), save = $('#nb-save');
    if (when) when.innerHTML = `${longDate(S.date)} · ${fmt(p.start)}<small>${SERVICES[S.service].label} · ${persone(p.party)} · fino alle ${fmt(p.start + durFor(p.party))}</small>`;
    if (box) box.innerHTML = errs.length ? `<div class="check bad">${errs.map(e => `<div>${e}</div>`).join('')}</div>`
      : `<div class="check ok">Libero: ${seat.label} · ${zName(S.layout, tById(S.layout, seat.ids[0]).zone)}. Al cliente si dice "un tavolo per ${p.party}", senza nome del tavolo.</div>`;
    if (save) {
      save.textContent = `Salva · ${shortDate(S.date)} ${fmt(p.start)} · ${persone(p.party)}`;
      save.disabled = !!errs.filter(e => !e.startsWith('Nome')).length;
    }
  }

  // ---------------------------------------------------------------- modals
  function modal(html, focusSel) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-back" data-act="modal-back"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
    const f = focusSel && $(focusSel, root);
    if (f) f.focus();
  }
  function closeModal() { $('#modal-root').innerHTML = ''; }

  function transcript(name, party, start, zone, convId) {
    return `<h3>Chiamata ${esc(convId)}</h3><p class="muted">Trascrizione inventata per il prototipo. Nella pagina vera si apre la conversazione nella dashboard, con registrazione.</p>
      <div class="transcript">
        <p><b>Assistente:</b> ${RESTAURANT}, buonasera. Come posso aiutarla?</p>
        <p class="c"><b>Cliente:</b> Vorrei prenotare per ${party} ${S.date === TODAY ? 'stasera' : longDate(S.date).toLowerCase()} alle ${fmt(start)}.</p>
        <p><b>Assistente:</b> Alle ${fmt(start)} ho un tavolo per ${party}${zone ? ' in ' + esc(zone.toLowerCase()) : ''}. A che nome?</p>
        <p class="c"><b>Cliente:</b> ${esc(name)}.</p>
        <p><b>Assistente:</b> Perfetto: ${esc(name)}, ${persone(party)}, alle ${fmt(start)}. Vi aspettiamo.</p>
      </div><div class="btns"><button class="btn" data-act="modal-close" id="m-ok">Chiudi</button></div>`;
  }

  // ---------------------------------------------------------------- actions on bookings
  function setState(b, st) {
    snapshot();
    const before = b.state;
    b.state = st;
    if (st === 'left') b.leftAt = Math.min(Math.max(S.time, b.start + 15), b.start + b.dur);
    else b.leftAt = null;
    const words = { booked: 'in arrivo', arrived: 'arrivati', seated: 'seduti', left: 'andati, tavolo libero', noshow: 'no-show', cancelled: 'annullata' };
    toast(`${esc(b.name)}: ${words[st]}${before === 'cancelled' || before === 'noshow' ? ' (ripristinata)' : ''}`, true);
  }

  function moveBooking(bid, tableId) {
    const L = S.layout, list = dayList();
    const b = list.find(x => x.id === bid);
    const t = tById(L, tableId);
    if (!b || !t) return;
    const opts = seatings(L, S.date).filter(s => s.ids.includes(tableId) && b.party >= s.min && b.party <= s.max && tablesFree(s.ids, list, S.service, b.start, b.dur, b.id)).sort(rank);
    if (!opts.length) {
      const why = b.party > t.max ? `${t.name} ha ${t.max} posti e nessuna unione libera lo completa` : b.party < t.min ? `${t.name} parte da ${t.min} persone` : `${t.name} non è libero dalle ${fmt(b.start)} alle ${fmt(b.start + b.dur)}`;
      toast(`${esc(b.name)} (${b.party}) non entra: ${why}.`, false, true);
      return;
    }
    snapshot();
    b.tables = opts[0].ids;
    S.moving = null;
    toast(`${esc(b.name)} spostati a ${opts[0].label}`, true);
  }

  function saveNew(walkParty) {
    const L = S.layout, list = dayList(), p = S.panel;
    if (walkParty) {
      const start = S.date === TODAY ? SIM_TIME : p.start;
      let ids = p.tables && p.tables.length ? p.tables : null;
      if (ids) {
        const s = seatings(L, S.date).find(x => x.ids.join() === ids.join());
        if (s && (walkParty < s.min || walkParty > s.max)) ids = null;
        if (ids && !tablesFree(ids, list, S.service, start, durFor(walkParty), null)) ids = null;
      }
      if (!ids) { const c = candidates(L, S.date, S.service, start, walkParty, list, null); if (!c.length) { toast(`Nessun tavolo libero adesso per ${walkParty}.`, false, true); return; } ids = c[0].ids; }
      snapshot();
      list.push(mkBooking({ service: S.service, start, party: walkParty, name: 'Walk-in', tables: ids, state: 'seated', source: 'walkin' }));
      S.panel = null;
      toast(`Walk-in da ${walkParty} seduti a ${seatLabel(L, ids)}`, true);
      return;
    }
    p.touched = true;
    const { errs, seat } = checkNew();
    if (errs.length) { updateNewCheck(); const n = $('#nb-name'); if (n && !p.name.trim()) n.focus(); return; }
    snapshot();
    list.push(mkBooking({ service: S.service, start: p.start, party: p.party, name: p.name.trim(), phone: p.phone.trim(), notes: p.notes.trim(), tables: seat.ids, state: 'booked', source: 'staff' }));
    if (p.requestId) S.requests = S.requests.filter(r => r.id !== p.requestId);
    S.panel = null;
    toast(`Salvata: ${esc(p.name.trim())}, ${persone(p.party)}, ${shortDate(S.date)} ${fmt(p.start)}, ${seat.label}`, true);
  }

  function openNew(tables, start, party, extra) {
    S.panel = Object.assign({ type: 'new', tables: tables || null, start: start != null ? start : S.time, party: party || 2, name: '', phone: '', notes: '', touched: false }, extra || {});
    if (S.panel.start > SERVICES[S.service].last + 30) S.panel.start = SERVICES[S.service].last;
  }

  function exportCsv() {
    const L = S.layout;
    const rows = [['data', 'servizio', 'ora', 'persone', 'nome', 'telefono', 'tavoli', 'zona', 'stato', 'fonte', 'note', 'allergie']];
    const n = S.strip === '14' ? 14 : 31;
    const start = S.strip === '14' ? S.stripStart : S.monthKey + '-01';
    const stName = { booked: 'in arrivo', arrived: 'arrivati', seated: 'seduti', left: 'andati', noshow: 'no-show', cancelled: 'annullata' };
    for (let i = 0; i < n; i++) {
      const key = addDays(start, i);
      if (S.strip !== '14' && key.slice(0, 7) !== S.monthKey) break;
      ensureDay(key).slice().sort((a, b) => a.service.localeCompare(b.service) || a.start - b.start).forEach(b => {
        const t = tById(L, b.tables[0]);
        rows.push([key, b.service, fmt(b.start), b.party, b.name, b.phone, seatLabel(L, b.tables), t ? zName(L, t.zone) : '', stName[b.state], b.source, b.notes, b.allergies]);
      });
    }
    const csv = '﻿' + rows.map(r => r.map(v => { const s = String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `prenotazioni-${start}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    toast(`CSV scaricato: ${rows.length - 1} prenotazioni`);
  }

  // ---------------------------------------------------------------- configuration editor
  function validate(L) {
    const errors = [], warnings = [];
    const zn = {};
    L.zones.forEach((z, i) => {
      const n = z.name.trim();
      if (!n) errors.push({ ref: `z-${z.id}-name`, msg: `Zona ${i + 1} · Nome: obbligatorio` });
      else if (zn[n.toLowerCase()]) errors.push({ ref: `z-${z.id}-name`, msg: `Zona "${n}" · Nome: esiste già un'altra zona con questo nome` });
      zn[n.toLowerCase()] = true;
      z.closures.forEach(c => { if (c.to < c.from) errors.push({ ref: `z-${z.id}-name`, msg: `Zona "${n}" · Chiusura: la fine (${c.to}) viene prima dell'inizio` }); });
      if (!L.tables.some(t => t.zone === z.id)) warnings.push({ ref: `z-${z.id}-name`, msg: `Zona "${n || i + 1}" · Tavoli: nessuno, l'assistente non la propone` });
    });
    const tn = {};
    L.tables.forEach(t => {
      const z = zName(L, t.zone), n = t.name.trim();
      if (!n) errors.push({ ref: `t-${t.id}-name`, msg: `Tavolo in ${z} · Nome: obbligatorio` });
      else if (tn[n.toLowerCase()]) errors.push({ ref: `t-${t.id}-name`, msg: `${n} · Nome: usato anche in ${tn[n.toLowerCase()]}; ogni tavolo ha un nome diverso` });
      if (n) tn[n.toLowerCase()] = z;
      if (!(t.min >= 1)) errors.push({ ref: `t-${t.id}-min`, msg: `${n || 'Tavolo'} · Min posti: almeno 1` });
      if (!(t.max >= t.min)) errors.push({ ref: `t-${t.id}-max`, msg: `${n || 'Tavolo'} · Max posti: deve essere almeno ${t.min} (il minimo)` });
      else if (t.max > 20) warnings.push({ ref: `t-${t.id}-max`, msg: `${n} · Max posti: ${t.max} è insolito per un tavolo solo` });
    });
    const seen = {};
    L.joins.forEach(j => {
      const ts = j.ids.map(i => tById(L, i)).filter(Boolean);
      const label = ts.map(t => t.name).join('+');
      if (ts.length < 2) { errors.push({ ref: `j-${j.id}-min`, msg: `Unione ${label || '?'} · Tavoli: servono almeno due tavoli` }); return; }
      const zones = [...new Set(ts.map(t => t.zone))];
      if (zones.length > 1) {
        const a = ts.find(t => t.zone === zones[0]), b = ts.find(t => t.zone === zones[1]);
        errors.push({ ref: `j-${j.id}-min`, msg: `Unione ${label} · Tavoli: ${a.name} (${zName(L, a.zone)}) e ${b.name} (${zName(L, b.zone)}) sono in zone diverse; un'unione sta in una zona sola` });
      }
      if (!(j.min >= 1)) errors.push({ ref: `j-${j.id}-min`, msg: `Unione ${label} · Min persone: almeno 1` });
      if (!(j.max >= j.min)) errors.push({ ref: `j-${j.id}-max`, msg: `Unione ${label} · Max persone: deve essere almeno ${j.min}` });
      const seats = ts.reduce((a, t) => a + t.max, 0);
      if (j.max > seats + 2) warnings.push({ ref: `j-${j.id}-max`, msg: `Unione ${label} · Max persone: ${j.max} supera di molto i posti dei tavoli (${seats})` });
      const off = ts.filter(t => !t.active);
      if (off.length) warnings.push({ ref: `j-${j.id}-min`, msg: `Unione ${label}: non viene usata finché ${off.map(t => t.name).join(', ')} è disattivo` });
      const k = j.ids.slice().sort().join();
      if (seen[k]) errors.push({ ref: `j-${j.id}-min`, msg: `Unione ${label}: c'è già un'unione con gli stessi tavoli` });
      seen[k] = true;
    });
    const mf = (L.settings || {}).minFree;
    if (!(mf >= 15 && mf <= 240)) errors.push({ ref: 'set-minfree', msg: 'Impostazioni · Tempo minimo libero: tra 15 e 240 minuti' });
    if (L === S.draft) errors.push(...guardErrors(L));
    if (L.tables.length) {
      const ss = seatings(L, '2000-01-01');
      const max = ss.reduce((a, s) => Math.max(a, s.max), 0);
      for (let p = 1; p <= max; p++) if (!ss.some(s => p >= s.min && p <= s.max))
        warnings.push({ ref: '', msg: `Persone ${p}: nessun tavolo né unione accetta ${persone(p)}; l'assistente prende un messaggio` });
    }
    return { errors, warnings };
  }

  // bookings not over yet, from the simulated now on, that match pred
  function futureOn(pred) {
    const out = [];
    Object.keys(S.bookings).filter(k => k >= TODAY).sort().forEach(k => S.bookings[k].forEach(b => {
      if (b.state === 'cancelled' || b.state === 'noshow' || b.state === 'left') return;
      if (k === TODAY && b.start + b.dur <= SIM_TIME) return;
      if (pred(b)) out.push({ k, b });
    }));
    return out;
  }
  const futureOnTable = id => futureOn(b => b.tables.includes(id));
  const futureOnJoin = ids => futureOn(b => b.tables.length === ids.length && ids.every(i => b.tables.includes(i)));
  const nameList = fs => fs.slice(0, 3).map(({ k, b }) => `${b.name} (${shortDate(k)} ${fmt(b.start)}, ${b.party} pers.)`).join(', ') + (fs.length > 3 ? ` e altre ${fs.length - 3}` : '');
  const bookingsWord = n => n === 1 ? '1 prenotazione futura' : `${n} prenotazioni future`;

  // What the saved layout's bookings forbid in the draft: removing, moving or switching off a table
  // that still has bookings, or changing a range so that one of them no longer fits.
  function guardErrors(D) {
    const errors = [];
    S.layout.tables.forEach(t => {
      const fs = futureOnTable(t.id);
      if (!fs.length) return;
      const d = tById(D, t.id);
      const head = `${t.name}: ha ${bookingsWord(fs.length)} (${nameList(fs)})`;
      if (!d) errors.push({ ref: '', msg: `${head}; non si può eliminare. Sposta o annulla prima le prenotazioni.` });
      else if (d.zone !== t.zone) errors.push({ ref: `t-${t.id}-zone`, msg: `${head}; Zona: non si può spostare in ${zName(D, d.zone)}.` });
      else if (!d.active) errors.push({ ref: `t-${t.id}-active`, msg: `${head}; Attivo: non si può disattivare.` });
      else {
        const out = fs.filter(({ b }) => b.tables.length === 1 && (b.party < d.min || b.party > d.max));
        if (out.length) errors.push({ ref: `t-${t.id}-${out.some(({ b }) => b.party > d.max) ? 'max' : 'min'}`, msg: `${d.name} · Posti ${d.min}-${d.max}: non ci starebbero più ${nameList(out)}` });
      }
    });
    S.layout.joins.forEach(j => {
      const fs = futureOnJoin(j.ids);
      if (!fs.length) return;
      const d = D.joins.find(x => x.id === j.id), label = seatLabel(S.layout, j.ids);
      if (!d) errors.push({ ref: '', msg: `Unione ${label}: ha ${bookingsWord(fs.length)} (${nameList(fs)}); non si può togliere.` });
      else if (d.ids.slice().sort().join() !== j.ids.slice().sort().join()) errors.push({ ref: `j-${j.id}-min`, msg: `Unione ${label} · Tavoli: ha ${bookingsWord(fs.length)} (${nameList(fs)}); i tavoli non si possono cambiare.` });
      else {
        const out = fs.filter(({ b }) => b.party < d.min || b.party > d.max);
        if (out.length) errors.push({ ref: `j-${j.id}-max`, msg: `Unione ${label} · Persone ${d.min}-${d.max}: non ci starebbero più ${nameList(out)}` });
      }
    });
    return errors;
  }

  function diffLayout(A, B) {
    const out = [];
    const za = new Map(A.zones.map(z => [z.id, z])), zb = new Map(B.zones.map(z => [z.id, z]));
    B.zones.forEach(z => { if (!za.has(z.id)) out.push(`Zona aggiunta: ${z.name}`); });
    A.zones.forEach(z => {
      const n = zb.get(z.id);
      if (!n) { out.push(`Zona eliminata: ${z.name}`); return; }
      if (n.name !== z.name) out.push(`Zona rinominata: ${z.name} → ${n.name}`);
      if (n.note !== z.note) out.push(`Nota per l'assistente cambiata: ${n.name}`);
      if (JSON.stringify(n.closures) !== JSON.stringify(z.closures)) out.push(`Chiusure cambiate: ${n.name}`);
    });
    const common = A.zones.filter(z => zb.has(z.id)).map(z => z.id), commonB = B.zones.filter(z => za.has(z.id)).map(z => z.id);
    if (common.join() !== commonB.join()) out.push('Ordine delle zone cambiato');
    const ta = new Map(A.tables.map(t => [t.id, t])), tb = new Map(B.tables.map(t => [t.id, t]));
    const added = B.tables.filter(t => !ta.has(t.id)).map(t => t.name);
    if (added.length) out.push(`Tavoli aggiunti: ${added.join(', ')}`);
    A.tables.forEach(t => {
      const n = tb.get(t.id);
      if (!n) { out.push(`Tavolo eliminato: ${t.name}`); return; }
      const ch = [];
      if (n.name !== t.name) ch.push(`nome ${t.name} → ${n.name}`);
      if (n.min !== t.min || n.max !== t.max) ch.push(`posti ${t.min}-${t.max} → ${n.min}-${n.max}`);
      if (n.zone !== t.zone) ch.push(`zona ${zName(A, t.zone)} → ${zName(B, n.zone)}`);
      if (n.active !== t.active) ch.push(n.active ? 'riattivato' : 'disattivato');
      if (ch.length) out.push(`${n.name}: ${ch.join(', ')}`);
    });
    const ja = new Map(A.joins.map(j => [j.id, j])), jb = new Map(B.joins.map(j => [j.id, j]));
    B.joins.forEach(j => { if (!ja.has(j.id)) out.push(`Unione aggiunta: ${seatLabel(B, j.ids)} (${j.min}-${j.max})`); });
    A.joins.forEach(j => {
      const n = jb.get(j.id);
      if (!n) { out.push(`Unione tolta: ${seatLabel(A, j.ids)}`); return; }
      if (n.ids.join() !== j.ids.join()) out.push(`Unione ${seatLabel(A, j.ids)} → ${seatLabel(B, n.ids)}`);
      if (n.min !== j.min || n.max !== j.max) out.push(`Unione ${seatLabel(B, n.ids)}: persone ${j.min}-${j.max} → ${n.min}-${n.max}`);
    });
    if ((A.settings || {}).minFree !== (B.settings || {}).minFree) out.push(`Tempo minimo libero: ${(A.settings || {}).minFree} → ${(B.settings || {}).minFree} min`);
    return out;
  }

  function genNames(L, zoneId, n) {
    const zt = L.tables.filter(t => t.zone === zoneId);
    const counts = {};
    zt.forEach(t => { const m = /^([A-Za-z]+)(\d+)$/.exec(t.name.trim()); if (m) counts[m[1]] = Math.max(counts[m[1]] || 0, +m[2]); });
    let prefix = Object.keys(counts)[0];
    if (!prefix) {
      const zname = zName(L, zoneId).replace(/[^A-Za-z]/g, '') || 'T';
      const usedElsewhere = p => L.tables.some(t => t.zone !== zoneId && new RegExp('^' + p + '\\d+$', 'i').test(t.name));
      prefix = /^sala$/i.test(zname) ? 'T' : zname[0].toUpperCase();
      if (usedElsewhere(prefix)) prefix = zname.slice(0, 2);
      if (usedElsewhere(prefix)) prefix = zname;
    }
    const taken = new Set(L.tables.map(t => t.name.toLowerCase()));
    const out = []; let k = (counts[prefix] || 0) + 1;
    while (out.length < n) { const name = prefix + k; if (!taken.has(name.toLowerCase())) out.push(name); k++; }
    return out;
  }
  const minFor = size => size <= 2 ? 1 : Math.ceil(size / 2);
  const nextTableId = L => L.tables.reduce((a, t) => Math.max(a, t.id), 0) + 1;

  function renderConfig() {
    const D = S.draft;
    if (!S.gen.zone || !D.zones.some(z => z.id === S.gen.zone)) S.gen.zone = D.zones.length ? D.zones[0].id : null;
    const zoneCards = D.zones.map((z, i) => {
      const ts = D.tables.filter(t => t.zone === z.id);
      const cf = S.closeForm[z.id] || { from: '', to: '' };
      return `<div class="zcard">
        <div class="zcard-head">
          <input class="zname" value="${esc(z.name)}" data-bind="z-name" data-zid="${z.id}" data-ref="z-${z.id}-name" aria-label="Nome della zona">
          <span class="pill">${ts.length} tavoli · ${ts.filter(t => t.active).reduce((a, t) => a + t.max, 0)} posti</span>
          <span class="order">
            <button data-act="z-move" data-zid="${z.id}" data-n="-1" aria-label="Sposta su" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button data-act="z-move" data-zid="${z.id}" data-n="1" aria-label="Sposta giù" ${i === D.zones.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="x-btn" data-act="z-del" data-zid="${z.id}" aria-label="Elimina zona ${esc(z.name)}">✕</button>
          </span>
        </div>
        <div class="row-msg" data-msg-for="z-${z.id}-name"></div>
        <div class="zgrid">
          <label class="field"><span>Nota per l'assistente</span><textarea data-bind="z-note" data-zid="${z.id}" placeholder="Es. all'aperto, riscaldato">${esc(z.note)}</textarea><small>L'assistente la usa per descrivere la zona a chi chiama.</small></label>
          <div class="field"><span>Chiusure</span>
            ${z.closures.length ? z.closures.map((c, ci) => `<div class="closure">${shortDate(c.from)} - ${shortDate(c.to)} <button class="x-btn" data-act="z-close-del" data-zid="${z.id}" data-i="${ci}" aria-label="Togli chiusura">✕</button></div>`).join('') : '<small>Sempre aperta.</small>'}
            <div class="closure-add"><input type="date" value="${cf.from}" data-bind="cf-from" data-zid="${z.id}" aria-label="Chiusa dal"><input type="date" value="${cf.to}" data-bind="cf-to" data-zid="${z.id}" aria-label="Chiusa fino al"><button class="btn ghost small" data-act="z-close-add" data-zid="${z.id}">Aggiungi chiusura</button></div>
          </div>
        </div>
        <table class="tt"><thead><tr><th>Nome</th><th>Min posti</th><th>Max posti</th><th>Zona</th><th>Attivo</th><th></th></tr></thead><tbody>
          ${ts.map(t => `<tr class="${t.active ? '' : 'inactive'}">
            <td><input type="text" value="${esc(t.name)}" data-bind="t-name" data-tid="${t.id}" data-ref="t-${t.id}-name" aria-label="Nome tavolo"></td>
            <td><input type="number" min="1" value="${t.min}" data-bind="t-min" data-tid="${t.id}" data-ref="t-${t.id}-min" aria-label="Min posti ${esc(t.name)}"></td>
            <td><input type="number" min="1" value="${t.max}" data-bind="t-max" data-tid="${t.id}" data-ref="t-${t.id}-max" aria-label="Max posti ${esc(t.name)}"></td>
            <td><select data-bind="t-zone" data-tid="${t.id}" data-ref="t-${t.id}-zone" aria-label="Zona di ${esc(t.name)}">${D.zones.map(o => `<option value="${o.id}" ${o.id === t.zone ? 'selected' : ''}>${esc(o.name || '(senza nome)')}</option>`).join('')}</select></td>
            <td><input type="checkbox" ${t.active ? 'checked' : ''} data-bind="t-active" data-tid="${t.id}" data-ref="t-${t.id}-active" aria-label="${esc(t.name)} attivo" style="min-height:24px;width:24px"></td>
            <td><button class="x-btn" data-act="t-del" data-tid="${t.id}" aria-label="Elimina ${esc(t.name)}">✕</button></td></tr>
            <tr><td colspan="6" class="row-msg" data-msg-for="t-${t.id}"></td></tr>`).join('')}
        </tbody></table>
        <button class="btn ghost small" data-act="t-add" data-zid="${z.id}">${ICON.plus} Un tavolo</button>
      </div>`;
    }).join('');

    const joins = D.joins.map(j => `<div class="jrow"><b>${esc(seatLabel(D, j.ids))}</b><span class="muted">${esc(zName(D, (tById(D, j.ids[0]) || {}).zone))}</span>
        da <input type="number" min="1" value="${j.min}" data-bind="j-min" data-jid="${j.id}" data-ref="j-${j.id}-min" aria-label="Min persone"> a <input type="number" min="1" value="${j.max}" data-bind="j-max" data-jid="${j.id}" data-ref="j-${j.id}-max" aria-label="Max persone"> persone
        <button class="btn ghost small" data-act="j-edit" data-jid="${j.id}" aria-expanded="${S.joinEdit === j.id}">${S.joinEdit === j.id ? 'Fatto' : 'Cambia tavoli'}</button>
        <button class="x-btn" data-act="j-del" data-jid="${j.id}" aria-label="Togli unione">✕</button>
        ${S.joinEdit === j.id ? `<div class="pick" style="width:100%">${D.zones.map(z => { const ts = D.tables.filter(t => t.zone === z.id); return ts.length ? `<span class="zl">${esc(z.name)}</span>` + ts.map(t => `<label class="${j.ids.includes(t.id) ? 'on' : ''}"><input type="checkbox" data-bind="je-pick" data-jid="${j.id}" data-tid="${t.id}" ${j.ids.includes(t.id) ? 'checked' : ''}> ${esc(t.name)}</label>`).join('') : ''; }).join('')}</div>` : ''}
        <span class="row-msg" data-msg-for="j-${j.id}" style="width:100%"></span></div>`).join('');

    const pick = D.zones.map(z => {
      const ts = D.tables.filter(t => t.zone === z.id);
      if (!ts.length) return '';
      return `<span class="zl">${esc(z.name)}</span>` + ts.map(t => `<label class="${S.joinPick.includes(t.id) ? 'on' : ''}"><input type="checkbox" data-bind="j-pick" data-tid="${t.id}" ${S.joinPick.includes(t.id) ? 'checked' : ''}> ${esc(t.name)}</label>`).join('');
    }).join('');

    return `<div class="cfg">
      <div>
        <div class="callout blue cfg-intro"><b>Qui si modifica tutta la sala.</b> Ogni zona, tavolo e unione si cambia direttamente nel suo campo o si elimina con ✕. Le modifiche valgono per l'assistente solo quando premi <b>Salva modifiche</b>; fino ad allora puoi annullarle tutte.</div>
        <div id="cfg-changes"></div>
        <div class="issues" id="cfg-issues"></div>
        <section class="cfg-block card">
          <h2>Impostazioni</h2>
          <label class="field" style="max-width:520px"><span>Tempo minimo libero</span>
            <span class="tb-row"><input class="input" type="number" min="15" max="240" step="5" value="${(D.settings || {}).minFree}" data-bind="set-minfree" data-ref="set-minfree" style="width:90px" aria-label="Tempo minimo libero in minuti"> minuti</span>
            <small>Un tavolo libero per meno di così non è mostrato come libero e non entra nei conteggi dei tavoli liberi. Di solito è il tempo del tavolo per 1-2 persone (${durFor(1)} min); un locale veloce può metterlo più basso.</small></label>
          <div class="row-msg" data-msg-for="set-minfree"></div>
        </section>
        <section class="cfg-block">
          <h2>Aggiungi tavoli in un colpo</h2>
          <div class="gen">Aggiungi <input type="number" min="1" max="40" value="${S.gen.n}" data-bind="gen-n" aria-label="Quanti tavoli"> tavoli da <input type="number" min="1" max="20" value="${S.gen.size}" data-bind="gen-size" aria-label="Posti per tavolo"> in
            <select data-bind="gen-zone" aria-label="Zona">${D.zones.map(z => `<option value="${z.id}" ${z.id === S.gen.zone ? 'selected' : ''}>${esc(z.name || '(senza nome)')}</option>`).join('')}</select>
            <button class="btn small" data-act="gen-add" ${D.zones.length ? '' : 'disabled'}>Aggiungi</button>
            <span class="names" id="gen-names"></span></div>
        </section>
        <section class="cfg-block">
          <h2>Zone e tavoli</h2>
          ${zoneCards}
          <button class="btn ghost" data-act="z-add">${ICON.plus} Aggiungi zona</button>
        </section>
        <section class="cfg-block card">
          <h2>Unioni di tavoli</h2>
          <p class="muted" style="margin-top:-6px">Tavoli che avvicinate per i gruppi. L'assistente le usa solo quando un tavolo da solo non basta.</p>
          <div class="join-list">${joins || '<p class="muted">Nessuna unione.</p>'}</div>
          <h4 style="margin-top:12px">Nuova unione: spunta i tavoli</h4>
          <div class="pick">${pick}</div>
          <div id="join-builder"></div>
        </section>
      </div>
      <aside class="preview card" id="cfg-preview"></aside>
      <div class="savebar" id="savebar"></div>
    </div>`;
  }

  function liveConfig() {
    const D = S.draft;
    const { errors, warnings } = validate(D);
    const issues = $('#cfg-issues');
    if (issues) issues.innerHTML = (errors.length ? `<div class="callout red" role="alert"><b>${errors.length === 1 ? 'Un errore da correggere' : errors.length + ' errori da correggere'} prima di salvare</b><ul>${errors.map(e => `<li><button class="linkish" data-act="focus-ref" data-ref="${e.ref}">${esc(e.msg)}</button></li>`).join('')}</ul></div>` : '')
      + (warnings.length ? `<div class="callout amber"><b>Da sapere</b> (non blocca il salvataggio)<ul>${warnings.map(w => `<li>${esc(w.msg)}</li>`).join('')}</ul></div>` : '');
    $$('[data-ref]').forEach(el => el.classList.toggle('invalid', errors.some(e => e.ref === el.dataset.ref)));
    $$('[data-msg-for]').forEach(el => {
      const k = el.dataset.msgFor;
      const mine = errors.filter(e => e.ref === k || e.ref.startsWith(k + '-'));
      el.innerHTML = mine.map(e => `<span class="err">${esc(e.msg)}</span>`).join('<br>');
    });
    const gn = $('#gen-names');
    if (gn && S.gen.zone) {
      const names = genNames(D, S.gen.zone, Math.max(0, Math.min(40, S.gen.n | 0)));
      gn.textContent = names.length ? `Diventano ${names.length > 6 ? names.slice(0, 3).join(', ') + ' … ' + names[names.length - 1] : names.join(', ')}, ciascuno da ${minFor(S.gen.size)} a ${S.gen.size} persone. Poi li rinomini come vuoi.` : '';
    }
    const jb = $('#join-builder');
    if (jb) {
      const ts = S.joinPick.map(i => tById(D, i)).filter(Boolean);
      let msg = '', ok = false;
      if (ts.length < 2) msg = '<span class="muted">Spunta almeno due tavoli.</span>';
      else {
        const zs = [...new Set(ts.map(t => t.zone))];
        if (zs.length > 1) {
          const a = ts.find(t => t.zone === zs[0]), b = ts.find(t => t.zone === zs[1]);
          msg = `<span class="err">Tavoli: ${esc(a.name)} (${esc(zName(D, a.zone))}) e ${esc(b.name)} (${esc(zName(D, b.zone))}) sono in zone diverse; un'unione sta in una zona sola.</span>`;
        } else {
          const lo = Math.max(...ts.map(t => t.max)) + 1, hi = ts.reduce((a, t) => a + t.max, 0);
          msg = `<span class="ok">${esc(ts.map(t => t.name).join('+'))}: da ${lo} a ${hi} persone (modificabile dopo).</span>`; ok = true;
        }
      }
      jb.innerHTML = `${msg} <button class="btn small" data-act="j-create" ${ok ? '' : 'disabled'}>Crea unione</button>`;
    }
    const pv = $('#cfg-preview');
    if (pv) pv.innerHTML = renderPreview(D, errors);
    const changes = diffLayout(S.layout, D);
    const ch = $('#cfg-changes');
    if (ch) ch.innerHTML = changes.length ? `<div class="callout amber"><b>${changes.length === 1 ? '1 modifica da salvare' : changes.length + ' modifiche da salvare'}</b><ul>${changes.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>` : '';
    const sb = $('#savebar');
    if (sb) {
      const n = changes.length;
      sb.innerHTML = `<span class="${n ? 'warn' : 'muted'}">${n ? `${n === 1 ? '1 modifica non salvata' : n + ' modifiche non salvate'}: l'assistente usa ancora la sala salvata.` : 'Nessuna modifica: la sala è quella salvata.'}</span><span class="spacer"></span>
        <button class="btn ghost" data-act="cfg-discard-ask" ${n ? '' : 'disabled'}>Annulla modifiche</button>
        <button class="btn" data-act="cfg-save" ${n && !errors.length ? '' : 'disabled'}>${errors.length ? `Salva modifiche (${errors.length} ${errors.length === 1 ? 'errore' : 'errori'})` : 'Salva modifiche'}</button>`;
    }
  }

  function renderPreview(D, errors) {
    const svc = S.preview.svc;
    // an empty evening is read on tomorrow (never the rest day), so every arrival time counts
    const key = S.preview.mode === 'today' ? TODAY : addDays(TODAY, 1);
    const list = S.preview.mode === 'today' ? live(ensureDay(TODAY), svc).filter(b => b.tables.every(id => tById(D, id))) : [];
    const ss = seatings(D, key);
    const maxP = ss.reduce((a, s) => Math.max(a, s.max), 0);
    const tables = D.tables.filter(t => t.active);
    let rows = '';
    for (let p = 1; p <= Math.min(maxP + 1, 14); p++) {
      const times = arrivalTimes(key, svc).filter(t => candidates(D, key, svc, t, p, list, null).length);
      const first = times.length ? candidates(D, key, svc, times[0], p, list, null)[0] : null;
      rows += `<tr><td><b>${p}</b></td><td>${times.length ? compactTimes(times) : '<span class="err">non prenotabile</span>'}</td><td>${first ? `${esc(first.label)} <small>${esc(zName(D, first.zone))}</small>` : '<small>prende un messaggio</small>'}</td></tr>`;
    }
    const openZones = D.zones.filter(z => zoneOpen(z, key) && D.tables.some(t => t.zone === z.id && t.active));
    const ex = ss.find(s => s.max >= 4 && s.min <= 4);
    return `<h2>Anteprima serata</h2>
      <p class="muted" style="margin-top:-6px">Cosa venderebbe l'assistente con questa sala${errors.length ? ' (con gli errori corretti)' : ''}, prima di salvare.</p>
      <div class="seg" role="group" aria-label="Serata d'esempio" style="margin-bottom:8px">
        <button data-act="pv-mode" data-v="empty" aria-pressed="${S.preview.mode === 'empty'}">Sala vuota</button>
        <button data-act="pv-mode" data-v="today" aria-pressed="${S.preview.mode === 'today'}">Con le prenotazioni di oggi</button>
      </div>
      <div class="seg" role="group" aria-label="Servizio" style="margin-bottom:8px">
        <button data-act="pv-svc" data-v="pranzo" aria-pressed="${svc === 'pranzo'}">Pranzo</button>
        <button data-act="pv-svc" data-v="cena" aria-pressed="${svc === 'cena'}">Cena</button>
      </div>
      <p><b>${tables.length}</b> tavoli attivi · <b>${tables.reduce((a, t) => a + t.max, 0)}</b> posti · gruppo più grande <b>${maxP}</b></p>
      <table><thead><tr><th>Persone</th><th>Orari che offre</th><th>Di solito</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="say">Al telefono: <b>"${ex ? `Alle ${fmt(SERVICES[svc].open + 60)} ho un tavolo per 4 in ${esc(zName(D, ex.zone).toLowerCase())}.` : 'Mi spiace, non ho posto.'}"</b><br><small>L'assistente nomina la zona, mai il tavolo. Zone che può proporre: ${openZones.map(z => esc(z.name) + (z.note ? ` (${esc(z.note)})` : '')).join(', ') || 'nessuna'}.</small></div>`;
  }

  // ---------------------------------------------------------------- first-run wizard
  function wizardLayout(W) {
    const L = { zones: [], tables: [], joins: [], settings: { minFree: durFor(1) } };
    W.zones.forEach((name, i) => {
      const zid = 'z' + (i + 1);
      L.zones.push({ id: zid, name, note: '', closures: [] });
      (W.rows[name] || []).forEach(r => {
        const names = genNames(L, zid, Math.max(0, Math.min(40, r.n | 0)));
        names.forEach(n => L.tables.push({ id: nextTableId(L), zone: zid, name: n, min: minFor(r.size), max: r.size, active: true }));
      });
    });
    let j = 1;
    W.zones.forEach(name => {
      if (!W.pairs[name]) return;
      const z = L.zones.find(x => x.name === name);
      const bySize = {};
      L.tables.filter(t => t.zone === z.id).forEach(t => { (bySize[t.max] = bySize[t.max] || []).push(t); });
      Object.values(bySize).forEach(ts => { for (let i = 0; i + 1 < ts.length; i += 2) L.joins.push({ id: 'j' + (j++), ids: [ts[i].id, ts[i + 1].id], min: ts[i].max + 1, max: ts[i].max * 2 }); });
    });
    return L;
  }

  function renderWizard() {
    const W = S.wizard;
    const steps = ['Zone', 'Tavoli', 'Unioni (facoltative)'];
    const bar = `<div class="steps">${steps.map((s, i) => `<div class="step ${i + 1 === W.step ? 'on' : i + 1 < W.step ? 'done' : ''}">${i + 1}. ${s}</div>`).join('')}</div>`;
    let body = '';
    if (W.step === 1) {
      const sugg = ['Sala', 'Dehors', 'Saletta', 'Veranda', 'Terrazza'];
      const all = [...new Set([...sugg, ...W.zones])];
      body = `<h3>Quali zone ha il locale?</h3><p class="muted">L'assistente le propone a chi chiama ("preferisce in sala o nel dehors?"). Potete cambiarle quando volete.</p>
        <div class="zchips">${all.map(z => `<button data-act="wz-zone" data-z="${esc(z)}" aria-pressed="${W.zones.includes(z)}">${esc(z)}</button>`).join('')}</div>
        <div class="wz-row"><input class="input" style="width:220px;text-align:left" placeholder="Altra zona, es. Giardino" value="${esc(W.custom)}" data-bind="wz-custom" aria-label="Altra zona"><button class="btn ghost small" data-act="wz-custom-add">Aggiungi</button></div>
        ${W.zones.length ? '' : '<p class="err">Zone: scegline almeno una.</p>'}`;
    } else if (W.step === 2) {
      const L = wizardLayout(W);
      body = `<h3>Quanti tavoli, di che misura?</h3><p class="muted">Una riga per misura. I nomi li generiamo noi (T1, T2…), li cambiate dopo.</p>` +
        W.zones.map(z => {
          const zid = L.zones.find(x => x.name === z).id;
          const names = L.tables.filter(t => t.zone === zid).map(t => t.name);
          return `<div class="wz-zone"><h3>${esc(z)}</h3>${(W.rows[z] || []).map((r, i) => `<div class="wz-row"><input type="number" min="1" max="40" value="${r.n}" data-bind="wz-n" data-z="${esc(z)}" data-i="${i}" aria-label="Quanti tavoli"> tavoli da <input type="number" min="1" max="20" value="${r.size}" data-bind="wz-size" data-z="${esc(z)}" data-i="${i}" aria-label="Posti"> posti <button class="x-btn" data-act="wz-row-del" data-z="${esc(z)}" data-i="${i}" aria-label="Togli riga">✕</button></div>`).join('')}
            <button class="btn ghost small" data-act="wz-row-add" data-z="${esc(z)}">${ICON.plus} Un'altra misura</button>
            <p class="muted" style="font-size:13px">${names.length ? `${names.length} tavoli: ${names.join(', ')}` : '<span class="err">Tavoli: nessuno in questa zona</span>'}</p></div>`;
        }).join('') +
        `<p><b>Totale: ${L.tables.length} tavoli, ${L.tables.reduce((a, t) => a + t.max, 0)} posti.</b></p>`;
    } else {
      const L = wizardLayout(Object.assign({}, W, { pairs: {} }));
      body = `<h3>Unite spesso dei tavoli?</h3><p class="muted">Servono per i gruppi: l'assistente unisce solo quando un tavolo da solo non basta. Si può saltare e farlo dopo da "Sala e tavoli".</p>` +
        W.zones.map(z => {
          const zid = L.zones.find(x => x.name === z).id;
          const ts = L.tables.filter(t => t.zone === zid);
          if (ts.length < 2) return '';
          const prev = wizardLayout(Object.assign({}, W, { pairs: { [z]: true } })).joins.filter(j => j.ids.every(id => ts.some(t => t.id === id)));
          if (!prev.length) return '';
          return `<label class="wz-zone" style="display:block;cursor:pointer"><input type="checkbox" data-bind="wz-pair" data-z="${esc(z)}" ${W.pairs[z] ? 'checked' : ''}> <b>${esc(z)}</b>: unisci a coppie i tavoli della stessa misura<br><small>${prev.map(j => seatLabel(L, j.ids)).join(', ')}</small></label>`;
        }).join('');
    }
    const canNext = W.step === 1 ? W.zones.length > 0 : W.step === 2 ? wizardLayout(W).tables.length > 0 && W.zones.every(z => (W.rows[z] || []).some(r => r.n > 0)) : true;
    return `<div class="wizard"><div class="card">
      <h2>Prepariamo la sala</h2><p class="muted">Tre passi, un paio di minuti. Finché non c'è almeno un tavolo l'assistente non prenota: prende il nome e vi lascia un messaggio.</p>
      ${bar}${body}
      <div class="wz-nav">
        ${W.step > 1 ? '<button class="btn ghost left" data-act="wz-back">Indietro</button>' : ''}
        ${W.step === 3 ? '<button class="btn ghost" data-act="wz-done" data-skip="1">Salta</button><button class="btn" data-act="wz-done">Fatto: apri la serata</button>' : `<button class="btn" data-act="wz-next" ${canNext ? '' : 'disabled'}>Avanti</button>`}
      </div></div></div>`;
  }

  // ---------------------------------------------------------------- search across days
  function renderSearch() {
    const box = $('#search-results');
    const q = S.search.trim().toLowerCase();
    if (q.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
    const res = [];
    Object.keys(S.bookings).filter(k => k >= addDays(TODAY, -7)).sort().forEach(k => S.bookings[k].forEach(b => {
      if (b.source === 'walkin') return;
      if (b.name.toLowerCase().includes(q) || (b.phone || '').replace(/\s/g, '').includes(q.replace(/\s/g, ''))) res.push({ k, b });
    }));
    const near = res.filter(r => r.k >= TODAY).concat(res.filter(r => r.k < TODAY).reverse()).slice(0, 10);
    box.hidden = false;
    box.innerHTML = near.length ? near.map(({ k, b }) => `<button class="sr-item" data-act="sr-open" data-date="${k}" data-svc="${b.service}" data-bid="${b.id}"><b>${esc(b.name)}</b> · ${b.party} pers. · ${esc(b.phone)}<br><small>${shortDate(k)} · ${SERVICES[b.service].label} ${fmt(b.start)} · ${seatLabel(S.layout, b.tables)}${b.state === 'cancelled' ? ' · annullata' : ''}</small></button>`).join('')
      : '<div class="sr-empty">Nessuna prenotazione trovata.</div>';
  }

  // ---------------------------------------------------------------- navigation helpers
  function setDate(key) {
    S.date = key; ensureDay(key); S.moving = null; S.panel = null; S.know = null;
    S.time = key === TODAY && S.service === 'cena' ? SIM_TIME : SERVICES[S.service].open + 60;
    if (S.strip === '14' && (key < S.stripStart || key > addDays(S.stripStart, 13))) S.stripStart = key < TODAY ? key : (key <= addDays(TODAY, 13) ? TODAY : key);
    S.monthKey = key.slice(0, 7);
  }

  // ---------------------------------------------------------------- event wiring
  const ACT = {
    tab: el => { S.tab = el.dataset.tab; S.panel = null; S.moving = null; if (S.tab === 'config') S.draft = S.draft || clone(S.layout); },
    'go-day': el => setDate(el.dataset.date),
    'day-shift': el => setDate(addDays(S.date, +el.dataset.n)),
    'strip-mode': el => { S.strip = el.dataset.v; S.monthKey = S.date.slice(0, 7); },
    'strip-shift': el => { S.stripStart = addDays(S.stripStart, +el.dataset.n); },
    'month-shift': el => { const [y, m] = S.monthKey.split('-').map(Number); const d = new Date(y, m - 1 + (+el.dataset.n), 1); S.monthKey = keyOf(d).slice(0, 7); },
    svc: el => { S.service = el.dataset.svc; S.know = null; S.time = S.date === TODAY && S.service === 'cena' ? SIM_TIME : SERVICES[S.service].open + 60; S.moving = null; },
    time: el => { S.time = +el.dataset.t; },
    mode: el => { S.mode = el.dataset.v; },
    find: el => { S.find = Math.max(0, Math.min(20, S.find + (+el.dataset.n))); },
    'find-clear': () => { S.find = 0; },
    'fit-book': el => {
      const c = candidates(S.layout, S.date, S.service, S.time, S.find, dayList(), null)[+el.dataset.i];
      if (c) openNew(c.ids, S.time, S.find);
    },
    'list-filter': el => { S.listFilter = el.dataset.v; },
    open: el => {
      if (S.moving) { toast('Tocca un tavolo libero (verde) per spostare, oppure annulla lo spostamento.'); return false; }
      S.panel = { type: 'booking', id: el.dataset.bid };
    },
    'tile-free': el => {
      const tid = +el.dataset.tid;
      if (S.moving) { moveBooking(S.moving, tid); return; }
      if (S.find) {
        const c = candidates(S.layout, S.date, S.service, S.time, S.find, dayList(), null).find(s => s.ids.includes(tid));
        if (c) { openNew(c.ids, S.time, S.find); return; }
      }
      const t = tById(S.layout, tid);
      // a table not free long enough opens on the time it frees up
      const ff = freeFrom(dayList(), S.service, tid, S.time);
      openNew([tid], ff != null ? ff : S.time, Math.min(t.max, Math.max(t.min, 2)));
    },
    know: el => { S.know = S.know === el.dataset.k ? null : el.dataset.k; },
    'know-go': el => { const b = findBooking(el.dataset.bid); if (b) { S.panel = { type: 'booking', id: b.id }; } },
    'new-free': () => openNew(null, S.time, S.find || 2),
    'tl-new': (el, e) => {
      const r = el.getBoundingClientRect(), sv = SERVICES[S.service];
      const m = sv.open + Math.floor(((e.clientX - r.left) / r.width) * (sv.close - sv.open) / 15) * 15;
      const t = tById(S.layout, +el.dataset.tid);
      openNew([t.id], Math.min(m, sv.last + 30), Math.min(t.max, Math.max(t.min, 2)));
    },
    'tl-time': (el, e) => {
      const r = el.getBoundingClientRect(), sv = SERVICES[S.service];
      S.time = Math.min(sv.close - 30, sv.open + Math.round(((e.clientX - r.left) / r.width) * (sv.close - sv.open) / 15) * 15);
    },
    'panel-close': () => { S.panel = null; },
    st: el => { const b = findBooking(el.dataset.bid); if (b && b.state !== el.dataset.st) setState(b, el.dataset.st); },
    'move-start': el => { S.moving = el.dataset.bid; S.panel = null; S.mode = 'sala'; S.find = 0; const b = findBooking(el.dataset.bid); S.time = b.start; },
    'move-cancel': () => { S.moving = null; },
    pin: el => { const b = findBooking(el.dataset.bid); snapshot(); b.pinned = !b.pinned; toast(b.pinned ? `${esc(b.name)}: tavolo fissato, il sistema non lo sposta` : `${esc(b.name)}: tavolo sbloccato`, true); },
    'cancel-ask': el => {
      const b = findBooking(el.dataset.bid);
      modal(`<h3>Annullare la prenotazione?</h3><p><b>${esc(b.name)}</b>, ${persone(b.party)}, ${longDate(S.date).toLowerCase()} alle ${fmt(b.start)}.</p><p class="muted">Il tavolo torna libero e l'assistente può rivenderlo.</p>
        <div class="btns"><button class="btn danger" data-act="cancel-confirm" data-bid="${b.id}">Annulla prenotazione</button><button class="btn" data-act="modal-close" id="m-keep">Mantieni</button></div>`, '#m-keep');
      return false;
    },
    'cancel-confirm': el => { const b = findBooking(el.dataset.bid); closeModal(); setState(b, 'cancelled'); S.panel = null; },
    'modal-close': () => { closeModal(); return false; },
    'modal-back': (el, e) => { if (e.target === el) closeModal(); return false; },
    call: el => {
      if (el.dataset.rid) { const r = S.requests.find(x => x.id === el.dataset.rid); modal(transcript(r.name, r.party, r.start, '', r.convId), '#m-ok'); return false; }
      const b = findBooking(el.dataset.bid); const t = tById(S.layout, b.tables[0]);
      modal(transcript(b.name, b.party, b.start, t ? zName(S.layout, t.zone) : '', b.convId), '#m-ok');
      return false;
    },
    fake: el => { toast(el.dataset.msg); return false; },
    'nb-party': el => { S.panel.party = +el.dataset.p; },
    'nb-auto': () => { S.panel.tables = null; },
    'nb-seat': el => { S.panel.tables = el.dataset.ids.split(',').map(Number); },
    'nb-save': () => saveNew(0),
    walkin: el => saveNew(+el.dataset.p),
    'req-accept': el => { const r = S.requests.find(x => x.id === el.dataset.rid); openNew(null, r.start, r.party, { name: r.name, phone: r.phone, notes: 'Con un cane', requestId: r.id }); },
    'req-decline': el => {
      const r = S.requests.find(x => x.id === el.dataset.rid);
      modal(`<h3>Rifiutare la richiesta?</h3><p><b>${esc(r.name)}</b>, ${persone(r.party)}, alle ${fmt(r.start)}. Il cliente riceve un messaggio che non è possibile.</p>
        <div class="btns"><button class="btn danger" data-act="req-decline-ok" data-rid="${r.id}">Rifiuta</button><button class="btn" data-act="modal-close" id="m-keep">Mantieni</button></div>`, '#m-keep');
      return false;
    },
    'req-decline-ok': el => { closeModal(); snapshot(); S.requests = S.requests.filter(x => x.id !== el.dataset.rid); toast('Richiesta rifiutata', true); },
    undo: () => {
      if (!undoSnap) return;
      S.bookings[undoSnap.key] = undoSnap.list; S.requests = undoSnap.requests; undoSnap = null;
      S.panel = null; S.moving = null; $('#toasts').innerHTML = ''; toast('Fatto: azione annullata');
    },
    export: () => { exportCsv(); return false; },
    'sr-open': el => {
      S.service = el.dataset.svc; setDate(el.dataset.date); S.tab = 'day';
      const b = findBooking(el.dataset.bid); if (b) { S.time = b.start; S.panel = { type: 'booking', id: b.id }; }
      $('#search-results').hidden = true;
    },

    // configuration
    'z-add': () => { const id = 'z' + Date.now().toString(36); S.draft.zones.push({ id, name: 'Nuova zona', note: '', closures: [] }); S.gen.zone = id; },
    'z-move': el => { const zs = S.draft.zones, i = zs.findIndex(z => z.id === el.dataset.zid), j = i + (+el.dataset.n); [zs[i], zs[j]] = [zs[j], zs[i]]; },
    'z-del': el => {
      const z = S.draft.zones.find(x => x.id === el.dataset.zid);
      const fs = futureOn(b => b.tables.some(id => { const t = tById(S.layout, id); return t && t.zone === z.id; }));
      if (fs.length) { toast(`${esc(z.name)} non si può eliminare: ha ${bookingsWord(fs.length)} (${esc(nameList(fs))})`, false, true); return false; }
      const n = S.draft.tables.filter(t => t.zone === z.id).length;
      modal(`<h3>Eliminare la zona ${esc(z.name)}?</h3><p>${n ? `Con i suoi ${n} tavoli e le loro unioni. ` : ''}Diventa definitivo solo quando salvi la sala.</p>
        <div class="btns"><button class="btn danger" data-act="z-del-ok" data-zid="${z.id}">Elimina</button><button class="btn" data-act="modal-close" id="m-keep">Mantieni</button></div>`, '#m-keep');
      return false;
    },
    'z-del-ok': el => {
      const D = S.draft, zid = el.dataset.zid;
      const gone = new Set(D.tables.filter(t => t.zone === zid).map(t => t.id));
      D.zones = D.zones.filter(z => z.id !== zid); D.tables = D.tables.filter(t => !gone.has(t.id)); D.joins = D.joins.filter(j => !j.ids.some(i => gone.has(i)));
      closeModal();
    },
    'z-close-add': el => {
      const cf = S.closeForm[el.dataset.zid] || {};
      if (!cf.from || !cf.to) { toast('Chiusura: scegli le date "dal" e "al"', false, true); return false; }
      S.draft.zones.find(z => z.id === el.dataset.zid).closures.push({ from: cf.from, to: cf.to }); S.closeForm[el.dataset.zid] = { from: '', to: '' };
    },
    'z-close-del': el => { S.draft.zones.find(z => z.id === el.dataset.zid).closures.splice(+el.dataset.i, 1); },
    't-add': el => { const D = S.draft; const [name] = genNames(D, el.dataset.zid, 1); D.tables.push({ id: nextTableId(D), zone: el.dataset.zid, name, min: 1, max: 2, active: true }); },
    't-del': el => {
      const D = S.draft, id = +el.dataset.tid, t = tById(D, id);
      const fs = tById(S.layout, id) ? futureOnTable(id) : [];
      if (fs.length) { toast(`${esc(t.name)} non si può eliminare: ha ${bookingsWord(fs.length)} (${esc(nameList(fs))})`, false, true); return false; }
      const lost = D.joins.filter(j => j.ids.includes(id));
      D.tables = D.tables.filter(x => x.id !== id); D.joins = D.joins.filter(j => !j.ids.includes(id));
      toast(`${esc(t.name)} tolto${lost.length ? ` con ${lost.length} ${lost.length === 1 ? 'unione' : 'unioni'}` : ''}. Scarta per tornare indietro.`);
    },
    'gen-add': () => {
      const D = S.draft, n = Math.max(1, Math.min(40, S.gen.n | 0)), size = Math.max(1, Math.min(20, S.gen.size | 0));
      const names = genNames(D, S.gen.zone, n);
      names.forEach(name => D.tables.push({ id: nextTableId(D), zone: S.gen.zone, name, min: minFor(size), max: size, active: true }));
      toast(`Aggiunti ${names[0]}…${names[names.length - 1]} in ${esc(zName(D, S.gen.zone))}`);
    },
    'j-create': () => {
      const D = S.draft, ts = S.joinPick.map(i => tById(D, i));
      D.joins.push({ id: 'j' + Date.now().toString(36), ids: S.joinPick.slice(), min: Math.max(...ts.map(t => t.max)) + 1, max: ts.reduce((a, t) => a + t.max, 0) });
      S.joinPick = [];
    },
    'j-del': el => {
      const j = S.layout.joins.find(x => x.id === el.dataset.jid);
      const fs = j ? futureOnJoin(j.ids) : [];
      if (fs.length) { toast(`L'unione ${esc(seatLabel(S.layout, j.ids))} non si può togliere: ha ${bookingsWord(fs.length)} (${esc(nameList(fs))})`, false, true); return false; }
      S.draft.joins = S.draft.joins.filter(x => x.id !== el.dataset.jid);
    },
    'j-edit': el => { S.joinEdit = S.joinEdit === el.dataset.jid ? null : el.dataset.jid; },
    'focus-ref': el => { const t = $(`[data-ref="${el.dataset.ref}"]`); if (t) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.focus(); } return false; },
    'cfg-discard-ask': () => {
      const n = diffLayout(S.layout, S.draft).length;
      modal(`<h3>Annullare ${n === 1 ? 'la modifica' : 'le ' + n + ' modifiche'}?</h3><p>La sala torna com'era all'ultimo salvataggio.</p>
        <div class="btns"><button class="btn danger" data-act="cfg-discard">Annulla modifiche</button><button class="btn" data-act="modal-close" id="m-keep">Mantieni</button></div>`, '#m-keep');
      return false;
    },
    'cfg-discard': () => { closeModal(); S.draft = clone(S.layout); S.joinPick = []; S.joinEdit = null; toast('Modifiche annullate'); },
    'cfg-save': () => {
      const { errors } = validate(S.draft);
      if (errors.length) return;
      const n = diffLayout(S.layout, S.draft).length;
      S.layout = clone(S.draft); S.joinEdit = null;
      Object.values(S.bookings).forEach(list => list.forEach(b => { if (b.tables.some(id => !tById(S.layout, id))) b.tables = []; }));
      const zs = S.layout.zones.filter(z => S.layout.tables.some(t => t.zone === z.id && t.active)).map(z => z.name);
      toast(`${n === 1 ? '1 modifica salvata' : n + ' modifiche salvate'}. Dalla prossima chiamata l'assistente propone: ${esc(zs.join(', '))}`);
    },
    'pv-mode': el => { S.preview.mode = el.dataset.v; },
    'pv-svc': el => { S.preview.svc = el.dataset.v; },

    // wizard
    'wz-zone': el => { const W = S.wizard, z = el.dataset.z; if (W.zones.includes(z)) W.zones = W.zones.filter(x => x !== z); else { W.zones.push(z); W.rows[z] = W.rows[z] || [{ n: 4, size: 2 }]; } },
    'wz-custom-add': () => { const W = S.wizard, z = W.custom.trim(); if (!z) return; if (!W.zones.includes(z)) { W.zones.push(z); W.rows[z] = [{ n: 4, size: 2 }]; } W.custom = ''; },
    'wz-row-add': el => { S.wizard.rows[el.dataset.z].push({ n: 2, size: 4 }); },
    'wz-row-del': el => { S.wizard.rows[el.dataset.z].splice(+el.dataset.i, 1); },
    'wz-next': () => { S.wizard.step++; },
    'wz-back': () => { S.wizard.step--; },
    'wz-done': el => {
      const W = S.wizard;
      if (el.dataset.skip) W.pairs = {};
      S.layout = wizardLayout(W); S.draft = clone(S.layout); S.wizard = null; S.bookings = {}; S.tab = 'day';
      S.gen.zone = S.layout.zones[0].id;
      setDate(TODAY);
      toast(`Sala pronta: ${S.layout.tables.length} tavoli. L'assistente prenota da subito.`);
    },
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    if (el.tagName === 'A') return;
    const fn = ACT[el.dataset.act];
    if (!fn) return;
    const keepFocus = fn(el, e) === false;
    if (!keepFocus) {
      render();
      if (S.panel) { const h = $('#panel-h'); if (h && !$('#panel').contains(document.activeElement)) h.focus({ preventScroll: true }); updateNewCheck(); }
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if ($('#modal-root').innerHTML) { closeModal(); return; }
      if (!$('#search-results').hidden) { $('#search-results').hidden = true; return; }
      if (S.panel || S.moving) { S.panel = null; S.moving = null; render(); }
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.brow')) { e.preventDefault(); e.target.click(); }
  });

  const BIND = {
    search: el => { S.search = el.value; renderSearch(); if (S.tab === 'day' && S.layout.tables.length) { $('#view').innerHTML = renderDay(); } },
    date: el => { if (el.value) { setDate(el.value); render(); } },
    scenario: el => { S.scenario = el.value; S.tab = 'day'; initScenario(); render(); },
    'nb-name': el => { S.panel.name = el.value; updateNewCheck(); },
    'nb-phone': el => { S.panel.phone = el.value; updateNewCheck(); },
    'nb-notes': el => { S.panel.notes = el.value; },
    'nb-party': el => { const v = +el.value; if (v >= 1) { S.panel.party = v; $$('.pchips button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.p === v)); updateNewCheck(); } },
    'nb-time': el => { S.panel.start = +el.value; updateNewCheck(); },
    'z-name': el => { S.draft.zones.find(z => z.id === el.dataset.zid).name = el.value; liveConfig(); },
    'z-note': el => { S.draft.zones.find(z => z.id === el.dataset.zid).note = el.value; liveConfig(); },
    'cf-from': el => { (S.closeForm[el.dataset.zid] = S.closeForm[el.dataset.zid] || {}).from = el.value; },
    'cf-to': el => { (S.closeForm[el.dataset.zid] = S.closeForm[el.dataset.zid] || {}).to = el.value; },
    't-name': el => { tById(S.draft, +el.dataset.tid).name = el.value; liveConfig(); },
    't-min': el => { tById(S.draft, +el.dataset.tid).min = el.value === '' ? NaN : +el.value; liveConfig(); },
    't-max': el => { tById(S.draft, +el.dataset.tid).max = el.value === '' ? NaN : +el.value; liveConfig(); },
    't-active': el => {
      const id = +el.dataset.tid, fs = !el.checked && tById(S.layout, id) ? futureOnTable(id) : [];
      if (fs.length) { el.checked = true; toast(`${esc(tById(S.draft, id).name)} non si può disattivare: ha ${bookingsWord(fs.length)} (${esc(nameList(fs))})`, false, true); return; }
      tById(S.draft, id).active = el.checked; render();
    },
    't-zone': el => {
      const id = +el.dataset.tid, saved = tById(S.layout, id), d = tById(S.draft, id);
      const fs = saved && el.value !== saved.zone ? futureOnTable(id) : [];
      if (fs.length) { el.value = d.zone; toast(`${esc(d.name)} non si può spostare: ha ${bookingsWord(fs.length)} (${esc(nameList(fs))})`, false, true); return; }
      d.zone = el.value; render();
    },
    'set-minfree': el => { S.draft.settings = S.draft.settings || {}; S.draft.settings.minFree = el.value === '' ? NaN : +el.value; liveConfig(); },
    'je-pick': el => {
      const j = S.draft.joins.find(x => x.id === el.dataset.jid), id = +el.dataset.tid;
      const saved = S.layout.joins.find(x => x.id === j.id), fs = saved ? futureOnJoin(saved.ids) : [];
      if (fs.length) { el.checked = !el.checked; toast(`L'unione ${esc(seatLabel(S.layout, saved.ids))} ha ${bookingsWord(fs.length)} (${esc(nameList(fs))}): i tavoli non si possono cambiare`, false, true); return; }
      j.ids = el.checked ? j.ids.concat(id) : j.ids.filter(x => x !== id);
      render();
    },
    'j-min': el => { S.draft.joins.find(j => j.id === el.dataset.jid).min = el.value === '' ? NaN : +el.value; liveConfig(); },
    'j-max': el => { S.draft.joins.find(j => j.id === el.dataset.jid).max = el.value === '' ? NaN : +el.value; liveConfig(); },
    'j-pick': el => { const id = +el.dataset.tid; S.joinPick = el.checked ? S.joinPick.concat(id) : S.joinPick.filter(x => x !== id); el.parentElement.classList.toggle('on', el.checked); liveConfig(); },
    'gen-n': el => { S.gen.n = +el.value; liveConfig(); },
    'gen-size': el => { S.gen.size = +el.value; liveConfig(); },
    'gen-zone': el => { S.gen.zone = el.value; liveConfig(); },
    'wz-custom': el => { S.wizard.custom = el.value; },
    'wz-n': el => { S.wizard.rows[el.dataset.z][+el.dataset.i].n = +el.value; },
    'wz-size': el => { S.wizard.rows[el.dataset.z][+el.dataset.i].size = +el.value; },
    'wz-pair': el => { S.wizard.pairs[el.dataset.z] = el.checked; },
  };
  const CHANGE_RERENDER = new Set(['wz-n', 'wz-size', 't-name', 'z-name']);

  document.addEventListener('input', e => {
    const el = e.target.closest('[data-bind]');
    if (!el || el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'date') return;
    const fn = BIND[el.dataset.bind]; if (fn) fn(el);
  });
  document.addEventListener('change', e => {
    const el = e.target.closest('[data-bind]');
    if (!el) return;
    if (el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'date') { const fn = BIND[el.dataset.bind]; if (fn) fn(el); }
    if (CHANGE_RERENDER.has(el.dataset.bind)) render();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('[data-bind="wz-custom"]')) { ACT['wz-custom-add'](); render(); }
  });

  // drag and drop: an occupied tile onto a free one moves the booking through the same check
  document.addEventListener('dragstart', e => {
    const el = e.target.closest('[data-drag-bid]');
    if (el) { e.dataTransfer.setData('text/plain', el.dataset.dragBid); e.dataTransfer.effectAllowed = 'move'; }
  });
  document.addEventListener('dragover', e => {
    const el = e.target.closest('[data-drop-tid]');
    if (el) { e.preventDefault(); el.classList.add('drop-over'); }
  });
  document.addEventListener('dragleave', e => { const el = e.target.closest('[data-drop-tid]'); if (el) el.classList.remove('drop-over'); });
  document.addEventListener('drop', e => {
    const el = e.target.closest('[data-drop-tid]');
    if (!el) return;
    e.preventDefault();
    moveBooking(e.dataTransfer.getData('text/plain'), +el.dataset.dropTid);
    render();
  });

  // ---------------------------------------------------------------- boot
  initScenario();
  render();
  const sel = $('#tchips [aria-pressed="true"]');
  if (sel) sel.scrollIntoView({ inline: 'center', block: 'nearest' });
  window.__proto = { S, validate, candidates, futureOnJoin }; // for inspection from the console
})();
