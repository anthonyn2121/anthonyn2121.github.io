import { profile } from "../../data/profile";
import { groupRange } from "../../lib/uas";
import { Panel } from "./Panel";

export function OperatorPanel() {
  const allGroups = profile.platforms.map((p) => p.group);
  return (
    <Panel id="operator" title="Operator" plain="About me" titleAs="p" meta={profile.callsign} className="panel--operator">
      <div className="operator">
        <div className="operator__ident">
          {profile.photo && <img className="operator__photo" src={profile.photo} alt="" width={72} height={72} />}
          <div>
            <h1 className="operator__name">{profile.name}</h1>
            <p className="operator__role">{profile.role}</p>
          </div>
        </div>
        <p className="operator__summary">{profile.summary}</p>

        <dl className="datablock">
          <div>
            <dt>Based in</dt>
            <dd>{profile.location.label}</dd>
          </div>
          <div>
            <dt>Experience</dt>
            <dd>{profile.yearsExperience} years</dd>
          </div>
          <div>
            <dt>Platforms</dt>
            <dd>{groupRange(allGroups)}</dd>
          </div>
          <div>
            <dt>Clearance</dt>
            <dd>{profile.clearance}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`led ${profile.availability.open ? "led--ok" : "led--caution"}`} aria-hidden="true" />
              {profile.availability.detail}
            </dd>
          </div>
        </dl>

        <div className="operator__actions">
          <a className="btn btn--primary" href={profile.resumeUrl} target="_blank" rel="noopener">
            Download resume
          </a>
          <a className="btn" href={`mailto:${profile.email}`}>
            Email me
          </a>
          {profile.links.map((l) => (
            <a key={l.href} className="btn btn--ghost" href={l.href} target="_blank" rel="noopener">
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </Panel>
  );
}
