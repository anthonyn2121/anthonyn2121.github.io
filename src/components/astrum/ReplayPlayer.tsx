import { useEffect, useMemo, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../../lib/hooks";
import { useTheme } from "../../lib/theme";
import { loadAsset, sampleAt, themeColors, type Channel, type ReplayData } from "./data";

export interface Callout {
  t: number;
  label: string;
}

interface Props {
  src: string;
  caption: string;
  /** "top" looks down on the tracks (north up); "side" plots altitude against distance flown. */
  view?: "top" | "side";
  /** Flight-data rows under the track that scrub with it. */
  strips?: boolean;
  /** One label per aircraft, in file order. */
  labels?: string[];
  callouts?: (d: ReplayData) => Callout[];
  /** A shorter player for the mission card. */
  compact?: boolean;
}

/** A replay of an ASTRUM run: the tracks drawn as they're flown, with play, pause and scrub. */
export function ReplayPlayer(props: Props) {
  const [data, setData] = useState<ReplayData | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    loadAsset<ReplayData>(props.src).then((d) => live && setData(d), () => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [props.src]);

  return (
    <figure className={`replay${props.compact ? " replay--compact" : ""}`}>
      {data ? <Player {...props} data={data} /> : <div className="replay__loading">{failed ? "Replay unavailable." : "Loading replay…"}</div>}
      <figcaption className="replay__caption">{props.caption}</figcaption>
    </figure>
  );
}

const STRIPS: { ch: Channel; label: string; unit: string; scale: number; digits: number }[] = [
  { ch: "u", label: "Altitude", unit: "ft", scale: 3.28084, digits: 0 },
  { ch: "tas", label: "Airspeed", unit: "kt", scale: 1.94384, digits: 0 },
  { ch: "theta", label: "Pitch", unit: "°", scale: 180 / Math.PI, digits: 0 },
  { ch: "phi", label: "Roll", unit: "°", scale: 180 / Math.PI, digits: 0 },
  { ch: "nz", label: "Load", unit: "g", scale: 1, digits: 1 },
];
const STRIP_H = 36;
const HOLD_AT_END = 1.4;

function Player({ data, view = "top", strips, labels, callouts, compact, caption }: Props & { data: ReplayData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();
  const { theme } = useTheme();
  const [playing, setPlaying] = useState(false);
  const userPaused = useRef(false);
  const ids = useMemo(() => data.aircraft.map((a) => String(a.id)), [data]);
  const rows = useMemo(() => (strips ? STRIPS.filter((s) => data.tracks[ids[0]][s.ch]) : []), [strips, data, ids]);
  const tRef = useRef(reduced ? data.duration : 0);
  const marks = useMemo(() => callouts?.(data) ?? [], [callouts, data]);

  // Track coordinates in the chosen view, computed once.
  const paths = useMemo(() => {
    const first = data.tracks[ids[0]];
    const k = Math.min(10, data.t.length - 1);
    const dx = first.e![k] - first.e![0], dy = first.n![k] - first.n![0], len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    return ids.map((id) => {
      const tr = data.tracks[id];
      return tr.e!.map((e, i) =>
        view === "side" ? [(e - first.e![0]) * ux + (tr.n![i] - first.n![0]) * uy, tr.u![i]] : [e, tr.n![i]],
      ) as [number, number][];
    });
  }, [data, ids, view]);

  const draw = useMemo(() => {
    return () => {
      const c = canvasRef.current;
      if (!c) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1), W = c.clientWidth, H = c.clientHeight;
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
      }
      const g = c.getContext("2d")!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const col = themeColors(), t = tRef.current, [i, f] = sampleAt(data.t, t);
      const trackH = H - rows.length * STRIP_H - (rows.length ? 10 : 0);
      const palette = [col.select, col.route, col.route, col.route];

      // Fit every path into the track area with equal axes.
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of paths) for (const [x, y] of p) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
      const pad = 18, s = Math.min((W - pad * 2) / Math.max(1, x1 - x0), (trackH - pad * 2) / Math.max(1, y1 - y0));
      const ox = (W - (x1 - x0) * s) / 2, oy = (trackH - (y1 - y0) * s) / 2;
      const X = (x: number) => ox + (x - x0) * s, Y = (y: number) => trackH - (oy + (y - y0) * s);

      // Scale bar.
      const bar = niceLength(80 / s);
      g.strokeStyle = col.faint;
      g.fillStyle = col.faint;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(10, trackH - 10);
      g.lineTo(10 + bar * s, trackH - 10);
      g.stroke();
      g.font = "11px 'B612 Mono', ui-monospace, monospace";
      g.fillText(bar >= 1000 ? `${bar / 1000} km` : `${bar} m`, 10, trackH - 15);
      if (view === "side") {
        g.textAlign = "right";
        g.fillText("altitude ↑   distance →", W - 10, 14);
        g.textAlign = "left";
      }

      paths.forEach((p, a) => {
        g.lineWidth = 1;
        g.strokeStyle = col.strong;
        g.globalAlpha = 0.6;
        line(g, p, 0, p.length - 1, X, Y);
        g.globalAlpha = 1;
        g.lineWidth = 2;
        g.strokeStyle = palette[a] ?? col.route;
        line(g, p, 0, i, X, Y);
        // The aircraft: a small arrowhead along its direction of travel.
        const j = Math.min(p.length - 1, i + 1), px = p[i][0] + (p[j][0] - p[i][0]) * f, py = p[i][1] + (p[j][1] - p[i][1]) * f;
        const back = p[Math.max(0, i - 2)], dirx = X(p[j][0]) - X(back[0]), diry = Y(p[j][1]) - Y(back[1]), dl = Math.hypot(dirx, diry) || 1;
        arrow(g, X(px), Y(py), dirx / dl, diry / dl, palette[a] ?? col.route);
      });

      // Hits and the kill, at the target's position when they happened.
      for (const ev of data.events) {
        if (ev.t > t) break;
        const a = ids.indexOf(String(ev.id)), [k] = sampleAt(data.t, ev.t), [ex, ey] = paths[a][k];
        g.strokeStyle = col.caution;
        g.fillStyle = col.caution;
        if (ev.kind === "kill") {
          g.lineWidth = 2;
          g.beginPath();
          g.arc(X(ex), Y(ey), 9, 0, Math.PI * 2);
          g.stroke();
          g.font = "700 11px 'B612 Mono', ui-monospace, monospace";
          g.fillText("KILL", X(ex) + 12, Y(ey) - 8);
        } else {
          g.lineWidth = 1.5;
          cross(g, X(ex), Y(ey), 4);
        }
      }

      // Flight-data strips, sharing the time axis.
      rows.forEach((r, k) => {
        const top = trackH + 10 + k * STRIP_H, ser = data.tracks[ids[0]][r.ch]!, mid = top + STRIP_H / 2;
        let lo = Infinity, hi = -Infinity;
        for (const v of ser) (lo = Math.min(lo, v)), (hi = Math.max(hi, v));
        const span = hi - lo || 1, tx = (tt: number) => 96 + ((W - 160) * tt) / data.duration, ty = (v: number) => top + STRIP_H - 6 - ((v - lo) / span) * (STRIP_H - 12);
        g.strokeStyle = col.line;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(96, top + STRIP_H - 2);
        g.lineTo(W - 64, top + STRIP_H - 2);
        g.stroke();
        g.strokeStyle = col.dim;
        g.beginPath();
        ser.forEach((v, n) => (n ? g.lineTo(tx(data.t[n]), ty(v)) : g.moveTo(tx(data.t[n]), ty(v))));
        g.stroke();
        g.strokeStyle = col.select;
        g.lineWidth = 2;
        g.beginPath();
        for (let n = 0; n <= i; n++) (n ? g.lineTo : g.moveTo).call(g, tx(data.t[n]), ty(ser[n]));
        g.stroke();
        g.fillStyle = col.dim;
        g.font = "11px 'B612 Mono', ui-monospace, monospace";
        g.fillText(r.label, 0, mid + 4);
        const v = (ser[i] + ((ser[Math.min(ser.length - 1, i + 1)] ?? ser[i]) - ser[i]) * f) * r.scale;
        g.fillStyle = col.ink;
        g.fillText(`${v.toFixed(r.digits)} ${r.unit}`, W - 58, mid + 4);
      });
      if (rows.length) {
        const tx = (tt: number) => 96 + ((W - 160) * tt) / data.duration, top = trackH + 10, bottom = top + rows.length * STRIP_H;
        for (const m of marks) {
          g.strokeStyle = m.t <= t ? col.route : col.line;
          g.setLineDash([3, 3]);
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(tx(m.t), top);
          g.lineTo(tx(m.t), bottom);
          g.stroke();
          g.setLineDash([]);
        }
        g.strokeStyle = col.ink;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(tx(t), top);
        g.lineTo(tx(t), bottom);
        g.stroke();
      }

      if (scrubRef.current) scrubRef.current.value = String(t);
      if (timeRef.current) timeRef.current.textContent = `${t.toFixed(1)} / ${data.duration.toFixed(1)} s`;
    };
  }, [data, paths, rows, ids, marks, view]);

  // Redraw on theme change and resize.
  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, [draw, theme]);

  // Play when on screen (unless the visitor paused it or prefers reduced motion), loop with a short hold.
  useEffect(() => {
    if (reduced) return;
    const io = new IntersectionObserver(([e]) => setPlaying(e.isIntersecting && !userPaused.current), { threshold: 0.35 });
    if (canvasRef.current) io.observe(canvasRef.current);
    return () => io.disconnect();
  }, [reduced]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now(), held = 0;
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (tRef.current >= data.duration) {
        held += dt;
        if (held > HOLD_AT_END) (tRef.current = 0), (held = 0);
      } else tRef.current = Math.min(data.duration, tRef.current + dt);
      draw();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, data.duration, draw]);

  const height = compact ? 190 : (view === "side" ? 300 : 320) + rows.length * STRIP_H + (rows.length ? 10 : 0);
  return (
    <>
      <canvas ref={canvasRef} className="replay__canvas" style={{ height }} role="img" aria-label={caption} />
      <div className="replay__controls">
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={() => {
            userPaused.current = playing;
            if (!playing && tRef.current >= data.duration) tRef.current = 0;
            setPlaying(!playing);
          }}
          aria-label={playing ? "Pause replay" : "Play replay"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {playing ? <path d="M8 5v14M16 5v14" /> : <path d="M8 5l11 7-11 7Z" />}
          </svg>
        </button>
        <input
          ref={scrubRef}
          className="replay__scrub"
          type="range"
          min={0}
          max={data.duration}
          step={0.05}
          defaultValue={tRef.current}
          aria-label="Replay time"
          onInput={(e) => {
            tRef.current = Number(e.currentTarget.value);
            draw();
          }}
        />
        <span ref={timeRef} className="replay__time" />
        {labels && (
          <span className="replay__legend">
            {labels.map((l, k) => (
              <span key={l} className={`replay__key replay__key--${k ? "route" : "select"}`}>
                {l}
              </span>
            ))}
          </span>
        )}
      </div>
      {marks.length > 0 && (
        <ol className="replay__callouts">
          {marks.map((m) => (
            <li key={m.label}>
              <button
                type="button"
                className="replay__callout"
                onClick={() => {
                  tRef.current = m.t;
                  draw();
                }}
              >
                <span className="replay__callout-t">{m.t.toFixed(1)} s</span> {m.label}
              </button>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function line(g: CanvasRenderingContext2D, p: [number, number][], from: number, to: number, X: (x: number) => number, Y: (y: number) => number) {
  if (to <= from) return;
  g.beginPath();
  g.moveTo(X(p[from][0]), Y(p[from][1]));
  for (let k = from + 1; k <= to; k++) g.lineTo(X(p[k][0]), Y(p[k][1]));
  g.stroke();
}

function arrow(g: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, color: string) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x + dx * 8, y + dy * 8);
  g.lineTo(x - dx * 5 - dy * 5, y - dy * 5 + dx * 5);
  g.lineTo(x - dx * 5 + dy * 5, y - dy * 5 - dx * 5);
  g.closePath();
  g.fill();
}

function cross(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  g.moveTo(x - r, y - r);
  g.lineTo(x + r, y + r);
  g.moveTo(x + r, y - r);
  g.lineTo(x - r, y + r);
  g.stroke();
}

/** A round scale-bar length near `m` metres: 1, 2 or 5 × a power of ten. */
function niceLength(m: number) {
  const p = 10 ** Math.floor(Math.log10(m)), k = m / p;
  return (k < 1.5 ? 1 : k < 3.5 ? 2 : 5) * p;
}
