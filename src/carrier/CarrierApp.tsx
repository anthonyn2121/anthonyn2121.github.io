import { AnimatePresence, domAnimation, LazyMotion, m, MotionConfig } from "motion/react";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { Reticle } from "../components/Reticle";
import { About } from "../components/sections/About";
import { Contact } from "../components/sections/Contact";
import { Experience } from "../components/sections/Experience";
import { Platforms } from "../components/sections/Platforms";
import { Projects } from "../components/sections/Projects";
import { Clock, SECTIONS, StatusBar, type NavLink } from "../components/StatusBar";
import { profile } from "../data/profile";
import { skiesTitle } from "../data/skies";
import { usePrefersReducedMotion } from "../lib/hooks";
import { onSkiesLinkClick, SKIES_HREF } from "../lib/pages";
import { ThemeProvider, useTheme } from "../lib/theme";
import { GROUPS, groupRange } from "../lib/uas";
import { createCarrierScene, type CarrierScene, type DeckState, type Phase } from "./scene";

/*
 * The home page as a carrier flight deck. The ASCII diorama is the hero; each
 * featured project is an aircraft parked forward of the island: an F-35C that taxis to cat 2,
 * launches, and traps back aboard, or a Group 1 quadcopter that lifts off its pad and circles
 * over the deck. Its mission card is open while it flies.
 */

/** The deck has four project spots; further projects still appear in the Projects section. */
const DECK = profile.projects.slice(0, 4).map((p, i) => ({ ...p, vehicle: p.vehicle ?? ("jet" as const), modex: `1${String(i + 1).padStart(2, "0")}` }));
type DeckProject = (typeof DECK)[number];

/** The hull number on the bow comes from the digits in your callsign. */
const HULL = profile.callsign.replace(/\D/g, "") || "01";

const NAV: NavLink[] = [
  ...SECTIONS.map((s) => ({ href: `#${s.id}`, label: s.label })),
  { href: SKIES_HREF, label: skiesTitle, onClick: onSkiesLinkClick },
];

const zulu = (now: Date) => now.toISOString().slice(11, 19) + "Z";

const PHASE_LABEL: Record<Phase, string> = {
  parked: "On deck",
  "taxi-out": "Taxiing to cat 2",
  "on-cat": "On cat 2",
  launch: "Launching",
  departure: "Departing",
  airborne: "Airborne",
  approach: "On approach",
  trap: "Trapped",
  "taxi-in": "Taxiing in",
  spotting: "Spotting",
  "spin-up": "Spinning up",
  liftoff: "Lifting off",
  "on-station": "On station",
  landing: "Landing",
};
const CAT2_PHASES: Phase[] = ["taxi-out", "on-cat", "launch"];
const RECOVERY_PHASES: Phase[] = ["approach", "trap", "taxi-in", "spotting"];
const QUAD = DECK.find((p) => p.vehicle === "quadcopter");

type DeckEntry = { state: DeckState; phase: Phase };
const PARKED: DeckEntry = { state: "parked", phase: "parked" };

/** F-35C planform seen from above, nose up, in metres: starboard half, then mirrored. */
const PLANFORM_HALF: [number, number][] = [
  [7.6, 0], [6.2, 0.75], [4.6, 1.5], [3, 2.1], [1.4, 2.2], [-2.14, 6.55], [-3.74, 6.55], [-4.6, 2.4],
  [-5.5, 2.2], [-7, 3.35], [-8.1, 3.35], [-8.1, 1], [-7.3, 0.6], [-7.3, 0],
];
const PLANFORM = `M${[...PLANFORM_HALF, ...PLANFORM_HALF.map(([x, z]) => [x, -z]).reverse()].map(([x, z]) => `${z} ${-x}`).join("L")}Z`;

/** Dev only: `?fps` shows the frame rate and quality level in the deck status strip. */
const SHOW_FPS = import.meta.env.DEV && new URLSearchParams(location.search).has("fps");

