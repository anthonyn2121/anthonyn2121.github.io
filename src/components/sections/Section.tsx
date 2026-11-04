import type { ReactNode } from "react";

interface Props {
  id: string;
  title: string;
  intro?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}

/** A detail section: heading column on the left, content on the right. */
export function Section({ id, title, intro, aside, children }: Props) {
  return (
    <section id={id} className="section" aria-labelledby={`${id}-heading`}>
      <div className="section__head">
        <h2 id={`${id}-heading`} className="section__title">
          {title}
        </h2>
        {intro && <p className="section__intro">{intro}</p>}
        {aside}
      </div>
      <div className="section__body">{children}</div>
    </section>
  );
}
