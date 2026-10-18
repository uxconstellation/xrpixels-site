/* XR Pixels v2. One idea: 3D becomes pixel, pixel becomes light. Every effect is decoration; the page reads
   fully without this file (no-JS and prefers-reduced-motion give a static, complete page). */
// Progressive enhancement. The HTML/CSS page is complete on its own (static pixel mark, Premiere block, vector
// footer wordmark, normal scroll). Each enhancement class is added only after its own dependency initialised:
//   hero-gl (voxel mark rendered), hero-scroll (ScrollTrigger drives the 320vh hero), field-gl, wm-canvas.
// Init runs after first paint inside a GSAP context; any throw reverts it and removes every class (fail()).
const ENH = ['hero-gl', 'hero-scroll', 'field-gl', 'wm-canvas', 'hdr-live'];
let dead = false, ctx = null, mmRef = null;
const enh = c => document.documentElement.classList.add(c);
const xrMain = () => {
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const G = window.gsap, ST = window.ScrollTrigger, T = window.THREE;
const motion = !reduce && G && ST;
if (G && ST) G.registerPlugin(ST);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); }; // stable seeds
const cellPx = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cell')) || 24;

// Wide Neck mark, brand/src/mark.mjs (6 x 5 modules). Liquid necks live in the vector only.
const MODS = [[0,0],[1,0],[2,0],[3,0],[4,0],[1,1],[4,1],[2,2],[3,2],[4,2],[1,3],[4,3],[0,4],[5,4]];
// Mark geometry (brand/src/mark.mjs, 6 x 5 modules) is inline in the HTML; MODS drives the voxel and pixel builds.
const ON = new Set(MODS.map(([x, y]) => x + ',' + y));

/* ---------- hero backdrop: the mark repeated as a dot / X matrix (mood board) ---------- */
{
  const c = cellPx(); let s = `<svg xmlns='http://www.w3.org/2000/svg' width='${c * 6}' height='${c * 5}'><g opacity='.3' fill='#9d8aff' stroke='#9d8aff' stroke-width='1.2'>`;
  for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) {
    const cx = x * c + c / 2, cy = y * c + c / 2, r = c * .15;
    s += ON.has(x + ',' + y) ? `<path d='M${cx - r} ${cy - r}L${cx + r} ${cy + r}M${cx + r} ${cy - r}L${cx - r} ${cy + r}'/>` : `<rect x='${cx - 1}' y='${cy - 1}' width='2' height='2' stroke='none'/>`;
  }
  $('.matrix').style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(s + '</g></svg>')}")`;
}

