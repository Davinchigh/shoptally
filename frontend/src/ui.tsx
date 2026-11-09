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

/** The ShopTally mark: a receipt with a tick on it. */
export function Mark() {
  return (
    <svg className="mark" width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--ink)" />
      <path d="M10 7h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z" fill="var(--accent)" />
      <path d="m12.5 15.5 2.5 2.5 4.6-5" fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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
