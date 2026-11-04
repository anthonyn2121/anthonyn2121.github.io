import { m, useMotionValue, useSpring } from "motion/react";
import { useEffect, useRef } from "react";
import { cursorBus } from "../lib/cursorBus";
import { useMediaQuery, usePrefersReducedMotion } from "../lib/hooks";

const LOCKABLE = 'a[href], button, input, textarea, select, summary, [role="button"], [data-lock]';
const IDLE = 22;
const PAD = 5;

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}
type Probe = (x: number, y: number, under: Element | null) => Box | null;
let probe: Probe | null = null;

/**
 * Lets a canvas offer its own lock targets where the DOM has none, such as the stars on
 * the sky chart. The probe gets the element under the pointer so it can ignore overlays.
 */
export function setReticleProbe(p: Probe | null) {
  probe = p;
}

/**
 * Custom cursor: a crosshair that follows the pointer, plus target brackets
 * that spring out to frame whatever interactive element is under it.
 * Only on fine pointers, and never when the visitor prefers reduced motion.
 */
export function Reticle() {
  const finePointer = useMediaQuery("(hover: hover) and (pointer: fine)");
  const reduced = usePrefersReducedMotion();
  const enabled = finePointer && !reduced;

  useEffect(() => {
    document.documentElement.classList.toggle("reticle-on", enabled);
    return () => document.documentElement.classList.remove("reticle-on");
  }, [enabled]);

  return enabled ? <ReticleInner /> : null;
}

function ReticleInner() {
  const boxRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const spring = { stiffness: 520, damping: 38, mass: 0.6 };
  const bx = useSpring(-100, spring);
  const by = useSpring(-100, spring);
  const bw = useSpring(IDLE, spring);
  const bh = useSpring(IDLE, spring);
  const opacity = useMotionValue(0);

  useEffect(() => {
    let px = -100;
    let py = -100;

    const aim = (target: Box | null) => {
      const box = boxRef.current;
      if (target) {
        bx.set(target.left - PAD);
        by.set(target.top - PAD);
        bw.set(target.width + PAD * 2);
        bh.set(target.height + PAD * 2);
      } else {
        bx.set(px - IDLE / 2);
        by.set(py - IDLE / 2);
        bw.set(IDLE);
        bh.set(IDLE);
      }
      box?.classList.toggle("is-locked", !!target);
    };
    const lockOn = (under: Element | null) => {
      const el = under?.closest?.(LOCKABLE);
      return el ? el.getBoundingClientRect() : (probe?.(px, py, under) ?? null);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      px = e.clientX;
      py = e.clientY;
      x.set(px);
      y.set(py);
      opacity.set(1);
      aim(lockOn(e.target as Element | null));
      cursorBus.emit(px, py);
    };
    const onScroll = () => aim(lockOn(document.elementFromPoint(px, py)));
    const onLeave = () => opacity.set(0);
    const onDown = () => boxRef.current?.classList.add("is-pressed");
    const onUp = () => boxRef.current?.classList.remove("is-pressed");

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("wheel", onScroll, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("wheel", onScroll);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [x, y, bx, by, bw, bh, opacity]);

  return (
    <div className="reticle" aria-hidden="true">
      <m.div ref={boxRef} className="reticle__box" style={{ x: bx, y: by, width: bw, height: bh, opacity }}>
        <span className="reticle__corner reticle__corner--tl" />
        <span className="reticle__corner reticle__corner--tr" />
        <span className="reticle__corner reticle__corner--bl" />
        <span className="reticle__corner reticle__corner--br" />
      </m.div>
      <m.div className="reticle__cross" style={{ x, y, opacity }} />
    </div>
  );
}
