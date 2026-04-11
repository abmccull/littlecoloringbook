import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  priority?: boolean;
  size?: "header" | "cover";
  subtitle?: string;
};

export function BrandLogo({ href, priority = false, size = "header", subtitle }: BrandLogoProps) {
  const content = (
    <>
      <Image
        alt="Little Color Book"
        className={`brand-logo-image brand-logo-image-${size}`}
        height={289}
        priority={priority}
        src="/brand-logo.png"
        width={784}
      />
      {subtitle ? <span className="brand-logo-subtitle">{subtitle}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link aria-label="Little Color Book home" className={`brand-logo brand-logo-${size}`} href={href}>
        {content}
      </Link>
    );
  }

  return <div className={`brand-logo brand-logo-${size}`}>{content}</div>;
}
