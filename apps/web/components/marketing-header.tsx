import { BrandLogo } from "./brand-logo";
import { TrackedLink } from "./tracked-link";

const navLinks = [
  {
    label: "How it works",
    href: "/#homepage-proof-module",
    eventName: "site_nav_how_it_works_clicked",
  },
  {
    label: "Book sizes",
    href: "/#book-sizes",
    eventName: "site_nav_book_sizes_clicked",
  },
  {
    label: "FAQ",
    href: "/#faq",
    eventName: "site_nav_faq_clicked",
  },
] as const;

type MarketingHeaderProps = {
  subtitle?: string;
};

export function MarketingHeader({ subtitle = "personalized coloring books from your photos" }: MarketingHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header-shell">
        <BrandLogo href="/" priority subtitle={subtitle} />

        <nav aria-label="Primary" className="site-nav">
          {navLinks.map((link) => (
            <TrackedLink className="site-nav-link" eventName={link.eventName} href={link.href} key={link.label}>
              {link.label}
            </TrackedLink>
          ))}
        </nav>

        <div className="site-header-actions">
          <TrackedLink className="button button-secondary" eventName="site_header_builder_clicked" href="/create?offer=pdf-100&source=site-header&acquisitionPath=direct_buy">
            Build My Book
          </TrackedLink>
          <TrackedLink className="button button-primary" eventName="site_header_sample_clicked" href="/sample?source=site-header&acquisitionPath=sample_first">
            Get Free Sample
          </TrackedLink>
        </div>

        <details className="site-mobile-menu">
          <summary>Menu</summary>
          <div className="site-mobile-panel">
            <nav aria-label="Mobile primary" className="site-mobile-links">
              {navLinks.map((link) => (
                <TrackedLink className="site-mobile-link" eventName={link.eventName} href={link.href} key={link.label}>
                  {link.label}
                </TrackedLink>
              ))}
            </nav>
            <div className="site-mobile-actions">
              <TrackedLink className="button button-secondary" eventName="site_mobile_builder_clicked" href="/create?offer=pdf-100&source=site-mobile-nav&acquisitionPath=direct_buy">
                Build My Book
              </TrackedLink>
              <TrackedLink className="button button-primary" eventName="site_mobile_sample_clicked" href="/sample?source=site-mobile-nav&acquisitionPath=sample_first">
                Get Free Sample
              </TrackedLink>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
