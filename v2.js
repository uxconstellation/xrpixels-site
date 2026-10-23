/* XR Pixels v2. One idea: 3D becomes pixel, pixel becomes light. Every effect is decoration; the page reads
   fully without this file (no-JS and prefers-reduced-motion give a static, complete page). */
// Progressive enhancement. The HTML/CSS page is complete on its own (static pixel mark, Premiere block, vector
// footer wordmark, normal scroll). Each enhancement class is added only after its own dependency initialised:
//   hero-gl (voxel mark rendered), hero-scroll (ScrollTrigger drives the 320vh hero), field-gl, wm-canvas.
// Init runs after first paint inside a GSAP context; any throw reverts it and removes every class (fail()).
const ENH = ['hero-gl', 'hero-scroll', 'field-gl', 'wm-canvas', 'hdr-live', 'reel-gl'];
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
  // Films preview only while a card is hovered or focused (no autoplaying loops: WCAG 2.2.2); the dialog has full controls.
  $$('.case').forEach(card => { const v = $('video', card); if (!v) return;
    const on = () => { if (!v.src) v.src = v.dataset.src; v.play().catch(() => {}); }, off = () => v.pause();
    card.addEventListener('pointerenter', on); card.addEventListener('focusin', on);
    card.addEventListener('pointerleave', off); card.addEventListener('focusout', off); });
}

/* ---------- 5b showreel: the mark breaks into voxels, becomes a hologram fan, and the fan plays the work ----------
   One scrubbed timeline over a sticky WebGL stage. Footage is drawn as light (additive, inside the fan disc, LED
   scan lines and spinning blades) and swaps behind a stepped pixel snap. Own try: a failure here drops reel-gl
   only and the static film grid stays. Videos load one ahead, play only while the stage is on screen. */
