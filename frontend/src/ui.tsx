import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/* ---------- Icons: one authored set, one stroke weight ---------- */
const PATHS = {
  today: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  sell: "M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2M9.5 20h.01M17.5 20h.01",
  stock: "M12 3 3.5 7.5v9L12 21l8.5-4.5v-9zM3.8 7.7l8.2 4.4 8.2-4.4M12 12.1V21",
  reconcile: "M7 7h11l-3-3M17 17H6l3 3",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  tick: "m5 12.5 4.5 4.5L19 7.5",
  alert: "M12 4 2.8 19.5h18.4zM12 10v4.2M12 17.2v.1",
  low: "M12 3 3.5 7.5v9L12 21l8.5-4.5v-9zM12 9v4M12 16v.1",
  upload: "M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3",
  copy: "M9 3h6M6 6h12v15l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  out: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3",
};
export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

/** The ShopTally mark: four tally strokes and a slash. With `intro`, it is counted in and the name follows. */
export function Logo({ intro = false }: { intro?: boolean }) {
  return (
    <span className={`brand${intro ? " intro" : ""}`} aria-label="ShopTally">
      <span className="tally" aria-hidden="true">
        <svg viewBox="0 0 30 30">
          {[5, 10.5, 16, 21.5].map((x, n) => <line key={n} x1={x} y1={5} x2={x} y2={25} style={{ ["--n" as string]: n }} />)}
          <line className="slash" x1={2} y1={21} x2={27} y2={9} style={{ ["--n" as string]: 4 }} />
        </svg>
      </span>
      <span className="word" aria-hidden="true">
        {[..."ShopTally"].map((c, i) => <span key={i} style={{ ["--c" as string]: i }}>{c}</span>)}
      </span>
    </span>
  );
}

/** Play the logo intro once per browser session, not on every screen. */
export function useIntroOnce(key = "shoptally.intro") {
  const [play] = useState(() => {
    try { if (sessionStorage.getItem(key)) return false; sessionStorage.setItem(key, "1"); return true; } catch { return true; }
  });
  return play;
}

/**
 * Glass thumb that slides to the active option on a spring and stretches a little with speed.
 * Put <span className="thumb" /> as the first child of the container and pass the active index.
 */
