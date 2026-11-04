import { astrum, type ArchId, type AstrumProject, type Visual } from "../../data/astrum";
import { ArchitectureDiagram, TickStepper } from "./Architecture";
import { CourseChart, CurveChart, PerfBars } from "./Charts";
import type { ReplayData } from "./data";
import { archHighlight } from "./highlight";
import { ReplayPlayer, type Callout } from "./ReplayPlayer";

/*
 * The ASTRUM case study at the top of the Projects section: what it is, how it works, why its
 * flight is realistic, and what's been built on it. Content lives in src/data/astrum.ts.
 */

const name = (slug: string) => astrum.projects.find((p) => p.slug === slug)?.name ?? slug;

/** Copy that starts "Placeholder:" is styled as a note to replace. */
function Copy({ text, as: Tag = "p" }: { text: string; as?: "p" | "li" | "span" }) {
  return <Tag className={text.startsWith("Placeholder:") ? "placeholder" : undefined}>{text}</Tag>;
}

const splitSCallouts = (d: ReplayData): Callout[] => {
  const s = d.summary;
  if (!s) return [];
  return [
    { t: s.t_inverted, label: "Rolled inverted" },
    { t: s.t_nose_low, label: `Nose ${-s.min_pitch_deg}° below the horizon, pulling through` },
    { t: s.t_level, label: `Out the bottom ${s.alt_loss_m.toLocaleString()} m lower, peak ${s.nz_max} g` },
  ];
};

export function VisualFor({ visual, compact }: { visual: Visual; compact?: boolean }) {
  if (visual.kind === "curve") return <CurveChart src={visual.src} caption={visual.caption} />;
  if (visual.kind === "course") return <CourseChart src={visual.src} caption={visual.caption} />;
  const formation = visual.src.endsWith("formation.json");
  return (
    <ReplayPlayer
      src={visual.src}
      caption={visual.caption}
      compact={compact}
      labels={formation ? ["Leader", "Followers"] : ["Learner", "Tier-3 opponent"]}
    />
  );
}

export function AstrumCaseStudy() {
  const roots = astrum.projects.filter((p) => !astrum.projects.some((q) => q.ledTo?.includes(p.slug)));
  return (
    <article className="astrum" id="astrum" aria-labelledby="astrum-title">
      <header className="astrum__head">
        <p className="astrum__eyebrow">Flagship project</p>
        <h3 id="astrum-title" className="astrum__name">
          {astrum.name}
        </h3>
        <p className="astrum__tagline">{astrum.tagline}</p>
        {astrum.summary.map((s) => (
          <Copy key={s} text={s} />
        ))}
        <ul className="astrum__stats">
          {astrum.stats.map((s) => (
            <li key={s.value}>
              <span className="astrum__stat">{s.value}</span> {s.label}
            </li>
          ))}
        </ul>
        <p className="astrum__links">
          {astrum.repo ? (
            <a className="btn" href={astrum.repo} target="_blank" rel="noopener">
              View code
            </a>
          ) : (
            <span className="astrum__private">The repository is private for now; happy to walk through it.</span>
          )}
          <a className="btn btn--ghost" href="#astrum-built-on">
            What I built on it
          </a>
        </p>
      </header>

      <section className="astrum__chapter" aria-labelledby="astrum-how">
        <h4 id="astrum-how" className="astrum__chapter-title">
          <span className="astrum__num">01</span> How it works
        </h4>
        <p>
          One authoritative state server, and everything else outside it. Controllers, recorders and the viewer are separate processes that only ever
          touch the sim through Zenoh and Cap'n Proto, never shared memory; the RL environment steps the same sim in-process. Hover a part to see what
          it does.
        </p>
        <ArchitectureDiagram />
        <p>Every tick runs one chained schedule. Physics advances exactly one step of 1/rate per loop; speed only paces it against the wall clock.</p>
        <TickStepper />
      </section>

      <section className="astrum__chapter" aria-labelledby="astrum-real">
        <h4 id="astrum-real" className="astrum__chapter-title">
          <span className="astrum__num">02</span> Realistic flight
        </h4>
        <p>
          Each aircraft is a full six-degree-of-freedom JSBSim model, not a kinematic point. Below, an F-16 flies a split-S in ASTRUM: watch altitude
          turn into airspeed and the load build through the pull. Pick a moment to jump to it.
        </p>
        <ReplayPlayer
          src={astrum.realism.replay.src}
          caption={astrum.realism.replay.caption}
          view="side"
          strips
          callouts={splitSCallouts}
        />
        <dl className="astrum__facts">
          {astrum.realism.facts.map((f) => (
            <div key={f.title}>
              <dt>{f.title}</dt>
              <dd>{f.text}</dd>
            </div>
          ))}
        </dl>
        <h5 className="astrum__sub">And it's fast</h5>
        <PerfBars />
      </section>

      <section className="astrum__chapter" id="astrum-built-on" aria-labelledby="astrum-built">
        <h4 id="astrum-built" className="astrum__chapter-title">
          <span className="astrum__num">03</span> Built on ASTRUM
        </h4>
        <p>
          Each project below plugs into a different part of the platform. Hover its <em>Uses</em> chips to light those parts up in the diagram above,
          and follow <em>Led to</em> to see how one became the next.
        </p>
        <ol className="lineage" aria-label="How the projects led to each other">
          {roots.map((r) => (
            <li key={r.slug} className="lineage__chain">
              {chain(r).map((p, i) => (
                <span key={p.slug} className="lineage__step">
                  {i > 0 && (
                    <span className="lineage__arrow" aria-hidden="true">
                      →
                    </span>
                  )}
                  <a href={`#astrum-${p.slug}`}>{p.name}</a>
                </span>
              ))}
            </li>
          ))}
        </ol>
        <div className="built">
          {astrum.projects.map((p) => (
            <BuiltOnCard key={p.slug} p={p} />
          ))}
        </div>
      </section>
    </article>
  );
}

