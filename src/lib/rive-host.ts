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
    if (match !== undefined) prop.value = match;
    else prop.value = target;
  } catch {
    // non-fatal if contract evolves
  }
}

function randRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// ---------------------------------------------------------------------------
// Port of Baken's desktop GazeDirector heuristics (GazePlan + GazeDirectorConfig)
// Each mascot runs its own independent director with:
//   - Per-state weighted attention targets (AWAY, OWN, PEER, USER, CURSOR, WORK)
//   - Local proximity cursor interest + habituation (4s decay -> 0.3 floor, 12s restore)
//   - Eyes-lead / head-follows critically damped spring (lead 0.45s, omega 4.8, zeta 0.92)
//   - Eye-head compensation (0.6) & natural blink on large turns (>= 0.4)
// ---------------------------------------------------------------------------
type GazeTarget = 'AWAY' | 'OWN' | 'PEER' | 'USER' | 'CURSOR' | 'WORK';

interface GazeLook {
  target: GazeTarget;
  weight: number;
  dwell: [number, number];
}

const GAZE_PLANS: Record<string, GazeLook[]> = {
  idle: [
    { target: 'AWAY',   weight: 35, dwell: [3.0, 8.0] },
    { target: 'OWN',    weight: 25, dwell: [3.0, 7.0] },
    { target: 'PEER',   weight: 18, dwell: [2.0, 5.0] },
    { target: 'USER',   weight: 14, dwell: [1.5, 3.5] },
    { target: 'CURSOR', weight:  8, dwell: [1.4, 2.8] },
  ],
  thinking: [
    { target: 'WORK',   weight: 58, dwell: [3.0, 7.0] },
    { target: 'AWAY',   weight: 22, dwell: [3.0, 7.0] },
    { target: 'OWN',    weight: 15, dwell: [2.0, 5.0] },
    { target: 'PEER',   weight:  5, dwell: [1.5, 3.0] },
  ],
  working: [
    { target: 'WORK',   weight: 76, dwell: [3.0, 7.0] },
    { target: 'AWAY',   weight: 11, dwell: [2.0, 5.0] },
    { target: 'OWN',    weight:  8, dwell: [2.0, 5.0] },
    { target: 'PEER',   weight:  5, dwell: [1.5, 3.0] },
  ],
  speaking: [
    { target: 'WORK',   weight: 56, dwell: [2.5, 6.0] },
    { target: 'USER',   weight: 26, dwell: [1.5, 3.5] },
    { target: 'AWAY',   weight:  9, dwell: [1.5, 3.0] },
    { target: 'CURSOR', weight:  5, dwell: [1.0, 2.0] },
    { target: 'PEER',   weight:  4, dwell: [1.2, 2.4] },
  ],
};

// Constants matching GazeDirectorConfig.kt
const EYE_TAU = 0.32;
const HEAD_LEAD = 0.45;
const HEAD_COMMIT_DELTA = 0.15;
const SPRING_OMEGA = 4.8;
const SPRING_ZETA = 0.92;
const HEAD_X_SCALE = 0.85;
const HEAD_Y_SCALE = 0.70;
const EYE_HEAD_COMP = 0.60;
const BLINK_TURN_DELTA = 0.40;
const HABITUATION_DECAY = 4.0;
const HABITUATION_RESTORE = 12.0;
const CURSOR_INTEREST_FLOOR = 0.30;

interface GazeState {
  stateName: string;
  target: GazeTarget;
  aimX: number;
  aimY: number;
  eyeX: number;
  eyeY: number;
  headTargetX: number;
  headTargetY: number;
  headX: number;
  headY: number;
  headVx: number;
  headVy: number;
  headPendingX: number;
  headPendingY: number;
  headLeadTimer: number;
  dwellTimer: number;
  saccadeCooldown: number;
  cursorInterest: number;    // 0.3..1.0 habituation curve
  cursorNoticeDelay: number; // per-mascot reaction time so peers never snap in unison
  curiosityBias: number;     // individual personality (0.6..1.35)
  nearRadiusPx: number;      // individual personal-space radius (170..300px)
  hovered: boolean;
  lastPokeMs: number;
  pokeStreak: number;
}