/* ---------- 1 + 2 hero: voxel Wide Neck (ported from _lab/voxel-hero, approved 16 Oct) ---------- */
{
  const hero = $('#hero'), cv = $('#gl'), px = $('#px'), g = px.getContext('2d');
  const parts = $$('.h span'), fades = [$('.hero-cta'), $('.meta')];
  const reveal = $('.reveal'), revImg = $('.reveal img'), matrix = $('.matrix');
  const INK = '#9d8aff';
  let R = null, scene, cam, group, caps = [], mat;
  try { if (T) R = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); } catch (e) { R = null; }
  if (R) {
    R.setPixelRatio(Math.min(devicePixelRatio, 2)); R.outputEncoding = T.sRGBEncoding;
    scene = new T.Scene(); cam = new T.PerspectiveCamera(32, 1, .1, 100); cam.position.set(0, 0, 14);
    scene.add(new T.HemisphereLight(0xffffff, 0x221a44, .9));
    const key = new T.DirectionalLight(0xffffff, 1.6); key.position.set(4, 6, 8); scene.add(key);
    const rim = new T.DirectionalLight(0x9d8aff, 1.2); rim.position.set(-6, -2, -4); scene.add(rim);
    const geo = new T.ExtrudeGeometry(capShape(.86, .16), { depth: .7, bevelEnabled: true, bevelThickness: .08, bevelSize: .06, bevelSegments: 4, curveSegments: 6 });
    geo.translate(0, 0, -.35);
    mat = new T.MeshPhysicalMaterial({ color: 0x9d8aff, roughness: .28, metalness: .05, clearcoat: 1, clearcoatRoughness: .15 });
    group = new T.Group(); scene.add(group);
    caps = MODS.map(([x, y], i) => {
      const m = new T.Mesh(geo, mat);
      m.userData.home = new T.Vector3(x - 2.5, 2 - y, 0);
      const a = i * 2.399; m.userData.out = new T.Vector3(Math.cos(a) * (5 + i % 3), Math.sin(a) * (3.5 + i % 4), 2 + (i % 5));
      m.position.copy(m.userData.home); group.add(m); return m;
    });
    enh('hero-gl');
  } else cv.remove();
  if (motion) { enh('hero-scroll'); $('.stage').insertBefore(reveal, px); } // dissolve target; otherwise it stays a static block after the hero
  const INKC = R ? new T.Color(INK) : null;

  let cell = 24, cols, rows, seeds;
  function size() {
    const w = innerWidth, h = innerHeight;
    if (R) { R.setSize(w, h, false); cam.aspect = w / h; cam.position.z = w < 760 ? 27 : h > w ? 23 : 17; /* phone / portrait tablet / landscape */ cam.updateProjectionMatrix(); }
    px.width = w; px.height = h; cell = w < 760 ? 16 : 24;
    cols = Math.ceil(w / cell); rows = Math.ceil(h / cell);
    seeds = Float32Array.from({ length: cols * rows }, (_, k) => hash(k % cols, (k / cols) | 0));
  }

  let p = 0, mx = 0, my = 0, on = true;
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
  const ease = G ? G.parseEase('power3.inOut') : t => t, out = G ? G.parseEase('expo.in') : t => t;

  function frame(t) {
    // phase A 0 to .45: keycaps turn face-on and lose depth into flat ink pixels (power3.inOut)
    const a = ease(Math.min(1, p / .45));
    // phase B .45 to .78: flat pixels scatter through the camera, ink cells flood the frame (expo.in)
    const b = out(clamp((p - .45) / .33));
    // phase C .8 to 1: the ink field clears cell by cell onto the first hologram
    const c = clamp((p - .8) / .2);
    if (R) {
      group.rotation.y = (1 - a) * (-.45 + (reduce ? 0 : Math.sin(t * .4) * .12) + mx * .5);
      group.rotation.x = (1 - a) * (.18 + my * .3);
      caps.forEach((m, i) => {
        const press = reduce ? 0 : Math.max(0, Math.sin(t * 2.2 - i * .55)) ** 8 * .22 * (1 - a); // travelling key-press wave
        m.position.lerpVectors(m.userData.home, m.userData.out, b);
        m.position.z += -press + b * 6;
        m.scale.set(1, 1, Math.max(.02, 1 - a * .98));
        m.rotation.z = b * (i % 2 ? 1 : -1) * 1.2;
      });
      mat.color.copy(INKC).multiplyScalar(1 - a); mat.emissive.copy(INKC).multiplyScalar(a); mat.clearcoat = 1 - a; mat.roughness = .28 + a * .7;
      cv.style.visibility = c > 0 ? 'hidden' : 'visible';
      if (c === 0) R.render(scene, cam);
    }
    // lines part toward the edges but stop 8px short of them, so no word is ever cut while visible
    parts.forEach((el, i) => {
      const room = i < 2 ? el.offsetLeft - 8 : innerWidth - el.offsetLeft - el.offsetWidth - 8;
      el.style.transform = `translate3d(${(i < 2 ? -1 : 1) * a * Math.max(0, room)}px,0,0)`; el.style.opacity = 1 - b;
    });
    const f = clamp(1 - a * 1.6);
    fades.forEach(el => { el.style.opacity = f; el.style.visibility = f < .02 ? 'hidden' : ''; });
    matrix.style.opacity = .9 * (1 - a);
    if (motion) { reveal.style.opacity = c > 0 ? 1 : 0; revImg.style.transform = `scale(${1.12 - .12 * c})`; }

    g.clearRect(0, 0, px.width, px.height);
    if (b > 0) {
      g.fillStyle = INK;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const s = seeds[j * cols + i];
        if (c > 0) { if (s >= c) g.fillRect(i * cell, j * cell, cell, cell); }
        else if (s < b) { const k = cell * (.15 + .85 * Math.min(1, (b - s) * 6)); g.fillRect(i * cell + (cell - k) / 2, j * cell + (cell - k) / 2, k, k); }
      }
    }
  }
  size(); frame(0);
  addEventListener('resize', () => { if (dead) return; size(); frame(performance.now() / 1000); });
  if (motion) {
    ST.create({ trigger: hero, start: 'top top', end: 'bottom bottom', onUpdate: s => { p = s.progress; } });
    new IntersectionObserver(([e]) => { on = e.isIntersecting; }).observe(hero);
    G.ticker.add(time => { if (on && !dead) frame(time); });
  }
}