/** Follows `ledTo` from a project, first branch only, to draw its line of descent. */
function chain(p: AstrumProject): AstrumProject[] {
  const out = [p];
  let next = p.ledTo?.[0];
  while (next) {
    const q = astrum.projects.find((x) => x.slug === next);
    if (!q || out.includes(q)) break;
    out.push(q);
    next = q.ledTo?.[0];
  }
  return out;
}

const USE_LABEL: Record<ArchId, string> = {
  sim: "State server",
  fdm: "JSBSim",
  geo: "Geodesy",
  bus: "Zenoh bus",
  env: "Embedded env",
  ctl: "Controllers",
  ctltool: "Run control",
  bag: "Recorder",
  web: "Viewer",
};

function BuiltOnCard({ p }: { p: AstrumProject }) {
  return (
    <article id={`astrum-${p.slug}`} className="built__card">
      <header className="built__head">
        <h5 className="built__name">{p.name}</h5>
        <span className={`built__status built__status--${p.status === "Shipped" ? "shipped" : "wip"}`}>{p.status}</span>
        <p className="built__tagline">{p.tagline}</p>
      </header>
      <div className="built__body">
        <div className="built__text">
          <p>
            <strong>Problem.</strong> {p.problem}
          </p>
          <p>
            <strong>Approach.</strong> {p.approach}
          </p>
          <ul className="project__highlights">
            {p.highlights.map((h) => (
              <Copy key={h} text={h} as="li" />
            ))}
          </ul>
          <p className="built__tech">{p.tech.join(" · ")}</p>
        </div>
        {p.visual && (
          <div className="built__visual">
            <VisualFor visual={p.visual} />
          </div>
        )}
      </div>
      <footer className="built__foot">
        <span className="built__foot-label">Uses</span>
        <ul className="built__uses">
          {p.uses.map((u) => (
            <li key={u}>
              <button
                type="button"
                className="chip"
                onPointerEnter={() => archHighlight.emit(p.uses)}
                onPointerLeave={() => archHighlight.emit(null)}
                onFocus={() => archHighlight.emit(p.uses)}
                onBlur={() => archHighlight.emit(null)}
                onClick={() => document.getElementById("astrum-how")?.scrollIntoView({ block: "center" })}
                title="Show in the architecture diagram"
              >
                {USE_LABEL[u]}
              </button>
            </li>
          ))}
        </ul>
        {p.ledTo && (
          <span className="built__led">
            Led to{" "}
            {p.ledTo.map((s) => (
              <a key={s} href={`#astrum-${s}`}>
                {name(s)}
              </a>
            ))}
          </span>
        )}
      </footer>
    </article>
  );
}
