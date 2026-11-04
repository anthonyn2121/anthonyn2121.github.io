import { m } from "motion/react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { profile } from "../../data/profile";
import { usePrefersReducedMotion } from "../../lib/hooks";
import { contours } from "../../lib/topo";
import { GROUPS, groupRange, maxGroup } from "../../lib/uas";
import { AircraftShape } from "../Aircraft";
import { Panel } from "./Panel";

const LOITER_R = 30;
const LOITER_PERIOD = 14000;
const CRAFT_SCALE = 0.3;

type Pt = { x: number; y: number };

/** Lay waypoints out as a climb from lower left to upper right, with a gentle zig-zag. */
function layout(n: number, w: number, h: number): Pt[] {
  if (n === 1) return [{ x: w * 0.5, y: h * 0.5 }];
  const left = Math.max(40, Math.min(80, w * 0.1));
  const right = Math.max(70, w * 0.16);
  const top = Math.max(84, h * 0.24);
  const bottom = Math.max(56, h * 0.2);
  return Array.from({ length: n }, (_, k) => {
    const f = k / (n - 1);
    const zig = k === 0 || k === n - 1 ? 0 : (k % 2 ? 1 : -1) * h * 0.07;
    return { x: left + f * (w - left - right), y: h - bottom - f * (h - top - bottom) + zig };
  });
}