function capShape(s, r) {
  const p = new T.Shape(), h = s / 2;
  p.moveTo(-h + r, -h); p.lineTo(h - r, -h); p.quadraticCurveTo(h, -h, h, -h + r); p.lineTo(h, h - r); p.quadraticCurveTo(h, h, h - r, h);
  p.lineTo(-h + r, h); p.quadraticCurveTo(-h, h, -h, h - r); p.lineTo(-h, -h + r); p.quadraticCurveTo(-h, -h, -h + r, -h); return p;
}

/* ---------- pixel dissolve edges: the previous ground breaks into modules as the next one arrives ---------- */
const REST = .7; // the dithered edge that stays (and the whole state under reduced motion)
const edgeTw = new Map();
function edges() { $$('.edge').forEach(el => {
  const old = edgeTw.get(el); if (old) { old.scrollTrigger && old.scrollTrigger.kill(); old.kill(); }
  el.textContent = '';
  const cell = cellPx(), n = Math.ceil(el.clientWidth / cell), R4 = 4, cells = [];
  for (let r = 0; r < R4; r++) for (let i = 0; i < n; i++) {
    const d = document.createElement('i'); d.style.background = el.dataset.from; el.appendChild(d);
    cells.push({ d, t: (1 - (r + .5) / R4) * .62 + hash(i, r + 7) * .38 });
  }
  const end = el.dataset.rest ? +el.dataset.rest : REST;
  const set = q => cells.forEach(c => { c.d.style.opacity = c.t > q ? 1 : 0; });
  set(REST);
  if (motion) {
    const o = { q: 0 }; set(0);
    edgeTw.set(el, G.to(o, { q: end, ease: 'none', onUpdate: () => set(o.q), scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: el.dataset.rest ? 'top 5%' : 'top 30%', scrub: true } }));
  }
}); }
edges();

/* ---------- 3 statement lights up word by word, the mark fills module by module ---------- */
{
  const st = $('#statement'), words = st.textContent.trim().split(/\s+/);
  st.innerHTML = words.map(w => `<span class="w">${w}</span>`).join(' ');
  const mm = $('.minimark'); // modules are inline in the HTML so the mark reads without JS
  if (motion) {
    const ws = $$('.w', st), mods = $$('rect.on', mm);
    const tl = G.timeline({ scrollTrigger: { trigger: '#about', start: 'top 60%', end: 'bottom 70%', scrub: .4 } });
    tl.fromTo(ws, { color: '#5c5970' }, { color: '#030305', ease: 'steps(1)', duration: .1, stagger: .1 }, 0)
      .fromTo(mods, { opacity: .14 }, { opacity: 1, ease: 'steps(1)', duration: .1, stagger: (ws.length * .1) / mods.length }, 0);
  }
}

/* ---------- 4 collective: the product follows the cursor through a pixel reveal ---------- */
if (motion && matchMedia('(hover:hover) and (pointer:fine)').matches) {
  const peek = $('.peek'), pix = $('.pix', peek), list = $('.rows'), img = peek.insertBefore(new Image(), pix); img.alt = '';
  pix.style.setProperty('--pc', 10);
  for (let i = 0; i < 60; i++) pix.appendChild(document.createElement('i'));
  const cells = [...pix.children];
  const xTo = G.quickTo(peek, 'x', { duration: .55, ease: 'power3.out' }), yTo = G.quickTo(peek, 'y', { duration: .55, ease: 'power3.out' });
  G.set(peek, { scale: .85 });
  list.addEventListener('pointermove', e => { xTo(Math.min(e.clientX + 28, innerWidth - 360)); yTo(e.clientY - 106); });
  $$('.row', list).forEach(row => row.addEventListener('pointerenter', () => {
    img.src = row.dataset.shot;
    G.to(peek, { opacity: 1, scale: 1, duration: .45, ease: 'power3.out' });
    G.killTweensOf(cells); G.set(cells, { opacity: 1 });
    G.to(cells, { opacity: 0, duration: .01, ease: 'steps(1)', stagger: { each: .006, from: 'random' } });
  }));
  list.addEventListener('pointerleave', () => G.to(peek, { opacity: 0, scale: .85, duration: .3, ease: 'power2.in' }));
}

