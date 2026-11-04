import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { setReticleProbe } from "../components/Reticle";
import { figures } from "../data/figures";
import { profile } from "../data/profile";
import { useTheme } from "../lib/theme";
import type { Constellation, Sky } from "./catalog";
import { skyCursorBus } from "./skyBus";
import { createSkyView, type ClearRect, type SkyView } from "./skyView";

interface Props {
  sky: Sky;
  featured: ReadonlySet<string>;
  selected: string | null;
  onSelect: (id: string) => void;
  /** The part of the chart no panel covers. The view centres itself there. */
  clearRef: RefObject<HTMLElement | null>;
}

export function SkyChart({ sky, featured, selected, onSelect, clearRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const crossRef = useRef<HTMLDivElement>(null);
  const fovRef = useRef<HTMLSpanElement>(null);
  const viewRef = useRef<SkyView | null>(null);
  const onSelectRef = useRef(onSelect);
  const { theme } = useTheme();
  const [center, setCenter] = useState<Constellation | null>(null);
  const [horizon, setHorizon] = useState(true);
  const [clear, setClear] = useState<ClearRect | null>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const view = createSkyView({
      canvas,
      sky,
      featured,
      location: profile.location,
      crosshair: crossRef.current!,
      onSelect: (id) => onSelectRef.current(id),
      onCenter: setCenter,
      onFov: (deg) => {
        if (fovRef.current) fovRef.current.textContent = `${deg}°`;
      },
      onCursor: skyCursorBus.emit,
    });
    viewRef.current = view;
    setReticleProbe((x, y, under) => (under === canvas ? view.starBox(x, y) : null));
    return () => {
      setReticleProbe(null);
      view.destroy();
      viewRef.current = null;
    };
  }, [sky, featured]);

  useEffect(() => viewRef.current?.setNight(theme === "night"), [theme]);
  useEffect(() => viewRef.current?.setHorizon(horizon), [horizon]);
  useEffect(() => viewRef.current?.select(selected, selected ? figures[selected] : undefined), [selected]);

  // Layout offsets, not client rects, so the pitch-up transform doesn't skew the measurement.
  useEffect(() => {
    const el = clearRef.current;
    if (!el) return;
    const measure = () => {
      const r = { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
      viewRef.current?.setClear(r);
      setClear((c) =>
        c && c.left === r.left && c.top === r.top && c.width === r.width && c.height === r.height ? c : r,
      );
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.offsetParent) ro.observe(el.offsetParent);
    return () => ro.disconnect();
  }, [clearRef]);

  const onKeyDown = (e: KeyboardEvent) => {
    const v = viewRef.current;
    if (!v) return;
    const step = e.shiftKey ? 3 : 1;
    if (e.key === "ArrowLeft") v.nudge(step, 0);
    else if (e.key === "ArrowRight") v.nudge(-step, 0);
    else if (e.key === "ArrowUp") v.nudge(0, step);
    else if (e.key === "ArrowDown") v.nudge(0, -step);
    else if (e.key === "+" || e.key === "=") v.zoom(0.8);
    else if (e.key === "-" || e.key === "_") v.zoom(1.25);
    else if (e.key === "Enter" || e.key === " ") v.selectCenter();
    else if (e.key === "Home") v.overhead();
    else return;
    e.preventDefault();
  };

  return (
    <div className="sky">
      <canvas
        ref={canvasRef}
        className="sky__canvas"
        tabIndex={0}
        role="application"
        aria-roledescription="sky chart"
        aria-label="Sky chart"
        aria-describedby="sky-help"
        onKeyDown={(e) => {
          setFocused(true);
          onKeyDown(e);
        }}
        onFocus={(e) => setFocused(e.currentTarget.matches(":focus-visible"))}
        onBlur={() => setFocused(false)}
      />
      <p id="sky-help" className="visually-hidden">
        Drag or use the arrow keys to turn the sky. Scroll, pinch, or press plus and minus to zoom. Press Enter to open
        the constellation under the crosshair, and Home to look straight up again.
      </p>
      <p className="visually-hidden" aria-live="polite">
        {focused && center ? `Crosshair on ${center.name}` : ""}
      </p>

      <div className="sky__crosshair" ref={crossRef} aria-hidden="true">
        <span className="sky__crosshair-mark" />
        {/* Keyboard users steer by the crosshair; pointer users get the hover outline instead. */}
        {focused && center && (
          <span className="sky__crosshair-label">
            {center.name}
            <span className="sky__crosshair-hint"> · Enter to open</span>
          </span>
        )}
      </div>

      {clear && (
        <div className="sky__controls" style={{ left: clear.left + clear.width / 2, top: clear.top + clear.height }}>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={() => viewRef.current?.zoom(1.25)}
            aria-label="Zoom out"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14" />
            </svg>
          </button>
          <span className="sky__fov" title="Field of view">
            <abbr title="Field of view">FOV</abbr> <span className="num" ref={fovRef} />
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={() => viewRef.current?.zoom(0.8)}
            aria-label="Zoom in"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14M12 5v14" />
            </svg>
          </button>
          <span className="sky__sep" aria-hidden="true" />
          <button type="button" className="btn btn--ghost" onClick={() => viewRef.current?.overhead()}>
            Overhead now
          </button>
          <button type="button" className="btn btn--ghost" aria-pressed={horizon} onClick={() => setHorizon((v) => !v)}>
            Horizon
          </button>
        </div>
      )}
    </div>
  );
}
