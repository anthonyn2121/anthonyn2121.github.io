import { profile } from "../../data/profile";
import { GROUPS } from "../../lib/uas";
import { AircraftIcon, GROUP_SCALE } from "../Aircraft";
import { Section } from "./Section";

export function Platforms() {
  return (
    <Section
      id="platforms"
      title="Platforms"
      intro="The U.S. Department of Defense sorts unmanned aircraft into five groups by weight, altitude, and speed. Here's what I've done in each."
    >
      <ol className="roster">
        {profile.platforms.map((p) => {
          const spec = GROUPS[p.group];
          return (
            <li key={p.group} className="roster__row">
              <div className="roster__art">
                <AircraftIcon group={p.group} size={Math.round(112 * GROUP_SCALE[p.group])} />
              </div>
              <div className="roster__spec">
                <h3 className="roster__group">Group {p.group}</h3>
                <dl>
                  <div>
                    <dt>Weight</dt>
                    <dd>{spec.weight}</dd>
                  </div>
                  <div>
                    <dt>Altitude</dt>
                    <dd>{spec.altitude}</dd>
                  </div>
                  <div>
                    <dt>Speed</dt>
                    <dd>{spec.speed}</dd>
                  </div>
                </dl>
              </div>
              <div className="roster__work">
                <p>{p.work}</p>
                <p className="roster__types">{p.types.join(", ")}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="skills">
        {profile.skills.map((s) => (
          <div key={s.area} className="skills__group">
            <h3 className="skills__area">{s.area}</h3>
            <p>{s.items.join(", ")}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
