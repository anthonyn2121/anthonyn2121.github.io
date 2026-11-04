import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { profile } from "../data/profile";
import { useBriefing } from "../lib/briefing";
import { cursorBus } from "../lib/cursorBus";
import { useTheme } from "../lib/theme";

export const SECTIONS = [
  { id: "about", label: "About" },
  { id: "experience", label: "Experience" },
  { id: "projects", label: "Projects" },
  { id: "platforms", label: "Platforms" },
  { id: "contact", label: "Contact" },
] as const;

export interface NavLink {
  href: string;
  label: string;
  /** Marks the page you're on. */
  current?: boolean;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}

interface Props {
  /** Where the name in the top-left links to. */
  homeHref: string;
  nav: NavLink[];
  /** Live readouts after the availability light, e.g. a cursor position and a clock. */
  readouts?: ReactNode;
  /** Buttons before the theme toggle. */
  actions?: ReactNode;
}

export function StatusBar({ homeHref, nav, readouts, actions }: Props) {
  const { theme, toggle } = useTheme();
  const nextTheme = theme === "night" ? "day" : "night";

  return (
    <header className="statusbar">
      <a className="statusbar__id" href={homeHref}>
        <svg className="statusbar__ownship" viewBox="-10 -10 20 20" aria-hidden="true">
          <path d="M0 -8L6 7L0 4L-6 7Z" />
        </svg>
        <span className="statusbar__name">{profile.name}</span>
        <span className="statusbar__callsign">{profile.callsign}</span>
      </a>

      <nav className="statusbar__nav" aria-label="Site">
        <ul>
          {nav.map((l) => (
            <li key={l.href}>
              <a href={l.href} aria-current={l.current ? "page" : undefined} onClick={l.onClick}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="statusbar__readouts">
        <span className="readout">
          <span className={`led ${profile.availability.open ? "led--ok" : "led--caution"}`} aria-hidden="true" />
          {profile.availability.short}
        </span>
        {readouts}
      </div>

      <div className="statusbar__actions">
        {actions}
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={toggle}
          aria-label={`Switch to ${nextTheme} theme`}
          title={`Switch to ${nextTheme} theme`}
        >
          {nextTheme === "day" ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4.5" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
            </svg>
          )}
        </button>
        <a className="btn btn--primary" href={profile.resumeUrl} target="_blank" rel="noopener">
          Resume
        </a>
      </div>
    </header>
  );
}

/** A readout that rewrites its own text every second, without re-rendering React. Pass a stable `format`. */
export function Clock({ format }: { format: (now: Date) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const tick = () => {
      if (ref.current) ref.current.textContent = format(new Date());
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [format]);
  return <span className="readout readout--clock" ref={ref} aria-hidden="true" />;
}

const fmtCoord = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`;
const utc = (now: Date) => now.toISOString().slice(11, 19) + "Z";

/** The main page's readouts: the pointer as coordinates around your home location, and UTC. */
export function GroundReadouts() {
  const coordRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const { lat, lon } = profile.location;
    const write = (la: number, lo: number) => {
      if (coordRef.current) coordRef.current.textContent = `${fmtCoord(la, "N", "S")}  ${fmtCoord(lo, "E", "W")}`;
    };
    write(lat, lon);
    // Map the pointer to a small box around your home location, like a map cursor readout.
    return cursorBus.subscribe((x, y) => {
      write(lat + (0.5 - y / window.innerHeight) * 0.06, lon + (x / window.innerWidth - 0.5) * 0.1);
    });
  }, []);

  return (
    <>
      <span className="readout readout--coords" ref={coordRef} aria-hidden="true" />
      <Clock format={utc} />
    </>
  );
}

/** Shows or hides the note that explains the GCS layout. */
export function BriefingToggle() {
  const briefing = useBriefing();
  return (
    <button
      type="button"
      id="briefing-toggle"
      className="btn btn--ghost statusbar__about"
      onClick={briefing.open ? briefing.dismiss : briefing.show}
      aria-expanded={briefing.open}
      aria-controls="briefing"
      title="What this layout is"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 11v6M12 7.5v.01" />
      </svg>
      <span className="statusbar__about-text">About this layout</span>
    </button>
  );
}