/* ---------- 5 signal chapter: a field of keycaps rises from flat pixels and depresses under the pointer ---------- */
{
  const cv = $('#field'); let R = null;
  try { if (T) R = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); } catch (e) { R = null; }
  if (R) {
    R.setPixelRatio(Math.min(devicePixelRatio, 2)); R.outputEncoding = T.sRGBEncoding;
    const scene = new T.Scene(), cam = new T.PerspectiveCamera(30, 1, .1, 200);
    scene.add(new T.HemisphereLight(0xffffff, 0x0b1f17, .55));
    const key = new T.DirectionalLight(0xffffff, 1.5); key.position.set(-4, -6, 10); scene.add(key);
    const rim = new T.DirectionalLight(0xc8ff3d, .8); rim.position.set(6, 8, 3); scene.add(rim);
    const geo = new T.ExtrudeGeometry(capShape(.84, .14), { depth: .6, bevelEnabled: true, bevelThickness: .06, bevelSize: .05, bevelSegments: 3, curveSegments: 5 });
    geo.translate(0, 0, -.6);
    const mat = new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: .32, metalness: 0, clearcoat: .8, clearcoatRoughness: .2 });
    let mesh, COLS, ROWS, cur;
    const SIG = new T.Color('#c8ff3d').convertSRGBToLinear(), LOW = new T.Color('#2f5a00').convertSRGBToLinear(), col = new T.Color(), M = new T.Object3D();
    const ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 0, 1), 0), hit = new T.Vector3(999, 999, 0), ndc = new T.Vector2();
    let rise = motion ? 0 : 1, on = false, has = false;
    enh('field-gl'); // the wrap must be laid out before build() measures it
    function build() {
      const w = cv.clientWidth, h = cv.clientHeight; R.setSize(w, h, false);
      const small = w < 760; COLS = small ? 11 : 24; ROWS = small ? 9 : 10;
      if (mesh) { scene.remove(mesh); mesh.dispose(); }
      mesh = new T.InstancedMesh(geo, mat, COLS * ROWS); scene.add(mesh); cur = new Float32Array(COLS * ROWS);
      cam.aspect = w / h;
      const tilt = .62, dist = (COLS / 2 + .6) / (Math.tan(T.MathUtils.degToRad(cam.fov / 2)) * cam.aspect);
      cam.position.set(0, -Math.sin(tilt) * dist, Math.cos(tilt) * dist); cam.lookAt(0, .6, 0); cam.updateProjectionMatrix();
      draw(0);
    }
    function draw(t) {
      if (has) { ray.setFromCamera(ndc, cam); ray.ray.intersectPlane(plane, hit); }
      for (let j = 0, k = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++, k++) {
        const x = i - (COLS - 1) / 2, y = j - (ROWS - 1) / 2;
        const d2 = (x - hit.x) ** 2 + (y - hit.y) ** 2;
        cur[k] += ((has ? Math.exp(-d2 / 2.4) : 0) - cur[k]) * .16;
        const wave = motion ? .1 * Math.sin(t * 1.6 - (x * .35 + y * .5)) : 0;
        M.position.set(x, y, rise * (wave - cur[k] * .8));
        M.scale.set(1, 1, Math.max(.03, rise * (1 - cur[k] * .35)));
        M.updateMatrix(); mesh.setMatrixAt(k, M.matrix);
        mesh.setColorAt(k, col.copy(SIG).lerp(LOW, cur[k] * .8));
      }
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
      R.render(scene, cam);
    }
    build(); addEventListener('resize', () => { if (!dead) build(); });
    if (motion) {
      cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); has = true; });
      cv.addEventListener('pointerleave', () => { has = false; });
      const o = { r: 0 };
      G.to(o, { r: 1, ease: 'power3.inOut', onUpdate: () => { rise = o.r; }, scrollTrigger: { trigger: '.field-wrap', start: 'top 95%', end: 'top 25%', scrub: .5 } });
      new IntersectionObserver(([e]) => { on = e.isIntersecting; }).observe(cv);
      G.ticker.add(time => { if (on && !dead) draw(time); });
    }
  } else cv.remove();
}