interface ActiveMascot {
  canvas: HTMLCanvasElement;
  rive: Rive;
  vmi: any;
  talk: boolean;
  visible: boolean;
  gaze: GazeState;
}

interface ActiveMark {
  canvas: HTMLCanvasElement;
  rive: Rive;
  vmi: any;
  themeMode: string;
  visible: boolean;
}

function pickWeightedLook(stateName: string, cursorInterest: number, curiosityBias: number): GazeLook {
  const plan = GAZE_PLANS[stateName] || GAZE_PLANS.idle;
  let total = 0;
  const weights = plan.map((row) => {
    let w = row.weight;
    if (row.target === 'CURSOR') w *= cursorInterest * curiosityBias;
    if (row.target === 'PEER') w *= 0.85 + 0.3 * curiosityBias;
    total += w;
    return w;
  });
  let r = Math.random() * total;
  for (let i = 0; i < plan.length; i++) {
    r -= weights[i];
    if (r <= 0) return plan[i];
  }
  return plan[0];
}

function createGazeState(stateName: string): GazeState {
  // Initial pose is already off-axis / individualized so a lineup doesn't open staring straight ahead
  const initX = (Math.random() < 0.5 ? -1 : 1) * randRange(0.18, 0.55);
  const initY = randRange(-0.22, 0.12);
  return {
    stateName,
    target: stateName === 'working' || stateName === 'thinking' ? 'WORK' : 'AWAY',
    aimX: initX,
    aimY: initY,
    eyeX: initX,
    eyeY: initY,
    headTargetX: initX * 0.5,
    headTargetY: initY * 0.5,
    headX: initX * 0.5,
    headY: initY * 0.5,
    headVx: 0,
    headVy: 0,
    headPendingX: initX,
    headPendingY: initY,
    headLeadTimer: 0,
    dwellTimer: randRange(1.0, 4.2), // staggered initial dwell per mascot
    saccadeCooldown: 0,
    cursorInterest: randRange(0.75, 1.0),
    cursorNoticeDelay: randRange(0.28, 0.85),
    curiosityBias: randRange(0.60, 1.35),
    nearRadiusPx: randRange(180, 310),
    hovered: false,
    lastPokeMs: 0,
    pokeStreak: 0,
  };
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

  // Shared pointer telemetry (does NOT directly drive every mascot)
  const pointer = {
    x: -9999,
    y: -9999,
    active: false,
    lastMoveSec: -99,
    speed: 0,
  };

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

  // Fisher-Yates shuffle so visible mascots enter in an organic, non-mechanical order
  function shuffle<T>(arr: T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function computeTargetAim(m: ActiveMascot, target: GazeTarget): [number, number] {
    const r = m.canvas.getBoundingClientRect();
    const cx = r.left + r.width * 0.5;
    const cy = r.top + r.height * 0.5;

    if (target === 'USER') {
      return [randRange(-0.06, 0.06), randRange(-0.05, 0.05)];
    }
    if (target === 'OWN') {
      if (Math.random() < 0.65) {
        const side = Math.random() < 0.5 ? -1 : 1;
        return [side * randRange(0.20, 0.45), randRange(-0.24, 0.08)];
      }
      return [randRange(-0.08, 0.08), randRange(-0.08, 0.06)];
    }
    if (target === 'AWAY') {
      const side = Math.random() < 0.5 ? -1 : 1;
      return [side * randRange(0.45, 0.85), randRange(-0.32, 0.14)];
    }
    if (target === 'WORK') {
      // Thinking looks slightly up-right; working/speaking looks toward content (right / slightly down-right)
      if (m.gaze.stateName === 'thinking') {
        return [randRange(0.28, 0.68), randRange(-0.48, -0.14)];
      }
      return [randRange(0.32, 0.72), randRange(-0.10, 0.28)];
    }
    if (target === 'CURSOR' && pointer.active) {
      return [
        clamp((pointer.x - cx) / 280, -1, 1),
        clamp((pointer.y - cy) / 240, -1, 1),
      ];
    }
    if (target === 'PEER') {
      // Pick a nearby visible peer mascot or Baken mark in the same visual neighborhood
      const candidates: Array<{ x: number; y: number; dist: number }> = [];
      for (const other of mascots) {
        if (other === m || !other.visible) continue;
        const ob = other.canvas.getBoundingClientRect();
        const ox = ob.left + ob.width * 0.5;
        const oy = ob.top + ob.height * 0.5;
        const dist = Math.hypot(ox - cx, oy - cy);
        if (dist > 20 && dist < 480) candidates.push({ x: ox, y: oy, dist });
      }
      for (const mk of marks) {
        if (!mk.visible) continue;
        const ob = mk.canvas.getBoundingClientRect();
        const ox = ob.left + ob.width * 0.5;
        const oy = ob.top + ob.height * 0.5;
        const dist = Math.hypot(ox - cx, oy - cy);
        if (dist > 20 && dist < 360) candidates.push({ x: ox, y: oy, dist });
      }
      if (candidates.length > 0) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        return [
          clamp((pick.x - cx) / 220, -0.92, 0.92),
          clamp((pick.y - cy) / 220, -0.75, 0.75),
        ];
      }
      // Fallback to a gentle aside if no neighbor is nearby
      const side = Math.random() < 0.5 ? -1 : 1;
      return [side * randRange(0.40, 0.75), randRange(-0.15, 0.10)];
    }
    return [0, 0];
  }

  function assignAim(m: ActiveMascot, target: GazeTarget, ax: number, ay: number, dwellSec: number) {
    const g = m.gaze;
    const jump = Math.hypot(ax - g.aimX, ay - g.aimY);
    g.target = target;
    g.aimX = ax;
    g.aimY = ay;
    g.dwellTimer = dwellSec;
    g.saccadeCooldown = 1 / 1.5; // maxSaccadesPerSecond = 1.5

    // Eyes lead; head commits after HEAD_LEAD if change >= HEAD_COMMIT_DELTA
    if (Math.hypot(ax - g.headTargetX, ay - g.headTargetY) >= HEAD_COMMIT_DELTA) {
      g.headPendingX = ax;
      g.headPendingY = ay;
      g.headLeadTimer = HEAD_LEAD;
    }

    // Natural blink on big gaze shifts (blinkOnHeadTurn = 0.4)
    if (jump >= BLINK_TURN_DELTA && m.vmi) {
      try { m.vmi.trigger('blink')?.trigger(); } catch {}
    }
  }

  function mountMascot(canvas: HTMLCanvasElement, buf: ArrayBuffer) {
    const shape = canvas.dataset.shape || 'blob';
    const color = canvas.dataset.color || '#1E7BF0';
    const state = canvas.dataset.state || 'idle';
    const talk = canvas.dataset.talk === 'true';
    const interactive = canvas.dataset.interactive !== 'false';
    const rot = Number(canvas.dataset.rotation || '0');
    const gaze = createGazeState(state);

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
          // Seed initial individualized gaze so mascots don't all open dead-center
          if (!reduceMotionQuery.matches) {
            try {
              const lx = vmi.number('lookX'); if (lx) lx.value = gaze.eyeX;
              const ly = vmi.number('lookY'); if (ly) ly.value = gaze.eyeY;
              const tx = vmi.number('turnX'); if (tx) tx.value = gaze.headX * HEAD_X_SCALE;
              const ty = vmi.number('turnY'); if (ty) ty.value = gaze.headY * HEAD_Y_SCALE;
            } catch {}
          }
        }

        rive.play();
        requestAnimationFrame(() => canvas.classList.add('rive-ready'));

        const rec: ActiveMascot = { canvas, rive, vmi, talk, visible: true, gaze };
        mascots.push(rec);
        io?.observe(canvas);

        if (interactive && vmi) {
          const hit = canvas.parentElement || canvas;
          hit.addEventListener('pointerenter', () => {
            gaze.hovered = true;
            try { const h = vmi.boolean('hovered'); if (h) h.value = true; } catch {}
            // Direct hover always earns a polite look right at the user/pointer
            if (!reduceMotionQuery.matches) {
              assignAim(rec, 'USER', randRange(-0.08, 0.08), randRange(-0.06, 0.04), randRange(1.8, 3.2));
            }
          });
          hit.addEventListener('pointerleave', () => {
            gaze.hovered = false;
            try { const h = vmi.boolean('hovered'); if (h) h.value = false; } catch {}
          });
          hit.addEventListener('click', () => {
            const now = performance.now();
            if (now - gaze.lastPokeMs < 900) gaze.pokeStreak += 1;
            else gaze.pokeStreak = 1;
            gaze.lastPokeMs = now;

            try {
              if (gaze.pokeStreak >= 4) {
                gaze.pokeStreak = 0;
                vmi.trigger('dizzy')?.trigger();
              } else if (gaze.pokeStreak === 2 && !reduceMotionQuery.matches) {
                const tid = vmi.number('trickId');
                if (tid) tid.value = Math.floor(Math.random() * 4);
                const trick = vmi.trigger('trick');
                if (trick) trick.trigger();
                else vmi.trigger('poke')?.trigger();
              } else {
                vmi.trigger('poke')?.trigger();
              }
            } catch {}
          });
        }
      },
    });
  }

  function mountMark(canvas: HTMLCanvasElement, buf: ArrayBuffer) {
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
  }

  // Lazy-mount mascots as they approach the viewport, with randomized staggered entrances
  const mascotEls = Array.from(document.querySelectorAll<HTMLCanvasElement>('canvas[data-rive-mascot]'));
  const mountedMascots = new WeakSet<HTMLCanvasElement>();

  function scheduleMascotBatch(batch: HTMLCanvasElement[]) {
    const pending = batch.filter((c) => !mountedMascots.has(c));
    if (pending.length === 0) return;
    pending.forEach((c) => mountedMascots.add(c));

    fetchRivBuffer('/rive/mascot.riv')
      .then((buf) => {
        const order = reduceMotionQuery.matches ? pending : shuffle(pending);
        const maxSpread = Math.min(720, order.length * 135);
        const step = order.length > 1 ? maxSpread / (order.length - 1) : 0;
        order.forEach((canvas, idx) => {
          const jitter = Math.round((Math.random() - 0.5) * Math.min(70, step * 0.6));
          const wait = reduceMotionQuery.matches
            ? 0
            : Math.max(40, Math.round(60 + idx * step + jitter));
          if (wait === 0 && idx === 0) {
            mountMascot(canvas, buf);
          } else {
            window.setTimeout(() => mountMascot(canvas, buf), wait);
          }
        });
      })
      .catch((err) => console.error('mascot.riv load error:', err));
  }

  if (mascotEls.length > 0) {
    if ('IntersectionObserver' in window) {
      const lazyMascotIo = new IntersectionObserver(
        (entries) => {
          const entering: HTMLCanvasElement[] = [];
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const el = entry.target as HTMLCanvasElement;
            lazyMascotIo.unobserve(el);
            entering.push(el);
          }
          if (entering.length > 0) scheduleMascotBatch(entering);
        },
        { rootMargin: '160px 0px', threshold: 0.01 }
      );
      mascotEls.forEach((c) => lazyMascotIo.observe(c));
    } else {
      scheduleMascotBatch(mascotEls);
    }
  }

  // Mount baken_mark.riv instances (boot mark immediately; off-screen marks lazily on approach)
  const markEls = Array.from(document.querySelectorAll<HTMLCanvasElement>('canvas[data-rive-mark]'));
  const mountedMarks = new WeakSet<HTMLCanvasElement>();

  function mountMarkSoon(canvas: HTMLCanvasElement) {
    if (mountedMarks.has(canvas)) return;
    mountedMarks.add(canvas);
    fetchRivBuffer('/rive/baken_mark.riv')
      .then((buf) => mountMark(canvas, buf))
      .catch((err) => console.error('baken_mark.riv load error:', err));
  }

  if (markEls.length > 0) {
    const eagerMarks = markEls.filter((c) => c.dataset.boot === 'true');
    const lazyMarks = markEls.filter((c) => c.dataset.boot !== 'true');
    eagerMarks.forEach(mountMarkSoon);

    if (lazyMarks.length > 0) {
      if ('IntersectionObserver' in window) {
        const lazyMarkIo = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              const el = entry.target as HTMLCanvasElement;
              lazyMarkIo.unobserve(el);
              mountMarkSoon(el);
            }
          },
          { rootMargin: '180px 0px', threshold: 0.01 }
        );
        lazyMarks.forEach((c) => lazyMarkIo.observe(c));
      } else {
        lazyMarks.forEach(mountMarkSoon);
      }
    }
  }

  // Record pointer position & velocity passively; each mascot's GazeDirector decides independently
  // whether it even notices the cursor (proximity, state, habituation, and individual reaction delay).
  if (!reduceMotionQuery.matches) {
    window.addEventListener(
      'pointermove',
      (e) => {
        const nowSec = performance.now() * 0.001;
        const dt = Math.max(0.016, nowSec - pointer.lastMoveSec);
        if (pointer.active) {
          pointer.speed = Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) / dt;
        }
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        pointer.active = true;
        pointer.lastMoveSec = nowSec;
      },
      { passive: true }
    );
    window.addEventListener('pointerleave', () => {
      pointer.active = false;
      pointer.speed = 0;
    });

    let lastSec = performance.now() * 0.001;

    const tick = (nowMs: number) => {
      const nowSec = nowMs * 0.001;
      const dt = clamp(nowSec - lastSec, 0.005, 0.10);
      lastSec = nowSec;
      const cursorMovingRecently = pointer.active && (nowSec - pointer.lastMoveSec < 0.6);

      for (const m of mascots) {
        if (!m.visible || !m.vmi) continue;
        const g = m.gaze;

        // 1. Speech cadence for Voice card mascot
        if (m.talk) {
          const amp = clamp(
            0.35 + 0.35 * Math.sin(nowSec * 7.4) + 0.22 * Math.sin(nowSec * 13.1 + 1.1) + 0.14 * Math.cos(nowSec * 3.2),
            0,
            1
          );
          try { const mo = m.vmi.number('mouthOpen'); if (mo) mo.value = amp; } catch {}
        }

        // 2. Proximity & habituation update
        const rect = m.canvas.getBoundingClientRect();
        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.5;
        const distPx = pointer.active ? Math.hypot(pointer.x - cx, pointer.y - cy) : 9999;
        const cursorNear = distPx < g.nearRadiusPx;

        if (g.target === 'CURSOR' || g.hovered) {
          g.cursorInterest = Math.max(
            CURSOR_INTEREST_FLOOR,
            g.cursorInterest - ((1 - CURSOR_INTEREST_FLOOR) / HABITUATION_DECAY) * dt
          );
        } else {
          g.cursorInterest = Math.min(
            1,
            g.cursorInterest + ((1 - CURSOR_INTEREST_FLOOR) / HABITUATION_RESTORE) * dt
          );
        }

        g.saccadeCooldown = Math.max(0, g.saccadeCooldown - dt);
        g.dwellTimer -= dt;

        // 3. Opportunistic cursor glance: only if cursor moved nearby, mascot isn't busy working/thinking,
        //    hasn't habituated, and passes its own curiosity roll
        const busyState = g.stateName === 'working' || g.stateName === 'thinking';
        if (
          cursorMovingRecently &&
          cursorNear &&
          !g.hovered &&
          g.target !== 'CURSOR' &&
          g.saccadeCooldown <= 0 &&
          (!busyState || distPx < 110)
        ) {
          const proximity = 1 - distPx / g.nearRadiusPx;
          // Rate-independent probability per frame so different mascots glance at different moments (or ignore it)
          const glanceProb = proximity * g.cursorInterest * g.curiosityBias * (busyState ? 0.35 : 1.4) * dt;
          if (Math.random() < glanceProb) {
            const [ax, ay] = computeTargetAim(m, 'CURSOR');
            assignAim(m, 'CURSOR', ax, ay, randRange(1.0, 2.4));
          }
        }

        // If currently tracking cursor, update aim gently while cursor stays near & interesting
        if (g.target === 'CURSOR' && pointer.active && cursorNear && g.cursorInterest > CURSOR_INTEREST_FLOOR + 0.05) {
          const [ax, ay] = computeTargetAim(m, 'CURSOR');
          g.aimX += (ax - g.aimX) * Math.min(1, dt * 4.5);
          g.aimY += (ay - g.aimY) * Math.min(1, dt * 4.5);
          if (Math.hypot(g.aimX - g.headTargetX, g.aimY - g.headTargetY) >= HEAD_COMMIT_DELTA) {
            g.headPendingX = g.aimX;
            g.headPendingY = g.aimY;
            if (g.headLeadTimer <= 0) g.headLeadTimer = HEAD_LEAD * 0.65;
          }
        }

        // 4. Independent dwell expiry -> pick next justified target from GazePlan
        if (g.dwellTimer <= 0 && !g.hovered && g.saccadeCooldown <= 0) {
          const look = pickWeightedLook(g.stateName, g.cursorInterest, g.curiosityBias);
          let target = look.target;
          // Only actually look at CURSOR if it's currently inside the window and reasonably nearby
          if (target === 'CURSOR' && (!pointer.active || distPx > g.nearRadiusPx * 1.5)) {
            target = Math.random() < 0.55 ? 'PEER' : 'AWAY';
          }
          const [ax, ay] = computeTargetAim(m, target);
          assignAim(m, target, ax, ay, randRange(look.dwell[0], look.dwell[1]));
        }

        // 5. Eyes lead (exponential smoothing, tau = 0.32s)
        const eyeAlpha = 1 - Math.exp(-dt / EYE_TAU);
        g.eyeX += (g.aimX - g.eyeX) * eyeAlpha;
        g.eyeY += (g.aimY - g.eyeY) * eyeAlpha;

        // 6. Head lags behind eyes (HEAD_LEAD = 0.45s), then settles on a critically damped spring
        if (g.headLeadTimer > 0) {
          g.headLeadTimer -= dt;
          if (g.headLeadTimer <= 0) {
            g.headTargetX = g.headPendingX;
            g.headTargetY = g.headPendingY;
          }
        }

        const w2 = SPRING_OMEGA * SPRING_OMEGA;
        const c2 = 2 * SPRING_ZETA * SPRING_OMEGA;
        const axSpring = w2 * (g.headTargetX - g.headX) - c2 * g.headVx;
        const aySpring = w2 * (g.headTargetY - g.headY) - c2 * g.headVy;
        g.headVx += axSpring * dt;
        g.headVy += aySpring * dt;
        g.headX += g.headVx * dt;
        g.headY += g.headVy * dt;

        // 7. Apply eye-head compensation (0.6) so eyes hold the target smoothly as the head turns
        const outTurnX = clamp(g.headX * HEAD_X_SCALE, -1, 1);
        const outTurnY = clamp(g.headY * HEAD_Y_SCALE, -1, 1);
        const outLookX = clamp(g.eyeX - g.headX * EYE_HEAD_COMP * 0.5, -1, 1);
        const outLookY = clamp(g.eyeY - g.headY * EYE_HEAD_COMP * 0.5, -1, 1);

        try {
          const lx = m.vmi.number('lookX'); if (lx) lx.value = outLookX;
          const ly = m.vmi.number('lookY'); if (ly) ly.value = outLookY;
          const tx = m.vmi.number('turnX'); if (tx) tx.value = outTurnX;
          const ty = m.vmi.number('turnY'); if (ty) ty.value = outTurnY;
        } catch {}
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
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
