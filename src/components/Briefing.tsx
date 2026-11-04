import { AnimatePresence, m } from "motion/react";
import { useBriefing } from "../lib/briefing";
import { usePrefersReducedMotion } from "../lib/hooks";

/** Explains the GCS layout for visitors outside aerospace. */
export function Briefing() {
  const { open, dismiss } = useBriefing();
  const reduced = usePrefersReducedMotion();

  const onDismiss = () => {
    dismiss();
    // Point keyboard users at the button that brings the note back.
    document.getElementById("briefing-toggle")?.focus({ preventScroll: true });
  };

  return (
    <AnimatePresence initial={false}>
      {open && (
        <m.aside
          key="briefing"
          id="briefing"
          className="briefing"
          aria-label="About this layout"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.3, ease: [0.2, 0.7, 0.2, 1] }}
        >
          <div className="briefing__inner">
            <svg className="briefing__icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9.5" />
              <path d="M12 11v6M12 7.5v.01" />
            </svg>
            <div className="briefing__text">
              <p className="briefing__lede">
                You're looking at a ground control station, or GCS: the screens a pilot uses to fly an unmanned aircraft.
              </p>
              <p className="briefing__detail">
                I've laid out my portfolio the same way. Each panel's label says what it holds, and everything is also
                below in a standard layout.
              </p>
            </div>
            <div className="briefing__actions">
              <a className="btn btn--ghost" href="#about">
                Go to standard layout
              </a>
              <button type="button" className="btn" onClick={onDismiss}>
                Got it
              </button>
            </div>
          </div>
        </m.aside>
      )}
    </AnimatePresence>
  );
}
