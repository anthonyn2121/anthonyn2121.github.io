import { Panel } from "../components/Panel";
import type { Figure } from "../data/figures";
import type { Story } from "../data/myths";
import { profile } from "../data/profile";
import { bestMonth, formatDec, formatRa, visibility } from "./astro";
import type { Constellation } from "./catalog";

interface Props {
  constellation: Constellation;
  story?: Story;
  figure?: Figure;
  /** The stories in this story's group, in order, for the previous and next links. */
  group: Story[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

/** The selected constellation: its myth if it has one, otherwise a short fact card. */
export function StoryCard({ constellation: c, story, figure, group, onSelect, onClose }: Props) {
  const i = story ? group.indexOf(story) : -1;
  const prev = i > 0 ? group[i - 1] : undefined;
  const next = i >= 0 && i < group.length - 1 ? group[i + 1] : undefined;
  const star = c.brightest;

  return (
    <Panel
      id="story"
      title={c.name}
      plain={c.meaning === c.name ? undefined : c.meaning}
      className="skies__card"
      meta={
        <>
          <span className="story__coords">
            RA {formatRa(c.center[0])} · Dec {formatDec(c.center[1])}
          </span>
          <button type="button" className="btn btn--ghost btn--icon story__close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </>
      }
    >
      <div className="story">
        {story ? (
          <>
            <p className="story__kicker">{story.group}</p>
            <h3 className="story__title">{story.title}</h3>
            <p className="story__figure">{story.figure}</p>
            <div className="story__text">
              {story.story.map((p, k) => (
                <p key={k}>{p}</p>
              ))}
            </div>
          </>
        ) : (
          <>
            <h3 className="story__title">{c.meaning}</h3>
            <p className="story__figure">
              One of the 88 constellations recognised by the International Astronomical Union.
            </p>
          </>
        )}

        <dl className="datablock story__facts">
          {star && (
            <div>
              <dt>Brightest star</dt>
              <dd>
                {star.name ? `${star.name} (${star.desig})` : star.desig}, magnitude {star.mag.toFixed(1)}
              </dd>
            </div>
          )}
          <div>
            <dt>Highest at 9 PM</dt>
            <dd>{bestMonth(c.center[0])}</dd>
          </div>
          <div>
            <dt>From {profile.location.label}</dt>
            <dd>{visibility(c.dec, c.center[1], profile.location.lat)}</dd>
          </div>
        </dl>

        {story && story.sources.length > 0 && (
          <>
            <h4 className="story__heading">Sources</h4>
            <ul className="story__sources">
              {story.sources.map((s, k) => (
                <li key={k}>
                  {s.author}, <cite>{s.work}</cite> {s.ref}
                </li>
              ))}
            </ul>
          </>
        )}

        {figure && (
          <p className="story__credit">
            Figure: {figure.credit.author}, <cite>{figure.credit.atlas}</cite> ({figure.credit.year}), plate “
            {figure.credit.plate}”. {figure.credit.license},{" "}
            <a href={figure.credit.source} target="_blank" rel="noopener">
              scan on Wikimedia Commons
            </a>
            .
          </p>
        )}

        {(prev || next) && (
          <nav className="story__nav" aria-label="More of this story">
            {prev && (
              <button type="button" className="btn btn--ghost" onClick={() => onSelect(prev.id)}>
                ← {prev.title}
              </button>
            )}
            {next && (
              <button type="button" className="btn story__next" onClick={() => onSelect(next.id)}>
                {next.title} →
              </button>
            )}
          </nav>
        )}
      </div>
    </Panel>
  );
}