if (motion && T) try { (() => {
  const items = $$('.reel-list li'); if (!items.length) return;
  const canvas = $('#reelgl');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0x030305, 1);
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(35, 1, .1, 100), rig = new T.Group(); scene.add(rig);
  const UV = new T.Color('#9d8aff'), SUB = 6, N = MODS.length * SUB * SUB, S = 1.15, R = 3.3;
  const mark = [], ring = [], scat = [];
  MODS.forEach(([mx, my]) => { for (let j = 0; j < SUB; j++) for (let i = 0; i < SUB; i++) {
    const k = mark.length, a = k / N * Math.PI * 2, band = (hash(k, 1) - .5) * .22;
    mark.push(new T.Vector3((mx + (i + .5) / SUB - 3) * S, (-(my + (j + .5) / SUB) + 2.5) * S, 0));
    ring.push(new T.Vector3(Math.cos(a) * (R + .18 + band), Math.sin(a) * (R + .18 + band), (hash(k, 2) - .5) * .5));
    const u = hash(k, 3) * Math.PI * 2, v = Math.acos(2 * hash(k, 4) - 1), d = 9 + hash(k, 5) * 7;
    scat.push(new T.Vector3(Math.sin(v) * Math.cos(u) * d, Math.sin(v) * Math.sin(u) * d * .6, Math.cos(v) * d - 4));
  } });
  const vs = S / SUB * .86, vox = new T.InstancedMesh(new T.BoxGeometry(vs, vs, vs), new T.MeshStandardMaterial({ color: UV, emissive: UV, emissiveIntensity: .35, roughness: .4, metalness: .1 }), N);
  rig.add(vox); scene.add(new T.AmbientLight(0xffffff, .5));
  const key = new T.DirectionalLight(0xffffff, 1.6); key.position.set(3, 4, 8); scene.add(key);
  const blades = new T.Group(), bladeMat = new T.LineBasicMaterial({ color: UV, transparent: true, opacity: 0, blending: T.AdditiveBlending });
  for (let b = 0; b < 4; b++) { const a = b / 4 * Math.PI * 2; blades.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0)]), bladeMat)); }
  rig.add(blades);
  const clips = items.map(li => ({ src: './holo/' + li.dataset.clip, label: li.dataset.label, tag: li.dataset.tag, cap: li.dataset.cap }));
  const vids = clips.map(c => { const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none'; v.dataset.src = c.src + '.mp4'; return v; });
  const texs = vids.map(v => { return new T.VideoTexture(v); });
  const loader = new T.TextureLoader(), posters = clips.map(c => { return loader.load(c.src + '.jpg'); });
  const scr = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { map: { value: posters[0] }, uPix: { value: 90 }, uReveal: { value: 0 }, uTime: { value: 0 }, uSize: { value: new T.Vector2(1, 1) }, uR: { value: R } },
    vertexShader: 'varying vec2 vP; uniform vec2 uSize; void main(){ vP = (uv - .5) * uSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform sampler2D map; uniform float uPix, uReveal, uTime, uR; uniform vec2 uSize; varying vec2 vP;
      void main(){
        float r = length(vP); if (r > uR) discard;
        float cells = max(2., uR * 120. / uPix);
        vec2 q = (floor(vP / (2. * uR) * cells) + .5) / cells * (2. * uR);
        vec3 c = texture2D(map, q / uSize + .5).rgb;
        float ang = fract(atan(vP.y, vP.x) / 6.28318 + .25);
        float sweep = 1. - smoothstep(uReveal - .04, uReveal, ang);
        float scan = .86 + .14 * sin(vP.y * 90. - uTime * 30.);
        float spoke = .8 + .2 * smoothstep(0., .5, abs(fract(ang * 4. - uTime * 2.6) - .5));
        float edge = 1. - smoothstep(uR - .25, uR, r);
        float pass = exp(-pow((r - uR * (1. - fract(uTime * .35))) * 7., 2.)) * .08;
        gl_FragColor = vec4(c * 1.25 * scan * spoke * sweep * edge + vec3(.61, .54, 1.) * pass * sweep, 1.);
      }` });
  const screen = new T.Mesh(new T.PlaneGeometry(1, 1), scr); rig.add(screen);
  const fit = i => { const v = vids[i], im = posters[i].image, a = v.videoWidth ? v.videoWidth / v.videoHeight : im && im.width ? im.width / im.height : 16 / 9;
    const w = a >= 1 ? 2 * R * a : 2 * R, h = a >= 1 ? 2 * R : 2 * R / a; screen.scale.set(w, h, 1); scr.uniforms.uSize.value.set(w, h); };
  const load = i => { const v = vids[i]; if (v && !v.src) { v.src = v.dataset.src; v.load(); } };
  const st = { form: 0, fan: 0, clip: 0, out: 0 };
  let cur = -1, hudAt = -1, live = false, spin = 0;
  const show = i => { if (i === cur) return; vids.forEach((v, k) => k !== i && v.pause()); cur = i; load(i); load(i + 1);
    const v = vids[i]; scr.uniforms.map.value = v.readyState >= 2 ? texs[i] : posters[i];
    v.onloadeddata = () => { if (cur === i) { scr.uniforms.map.value = texs[i]; fit(i); } }; fit(i); };
  const hud = i => { const c = clips[i]; $('#reelN').textContent = String(i + 1).padStart(2, '0') + ' / ' + String(clips.length).padStart(2, '0');
    $('#reelTag').textContent = c.tag; $('#reelName').textContent = c.label; $('#reelCap').textContent = c.cap; };
  const tl = G.timeline({ defaults: { ease: 'none' } });
  tl.to(st, { form: 1, duration: 1, ease: 'power3.out' }).to({}, { duration: .5 })
    .to(st, { form: 2, duration: 1, ease: 'power3.inOut' }).to(st, { fan: 1, duration: .5 }, '<.4')
    .to(scr.uniforms.uReveal, { value: 1.04, duration: .7, ease: 'power2.inOut' })
    .to(scr.uniforms.uPix, { value: 1, duration: .5, ease: 'steps(6)' }, '<.2');
  clips.forEach((c, i) => { if (i) tl.to(scr.uniforms.uPix, { value: 70, duration: .25, ease: 'steps(5)' }).to(st, { clip: i, duration: .001 }).to(scr.uniforms.uPix, { value: 1, duration: .3, ease: 'steps(6)' }); tl.to({}, { duration: .9 }); });
  tl.to(scr.uniforms.uReveal, { value: 0, duration: .6, ease: 'power2.inOut' }).to(st, { fan: 0, duration: .4 }, '<.2').to(st, { form: 1, duration: .9, ease: 'power3.inOut' }, '<').to(st, { out: 1, duration: .4 });
  enh('reel-gl');
  const links = $$('.reel-list a'); links.forEach(a => a.tabIndex = -1);
  const stage = $('.reel-stage'); stage.removeAttribute('aria-hidden'); // controls are live only with the scene
  let held = false; const pauseBtn = $('#reelPause');
  let frozen = null; // what the paused frame shows; scroll keeps moving the timeline underneath
  pauseBtn.addEventListener('click', () => { held = !held; frozen = held ? { r: scr.uniforms.uReveal.value, p: scr.uniforms.uPix.value, m: scr.uniforms.map.value } : null; pauseBtn.setAttribute('aria-pressed', held); pauseBtn.textContent = held ? 'Play' : 'Pause'; if (held) vids.forEach(v => v.pause()); });
  $('#reelOpen').addEventListener('click', () => { held || pauseBtn.click(); links[Math.max(0, cur)].click(); });
  const reelST = ST.create({ trigger: '#reel', start: 'top top', end: 'bottom bottom', scrub: .8, animation: tl, onEnter: () => load(0), onEnterBack: () => load(0) });
  let lost = false; // a lost GPU context after init: drop back to the static film grid
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; vids.forEach(v => v.pause()); reelST.kill(); tl.kill();
    document.documentElement.classList.remove('reel-gl'); stage.setAttribute('aria-hidden', 'true'); links.forEach(a => a.removeAttribute('tabindex')); ST.refresh(); });
  let px = 0, py = 0;
  addEventListener('pointermove', e => { px = e.clientX / innerWidth - .5; py = e.clientY / innerHeight - .5; }, { passive: true });
  const draw = () => { const u = scr.uniforms, now = frozen && [u.uReveal.value, u.uPix.value, u.map.value];
    if (frozen) { u.uReveal.value = frozen.r; u.uPix.value = frozen.p; u.map.value = frozen.m; }
    renderer.render(scene, cam);
    if (now) [u.uReveal.value, u.uPix.value, u.map.value] = now; };
  const size = () => { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.position.z = Math.max(13.3, 13.3 / cam.aspect); cam.updateProjectionMatrix(); draw(); }; // fan disc (2R + rim) always fits width and height; setSize clears the canvas, so redraw (frozen state while paused)
  addEventListener('resize', size); size(); show(0);
  new IntersectionObserver(es => { live = es[0].isIntersecting; if (!live) vids.forEach(v => v.pause()); }).observe(canvas);
  const M = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), P = new T.Vector3(), SC = new T.Vector3(), hudEl = $('.reel-hud'), clock = new T.Clock(); let clockT = 0;
  (function frame() {
    if (dead || lost) return; requestAnimationFrame(frame); const dt = clock.getDelta(); if (!live || held) return;
    clockT += dt; const t = clockT, i = Math.round(st.clip), f = st.form;
    if (i !== cur) show(i);
    if (st.fan >= .5 && hudAt !== cur) { hudAt = cur; hud(cur); }
    const v = vids[cur]; if (st.fan > .5 && v.paused) v.play().catch(() => {}); else if (st.fan < .05 && !v.paused) v.pause();
    for (let k = 0; k < N; k++) {
      const A = f <= 1 ? scat[k] : mark[k], B = f <= 1 ? mark[k] : ring[k], u = f <= 1 ? f : f - 1;
      P.lerpVectors(A, B, clamp(u * 1.6 - hash(k, 6) * .6));
      if (f > 1) { const a = Math.atan2(P.y, P.x) + t * .25 * (f - 1), r = Math.hypot(P.x, P.y); P.set(Math.cos(a) * r, Math.sin(a) * r, P.z); }
      const tumble = (1 - Math.min(1, f)) * 3, s = f > 1 ? 1 - (f - 1) * .45 : 1;
      E.set(t * .7 * tumble + k, t * .5 * tumble, 0); Q.setFromEuler(E); SC.set(s, s, s); M.compose(P, Q, SC); vox.setMatrixAt(k, M);
    }
    vox.instanceMatrix.needsUpdate = true;
    spin += .9 * st.fan; blades.rotation.z = -spin; bladeMat.opacity = st.fan * .35 * (1 - Math.min(1, scr.uniforms.uReveal.value) * .7);
    scr.uniforms.uTime.value = t; screen.visible = scr.uniforms.uReveal.value > .001;
    rig.rotation.y += (px * .35 + (f > 1 ? Math.sin(t * .3) * .24 : 0) - rig.rotation.y) * .06;
    rig.rotation.x += (py * .2 - rig.rotation.x) * .06;
    rig.position.y = st.out * 1.7; rig.scale.setScalar(1 - st.out * .45); hudEl.style.opacity = 1 - st.out; hudEl.style.visibility = st.out > .95 ? 'hidden' : '';
    renderer.render(scene, cam);
  })();
})(); } catch (e) { // same fallback as context loss: static grid visible, every film tabbable again
  document.documentElement.classList.remove('reel-gl'); const sg = document.querySelector('.reel-stage'); if (sg) sg.setAttribute('aria-hidden', 'true');
  document.querySelectorAll('.reel-list a').forEach(a => a.removeAttribute('tabindex')); if (ST) ST.refresh(); console.warn('XR Pixels v2: showreel kept static.', e); }

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
  const sg = document.querySelector('.reel-stage'); if (sg) sg.setAttribute('aria-hidden', 'true');
  document.querySelectorAll('.reel-list a').forEach(a => a.removeAttribute('tabindex'));
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
