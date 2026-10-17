// Hero intro, "del trazo al contacto" (06-roteiros/ANIMACAO.md, 07-integracao/timeline.json):
//   0-1.4 s   the tyre outline draws in graphite, the pencil study fades in
//   1.4-3.6 s a red scan sweeps left to right and the clip behind it reveals rubber and metal
//   3.6-4.8 s the lines lose presence, the scan fades, the photograph stays
// The markup's default is the final frame; motion layers only load when the intro runs.
// ?t=<ms> freezes the timeline (QA captures), ?static skips it.
import lines from './hero-lines.json';

const DUR = 4800;
const NS = 'http://www.w3.org/2000/svg';
// wipe from just left of the paper layer's soft edge to past the tyre's right edge (% of art)
const WIPE_FROM = 52;
const WIPE_TO = 93.5;

export function initHero() {
  const root = document.documentElement;
  const hero = document.querySelector('.hero');
  const art = hero.querySelector('.hero-art');
  const plate = hero.querySelector('.hero-plate');
  const paper = hero.querySelector('.hero-paper');
  const sketch = hero.querySelector('.hero-sketch');
  const svg = hero.querySelector('.hero-lines');
  const track = hero.querySelector('.scan-track');
  const scan = hero.querySelector('.scan');
  const controls = hero.querySelector('.motion-controls');
  const [btnReplay, btnPause, btnDiagram] = ['replay', 'pause', 'diagram'].map((a) => controls.querySelector(`[data-act="${a}"]`));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const params = new URLSearchParams(location.search);
  const intro = root.classList.contains('intro');

  // sketch crop sits on the plate grid
  const [sx0, sy0, sx1, sy1] = lines.sketch_box_x4;
  const [PW, PH] = lines.plate_x4;
  Object.assign(sketch.style, {
    left: (100 * sx0) / PW + '%', top: (100 * sy0) / PH + '%',
    width: (100 * (sx1 - sx0)) / PW + '%', height: (100 * (sy1 - sy0)) / PH + '%',
  });
  const paths = ['silhouette', 'rim', 'hub'].map((k) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', lines.paths[k]);
    p.setAttribute('pathLength', '1');
    svg.appendChild(p);
    return p;
  });

  let anims = [];
  let ready = false;

  const clearIntro = () => {
    clearTimeout(window.__introFailsafe);
    root.classList.remove('intro');
  };

  function build() {
    anims.forEach((a) => a.cancel());
    const o = (ms) => ms / DUR;
    const opts = { duration: DUR, fill: 'both' };
    const inset = (p) => `inset(0 ${100 - p}% 0 0)`;
    anims = [
      plate.animate([
        { offset: 0, clipPath: inset(WIPE_FROM) },
        { offset: o(1400), clipPath: inset(WIPE_FROM), easing: 'cubic-bezier(.45,0,.3,1)' },
        { offset: o(3600), clipPath: inset(WIPE_TO) },
        { offset: o(3620), clipPath: inset(100) },
        { offset: 1, clipPath: inset(100) },
      ], opts),
      track.animate([
        { offset: 0, transform: `translateX(${WIPE_FROM}%)` },
        { offset: o(1400), transform: `translateX(${WIPE_FROM}%)`, easing: 'cubic-bezier(.45,0,.3,1)' },
        { offset: o(3600), transform: `translateX(${WIPE_TO}%)` },
        { offset: 1, transform: `translateX(${WIPE_TO}%)` },
      ], opts),
      scan.animate([
        { offset: 0, opacity: 0 }, { offset: o(1300), opacity: 0 }, { offset: o(1450), opacity: 1 },
        { offset: o(3600), opacity: 1 }, { offset: o(3950), opacity: 0 }, { offset: 1, opacity: 0 },
      ], opts),
      sketch.animate([
        { offset: 0, opacity: 0 }, { offset: o(300), opacity: 0 }, { offset: o(1400), opacity: 0.9 },
        { offset: o(3600), opacity: 0.9 }, { offset: 1, opacity: 0 },
      ], opts),
      svg.animate([
        { offset: 0, opacity: 1 }, { offset: o(3600), opacity: 1 }, { offset: o(4500), opacity: 0 }, { offset: 1, opacity: 0 },
      ], opts),
      ...paths.map((p, i) => p.animate([
        { offset: 0, strokeDashoffset: 1 },
        { offset: o(i * 220), strokeDashoffset: 1, easing: 'cubic-bezier(.5,0,.3,1)' },
        { offset: o(1150 + i * 120), strokeDashoffset: 0 },
        { offset: 1, strokeDashoffset: 0 },
      ], opts)),
    ];
    anims[0].onfinish = () => {
      if (hero.classList.contains('diagram')) return;
      btnPause.disabled = true;
      btnPause.textContent = 'Animación finalizada';
      btnPause.setAttribute('aria-pressed', 'false');
    };
  }

  function resetControls() {
    hero.classList.remove('diagram');
    btnPause.disabled = false;
    btnPause.textContent = 'Pausar';
    btnPause.setAttribute('aria-pressed', 'false');
    btnDiagram.textContent = 'Ver esquema';
    btnDiagram.setAttribute('aria-pressed', 'false');
  }

  function play() {
    resetControls();
    build();
    const t = params.get('t');
    if (t !== null) {
      anims.forEach((a) => { a.pause(); a.currentTime = Math.max(0, Math.min(DUR, +t)); });
      btnPause.textContent = 'Continuar';
      btnPause.setAttribute('aria-pressed', 'true');
    }
  }

  function finalFrame() {
    anims.forEach((a) => a.cancel());
    anims = [];
    root.classList.remove('motion-ready');
  }

  btnReplay.addEventListener('click', () => { if (ready && !reduced.matches) play(); });
  btnPause.addEventListener('click', () => {
    if (btnPause.disabled || !anims.length) return;
    const paused = anims[0].playState === 'paused';
    anims.forEach((a) => (paused ? a.play() : a.pause()));
    btnPause.textContent = paused ? 'Pausar' : 'Continuar';
    btnPause.setAttribute('aria-pressed', String(!paused));
  });
  btnDiagram.addEventListener('click', () => {
    if (!ready) return;
    const on = !hero.classList.contains('diagram');
    anims.forEach((a) => a.finish());
    hero.classList.toggle('diagram', on);
    btnDiagram.textContent = on ? 'Ver fotografía' : 'Ver esquema';
    btnDiagram.setAttribute('aria-pressed', String(on));
    btnPause.disabled = true;
    btnPause.textContent = on ? 'Vista estática' : 'Animación finalizada';
    btnPause.setAttribute('aria-pressed', 'false');
  });

  const decode = (img) => (img.decode ? img.decode() : new Promise((ok, no) => {
    if (img.complete) return img.naturalWidth ? ok() : no();
    img.addEventListener('load', ok, { once: true });
    img.addEventListener('error', no, { once: true });
  }));

  function start() {
    if (reduced.matches) { clearIntro(); return; }
    const sizes = getComputedStyle(art).width;
    for (const img of [paper, sketch]) {
      img.sizes = sizes;
      img.srcset = img.dataset.srcset;
    }
    const plateImg = plate.querySelector('img');
    Promise.all([plateImg, paper, sketch].map(decode)).then(() => {
      ready = true;
      root.classList.add('motion-ready');
      controls.hidden = false;
      if (intro && root.classList.contains('intro')) play();
      else { anims.forEach((a) => a.finish()); }
      clearIntro();
    }).catch(() => {
      ready = false;
      finalFrame();
      controls.hidden = true;
      clearIntro();
    });
  }

  reduced.addEventListener?.('change', () => {
    if (reduced.matches) { finalFrame(); controls.hidden = true; resetControls(); }
    else if (ready) { root.classList.add('motion-ready'); controls.hidden = false; }
  });

  if (params.has('static')) { clearIntro(); return; }
  start();
}
