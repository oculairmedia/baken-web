import { Rive, Layout, Fit, Alignment, RuntimeLoader } from '@rive-app/canvas';

let wasmConfigured = false;
const bufferCache = new Map<string, Promise<ArrayBuffer>>();

function ensureWasm() {
  if (wasmConfigured) return;
  wasmConfigured = true;
  RuntimeLoader.setWasmUrl('/rive/rive.wasm');
}

function fetchRivBuffer(url: string): Promise<ArrayBuffer> {
  let p = bufferCache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Failed to fetch ${url}: ${r.status}`);
      return r.arrayBuffer();
    });
    bufferCache.set(url, p);
  }
  return p;
}

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.padEnd(6, '0').slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function setEnumCaseInsensitive(vmi: any, propName: string, target: string) {
  try {
    const prop = vmi?.enum?.(propName);
    if (!prop) return;
    const vals: string[] = Array.isArray(prop.values) ? prop.values : [];
    const match = vals.find((v) => v.toLowerCase() === target.toLowerCase());
    if (match !== undefined) {
      prop.value = match;
    } else {
      prop.value = target;
    }
  } catch {
    // non-fatal if contract evolves
  }
}

interface ActiveMascot {
  canvas: HTMLCanvasElement;
  rive: Rive;
  vmi: any;
  talk: boolean;
  visible: boolean;
}

interface ActiveMark {
  canvas: HTMLCanvasElement;
  rive: Rive;
  vmi: any;
  themeMode: string;
  visible: boolean;
}

export function initRiveHost() {
  if (typeof window === 'undefined') return;
  if ((window as any).__bakenRiveInitialized) return;
  (window as any).__bakenRiveInitialized = true;

  ensureWasm();

  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const darkSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const mascots: ActiveMascot[] = [];
  const marks: ActiveMark[] = [];

  // Shared IntersectionObserver to pause off-screen canvases cleanly
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const el = entry.target as HTMLCanvasElement;
            const m = mascots.find((x) => x.canvas === el);
            if (m) {
              m.visible = entry.isIntersecting;
              if (entry.isIntersecting) m.rive.play();
              else m.rive.pause();
            }
            const mk = marks.find((x) => x.canvas === el);
            if (mk) {
              mk.visible = entry.isIntersecting;
              if (entry.isIntersecting) mk.rive.play();
              else mk.rive.pause();
            }
          }
        },
        { rootMargin: '80px 0px', threshold: 0.01 }
      )
    : null;

  // Mount every real mascot.riv instance
  const mascotEls = Array.from(document.querySelectorAll<HTMLCanvasElement>('canvas[data-rive-mascot]'));
  if (mascotEls.length > 0) {
    fetchRivBuffer('/rive/mascot.riv')
      .then((buf) => {
        mascotEls.forEach((canvas) => {
          const shape = canvas.dataset.shape || 'blob';
          const color = canvas.dataset.color || '#1E7BF0';
          const state = canvas.dataset.state || 'idle';
          const talk = canvas.dataset.talk === 'true';
          const interactive = canvas.dataset.interactive !== 'false';
          const rot = Number(canvas.dataset.rotation || '0');

          const rive = new Rive({
            buffer: buf.slice(0),
            canvas,
            artboard: 'Mascot',
            stateMachine: 'Avatar',
            autoplay: false,
            autoBind: true,
            layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
            onLoad: () => {
              rive.resizeDrawingSurfaceToCanvas();
              const vmi = rive.viewModelInstance;
              if (vmi) {
                setEnumCaseInsensitive(vmi, 'shape', shape);
                setEnumCaseInsensitive(vmi, 'state', state);

                const [r, g, b] = parseHexRgb(color);
                try { vmi.color('color')?.rgb(r, g, b); } catch {}
                try {
                  const rm = vmi.boolean('reduceMotion');
                  if (rm) rm.value = reduceMotionQuery.matches;
                } catch {}
                if (rot) {
                  try {
                    const sr = vmi.number('shapeRotation');
                    if (sr) sr.value = rot;
                  } catch {}
                }
              }

              rive.play();
              const rec: ActiveMascot = { canvas, rive, vmi, talk, visible: true };
              mascots.push(rec);
              io?.observe(canvas);

              if (interactive && vmi) {
                const hit = canvas.parentElement || canvas;
                hit.addEventListener('pointerenter', () => {
                  try { const h = vmi.boolean('hovered'); if (h) h.value = true; } catch {}
                });
                hit.addEventListener('pointerleave', () => {
                  try { const h = vmi.boolean('hovered'); if (h) h.value = false; } catch {}
                });
                hit.addEventListener('click', () => {
                  try {
                    const poke = vmi.trigger('poke');
                    if (poke) poke.trigger();
                  } catch {}
                });
              }
            },
          });
        });
      })
      .catch((err) => console.error('mascot.riv load error:', err));
  }

  // Mount every real baken_mark.riv instance
  const markEls = Array.from(document.querySelectorAll<HTMLCanvasElement>('canvas[data-rive-mark]'));
  if (markEls.length > 0) {
    fetchRivBuffer('/rive/baken_mark.riv')
      .then((buf) => {
        markEls.forEach((canvas) => {
          const state = canvas.dataset.state || 'idle';
          const themeMode = canvas.dataset.theme || 'auto';
          const fireBoot = canvas.dataset.boot === 'true';

          const resolveTheme = () => {
            if (themeMode === 'dark' || themeMode === 'light' || themeMode === 'monoDark' || themeMode === 'monoLight') {
              return themeMode;
            }
            return darkSchemeQuery.matches ? 'dark' : 'light';
          };

          const rive = new Rive({
            buffer: buf.slice(0),
            canvas,
            artboard: 'BakenMark',
            stateMachine: 'BrandMark',
            autoplay: false,
            autoBind: true,
            layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
            onLoad: () => {
              rive.resizeDrawingSurfaceToCanvas();
              const vmi = rive.viewModelInstance;
              if (vmi) {
                setEnumCaseInsensitive(vmi, 'theme', resolveTheme());
                setEnumCaseInsensitive(vmi, 'state', state);
                try {
                  const rm = vmi.boolean('reduceMotion');
                  if (rm) rm.value = reduceMotionQuery.matches;
                } catch {}
                if (fireBoot && !reduceMotionQuery.matches) {
                  try { vmi.trigger('boot')?.trigger(); } catch {}
                }
              }

              rive.play();
              const rec: ActiveMark = { canvas, rive, vmi, themeMode, visible: true };
              marks.push(rec);
              io?.observe(canvas);

              const hit = canvas.parentElement || canvas;
              hit.addEventListener('pointerenter', () => {
                try { const h = vmi?.boolean('hovered'); if (h) h.value = true; } catch {}
              });
              hit.addEventListener('pointerleave', () => {
                try { const h = vmi?.boolean('hovered'); if (h) h.value = false; } catch {}
              });
              hit.addEventListener('click', () => {
                try { vmi?.trigger('success')?.trigger(); } catch {}
              });
            },
          });
        });
      })
      .catch((err) => console.error('baken_mark.riv load error:', err));
  }

  // Live pointer gaze + subtle head turn across all visible mascots
  if (!reduceMotionQuery.matches) {
    window.addEventListener(
      'pointermove',
      (e) => {
        for (const m of mascots) {
          if (!m.visible || !m.vmi) continue;
          const r = m.canvas.getBoundingClientRect();
          const cx = r.left + r.width * 0.5;
          const cy = r.top + r.height * 0.5;
          const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / 360));
          const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / 280));
          try {
            const lx = m.vmi.number('lookX');
            const ly = m.vmi.number('lookY');
            const tx = m.vmi.number('turnX');
            const ty = m.vmi.number('turnY');
            if (lx) lx.value = nx;
            if (ly) ly.value = ny;
            if (tx) tx.value = nx * 0.55;
            if (ty) ty.value = ny * 0.45;
          } catch {}
        }
      },
      { passive: true }
    );

    // Organic speech cadence for any mascot marked data-talk="true" (Voice card)
    const tickSpeech = (nowMs: number) => {
      const t = nowMs * 0.001;
      for (const m of mascots) {
        if (!m.talk || !m.visible || !m.vmi) continue;
        const amp = Math.max(0, Math.min(1,
          0.35 + 0.35 * Math.sin(t * 7.4) + 0.22 * Math.sin(t * 13.1 + 1.1) + 0.14 * Math.cos(t * 3.2)
        ));
        try {
          const mo = m.vmi.number('mouthOpen');
          if (mo) mo.value = amp;
        } catch {}
      }
      requestAnimationFrame(tickSpeech);
    };
    requestAnimationFrame(tickSpeech);
  }

  // Live OS color-scheme sync for auto-themed baken_mark.riv instances
  darkSchemeQuery.addEventListener('change', (ev) => {
    const theme = ev.matches ? 'dark' : 'light';
    for (const mk of marks) {
      if (mk.themeMode === 'auto' && mk.vmi) {
        setEnumCaseInsensitive(mk.vmi, 'theme', theme);
      }
    }
  });

  // Resize crispness
  window.addEventListener('resize', () => {
    for (const m of mascots) m.rive.resizeDrawingSurfaceToCanvas();
    for (const mk of marks) mk.rive.resizeDrawingSurfaceToCanvas();
  });
}