/* ---------- 6 gallery: pinned horizontal track (desktop), pixel-transition hover, films play in view ---------- */
if (motion) {
  mmRef = G.matchMedia();
  mmRef.add('(min-width: 761px)', () => {
    const work = $('#work'), track = $('.track'), dist = () => Math.max(0, track.scrollWidth - innerWidth);
    work.classList.add('is-h');
    G.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: '#work', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: .6, invalidateOnRefresh: true } });
    return () => work.classList.remove('is-h');
  });
  $$('.case').forEach(card => {
    const pix = $('.pix', card); let cells;
    card.addEventListener('pointerenter', () => {
      if (!cells) { for (let i = 0; i < 96; i++) pix.appendChild(document.createElement('i')); cells = [...pix.children]; }
      G.killTweensOf(cells);
      G.to(cells, { opacity: 1, duration: .01, ease: 'steps(1)', stagger: { each: .0018, from: 'random' } });
      G.to(cells, { opacity: 0, duration: .01, ease: 'steps(1)', delay: .3, stagger: { each: .0018, from: 'random' } });
    });
  });
  const io = new IntersectionObserver(es => es.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) { if (!v.src) v.src = v.dataset.src; v.play().catch(() => {}); } else v.pause();
  }), { rootMargin: '0px 200px' });
  $$('.case video').forEach(v => io.observe(v));
}

/* ---------- 7 premiere: the frame opens to full bleed (MakeReign zoom-through), links rise ---------- */
if (motion) {
  G.fromTo('.pframe', { clipPath: 'inset(12% 10% round 24px)' }, { clipPath: 'inset(0% 0% round 0px)', ease: 'power2.out', scrollTrigger: { trigger: '.pframe', start: 'top 95%', end: 'top 5%', scrub: true } });
  G.fromTo('.pframe img', { scale: 1.18 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.pframe', start: 'top bottom', end: 'bottom top', scrub: true } });
  G.from('.giant li', { yPercent: 60, opacity: 0, duration: 1, ease: 'expo.out', stagger: .09, scrollTrigger: { trigger: '.giant', start: 'top 85%' } });
}

/* ---------- 8 footer: the real wordmark assembles from scattered pixels ---------- */
let wmTw = null;
function wordmark() {
  if (wmTw) { wmTw.scrollTrigger && wmTw.scrollTrigger.kill(); wmTw.kill(); wmTw = null; }
  const cv = $('#wordmark'), svg = $('#wm'); if (!svg) return;
  enh('wm-canvas'); // canvas must be displayed to measure; removed again if the raster fails
  const W = cv.clientWidth, cap = W < 700 ? 10 : 20, mod = cap / 5, bb = svg.getBBox();
  const wc = Math.round(bb.width / bb.height * cap), gap = 2 * mod, COLS = 6 * mod + gap + wc;
  const cell = W / COLS, dpr = Math.min(devicePixelRatio, 2);
  cv.width = Math.round(W * dpr); cv.height = Math.round(cap * cell * dpr); cv.style.height = cap * cell + 'px';
  const pts = [];
  MODS.forEach(([x, y]) => { for (let a = 0; a < mod; a++) for (let b = 0; b < mod; b++) pts.push([x * mod + a, y * mod + b]); });
  const k = 4, clone = svg.cloneNode(true);
  clone.setAttribute('viewBox', `${bb.x} ${bb.y} ${bb.width} ${bb.height}`); clone.setAttribute('width', wc * k); clone.setAttribute('height', cap * k);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); clone.removeAttribute('id'); clone.style.color = '#000';
  $$('path', clone).forEach(p => p.setAttribute('fill', '#000'));
  const img = new Image();
  img.onload = () => {
    const oc = document.createElement('canvas'); oc.width = wc * k; oc.height = cap * k;
    const o = oc.getContext('2d'); o.drawImage(img, 0, 0); const d = o.getImageData(0, 0, oc.width, oc.height).data;
    for (let y = 0; y < cap; y++) for (let x = 0; x < wc; x++) {
      let s = 0; for (let b = 0; b < k; b++) for (let a = 0; a < k; a++) s += d[((y * k + b) * oc.width + x * k + a) * 4 + 3];
      if (s / (k * k * 255) > .42) pts.push([6 * mod + gap + x, y]);
    }
    const P = pts.map(([x, y], i) => ({ x, y, sx: hash(i, 1) * COLS, sy: hash(i, 2) * cap, s: hash(i, 3) }));
    const g = cv.getContext('2d'), e = G ? G.parseEase('power3.out') : t => t;
    const paint = q => {
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, cap * cell); g.fillStyle = '#9d8aff';
      const gp = Math.max(.5, cell * .12);
      P.forEach(p => { const l = e(clamp((q - p.s * .45) / .55)), sz = (cell - gp) * (.35 + .65 * l);
        g.fillRect((p.sx + (p.x - p.sx) * l) * cell + (cell - sz) / 2, (p.sy + (p.y - p.sy) * l) * cell + (cell - sz) / 2, sz, sz); });
    };
    if (motion) { const o = { q: 0 }; paint(0); wmTw = G.to(o, { q: 1, ease: 'none', onUpdate: () => paint(o.q), scrollTrigger: { trigger: cv, start: 'top bottom', end: 'bottom bottom', scrub: .5 } }); ST.refresh(); }
    else paint(1);
  };
  img.onerror = () => document.documentElement.classList.remove('wm-canvas');
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
}
wordmark();

