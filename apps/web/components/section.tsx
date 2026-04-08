import { ReactNode } from "react";

type SectionProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  copy?: string;
  children: ReactNode;
};

export function Section({ id, eyebrow, title, copy, children }: SectionProps) {
  return (
    <section id={id} className="section">
      <div className="section-copy">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {copy ? <p className="lede">{copy}</p> : null}
      </div>
      {children}
    </section>
  );
}
