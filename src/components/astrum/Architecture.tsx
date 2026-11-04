import { useEffect, useRef, useState } from "react";
import { astrum, type ArchId } from "../../data/astrum";
import { usePrefersReducedMotion } from "../../lib/hooks";
import { archHighlight } from "./highlight";

/*
 * ASTRUM's architecture as an interactive diagram: the state server with its flight models and
 * geodesy, the one Zenoh bus, and every client. Hover or focus a part for what it does; project
 * cards light up the parts they build on.
 */

type Box = { x: number; y: number; w: number; h: number };
const LAYOUT: Record<ArchId, Box> = {
  env: { x: 20, y: 34, w: 150, h: 76 },
  sim: { x: 240, y: 14, w: 300, h: 168 },
  fdm: { x: 256, y: 92, w: 136, h: 70 },
  geo: { x: 400, y: 92, w: 124, h: 70 },
  ctltool: { x: 590, y: 34, w: 150, h: 76 },
  bus: { x: 20, y: 226, w: 720, h: 52 },
  ctl: { x: 20, y: 336, w: 220, h: 72 },
  bag: { x: 270, y: 336, w: 220, h: 72 },
  web: { x: 520, y: 336, w: 220, h: 72 },
};

/** Message routes: [from, to, label, in-process?]. */
const EDGES: [ArchId, ArchId, string, boolean?][] = [
  ["env", "sim", "PyO3", true],
  ["sim", "bus", "telemetry · events ↓   commands · control ↑"],
  ["ctltool", "bus", "pause · step"],
  ["bus", "ctl", "telemetry → commands"],
  ["bus", "bag", "every tick"],
  ["bus", "web", "live or replayed"],
];

function anchor(from: Box, to: Box): [number, number, number, number] {
  // Horizontal neighbours join side to side; everything else joins top to bottom.
  if (from.y + from.h < to.y || to.y + to.h < from.y) {
    const top = from.y < to.y ? from : to, bottom = top === from ? to : from;
    const x = Math.max(top.x, bottom.x) + (Math.min(top.x + top.w, bottom.x + bottom.w) - Math.max(top.x, bottom.x)) / 2;
    return top === from ? [x, from.y + from.h, x, to.y] : [x, from.y, x, to.y + to.h];
  }
  const left = from.x < to.x;
  return [left ? from.x + from.w : from.x, from.y + from.h / 2, left ? to.x : to.x + to.w, to.y + to.h / 2];
}

export function ArchitectureDiagram() {
  const [focus, setFocus] = useState<ArchId | null>(null);
  const [lit, setLit] = useState<ArchId[] | null>(null);
  useEffect(() => archHighlight.subscribe(setLit), []);
  const active = focus ? [focus] : lit;
  const on = (id: ArchId) => !active || active.includes(id) || (id === "sim" && active.some((a) => a === "fdm" || a === "geo"));
  const node = astrum.nodes.find((n) => n.id === (focus ?? "sim"))!;

  return (
    <figure className="arch">
      <svg viewBox="0 0 760 416" className="arch__svg" role="group" aria-label="ASTRUM architecture">
        {EDGES.map(([a, b, label, inProc]) => {
          const [x1, y1, x2, y2] = anchor(LAYOUT[a], LAYOUT[b]);
          const live = on(a) && on(b), vertical = x1 === x2, leftOf = vertical && x1 > 600;
          return (
            <g key={`${a}-${b}`} className={`arch__edge${live ? "" : " is-dim"}${inProc ? " arch__edge--inproc" : ""}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} />
              <text x={(x1 + x2) / 2 + (vertical ? (leftOf ? -8 : 8) : 0)} y={(y1 + y2) / 2 + (vertical ? 4 : -8)} textAnchor={vertical ? (leftOf ? "end" : "start") : "middle"}>
                {label}
              </text>
            </g>
          );
        })}
        {astrum.nodes.map((n) => {
          const b = LAYOUT[n.id], group = n.id === "sim";
          return (
            <g
              key={n.id}
              className={`arch__node arch__node--${n.id}${on(n.id) ? "" : " is-dim"}${focus === n.id ? " is-focus" : ""}`}
              tabIndex={0}
              role="button"
              aria-label={`${n.label}, ${n.sub}: ${n.blurb}`}
              onPointerEnter={() => setFocus(n.id)}
              onPointerLeave={() => setFocus(null)}
              onFocus={() => setFocus(n.id)}
              onBlur={() => setFocus(null)}
            >
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={6} />
              <text className="arch__label" x={b.x + 12} y={b.y + (group ? 24 : b.h > 60 ? 28 : 22)}>
                {n.label}
              </text>
              <text className="arch__sub" x={b.x + 12} y={b.y + (group ? 42 : b.h > 60 ? 48 : 40)}>
                {n.sub}
              </text>
              {n.id === "fdm" && (
                <text className="arch__sub" x={b.x + 12} y={b.y + 62}>
                  × per aircraft
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="arch__caption" aria-live="polite">
        <strong>{node.label}</strong> <span className="arch__caption-sub">{node.sub}</span>
        <span className="arch__caption-text">{node.blurb}</span>
      </figcaption>
    </figure>
  );
}

/** One sim tick as a stepper: a pulse walks the chained schedule; click a step to read it. */
export function TickStepper() {
  const reduced = usePrefersReducedMotion();
  const [step, setStep] = useState(0);
  const [held, setHeld] = useState(false);
  const ref = useRef<HTMLOListElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.4 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (reduced || held || !visible) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % astrum.tick.length), 1400);
    return () => window.clearInterval(id);
  }, [reduced, held, visible]);

  const cur = astrum.tick[step];
  return (
    <div className="tick">
      <ol ref={ref} className="tick__steps" aria-label="One sim tick, in order">
        {astrum.tick.map((s, i) => (
          <li key={s.name}>
            <button
              type="button"
              className={`tick__step${i === step ? " is-current" : ""}${i < step ? " is-done" : ""}`}
              aria-current={i === step ? "step" : undefined}
              onClick={() => {
                setStep(i);
                setHeld(true);
              }}
            >
              <span className="tick__n">{String(i + 1).padStart(2, "0")}</span>
              <code>{s.name}</code>
            </button>
          </li>
        ))}
      </ol>
      <p className="tick__what" aria-live="polite">
        <code>{cur.name}</code> {cur.what}
      </p>
      {held && !reduced && (
        <button type="button" className="btn btn--ghost tick__resume" onClick={() => setHeld(false)}>
          Resume the tick
        </button>
      )}
    </div>
  );
}
