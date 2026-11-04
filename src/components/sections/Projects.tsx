import { profile } from "../../data/profile";
import { groupRange } from "../../lib/uas";
import { AstrumCaseStudy } from "../astrum/AstrumCaseStudy";
import { GitHubRepos } from "./GitHubRepos";
import { Section } from "./Section";

export function Projects() {
  return (
    <Section
      id="projects"
      title="Projects"
      intro="ASTRUM, the flight simulation platform most of my personal work runs on, and what I've built with it. Then other personal and open-source work; most of my professional work isn't public."
    >
      <AstrumCaseStudy />
      <h3 className="projects__more">Other work</h3>
      <div className="projects">
        {profile.projects.map((p) => (
          <article key={p.slug} id={`project-${p.slug}`} className="project">
            <header className="project__head">
              <h3 className="project__name">{p.name}</h3>
              <p className="project__tagline">{p.tagline}</p>
            </header>
            {p.image && <img className="project__image" src={p.image} alt={`Screenshot of ${p.name}`} loading="lazy" />}
            <p>{p.description}</p>
            <ul className="project__highlights">
              {p.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
            <dl className="project__meta">
              <div>
                <dt>Built with</dt>
                <dd>{p.tech.join(", ")}</dd>
              </div>
              <div>
                <dt>Platforms</dt>
                <dd>{groupRange(p.groups)}</dd>
              </div>
            </dl>
            {(p.repo || p.demo) && (
              <p className="project__links">
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
              </p>
            )}
          </article>
        ))}
      </div>
      <GitHubRepos />
    </Section>
  );
}
