import type { FaqItem } from "../lib/consumer-content";

type FaqAccordionProps = {
  items: FaqItem[];
  openFirstItem?: boolean;
};

export function FaqAccordion({ items, openFirstItem = true }: FaqAccordionProps) {
  return (
    <div className="faq-accordion">
      {items.map((item, index) => (
        <details className="faq-item" key={item.question} open={openFirstItem && index === 0}>
          <summary className="faq-summary">
            <h3>{item.question}</h3>
            <span aria-hidden="true" className="faq-icon">
              +
            </span>
          </summary>
          <div className="faq-answer">
            <p className="muted">{item.answer}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
