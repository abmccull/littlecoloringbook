import { BrandLogo } from "./brand-logo";
import { TrackedLink } from "./tracked-link";

const footerLinks = [
  {
    label: "How it works",
    href: "/#homepage-proof-module",
    eventName: "site_footer_how_it_works_clicked",
  },
  {
    label: "Book sizes",
    href: "/#book-sizes",
    eventName: "site_footer_book_sizes_clicked",
  },
  {
    label: "Free sample",
    href: "/sample?source=site-footer&acquisitionPath=sample_first",
    eventName: "site_footer_sample_clicked",
  },
  {
    label: "Build my book",
    href: "/create?offer=pdf-100&source=site-footer&acquisitionPath=direct_buy",
    eventName: "site_footer_builder_clicked",
  },
] as const;

export function MarketingFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-shell">
        <div className="site-footer-brand">
          <BrandLogo href="/" subtitle="screen-free activity now, keepsake later" />
          <p className="muted">
            Turn the favorite photos already on your phone into pages your child will actually want to color.
          </p>
        </div>

        <div className="site-footer-links">
          <span className="site-footer-label">Explore</span>
          {footerLinks.map((link) => (
            <TrackedLink className="site-footer-link" eventName={link.eventName} href={link.href} key={link.label}>
              {link.label}
            </TrackedLink>
          ))}
        </div>

        <div className="site-footer-cta">
          <span className="site-footer-label">Best first move</span>
          <p className="muted">Start with one free sample page if you want to see your own photo before buying the full book.</p>
          <TrackedLink className="button button-primary" eventName="site_footer_primary_sample_clicked" href="/sample?source=site-footer-primary&acquisitionPath=sample_first">
            Get My Free Sample Page
          </TrackedLink>
        </div>
      </div>
    </footer>
  );
}