const compass = (dx: number, dy: number) => ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function FlightPlanPanel({ replayKey }: { replayKey: number }) {
  const entries = profile.experience;
  const n = entries.length;
  const reduced = usePrefersReducedMotion();

  const wrapRef = useRef<HTMLDivElement>(null);
  const routeRef = useRef<SVGPathElement>(null);
  const pastRef = useRef<SVGPathElement>(null);
  const activeRef = useRef<SVGPathElement>(null);
  const craftRef = useRef<SVGGElement>(null);
  const altRef = useRef<HTMLSpanElement>(null);
  const gsRef = useRef<HTMLSpanElement>(null);
  const hdgRef = useRef<HTMLSpanElement>(null);
  const reachedRef = useRef(0);
  const completedFor = useRef<number | null>(null);

  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [reached, setReached] = useState(0);
  const [selected, setSelected] = useState(n - 1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      const h = Math.round(e.contentRect.height);
      setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const terrain = useMemo(() => contours({ width: 1500, height: 900, seed: 42, cell: 8, hills: 26, levels: 20 }), []);

  const geo = useMemo(() => {
    if (!size) return null;
    const pts = layout(n, size.w, size.h);
    const c = pts[n - 1];
    const prev = n > 1 ? pts[n - 2] : { x: c.x - 1, y: c.y + 1 };
    const len = Math.hypot(c.x - prev.x, c.y - prev.y) || 1;
    const u = { x: (c.x - prev.x) / len, y: (c.y - prev.y) / len };
    // Join the loiter circle on a tangent so the handoff from leg to orbit is smooth.
    const entry = { x: c.x + LOITER_R * u.y, y: c.y - LOITER_R * u.x };
    const theta0 = Math.atan2(-u.x, u.y);
    const route = [...pts.slice(0, -1), entry];
    const toD = (p: Pt[]) => p.map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join("");
    const cum = [0];
    for (let i = 1; i < route.length; i++) cum.push(cum[i - 1] + Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y));
    return {
      pts,
      c,
      u,
      entry,
      theta0,
      cum,
      routeD: toD(route),
      pastD: n > 2 ? toD(pts.slice(0, -1)) : "",
      activeD: n > 1 ? toD([pts[n - 2], entry]) : "",
    };
  }, [size, n]);

  useEffect(() => {
    const route = routeRef.current;
    const craft = craftRef.current;
    if (!geo || !route || !craft) return;

    const L = n > 1 ? route.getTotalLength() : 0;
    const Lp = geo.cum[Math.max(0, n - 2)];
    const La = L - Lp;
    const past = pastRef.current;
    const active = activeRef.current;
    if (past) past.style.strokeDasharray = `${Lp} ${Lp + 1}`;
    if (active) active.style.strokeDasharray = `${La} ${La + 1}`;

    const groupAt = (k: number) => GROUPS[maxGroup(entries[Math.min(k, n - 1)].groups)];
    const final = groupAt(n - 1);

    const setDrawn = (d: number) => {
      if (past) past.style.strokeDashoffset = String(Lp - Math.min(d, Lp));
      if (active) active.style.strokeDashoffset = String(La - Math.max(0, d - Lp));
    };
    const place = (x: number, y: number, hdg: number) =>
      craft.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${hdg.toFixed(1)}) scale(${CRAFT_SCALE})`);
    const telemetry = (alt: number, gs: number, hdg: number) => {
      if (altRef.current) altRef.current.textContent = (Math.round(alt / 100) * 100).toLocaleString("en-US");
      if (gsRef.current) gsRef.current.textContent = String(Math.round(gs));
      if (hdgRef.current) hdgRef.current.textContent = String(Math.round(hdg) % 360).padStart(3, "0");
    };
    const markReached = (k: number) => {
      if (k !== reachedRef.current) {
        reachedRef.current = k;
        setReached(k);
      }
    };
    const orbit = (theta: number) => {
      const x = geo.c.x + LOITER_R * Math.cos(theta);
      const y = geo.c.y + LOITER_R * Math.sin(theta);
      const hdg = compass(-Math.sin(theta), Math.cos(theta));
      place(x, y, hdg);
      telemetry(final.cruiseAlt, final.cruiseSpeed, hdg);
    };

    // Already flown (or reduced motion): show the finished route without replaying.
    const skipFlight = reduced || n === 1 || completedFor.current === replayKey;
    if (skipFlight) {
      setDrawn(L);
      markReached(n - 1);
      orbit(geo.theta0);
      if (reduced) return;
    } else {
      setDrawn(0);
      markReached(0);
    }

    let mode: "fly" | "loiter" = skipFlight ? "loiter" : "fly";
    const duration = 1400 + 1100 * (n - 1);
    let t0 = performance.now();
    let loiterStart = t0;
    let raf = 0;
    let onScreen = true;

    const frame = (now: number) => {
      raf = 0;
      if (mode === "fly") {
        const t = Math.min(1, (now - t0) / duration);
        const d = easeInOut(t) * L;
        setDrawn(d);
        const p = route.getPointAtLength(d);
        const ahead = route.getPointAtLength(Math.min(L, d + 1));
        const behind = route.getPointAtLength(Math.max(0, d - 1));
        const hdg = compass(ahead.x - behind.x, ahead.y - behind.y);
        let k = 0;
        while (k < n - 1 && geo.cum[k + 1] <= d + 0.01) k++;
        markReached(k);
        const legLen = k < n - 1 ? geo.cum[k + 1] - geo.cum[k] : 1;
        const f = k < n - 1 ? easeInOut((d - geo.cum[k]) / legLen) : 1;
        const a = groupAt(k);
        const b = groupAt(k + 1);
        place(p.x, p.y, hdg);
        telemetry(lerp(a.cruiseAlt, b.cruiseAlt, f), lerp(a.cruiseSpeed, b.cruiseSpeed, f), hdg);
        if (t >= 1) {
          mode = "loiter";
          loiterStart = now;
          completedFor.current = replayKey;
          markReached(n - 1);
        }
      } else {
        orbit(geo.theta0 + ((now - loiterStart) / LOITER_PERIOD) * Math.PI * 2);
      }
      if (onScreen && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const resume = () => {
      if (!raf && onScreen && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      resume();
    });
    if (wrapRef.current) io.observe(wrapRef.current);
    document.addEventListener("visibilitychange", resume);
    t0 = performance.now();
    loiterStart = t0;
    resume();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", resume);
    };
  }, [geo, replayKey, reduced, n, entries]);

  const sel = entries[selected];
  const craftGroup = maxGroup(entries[reached].groups);
  const compact = !!size && size.w < 560;

  const onWpKey = (e: KeyboardEvent, k: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelected(k);
    }
  };

  return (
    <Panel
      id="flightplan"
      title="Flight plan"
      plain="Career history"
      status="active"
      meta={`${n} waypoints, ${entries[0].start} to now`}
      className="panel--map"
    >
      <div className={`map ${compact ? "map--compact" : ""}`}>
        <div className="map__telemetry" aria-hidden="true">
          <span>
            <abbr title="Altitude">ALT</abbr> <span className="num" ref={altRef}>0</span> ft
          </span>
          <span>
            <abbr title="Ground speed">GS</abbr> <span className="num" ref={gsRef}>0</span> kt
          </span>
          <span>
            <abbr title="Heading">HDG</abbr> <span className="num" ref={hdgRef}>000</span>°
          </span>
          <span className="map__group">Group {craftGroup}</span>
        </div>
        <div className="map__viewport" ref={wrapRef}>
          {size && geo && (
            <svg
              className="map__svg"
              viewBox={`0 0 ${size.w} ${size.h}`}
              width={size.w}
              height={size.h}
              role="group"
              aria-label="Career flight plan. Each waypoint is a role. Select one to see details."
            >
              <g className="map__terrain" aria-hidden="true">
                {terrain.map((c, i) => (
                  <path key={i} d={c.d} className={c.index ? "is-index" : undefined} />
                ))}
              </g>
              <g className="map__grid" aria-hidden="true">
                {Array.from({ length: Math.ceil(size.w / 120) }, (_, i) => (
                  <line key={`v${i}`} x1={(i + 0.5) * 120} y1={0} x2={(i + 0.5) * 120} y2={size.h} />
                ))}
                {Array.from({ length: Math.ceil(size.h / 120) }, (_, i) => (
                  <line key={`h${i}`} x1={0} y1={(i + 0.5) * 120} x2={size.w} y2={(i + 0.5) * 120} />
                ))}
              </g>
              <g className="map__north" transform={`translate(${size.w - 26} 30)`} aria-hidden="true">
                <path d="M0 -14L6 6L0 2L-6 6Z" />
                <text y={22} textAnchor="middle">
                  N
                </text>
              </g>

              <path ref={routeRef} d={geo.routeD} fill="none" stroke="none" />
              {geo.pastD && <path d={geo.pastD} className="map__leg map__leg--planned" />}
              {geo.activeD && <path d={geo.activeD} className="map__leg map__leg--planned" />}
              {geo.pastD && <path ref={pastRef} d={geo.pastD} className="map__leg map__leg--flown" />}
              {geo.activeD && <path ref={activeRef} d={geo.activeD} className="map__leg map__leg--active" />}
              <circle
                className={`map__loiter ${reached === n - 1 ? "is-on" : ""}`}
                cx={geo.c.x}
                cy={geo.c.y}
                r={LOITER_R}
              />

              {geo.pts.map((p, k) => {
                const e = entries[k];
                const last = k === n - 1;
                const state = last && reached === k ? "current" : k <= reached ? "reached" : "planned";
                return (
                  <g
                    key={e.id}
                    className={`wp wp--${state} ${selected === k ? "is-selected" : ""}`}
                    transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selected === k}
                    aria-label={`${e.id}: ${e.role} at ${e.org}, ${e.start} to ${e.end}`}
                    onClick={() => setSelected(k)}
                    onKeyDown={(ev) => onWpKey(ev, k)}
                  >
                    <circle className="wp__hit" r={18} />
                    <circle className="wp__ring" r={12} />
                    <path className="wp__mark" d="M0 -7L7 0L0 7L-7 0Z" />
                    {k <= reached && (
                      <g transform={last ? `translate(0 ${-LOITER_R - 40})` : "translate(14 22)"}>
                        <m.g
                          className="wp__label"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.35 }}
                          textAnchor={last ? "middle" : "start"}
                        >
                          <text className="wp__id">
                            {e.id} {e.start}
                          </text>
                          {!compact && (
                            <text className="wp__role" y={15}>
                              {e.shortRole}
                            </text>
                          )}
                        </m.g>
                      </g>
                    )}
                  </g>
                );
              })}

              <g
                ref={craftRef}
                className="map__craft"
                aria-hidden="true"
                transform={`translate(${geo.pts[0].x.toFixed(1)} ${geo.pts[0].y.toFixed(1)}) scale(${CRAFT_SCALE})`}
              >
                <AircraftShape group={craftGroup} />
              </g>
            </svg>
          )}

        </div>

        <div className="map__detail" aria-live="polite">
          <p className="map__detail-when">
            <span className="map__detail-id">{sel.id}</span>
            {sel.start} to {sel.end}
          </p>
          <p className="map__detail-role">{sel.role}</p>
          <p className="map__detail-org">
            {sel.org}, {sel.location}
          </p>
          <p className="map__detail-groups">{groupRange(sel.groups)}</p>
          <a className="map__detail-link" href={`#exp-${sel.id}`}>
            Read the full entry
          </a>
        </div>
      </div>
    </Panel>
  );
}
