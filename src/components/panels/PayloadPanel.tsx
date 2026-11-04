import { AnimatePresence, m } from "motion/react";
import { useMemo, useState } from "react";
import { profile } from "../../data/profile";
import { contours } from "../../lib/topo";
import { Panel } from "./Panel";

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

/** Placeholder sensor imagery: terrain seen from the payload, unique per project. */
function FeedTerrain({ seed }: { seed: number }) {
  const lines = useMemo(() => contours({ width: 480, height: 300, seed, cell: 6, hills: 6, levels: 11 }), [seed]);
  return (
    <svg className="payload__terrain" viewBox="0 0 480 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {lines.map((l, i) => (
        <path key={i} d={l.d} className={l.index ? "is-index" : undefined} />
      ))}
    </svg>
  );
}

interface Props {
  index: number;
  setIndex: (i: number) => void;
}

export function PayloadPanel({ index, setIndex }: Props) {
  const projects = profile.projects;
  const n = projects.length;
  const p = projects[index];
  const [dir, setDir] = useState(1);

  const go = (delta: number) => {
    setDir(delta);
    setIndex((index + delta + n) % n);
  };

  return (
    <Panel id="payload" title="Payload" plain="Featured projects" meta={`Project ${index + 1} of ${n}`} className="panel--payload">
      <div className="payload">
        <div className="payload__frame">
          <AnimatePresence initial={false} custom={dir} mode="popLayout">
            <m.div
              key={p.slug}
              className="payload__feed"
              custom={dir}
              variants={{
                enter: (d: number) => ({ x: `${d * 30}%`, opacity: 0, filter: "blur(4px)" }),
                center: { x: "0%", opacity: 1, filter: "blur(0px)" },
                exit: (d: number) => ({ x: `${d * -30}%`, opacity: 0, filter: "blur(4px)" }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
            >
              {p.image ? <img src={p.image} alt="" /> : <FeedTerrain seed={hash(p.slug)} />}
            </m.div>
          </AnimatePresence>
          <div className="payload__overlay" aria-hidden="true">
            <span className="payload__corner payload__corner--tl" />
            <span className="payload__corner payload__corner--tr" />
            <span className="payload__corner payload__corner--bl" />
            <span className="payload__corner payload__corner--br" />
            <span className="payload__crosshair" />
            <span className="payload__mode">EO</span>
            <span className="payload__track">{p.name}</span>
          </div>
        </div>

        <div className="payload__info">
          <h3 className="payload__name">{p.name}</h3>
          <p className="payload__tagline">{p.tagline}</p>
          <p className="payload__tech">{p.tech.join(", ")}</p>
          <p className="payload__links">
            <a href={`#project-${p.slug}`}>Details</a>
            {p.repo && (
              <a href={p.repo} target="_blank" rel="noopener">
                Code
              </a>
            )}
            {p.demo && (
              <a href={p.demo} target="_blank" rel="noopener">
                Live demo
              </a>
            )}
          </p>
          <div className="payload__controls">
            <button type="button" className="btn btn--icon" onClick={() => go(-1)} aria-label="Previous project">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <button type="button" className="btn btn--icon" onClick={() => go(1)} aria-label="Next project">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Panel>
  );
}