/* width changes rebuild the module-sized pieces (debounced; height-only changes such as a mobile URL bar are ignored) */
{ let w = innerWidth, t; addEventListener('resize', () => { if (dead || innerWidth === w) return; w = innerWidth; clearTimeout(t);
  t = setTimeout(() => { edges(); wordmark(); if (ST) ST.refresh(); }, 200); }); }

/* ---------- header colour follows the ground under it (logo pairings: UV on Void, Void on Haze, Signal on Deep Green) ---------- */
if (G && ST) {
  const top = $('#top');
  // MakeReign drops to logo + "Menu." once you leave the hero, so the nav never sits on top of display type
  ST.create({ trigger: '#about', start: 'top 80px', onEnter: () => top.classList.add('compact'), onLeaveBack: () => top.classList.remove('compact') });
  $$('main [data-theme], footer[data-theme]').forEach(sec => ST.create({ trigger: sec, start: 'top 40px', end: 'bottom 40px',
    onToggle: s => { if (s.isActive) top.dataset.theme = sec.dataset.theme; } }));
  enh('hdr-live'); // transparent hero header + section colours only now that the triggers exist
}

if (ST) { document.fonts && document.fonts.ready.then(() => { if (!dead) ST.refresh(); }); addEventListener('load', () => { if (!dead) ST.refresh(); }); }
};

/* ---------- product dialog (v1 lightbox behaviour) and menu sheet: native <dialog> ----------
   Own init, run as soon as this file loads and before any WebGL/GSAP work, so a visual-init failure cannot
   take them down. In HTML every product row, gallery card and the Premiere action is a link to the real
   media file and "Menu." links to the footer nav; here they are upgraded to open the dialogs. */