export function useGlassThumb(active: number) {
  const ref = useRef<HTMLDivElement>(null);
  const st = useRef({ x: 0, w: 0, v: 0, raf: 0, ready: false });
  useLayoutEffect(() => {
    const box = ref.current;
    const thumb = box?.querySelector<HTMLElement>(":scope > .thumb");
    const items = box ? [...box.querySelectorAll<HTMLElement>(":scope > button")] : [];
    const target = items[active];
    if (!box || !thumb || !target) return;
    const s = st.current;
    const tx = target.offsetLeft, tw = target.offsetWidth;
    const set = (x: number, w: number, v: number) => {
      const stretch = 1 + Math.min(0.18, Math.abs(v) / 4500);
      const squash = 1 - Math.min(0.08, Math.abs(v) / 9000);
      thumb.style.width = `${w}px`;
      thumb.style.transform = `translateX(${x}px) scale(${stretch}, ${squash})`;
    };
    cancelAnimationFrame(s.raf);
    if (!s.ready || reduced()) { s.x = tx; s.w = tw; s.v = 0; s.ready = true; set(tx, tw, 0); return; }
    const k = (2 * Math.PI / 0.32) ** 2, c = (4 * Math.PI * 0.82) / 0.32;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.034, (now - last) / 1000); last = now;
      for (let i = 0; i < 6; i++) { const h = dt / 6; s.v += (-k * (s.x - tx) - c * s.v) * h; s.x += s.v * h; }
      s.w += (tw - s.w) * Math.min(1, dt * 18);
      if (Math.abs(s.v) < 2 && Math.abs(s.x - tx) < 0.5) { s.x = tx; s.w = tw; s.v = 0; set(tx, tw, 0); return; }
      set(s.x, s.w, s.v);
      s.raf = requestAnimationFrame(step);
    };
    s.raf = requestAnimationFrame(step);
  });
  useEffect(() => {
    const onResize = () => { st.current.ready = false; };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return ref;
}

/* ---------- Springs (damping ratio + response, as Apple describes them) ---------- */
type SpringState = { x: number; v: number; raf: number };
function runSpring(
  st: SpringState, to: number, opts: { response: number; damping: number },
  onUpdate: (x: number) => void, onDone?: () => void,
) {
  cancelAnimationFrame(st.raf);
  const k = ((2 * Math.PI) / opts.response) ** 2;
  const c = (4 * Math.PI * opts.damping) / opts.response;
  let last = performance.now();
  const step = (now: number) => {
    const dt = Math.min(0.034, (now - last) / 1000);
    last = now;
    for (let i = 0; i < 6; i++) {
      const h = dt / 6;
      st.v += (-k * (st.x - to) - c * st.v) * h;
      st.x += st.v * h;
    }
    if (Math.abs(st.v) < 1 && Math.abs(st.x - to) < 0.5) {
      st.x = to; st.v = 0; onUpdate(to); onDone?.();
      return;
    }
    onUpdate(st.x);
    st.raf = requestAnimationFrame(step);
  };
  st.raf = requestAnimationFrame(step);
}
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const project = (v: number, d = 0.998) => ((v / 1000) * d) / (1 - d);
const rubber = (o: number, dim: number, c = 0.55) => (o * dim * c) / (dim + c * Math.abs(o));

/**
 * Bottom sheet. Follows the finger 1:1, can be caught mid-motion, and a flick down
 * closes it using the release velocity.
 */
export function Sheet({ open, onClose, title, subtitle, children }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const st = useRef<SpringState>({ x: 0, v: 0, raf: 0 });
  const [mounted, setMounted] = useState(open);
  const height = useRef(0);

  const paint = useCallback((y: number) => {
    if (!sheet.current || !scrim.current) return;
    sheet.current.style.transform = `translate3d(0, ${Math.max(y, -40)}px, 0)`;
    scrim.current.style.opacity = String(Math.max(0, Math.min(1, 1 - y / Math.max(1, height.current))));
  }, []);

  useEffect(() => { if (open) setMounted(true); }, [open]);

  useLayoutEffect(() => {
    if (!mounted || !sheet.current) return;
    height.current = sheet.current.offsetHeight;
    const s = st.current;
    if (open) {
      if (s.raf === 0 && s.x === 0) s.x = height.current; // first open starts off screen
      if (reduced()) { s.x = 0; paint(0); return; }
      paint(s.x);
      runSpring(s, 0, { response: 0.36, damping: 1 }, paint);
      sheet.current.querySelector<HTMLElement>("button, input")?.focus({ preventScroll: true });
    } else {
      const done = () => { s.raf = 0; s.x = 0; setMounted(false); };
      if (reduced()) { done(); return; }
      runSpring(s, height.current, { response: 0.32, damping: 1 }, paint, done);
    }
  }, [open, mounted, paint]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const s = st.current;
    cancelAnimationFrame(s.raf); // catch it wherever it is
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const startY = s.x, startClient = e.clientY;
    const hist = [{ y: e.clientY, t: e.timeStamp }];
    const move = (ev: PointerEvent) => {
      hist.push({ y: ev.clientY, t: ev.timeStamp });
      if (hist.length > 6) hist.shift();
      const raw = startY + (ev.clientY - startClient);
      s.x = raw < 0 ? -rubber(-raw, height.current) : raw;
      paint(s.x);
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      const a = hist[0], b = hist[hist.length - 1];
      s.v = ((b.y - a.y) / Math.max(1, b.t - a.t)) * 1000;
      if (s.x + project(s.v) > height.current * 0.5) onClose();
      else runSpring(s, 0, { response: 0.3, damping: Math.abs(s.v) > 600 ? 0.8 : 1 }, paint);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }

  if (!mounted) return null;
  return (
    <>
      <div ref={scrim} className="scrim" onClick={onClose} />
      <div ref={sheet} className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grab" onPointerDown={onPointerDown}>
          <h2>{title}</h2>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>
  );
}

/* ---------- Toast: calm, short confirmations ---------- */
export function useToast() {
  const [msg, setMsg] = useState("");
  const [on, setOn] = useState(false);
  const timer = useRef<number>(0);
  const show = useCallback((text: string) => {
    setMsg(text);
    requestAnimationFrame(() => setOn(true));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOn(false), 2600);
  }, []);
  const node = <div className={`toast${on ? " on" : ""}`} role="status" aria-live="polite">{msg}</div>;
  return [node, show] as const;
}