export function CarrierApp() {
  useEffect(() => {
    document.title = `${profile.name}, ${profile.role}`;
  }, []);

  return (
    <ThemeProvider>
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user">
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <StatusBar homeHref="#top" nav={NAV} readouts={<Clock format={zulu} />} />
          <main id="main">
            <Hero />
            <div className="sections">
              <About />
              <Experience />
              <Projects />
              <Platforms />
              <Contact />
            </div>
          </main>
          <footer className="footer">
            <p>
              {profile.name}, {new Date().getFullYear()}. Built with React and Three.js, hosted on GitHub Pages.
            </p>
            <p className="footer__links">
              <a href={SKIES_HREF} onClick={onSkiesLinkClick}>
                {skiesTitle}
              </a>
              <a href="#top">Back to top</a>
            </p>
          </footer>
          <Reticle />
        </MotionConfig>
      </LazyMotion>
    </ThemeProvider>
  );
}

function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<CarrierScene | null>(null);
  const tagRefs = useRef(new Map<string, HTMLLIElement>());
  const triggerRef = useRef<HTMLElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [deck, setDeck] = useState<Record<string, DeckEntry>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const reduced = usePrefersReducedMotion();
  const { theme } = useTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;

  // One scene per mount. Tags follow their jets by writing transforms directly, not through React.
  useEffect(() => {
    let scene: CarrierScene;
    try {
      scene = createCarrierScene(canvasRef.current!, {
        projects: DECK.map((p) => ({ slug: p.slug, vehicle: p.vehicle })),
        hullNumber: HULL,
        theme: themeRef.current,
        still: reduced,
      });
    } catch {
      setFailed(true);
      return;
    }
    sceneRef.current = scene;
    let lastKey = "";
    const off = scene.onFrame((tags) => {
      for (const t of tags) {
        const el = tagRefs.current.get(t.slug);
        if (!el) continue;
        el.style.transform = `translate(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px)`;
        el.style.setProperty("--jet", `${t.size.toFixed(0)}px`);
        el.dataset.hidden = String(!t.visible);
      }
      const key = tags.map((t) => t.phase).join();
      if (key !== lastKey) {
        lastKey = key;
        setDeck(Object.fromEntries(tags.map((t) => [t.slug, { state: t.state, phase: t.phase }])));
      }
    });
    return () => {
      off();
      scene.dispose();
      sceneRef.current = null;
    };
  }, [reduced]);

  useEffect(() => sceneRef.current?.setTheme(theme), [theme]);
  useEffect(() => sceneRef.current?.setPaused(paused), [paused]);

  // Stop rendering while the hero is scrolled out of view.
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => sceneRef.current?.setActive(e.isIntersecting));
    io.observe(heroRef.current!);
    return () => io.disconnect();
  }, []);

  const launch = useCallback(
    (slug: string, trigger: HTMLElement | null) => {
      const scene = sceneRef.current;
      if (open && open !== slug) scene?.recall(open);
      scene?.launch(slug);
      triggerRef.current = trigger;
      setOpen(slug);
    },
    [open],
  );

  const close = useCallback(() => {
    if (!open) return;
    sceneRef.current?.recall(open);
    setOpen(null);
    triggerRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    sceneRef.current?.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
  };

  const hover = (slug: string | null) => sceneRef.current?.hover(slug);
  const active = DECK.find((p) => p.slug === open);
  const entry = (slug: string) => deck[slug] ?? PARKED;
  const cat2 = DECK.find((p) => CAT2_PHASES.includes(entry(p.slug).phase));
  const recovering = DECK.find((p) => RECOVERY_PHASES.includes(entry(p.slug).phase));
  const airborne = DECK.filter((p) => ["departure", "airborne", "on-station"].includes(entry(p.slug).phase));

  return (
    <section
      ref={heroRef}
      id="top"
      className={`carrier-hero${failed ? " carrier-hero--fallback" : ""}`}
      aria-label="Flight deck"
      onPointerMove={onPointerMove}
      onPointerLeave={() => sceneRef.current?.setPointer(0, 0)}
    >
      <canvas ref={canvasRef} className="carrier-hero__canvas" aria-hidden="true" />
      <div className="carrier-hero__scrim" aria-hidden="true" />

      <div className="carrier-hero__intro" hidden={!!active}>
        <p className="carrier-hero__eyebrow">
          CVN-{HULL} · Flight deck · {profile.location.label}
        </p>
        <h1 className="carrier-hero__name">{profile.name}</h1>
        <p className="carrier-hero__role">{profile.role}</p>
        <p className="carrier-hero__summary">{profile.summary}</p>
        <div className="carrier-hero__actions">
          <button type="button" className="btn btn--primary" onClick={(e) => launch(DECK[0].slug, e.currentTarget)}>
            Launch a project
          </button>
          <a className="btn" href="#experience">
            Career log
          </a>
          <a className="btn btn--ghost" href="#contact">
            Contact
          </a>
        </div>
        <p className="carrier-hero__hint">
          {failed ? "Pick a project to open its mission card." : `Or pick any of the ${DECK.length} tagged aircraft forward of the island.`}
        </p>
        <ul className="deck-list" aria-label="Projects on deck">
          {DECK.map((p) => (
            <li key={p.slug}>
              <button type="button" className="btn" aria-pressed={open === p.slug} onClick={(e) => launch(p.slug, e.currentTarget)}>
                <span className="deck-list__modex">{p.modex}</span> {p.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <ul className="deck-tags" aria-label="Aircraft on deck, one per project">
        {DECK.map((p) => (
          <DeckTagItem
            key={p.slug}
            project={p}
            entry={entry(p.slug)}
            selected={open === p.slug}
            refFn={(el) => (el ? tagRefs.current.set(p.slug, el) : tagRefs.current.delete(p.slug))}
            onHover={hover}
            onLaunch={launch}
          />
        ))}
      </ul>

      <div className="deck-status" role="status">
        {!reduced && !failed && (
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={() => setPaused((v) => !v)}
            aria-label={paused ? "Resume flight ops" : "Pause flight ops"}
            title={paused ? "Resume flight ops" : "Pause flight ops"}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {paused ? <path d="M8 5l11 7-11 7Z" /> : <path d="M8 5v14M16 5v14" />}
            </svg>
          </button>
        )}
        <dl className="deck-status__readouts">
          <div>
            <dt>Cat 1</dt>
            <dd>{reduced || failed ? "Secured" : paused ? "Holding" : "Cycling, 8 s"}</dd>
          </div>
          <div>
            <dt>Cat 2</dt>
            <dd>{cat2 ? `${cat2.modex} ${PHASE_LABEL[entry(cat2.slug).phase].toLowerCase()}` : "Ready"}</dd>
          </div>
          <div>
            <dt>Recovery</dt>
            <dd>{recovering ? `${recovering.modex} ${PHASE_LABEL[entry(recovering.slug).phase].toLowerCase()}` : "Clear"}</dd>
          </div>
          {QUAD && (
            <div>
              <dt>UAS pad</dt>
              <dd>{entry(QUAD.slug).phase === "parked" ? "Ready" : `${QUAD.modex} ${PHASE_LABEL[entry(QUAD.slug).phase].toLowerCase()}`}</dd>
            </div>
          )}
          <div>
            <dt>Airborne</dt>
            <dd>{airborne.length ? airborne.map((p) => p.modex).join(", ") : "None"}</dd>
          </div>
          {SHOW_FPS && <FpsReadout scene={sceneRef} />}
        </dl>
      </div>

      <a className="carrier-hero__cue" href="#about">
        Full briefing below
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </a>

      <AnimatePresence>{active && <MissionCard key={active.slug} project={active} phase={entry(active.slug).phase} onClose={close} />}</AnimatePresence>
    </section>
  );
}

function FpsReadout({ scene }: { scene: { current: CarrierScene | null } }) {
  const [text, setText] = useState("–");
  useEffect(() => {
    const id = setInterval(() => {
      const s = scene.current?.stats();
      if (s) setText(`${s.fps.toFixed(0)} · Q${s.level}`);
    }, 500);
    return () => clearInterval(id);
  }, [scene]);
  return (
    <div>
      <dt>FPS</dt>
      <dd>{text}</dd>
    </div>
  );
}

interface TagProps {
  project: DeckProject;
  entry: DeckEntry;
  selected: boolean;
  refFn: (el: HTMLLIElement | null) => void;
  onHover: (slug: string | null) => void;
  onLaunch: (slug: string, trigger: HTMLElement) => void;
}

function DeckTagItem({ project: p, entry, selected, refFn, onHover, onLaunch }: TagProps) {
  const parked = entry.state === "parked";
  return (
    <li ref={refFn} className="deck-tag" data-hidden="true" data-state={entry.state} data-selected={selected}>
      <button
        type="button"
        className="deck-tag__btn"
        aria-pressed={selected}
        aria-label={`${p.name}: ${p.tagline}. ${parked ? "Launch" : PHASE_LABEL[entry.phase]}.`}
        onPointerEnter={() => onHover(p.slug)}
        onPointerLeave={() => onHover(null)}
        onFocus={() => onHover(p.slug)}
        onBlur={() => onHover(null)}
        onClick={(e) => onLaunch(p.slug, e.currentTarget)}
      >
        <span className="deck-tag__chip">
          <span className="deck-tag__modex">{p.modex}</span>
          <span className="deck-tag__name">{p.name}</span>
          <span className="deck-tag__more">
            <span className="deck-tag__id">
              <Silhouette vehicle={p.vehicle} />
              <span>
                <span className="deck-tag__type">{p.vehicle === "quadcopter" ? "Group 1 quadcopter" : "F-35C Lightning II"}</span>
                {p.vehicle === "quadcopter" && (
                  <span className="deck-tag__spec">
                    {GROUPS[1].weight} · {GROUPS[1].altitude}
                  </span>
                )}
                <span className="deck-tag__tagline">{p.tagline}</span>
              </span>
            </span>
            <span className="deck-tag__action">{parked ? "Click to launch" : PHASE_LABEL[entry.phase]}</span>
          </span>
        </span>
        <span className="deck-tag__stem" />
        <span className="deck-tag__ring" />
      </button>
    </li>
  );
}

/** A crisp top view of the type, nose up, so it reads even where the ASCII is rough. */
function Silhouette({ vehicle }: { vehicle: DeckProject["vehicle"] }) {
  if (vehicle === "quadcopter")
    return (
      <svg className="deck-tag__plan" viewBox="-7.2 -8.2 14.4 16.8" aria-hidden="true">
        <path d="M-4.2 -4.2L4.2 4.2M4.2 -4.2L-4.2 4.2" />
        <rect x="-1.3" y="-1.3" width="2.6" height="2.6" rx="0.4" />
        {[-4.2, 4.2].flatMap((x) => [-4.2, 4.2].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="2.4" />))}
      </svg>
    );
  return (
    <svg className="deck-tag__plan" viewBox="-7.2 -8.2 14.4 16.8" aria-hidden="true">
      <path d={PLANFORM} />
    </svg>
  );
}

function MissionCard({ project: p, phase, onClose }: { project: DeckProject; phase: Phase; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  return (
    <m.aside
      ref={ref}
      className="mission"
      tabIndex={-1}
      aria-labelledby="mission-title"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.22 }}
    >
      <header className="mission__head">
        <p className="mission__status">
          <span className={`led ${phase === "airborne" ? "led--ok" : "led--caution"}`} aria-hidden="true" />
          Mission {p.modex} · {PHASE_LABEL[phase]}
        </p>
        <button type="button" className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Close and recover the aircraft" title="Close (Esc)">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>
      <h2 id="mission-title" className="mission__name">
        {p.name}
      </h2>
      <p className="mission__tagline">{p.tagline}</p>
      <p>{p.description}</p>
      <ul className="mission__highlights">
        {p.highlights.map((h, i) => (
          <li key={i}>{h}</li>
        ))}
      </ul>
      <dl className="mission__meta">
        <div>
          <dt>Built with</dt>
          <dd>{p.tech.join(", ")}</dd>
        </div>
        <div>
          <dt>Platforms</dt>
          <dd>{groupRange(p.groups)}</dd>
        </div>
      </dl>
      <p className="mission__links">
        {p.repo && (
          <a className="btn" href={p.repo} target="_blank" rel="noopener">
            View code
          </a>
        )}
        {p.demo && (
          <a className="btn btn--ghost" href={p.demo} target="_blank" rel="noopener">
            Live demo
          </a>
        )}
        <a className="btn btn--ghost" href={`#project-${p.slug}`}>
          Full write-up
        </a>
      </p>
      <button type="button" className="btn mission__recover" onClick={onClose}>
        Recover aircraft
      </button>
    </m.aside>
  );
}
