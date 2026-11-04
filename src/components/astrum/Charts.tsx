import { useEffect, useState } from "react";
import { astrum } from "../../data/astrum";
import { loadAsset, type CourseData, type CurveData } from "./data";

/** Marks a visual drawn from placeholder data, with the note on what should replace it. */
export function FillerBadge({ note }: { note?: string }) {
  if (!note) return null;
  return (
    <span className="filler" title={note}>
      Placeholder data
    </span>
  );
}

function useAsset<T>(src: string) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    loadAsset<T>(src).then((d) => live && setData(d), () => undefined);
    return () => {
      live = false;
    };
  }, [src]);
  return data;
}

/** A training curve: one series against environment steps. */
export function CurveChart({ src, caption }: { src: string; caption: string }) {
  const d = useAsset<CurveData>(src);
  const W = 560, H = 220, L = 44, B = 30, T = 12, R = 12;
  if (!d) return <figure className="chart chart--loading">Loading…</figure>;
  const xMax = Math.max(...d.x), yMax = Math.max(10, Math.ceil(Math.max(...d.y) / 10) * 10);
  const x = (v: number) => L + ((W - L - R) * v) / xMax, y = (v: number) => H - B - ((H - B - T) * v) / yMax;
  const path = d.x.map((v, i) => `${i ? "L" : "M"}${x(v).toFixed(1)} ${y(d.y[i]).toFixed(1)}`).join("");
  return (
    <figure className="chart">
      <FillerBadge note={d.filler} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${caption} ${d.y_label} against ${d.x_label}.`}>
        {[0, 0.25, 0.5, 0.75, 1].map((k) => (
          <g key={k} className="chart__grid">
            <line x1={L} x2={W - R} y1={y(yMax * k)} y2={y(yMax * k)} />
            <text x={L - 6} y={y(yMax * k) + 4} textAnchor="end">
              {Math.round(yMax * k)}
            </text>
          </g>
        ))}
        {[0, 0.5, 1].map((k) => (
          <text key={k} className="chart__tick" x={x(xMax * k)} y={H - 10} textAnchor="middle">
            {k ? `${((xMax * k) / 1e6).toFixed(1)}M` : "0"}
          </text>
        ))}
        <path className="chart__line" d={path} />
      </svg>
      <figcaption>
        {caption} <span className="chart__axes">{d.y_label} · {d.x_label}</span>
      </figcaption>
    </figure>
  );
}

/** A race course from above, the planned line through it, and the clearance at one gate. */
export function CourseChart({ src, caption }: { src: string; caption: string }) {
  const d = useAsset<CourseData>(src);
  if (!d) return <figure className="chart chart--loading">Loading…</figure>;
  const pts = [...d.line, ...d.gates.map((g) => [g.x, g.y] as [number, number])];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs) - 4, x1 = Math.max(...xs) + 4, y0 = Math.min(...ys) - 4, y1 = Math.max(...ys) + 4;
  const s = 360 / (x1 - x0), W = 360, H = (y1 - y0) * s;
  const X = (v: number) => (v - x0) * s, Y = (v: number) => H - (v - y0) * s;
  const line = d.line.map(([a, b], i) => `${i ? "L" : "M"}${X(a).toFixed(1)} ${Y(b).toFixed(1)}`).join("") + "Z";
  // Clearance inset: the opening, the airframe square on, and the gap each side, to scale.
  const IW = 180, k = IW / (d.opening_m * 1.25), ox = (IW - d.opening_m * k) / 2, frame = d.reach_m * 2;
  return (
    <figure className="chart chart--course">
      <FillerBadge note={d.filler} />
      <div className="course">
        <svg viewBox={`0 0 ${W} ${H.toFixed(0)}`} role="img" aria-label={`${caption} ${d.gates.length} gates.`}>
          <path className="course__line" d={line} />
          {d.gates.map((g, i) => (
            <g key={i} transform={`translate(${X(g.x).toFixed(1)} ${Y(g.y).toFixed(1)}) rotate(${((-g.yaw * 180) / Math.PI).toFixed(1)})`}>
              <rect className="course__gate" x={-7} y={-2} width={14} height={4} />
              <text className="course__num" y={-6} textAnchor="middle">
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
        <svg className="course__inset" viewBox={`0 0 ${IW} 90`} role="img" aria-label={`Square-on, the ${d.opening_m} m opening leaves ${d.clearance_m} m either side of the airframe; crabbed 45°, ${d.clearance_crabbed_m} m.`}>
          <rect className="course__post" x={ox - 8} y={18} width={8} height={44} />
          <rect className="course__post" x={ox + d.opening_m * k} y={18} width={8} height={44} />
          <rect className="course__frame" x={ox + d.clearance_m * k} y={32} width={frame * k} height={16} rx={3} />
          <text className="course__label" x={IW / 2} y={12} textAnchor="middle">
            {d.opening_m} m opening
          </text>
          <text className="course__label course__label--gap" x={ox + (d.clearance_m * k) / 2} y={78} textAnchor="middle">
            {d.clearance_m}
          </text>
          <text className="course__label course__label--gap" x={ox + d.opening_m * k - (d.clearance_m * k) / 2} y={78} textAnchor="middle">
            {d.clearance_m}
          </text>
          <text className="course__label" x={IW / 2} y={44} textAnchor="middle">
            F450
          </text>
        </svg>
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

/** Headless speed by fleet size, from the README's benchmark table. */
export function PerfBars() {
  const max = Math.max(...astrum.perf.map((p) => p.x));
  return (
    <figure className="perf">
      <ul className="perf__rows">
        {astrum.perf.map((p) => (
          <li key={`${p.fleet}-${p.threads}`} className="perf__row">
            <span className="perf__label">
              {p.fleet} <span className="perf__threads">· {p.threads} thread{p.threads > 1 ? "s" : ""}</span>
            </span>
            <span className="perf__bar" style={{ width: `${(p.x / max) * 100}%` }} />
            <span className="perf__value">{p.x}×</span>
          </li>
        ))}
      </ul>
      <figcaption>Times faster than real time, headless at 120 Hz with aircraft holding trim (24-core Core Ultra 9 285K, shared with other jobs).</figcaption>
    </figure>
  );
}
