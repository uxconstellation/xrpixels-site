/* XR Pixels project brief: five steps, required core per step, optional detail folded away.
   Posts JSON to /api/brief on the xrpixels.win Worker, which filters bots, validates, scores and hands off. */
(() => {
  // The endpoint is fixed. A local override exists only for a page served from this machine, pointing at this machine,
  // so a shared link can never redirect a client's answers somewhere else.
  const LOCAL = /^(127\.0\.0\.1|localhost)$/, override = new URLSearchParams(location.search).get('api');
  const API = LOCAL.test(location.hostname) && override && LOCAL.test(new URL(override, location.href).hostname) ? override : 'https://xrpixels.win/api/brief';
  // Turnstile site key: set once the widget exists (the Worker refuses briefs without a valid token in production).
  // A local page may pass ?sitekey= for testing with Cloudflare's test keys; a public page always uses this constant.
  const SITEKEY_PROD = '0x4AAAAAAFil6IrxfLlzu55z'; // Turnstile widget "XR Pixels project brief" (xrpixels.com, www.xrpixels.com)
  const SITEKEY = LOCAL.test(location.hostname) && new URLSearchParams(location.search).get('sitekey') || SITEKEY_PROD;
  const PREFIX = 'xrp-brief-draft:', TAB = 'xrp-brief-sid', KEEP_DAYS = 30;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const form = $('#brief'), steps = $$('.step', form), tabs = $$('#steps button');
  const film = $('#film'), filmBtn = $('#filmBtn'), screen = $('.screen'), cap = $('#filmCap');
  const back = $('#back'), next = $('#next'), send = $('#send'), status = $('#status');
  /* Drafts: one localStorage key per brief id, so tabs never rewrite or delete each other's answers. A tab keeps its
     id in sessionStorage (survives reload). A new tab copies the latest unsent draft under a fresh id; a tab that
     inherited an id another open tab still owns (duplicated tab, window.open) forks the same way. Every id is written
     to storage before anything can be sent, so a reload after a lost response resends under the same id. */
  const ls = { get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* no storage */ } }, del(k) { try { localStorage.removeItem(k); } catch { /* no storage */ } },
    keys() { try { return Object.keys(localStorage).filter(k => k.startsWith(PREFIX)); } catch { return []; } } };
  const cut = Date.now() - KEEP_DAYS * 864e5;
  for (const k of ls.keys()) { const r = ls.get(k); if (!r || !(r.at > cut)) ls.del(k); }
  const latest = () => ls.keys().map(k => ({ sid: k.slice(PREFIX.length), ...ls.get(k) })).filter(r => r.at).sort((a, b) => b.at - a.at)[0];
  const meta = (() => {
    let sid; try { sid = sessionStorage.getItem(TAB); } catch { /* no storage */ }
    const own = sid && ls.get(PREFIX + sid);
    if (own) return { sid, ...own };
    // A draft whose send had an unknown outcome keeps its id, so resending it after the tab was closed is still the same brief.
    const l = latest(); return { sid: l && l.sent ? l.sid : crypto.randomUUID(), started: l ? l.started : Date.now(), d: l ? l.d : null, sent: !!(l && l.sent) };
  })();
  const persist = () => { ls.set(PREFIX + meta.sid, { d: meta.d, started: meta.started, at: Date.now(), sent: !!meta.sent }); try { sessionStorage.setItem(TAB, meta.sid); } catch { /* no storage */ } };
  // Ownership is a Web Lock per draft id, held for the life of the tab and released by the browser when the page goes.
  // A tab that cannot take its inherited id's lock (another open tab holds it) continues under a fresh id. Nothing is
  // written to storage until ownership is settled.
  const hold = sid => new Promise(ok => navigator.locks.request(PREFIX + sid, { ifAvailable: true }, lock => { ok(!!lock); return lock ? new Promise(() => {}) : undefined; }));
  const claimed = (async () => {
    if (navigator.locks && !(await hold(meta.sid))) { meta.sid = crypto.randomUUID(); await hold(meta.sid); }
    persist();
  })();
  const saveDraft = d => { meta.d = d; claimed.then(persist); };
  const dropDraft = sid => ls.del(PREFIX + sid);
  const fork = () => { meta.sid = crypto.randomUUID(); meta.sent = false; if (navigator.locks) hold(meta.sid); persist(); };
  let at = 0, filmHeld = reduce, token = '';

  /* ---- the film for each step ---- */
  const setFilm = el => {
    if (film.dataset.src === el.dataset.film) return;
    film.dataset.src = el.dataset.film; screen.classList.add('swap');
    setTimeout(() => { film.poster = el.dataset.poster; film.src = el.dataset.film; cap.textContent = el.dataset.cap; screen.classList.remove('swap'); if (!filmHeld) film.play().catch(() => {}); }, reduce ? 0 : 300);
  };
  filmBtn.addEventListener('click', () => { filmHeld = !filmHeld; filmBtn.setAttribute('aria-pressed', filmHeld); filmBtn.textContent = filmHeld ? 'Play film' : 'Pause film'; filmHeld ? film.pause() : film.play().catch(() => {}); });
  if (reduce) { filmBtn.textContent = 'Play film'; filmBtn.setAttribute('aria-pressed', 'true'); } else film.play().catch(() => {});

  /* ---- solution cards: films preview on hover or focus only ---- */
  $$('.sol label').forEach(l => { const v = $('video', l); if (!v) return;
    const on = () => { if (reduce) return; if (!v.src) v.src = v.dataset.src; v.play().catch(() => {}); }, off = () => v.pause();
    l.addEventListener('pointerenter', on); l.addEventListener('focusin', on); l.addEventListener('pointerleave', off); l.addEventListener('focusout', off); });

  /* ---- values ---- */
  const values = () => {
    const d = {};
    for (const el of form.elements) {
      if (!el.name || el.type === 'submit') continue;
      if (el.type === 'checkbox' && el.name !== 'datesTbd') { (d[el.name] ||= []); if (el.checked) d[el.name].push(el.value); }
      else if (el.type === 'checkbox') d[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) d[el.name] = el.value; }
      else d[el.name] = el.value.trim();
    }
    return d;
  };
  const restore = d => { for (const el of form.elements) { const v = d[el.name]; if (v == null || el.name === 'hp') continue;
    if (el.type === 'checkbox') el.checked = Array.isArray(v) ? v.includes(el.value) : !!v; else if (el.type === 'radio') el.checked = v === el.value; else el.value = v; } };
  if (meta.d) restore(meta.d);
  form.addEventListener('input', () => { const d = values(); delete d.hp; saveDraft(d); });

  /* ---- errors ---- */
  const clear = () => { $$('.err', form).forEach(e => e.remove()); $$('.bad', form).forEach(e => e.classList.remove('bad')); status.textContent = ''; status.classList.remove('bad'); };
  const holder = name => { const el = form.elements[name]; if (!el) return null; const one = el.length != null && !el.tagName ? el[0] : el; return one.closest('.pick, .sol, .f, .check'); };
  const mark = (name, msg) => { const h = holder(name); if (!h) return null; h.classList.add('bad');
    const p = document.createElement('p'); p.className = 'err'; p.id = 'err-' + name; p.textContent = msg; h.append(p);
    const ctl = h.querySelector('input, textarea'); if (ctl) ctl.setAttribute('aria-describedby', p.id);
    const det = h.closest('details'); if (det) det.open = true; return h; };
  const stepOf = name => { const h = holder(name); return h ? steps.indexOf(h.closest('.step')) : -1; };

  const REQ = [['company', 'contactName', 'email', 'phone'], ['location', 'eventType', 'objective'], [], ['budgetRange', 'budgetApproved'], ['stage', 'nextStep']];
  const check = i => {
    const d = values(), bad = [];
    for (const f of REQ[i]) if (!d[f]) bad.push([f, 'Required.']);
    if (i === 0 && d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) bad.push(['email', 'That e-mail address does not look right.']);
    if (i === 0 && d.phone && d.phone.replace(/\D/g, '').length < 7) bad.push(['phone', 'That phone number does not look right.']);
    if (i === 1 && !d.datesTbd && !d.eventStart) bad.push(['eventStart', 'Add a start date, or tick "Dates not confirmed yet".']);
    if (i === 1 && d.eventStart && d.eventEnd && d.eventEnd < d.eventStart) bad.push(['eventEnd', 'Ends before it starts.']);
    return bad;
  };
  const report = bad => { clear(); let first; bad.forEach(([f, m]) => { const h = mark(f, m); first ||= h; });
    status.textContent = bad.length === 1 ? '1 answer needs a look.' : `${bad.length} answers need a look.`; status.classList.add('bad');
    const ctl = first && first.querySelector('input, textarea'); if (ctl) ctl.focus(); };

  /* ---- steps ---- */
  const go = (i, focus = true) => {
    at = i; steps.forEach((s, k) => s.classList.toggle('on', k === i));
    $('.intro').hidden = i > 0; // the title and promise belong to the first step only
    tabs.forEach((t, k) => { t.toggleAttribute('aria-current', k === i); if (k === i) t.setAttribute('aria-current', 'step'); t.classList.toggle('done', k < i); });
    back.hidden = i === 0; next.hidden = i === steps.length - 1; send.hidden = i !== steps.length - 1;
    setFilm(steps[i]); if (i === steps.length - 1) turnstile();
    if (focus) { const lg = $('legend', steps[i]); lg.tabIndex = -1; lg.focus({ preventScroll: true }); form.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }); }
  };
  next.addEventListener('click', () => { const bad = check(at); if (bad.length) return report(bad); clear(); go(at + 1); });
  back.addEventListener('click', () => { clear(); go(at - 1); });
  tabs.forEach((t, k) => t.addEventListener('click', () => {
    if (k > at) for (let s = at; s < k; s++) { const bad = check(s); if (bad.length) { if (s !== at) go(s, false); return report(bad); } }
    clear(); go(k);
  }));

  /* ---- Turnstile: tokens are single use, so every POST gets a fresh one ---- */
  let waiting = [], tsState = 'idle'; // idle | loading | ready; a failed script load goes back to idle so Send can retry it
  let tsGen = 0;
  function turnstile() {
    if (!SITEKEY || tsState !== 'idle') return; tsState = 'loading';
    const gen = ++tsGen, s = document.createElement('script');
    // A load that errors, or stalls past 20 s, is abandoned: tag removed, state back to idle, its late onload ignored.
    const abandon = () => { if (gen !== tsGen || tsState !== 'loading') return; tsGen++; tsState = 'idle'; s.remove(); waiting.splice(0).forEach(w => w.no(new Error('check unavailable'))); };
    // a fresh onload name per attempt also gives a fresh URL, so a retry is never merged with a stalled request
    window['xrpTs' + gen] = () => { if (gen !== tsGen) return; tsState = 'ready'; window.turnstile.render('#turnstile', { sitekey: SITEKEY, theme: 'dark',
      callback: t => { token = t; waiting.splice(0).forEach(w => w.ok(t)); }, 'expired-callback': () => { token = ''; } }); };
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=xrpTs' + gen; s.async = true; s.onerror = abandon;
    setTimeout(abandon, 20000);
    document.head.append(s);
  }
  const freshToken = (used = false) => {
    if (!SITEKEY) return Promise.resolve('');
    if (used) { token = ''; if (tsState === 'ready') window.turnstile.reset('#turnstile'); }
    if (token) return Promise.resolve(token);
    turnstile(); status.textContent = 'Completing the spam check.';
    return new Promise((ok, no) => { const w = { ok, no }; waiting.push(w);
      setTimeout(() => { const i = waiting.indexOf(w); if (i >= 0) { waiting.splice(i, 1); no(new Error('check timeout')); } }, 60000); });
  };

  /* ---- send ---- */
  let sending = false;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (sending) return;
    // Enter on an earlier step means Next: a brief is only sent from the last step, where the spam check is visible.
    if (at < steps.length - 1) return next.click();
    for (let s = 0; s < steps.length; s++) { const bad = check(s); if (bad.length) { go(s, false); return report(bad); } }
    sending = true; clear(); await claimed;
    // Freeze answers and navigation while sending, so what is sent is exactly what is on screen (Turnstile stays usable).
    const lock = on => { steps.forEach(s => { s.disabled = on; }); [back, next, send, ...tabs].forEach(b => { b.disabled = on; }); form.setAttribute('aria-busy', on); };
    lock(true);
    const sid0 = meta.sid; // this send's identity; only a 409 moves it, and the move is persisted before the resend
    const d = values(); d.elapsed = Date.now() - meta.started; delete d.hp;
    const hp = form.elements.hp.value; if (hp) d.hp = hp;
    let used = false, sid = sid0; // a token is spent by any POST, so a second POST always waits for a new one
    const post = async () => { d.turnstile = await freshToken(used); used = true; d.sid = sid; meta.sent = true; persist(); status.textContent = 'Sending your brief.';
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d), signal: AbortSignal.timeout(25000) });
      return [r, await r.json().catch(() => ({}))]; };
    try {
      let [r, res] = await post();
      // 409: this id already carries a different brief (another tab sent it). These answers become a new brief.
      if (r.status === 409 && res.conflict) { fork(); dropDraft(sid0); sid = meta.sid; [r, res] = await post(); }
      if (r.ok && res.ok) {
        dropDraft(sid); try { sessionStorage.removeItem(TAB); } catch { /* no storage */ }
        $('#ref').textContent = res.ref || ''; form.classList.add('sent'); tabs.forEach(t => { t.classList.add('done'); t.removeAttribute('aria-current'); }); $('#done').hidden = false; $('#done').focus(); film.pause(); return;
      }
      meta.sent = false; persist(); // the server answered and did not take it: a definite no, not an unknown
      if (SITEKEY) { token = ''; if (tsState === 'ready') window.turnstile.reset('#turnstile'); } // spent either way
      if (res.fields) { // unlock first: a disabled control cannot take the focus report() moves to it
        lock(false); const fields = Object.entries(res.fields), s = Math.min(...fields.map(([f]) => stepOf(f)).filter(n => n >= 0));
        if (isFinite(s)) go(s, false); report(fields);
      } else { status.textContent = res.error || 'Could not send just now. Your answers are kept; please try again, or email marketing@xrpixels.com.'; status.classList.add('bad'); }
    } catch {
      if (SITEKEY) { token = ''; if (tsState === 'ready') window.turnstile.reset('#turnstile'); }
      status.textContent = 'Could not reach us. Your answers are kept here; try again, or email marketing@xrpixels.com.'; status.classList.add('bad');
    } finally { sending = false; if (!form.classList.contains('sent')) lock(false); }
  });

  go(0, false);
})();
