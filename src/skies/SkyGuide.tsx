import { useMemo, type ChangeEvent } from "react";
import { Panel } from "../components/Panel";
import { figures } from "../data/figures";
import type { Story } from "../data/myths";
import { skiesTitle, stargazingNote } from "../data/skies";
import { HOME_HREF } from "../lib/pages";
import type { Sky } from "./catalog";

interface Props {
  sky: Sky;
  groups: [string, Story[]][];
  selected: string | null;
  onSelect: (id: string) => void;
  open: boolean;
  onToggle: () => void;
}

const atlases = [...new Set(Object.values(figures).map((f) => f && `${f.credit.author}'s ${f.credit.atlas}`))].filter(
  Boolean,
);

/** The page's heading panel: your note, the story list, every constellation, and credits. */
export function SkyGuide({ sky, groups, selected, onSelect, open, onToggle }: Props) {
  const sorted = useMemo(() => [...sky.constellations].sort((a, b) => a.name.localeCompare(b.name)), [sky]);

  const onPick = (e: ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value) onSelect(e.target.value);
  };

  return (
    <Panel
      id="sky-guide"
      title={skiesTitle}
      plain="Stars and stories"
      titleAs="h1"
      className={`skies__guide ${open ? "" : "is-collapsed"}`}
      meta={
        <button
          type="button"
          className="btn btn--ghost btn--icon guide__toggle"
          aria-expanded={open}
          aria-controls="sky-guide-body"
          aria-label={open ? "Hide the guide" : "Show the guide"}
          onClick={onToggle}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={open ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
          </svg>
        </button>
      }
    >
      <div id="sky-guide-body" className="guide" hidden={!open}>
        <div className="guide__note">
          {stargazingNote.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <p className="guide__hint">
          Drag to turn the sky, scroll or pinch to zoom, and click a constellation to open it. The glowing ones have
          stories.
        </p>

        {groups.map(([group, stories], g) => (
          <section key={group} className="guide__group" aria-labelledby={`guide-group-${g}`}>
            <h2 id={`guide-group-${g}`} className="guide__heading">
              {group}
            </h2>
            <ul className="guide__stories">
              {stories.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="guide__story"
                    aria-pressed={selected === s.id}
                    onClick={() => onSelect(s.id)}
                  >
                    <span className="guide__glow" aria-hidden="true" />
                    <span className="guide__story-title">{s.title}</span>
                    <span className="guide__story-name">{sky.byId.get(s.id)?.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <label className="guide__all">
          <span className="guide__heading">Every constellation</span>
          <select className="guide__select" value={selected ?? ""} onChange={onPick}>
            <option value="">Choose one of the 88</option>
            {sorted.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.meaning === c.name ? "" : `, ${c.meaning}`}
              </option>
            ))}
          </select>
        </label>

        <div className="guide__foot">
          <a className="btn btn--ghost" href={HOME_HREF}>
            Back to the ground
          </a>
          <details className="guide__credits">
            <summary>Credits</summary>
            <ul>
              <li>
                Stars, constellation lines and boundaries, and the Milky Way:{" "}
                <a href="https://github.com/ofrohn/d3-celestial" target="_blank" rel="noopener">
                  d3-celestial
                </a>{" "}
                by Olaf Frohn (
                <a href={`${import.meta.env.BASE_URL}skies/LICENSE-d3-celestial.txt`} target="_blank" rel="noopener">
                  BSD licence
                </a>
                ), compiled from Hipparcos (XHIP), the IAU, Davenhall and Leggett (1989), and Jose R. Vieira.
              </li>
              {atlases.length > 0 && <li>Figures: {atlases.join(" and ")}, public domain, via Wikimedia Commons.</li>}
              <li>Myths retold from the sources listed with each story.</li>
              <li>Type: EB Garamond and B612, both under the SIL Open Font License.</li>
            </ul>
          </details>
        </div>
      </div>
    </Panel>
  );
}
