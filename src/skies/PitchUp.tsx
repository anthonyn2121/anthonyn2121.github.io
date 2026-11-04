import { animate, m, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef } from "react";
import { TerrainBackground } from "../components/TerrainBackground";

/** Pitch in degrees at the start: nose down, looking at the terrain like the main page does. */
export const PITCH_START = -60;
export const PITCH_END = 90;
/** How far the world moves per degree of pitch, in vh. The ladder, horizon, and sky share it. */
export const VH_PER_DEG = 0.9;

const RUNGS = Array.from({ length: 15 }, (_, i) => -60 + i * 10).filter((d) => d !== 0);

const signed = (v: number) => `${v < 0 ? "−" : "+"}${String(Math.abs(Math.round(v))).padStart(2, "0")}°`;

interface Props {
  /** 0 is level flight; 90 is looking straight up. */
  pitch: MotionValue<number>;
  onDone: () => void;
}

/**
 * The arrival transition: the view pitches up from the terrain, past the horizon, until it
 * looks straight up at the sky, with a pitch ladder like a flight display. Any key or click skips it.
 */
export function PitchUp({ pitch, onDone }: Props) {
  const readoutRef = useRef<HTMLSpanElement>(null);
  // The horizon sits at mid-screen at zero pitch and slides down as the nose comes up.
  const horizonY = useTransform(pitch, (p) => `${50 + p * VH_PER_DEG}vh`);
  // Looking down, the terrain faces you; toward the horizon it lies back, foreshortened.
  const groundTilt = useTransform(pitch, [PITCH_START, 0], [0, 62]);
  const ladderY = useTransform(pitch, (p) => `${p * VH_PER_DEG}vh`);
  const hudOpacity = useTransform(pitch, [PITCH_START, PITCH_START + 8, 76, PITCH_END], [0, 1, 1, 0]);

  useEffect(() => {
    const unsubscribe = pitch.on("change", (v) => {
      if (readoutRef.current) readoutRef.current.textContent = signed(v);
    });
    const controls = animate(pitch, PITCH_END, { duration: 2.8, ease: [0.42, 0, 0.25, 1], onComplete: onDone });
    const skip = () => {
      controls.stop();
      pitch.set(PITCH_END);
      onDone();
    };
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      controls.stop();
      unsubscribe();
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [pitch, onDone]);

  return (
    <div className="pitch" aria-hidden="true">
      <m.div className="pitch__ground" style={{ y: horizonY, rotateX: groundTilt }}>
        <TerrainBackground />
      </m.div>
      <m.div className="pitch__horizon" style={{ y: horizonY }} />
      <m.div className="pitch__hud" style={{ opacity: hudOpacity }}>
        <m.div className="pitch__ladder" style={{ y: ladderY }}>
          {RUNGS.map((d) => (
            <div
              key={d}
              className={`pitch__rung ${d < 0 ? "pitch__rung--down" : ""}`}
              style={{ top: `${-d * VH_PER_DEG}vh` }}
            >
              <span>{Math.abs(d)}</span>
              <span>{Math.abs(d)}</span>
            </div>
          ))}
        </m.div>
        <svg className="pitch__aircraft" viewBox="-60 -12 120 24">
          <path d="M-56 0H-20L-9 9L0 0L9 9L20 0H56" />
        </svg>
        <p className="pitch__readout">
          Pitch{" "}
          <span className="num" ref={readoutRef}>
            {signed(PITCH_START)}
          </span>
        </p>
      </m.div>
    </div>
  );
}