function initDialogs() {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const box = $('#shotBox'), vid = $('#sbVid'), label = $('#sbLabel');
  $$('.shot').forEach(el => el.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return; // new tab / window keeps the plain link
    e.preventDefault();
    // Missing cleared product footage opens its existing hardware still.
    vid.poster = el.dataset.shot; vid.controls = Boolean(el.dataset.vid);
    if (el.dataset.vid) vid.src = el.dataset.vid; else { vid.removeAttribute('src'); vid.load(); }
    label.textContent = el.dataset.label; box.showModal();
    if (el.dataset.vid && !reduce) vid.play().catch(() => {});
  }));
  $('#sbClose').addEventListener('click', () => box.close());
  box.addEventListener('click', e => { if (e.target === box) box.close(); });
  box.addEventListener('close', () => { vid.pause(); vid.removeAttribute('src'); vid.load(); });

  const menu = $('#menu'), btn = $('#menuBtn');
  btn.setAttribute('role', 'button'); btn.setAttribute('aria-controls', 'menu'); btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('keydown', e => { if (e.key === ' ') { e.preventDefault(); btn.click(); } });
  btn.addEventListener('click', e => { e.preventDefault(); menu.showModal(); btn.setAttribute('aria-expanded', 'true');
    try { if (!reduce && window.gsap) gsap.from($$('#menu nav a'), { yPercent: 40, opacity: 0, duration: .7, ease: 'expo.out', stagger: .06 }); } catch (err) { /* sheet still opens */ } });
  $('#menuClose').addEventListener('click', () => menu.close());
  menu.addEventListener('close', () => btn.setAttribute('aria-expanded', 'false'));
  $$('#menu nav a').forEach(a => a.addEventListener('click', () => menu.close()));
}
try { initDialogs(); } catch (e) { console.warn('XR Pixels v2: dialogs not upgraded, links still work.', e); }

function fail(err) {
  dead = true;
  console.warn('XR Pixels v2: enhancement disabled, static page kept.', err);
  const html = document.documentElement; ENH.forEach(c => html.classList.remove(c));
  try { if (mmRef) mmRef.revert(); if (ctx) ctx.revert(); } catch (e) { /* revert is best effort */ }
  if (window.ScrollTrigger) ScrollTrigger.getAll().forEach(t => t.kill(true));
  const hero = document.getElementById('hero'), rv = document.querySelector('.reveal');
  if (rv && rv.parentElement !== hero) hero.appendChild(rv);
  document.querySelectorAll('.h span, .hero-cta, .meta, .matrix, .reveal, .reveal img, .track, .pframe, .pframe img, .giant li, .w')
    .forEach(el => el.removeAttribute('style'));
  const top = document.getElementById('top'); top.classList.remove('compact'); top.dataset.theme = 'dark';
  document.getElementById('work').classList.remove('is-h');
}
function boot() {
  try {
    if (window.gsap) { ctx = gsap.context(() => {}); ctx.add(xrMain); } else xrMain();
  } catch (e) { fail(e); }
}
// Runs after the first paint: the headline (LCP) never waits on WebGL or ScrollTrigger setup.
requestAnimationFrame(() => setTimeout(boot, 0));

/* Contact form, unchanged from the live site: posts to the Cloudflare Worker that mails marketing@xrpixels.com
   and aldo@uxconstellation.com (xrpixels.win/api/contact). */
(function () {
  var ENDPOINT = 'https://xrpixels.win/api/contact';
  var form = document.getElementById('contactForm');
  if (!form) return;
  form.noValidate = true; // JS shows its own messages; without JS the browser enforces the required fields
  var status = document.getElementById('contactStatus');
  var button = document.getElementById('contactSend');
  function say(msg, kind) { status.textContent = msg; status.className = 'form-status' + (kind ? ' ' + kind : ''); }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = new FormData(form);
    var name = (data.get('name') || '').trim();
    var email = (data.get('email') || '').trim();
    var phone = (data.get('phone') || '').trim();
    if (!name || !email || !phone) return say('Please add your name, e-mail and phone number.', 'bad');
    if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) return say('That e-mail address does not look right.', 'bad');
    button.disabled = true;
    say('Sending…');
    // ponytail: one 15 s cap; a stalled connection falls through to the email fallback instead of spinning forever
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = ctl && setTimeout(function () { ctl.abort(); }, 15000);
    fetch(ENDPOINT, { method: 'POST', body: data, signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
      .then(function (r) {
        if (r && r.ok) { form.reset(); say('Thank you. We will be in touch shortly.', 'ok'); }
        else say((r && r.error) || 'Could not send just now. Please email marketing@xrpixels.com.', 'bad');
      })
      .catch(function () { say('Could not reach us just now. Please email marketing@xrpixels.com.', 'bad'); })
      .then(function () { clearTimeout(timer); button.disabled = false; });
  });
})();
