import { profile } from "../../data/profile";
import { groupRange } from "../../lib/uas";
import { Section } from "./Section";

export function Experience() {
  const entries = [...profile.experience].reverse();
  return (
    <Section
      id="experience"
      title="Experience"
      intro={`${profile.yearsExperience} years, from university research to high-altitude autonomy.`}
      aside={
        <a className="btn btn--primary section__cta" href={profile.resumeUrl} target="_blank" rel="noopener">
          Download resume (PDF)
        </a>
      }
    >
      <ol className="log" reversed>
        {entries.map((e, i) => (
          <li key={e.id} id={`exp-${e.id}`} className={`log__entry ${i === 0 ? "is-current" : ""}`}>
            <div className="log__marker" aria-hidden="true">
              <span className="log__diamond" />
            </div>
            <p className="log__when">
              <span className="log__wp">{e.id}</span>
              <span>
                {e.start} to {e.end}
              </span>
            </p>
            <h3 className="log__role">{e.role}</h3>
            <p className="log__org">
              {e.org}, {e.location}
            </p>
            <p className="tag">{groupRange(e.groups)}</p>
            <p className="log__summary">{e.summary}</p>
            <ul className="log__highlights">
              {e.highlights.map((h, j) => (
                <li key={j}>{h}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </Section>
  );
}
