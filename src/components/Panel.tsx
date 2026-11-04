import type { ReactNode } from "react";

interface PanelProps {
  id: string;
  title: string;
  /** What the panel holds, in plain language, for visitors who don't know GCS terms. */
  plain?: string;
  /** Use "p" when the panel holds the page's h1 elsewhere, or "h1" when the title is the page heading. */
  titleAs?: "h1" | "h2" | "p";
  /** Short status text on the right of the title bar. */
  meta?: ReactNode;
  status?: "ok" | "caution" | "active";
  className?: string;
  children: ReactNode;
}

export function Panel({ id, title, plain, titleAs: Title = "h2", meta, status = "ok", className = "", children }: PanelProps) {
  return (
    <section className={`panel ${className}`} aria-labelledby={`${id}-title`}>
      <header className="panel__bar">
        <span className={`led led--${status}`} aria-hidden="true" />
        <Title id={`${id}-title`} className="panel__title">
          {title}
          {plain && (
            <span className="panel__plain">
              <span className="visually-hidden">, </span>
              {plain}
            </span>
          )}
        </Title>
        {meta && <span className="panel__meta">{meta}</span>}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}
