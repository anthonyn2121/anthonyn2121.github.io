import { profile } from "../../data/profile";
import { Section } from "./Section";

export function About() {
  return (
    <Section id="about" title="About">
      <div className="about">
        {profile.photo && <img className="about__photo" src={profile.photo} alt={profile.name} width={160} height={160} />}
        <div className="prose">
          {profile.about.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </Section>
  );
}
