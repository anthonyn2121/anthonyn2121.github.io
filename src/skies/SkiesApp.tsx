import {
  domAnimation,
  LazyMotion,
  m,
  MotionConfig,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Suspense, use, useCallback, useEffect, useRef, useState } from "react";
import { Reticle } from "../components/Reticle";
import { Clock, SECTIONS, StatusBar, type NavLink } from "../components/StatusBar";
import { figures } from "../data/figures";
import { myths, type Story } from "../data/myths";
import { profile } from "../data/profile";
import { skiesTitle } from "../data/skies";
import { usePrefersReducedMotion } from "../lib/hooks";
import { HOME_HREF, SKIES_HREF } from "../lib/pages";
import { ThemeProvider } from "../lib/theme";
import { formatDec, formatRa, siderealDeg } from "./astro";
import { loadSky, type Sky } from "./catalog";
import { PITCH_END, PITCH_START, PitchUp, VH_PER_DEG } from "./PitchUp";
import { SkyChart } from "./SkyChart";
import { skyCursorBus } from "./skyBus";
import { SkyGuide } from "./SkyGuide";
import { StoryCard } from "./StoryCard";

const NAV: NavLink[] = [
  ...SECTIONS.map((s) => ({ href: `${HOME_HREF}#${s.id}`, label: s.label })),
  { href: SKIES_HREF, label: skiesTitle, current: true },
];

const FEATURED: ReadonlySet<string> = new Set(myths.map((s) => s.id));

const GROUPS: [string, Story[]][] = [];
for (const s of myths) {
  const g = GROUPS.find(([name]) => name === s.group);
  if (g) g[1].push(s);
  else GROUPS.push([s.group, [s]]);
}

// Start fetching the catalog right away, so it loads while the transition plays.
const skyRequest = loadSky();

/** Phones start with the guide folded away. */
const PHONE = "(max-width: 760px)";
/** Below this width the guide and a story don't both fit, so opening a story folds the guide. */
const CROWDED = "(max-width: 1100px)";

const lst = (now: Date) => `LST ${formatRa(siderealDeg(now, profile.location.lon), true)}`;

/** The pointer's position on the sky, and local sidereal time at your home location. */
function SkyReadouts() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(
    () =>
      skyCursorBus.subscribe((ra, dec) => {
        if (ref.current) ref.current.textContent = `RA ${formatRa(ra, true)}  Dec ${formatDec(dec)}`;
      }),
    [],
  );
  return (
    <>
      <span className="readout readout--coords readout--sky" ref={ref} aria-hidden="true" />
      <Clock format={lst} />
    </>
  );
}

export function SkiesApp({ pitchUp }: { pitchUp: boolean }) {
  useEffect(() => {
    document.title = `${skiesTitle}, ${profile.name}`;
  }, []);

  return (
    <ThemeProvider>
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user">
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <StatusBar homeHref={HOME_HREF} nav={NAV} readouts={<SkyReadouts />} />
          <Page pitchUp={pitchUp} />
          <Reticle />
        </MotionConfig>
      </LazyMotion>
    </ThemeProvider>
  );
}

function Page({ pitchUp }: { pitchUp: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [pitching, setPitching] = useState(pitchUp && !reduced);
  const pitch = useMotionValue(pitching ? PITCH_START : PITCH_END);
  const done = useCallback(() => setPitching(false), []);

  return (
    <main id="main" className="skies">
      <Suspense fallback={<p className="skies__status">Loading the star catalog…</p>}>
        <Loaded pitch={pitch} pitching={pitching} />
      </Suspense>
      {pitching && <PitchUp pitch={pitch} onDone={done} />}
    </main>
  );
}

interface SkyProps {
  pitch: MotionValue<number>;
  /** True while the pitch-up plays. */
  pitching: boolean;
}

function Loaded(props: SkyProps) {
  const sky = use(skyRequest);
  if (!sky) return <p className="skies__status">The star catalog didn't load. Reload the page to try again.</p>;
  return <Planetarium sky={sky} {...props} />;
}

function Planetarium({ sky, pitch, pitching }: SkyProps & { sky: Sky }) {
  const [selected, setSelected] = useState<string | null>(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    return sky.byId.has(id) ? id : null;
  });
  const [guideOpen, setGuideOpen] = useState(() => !window.matchMedia(PHONE).matches);
  const clearRef = useRef<HTMLDivElement>(null);

  // The pitch-up: the sky comes down into view at the same rate as the horizon, then the panels fade in.
  const skyY = useTransform(pitch, (p) => `${(Math.max(p, 0) - PITCH_END) * VH_PER_DEG}vh`);
  const skyOpacity = useTransform(pitch, [5, 55], [0, 1]);
  const overlayOpacity = useTransform(pitch, [76, PITCH_END], [0, 1]);

  // Each constellation gets its own link, e.g. /skies/#Ori.
  const select = useCallback((id: string | null) => {
    setSelected(id);
    const { pathname, search } = window.location;
    window.history.replaceState(null, "", id ? `#${id}` : pathname + search);
    if (id && window.matchMedia(CROWDED).matches) setGuideOpen(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") select(null);
    };
    const onHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      setSelected(sky.byId.has(id) ? id : null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("hashchange", onHash);
    };
  }, [sky, select]);

  const c = selected ? sky.byId.get(selected) : undefined;
  const story = myths.find((s) => s.id === selected);
  const group = story ? (GROUPS.find(([g]) => g === story.group)?.[1] ?? []) : [];

  return (
    <div className={`skies__view ${pitching ? "is-pitching" : ""}`}>
      <m.div className="skies__sky" style={{ y: skyY, opacity: skyOpacity }}>
        <SkyChart sky={sky} featured={FEATURED} selected={selected} onSelect={select} clearRef={clearRef} />
      </m.div>
      <m.div className={`skies__overlay ${guideOpen ? "" : "is-guide-closed"}`} style={{ opacity: overlayOpacity }}>
        <SkyGuide
          sky={sky}
          groups={GROUPS}
          selected={selected}
          onSelect={select}
          open={guideOpen}
          onToggle={() => setGuideOpen((o) => !o)}
        />
        <div className="skies__clear" ref={clearRef} aria-hidden="true" />
        {c && (
          <StoryCard
            key={c.id}
            constellation={c}
            story={story}
            figure={figures[c.id]}
            group={group}
            onSelect={select}
            onClose={() => select(null)}
          />
        )}
      </m.div>
      <p className="visually-hidden" aria-live="polite">
        {c ? `Showing ${c.name}` : ""}
      </p>
    </div>
  );
}
