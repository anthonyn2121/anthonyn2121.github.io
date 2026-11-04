import { profile } from "../../data/profile";
import { Section } from "./Section";

export function Contact() {
  return (
    <Section id="contact" title="Contact">
      <div className="contact">
        <p className="contact__lede">The fastest way to reach me is email.</p>
        <a className="contact__email" href={`mailto:${profile.email}`}>
          {profile.email}
        </a>
        <ul className="contact__links">
          {profile.links.map((l) => (
            <li key={l.href}>
              <a className="btn btn--ghost" href={l.href} target="_blank" rel="noopener">
                {l.label}
              </a>
            </li>
          ))}
          <li>
            <a className="btn btn--ghost" href={profile.resumeUrl} target="_blank" rel="noopener">
              Resume (PDF)
            </a>
          </li>
        </ul>
        <p className="contact__note">
          Based in {profile.location.label}. {profile.availability.detail}.
        </p>
      </div>
    </Section>
  );
}
