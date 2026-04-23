import {
  getCoverDesign,
  type CoverStyleCode,
} from "@littlecolorbook/shared";
import type { CSSProperties } from "react";

type CoverStylePreviewProps = {
  styleCode: CoverStyleCode | string;
  kicker: string;
  subtitle?: string;
  title: string;
};

function splitTitle(title: string) {
  const words = title.trim().split(/\s+/).filter(Boolean);

  if (words.length <= 2) {
    return [title.trim()];
  }

  if (words.length === 3) {
    return [words.slice(0, 2).join(" "), words[2]!];
  }

  const midpoint = Math.ceil(words.length / 2);
  return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
}

function cssVars(styleCode: string) {
  const design = getCoverDesign(styleCode);

  return {
    "--cover-paper": design.palette.paper,
    "--cover-paper-alt": design.palette.paperAlt,
    "--cover-ink": design.palette.ink,
    "--cover-muted": design.palette.muted,
    "--cover-accent": design.palette.accent,
    "--cover-accent-2": design.palette.accent2,
    "--cover-accent-3": design.palette.accent3,
    "--cover-foil": design.palette.foil,
  } as CSSProperties;
}

function MotifMarks({ motif }: { motif: string }) {
  return (
    <>
      <span className="cover-style-preview-mark cover-style-preview-mark-a" />
      <span className="cover-style-preview-mark cover-style-preview-mark-b" />
      <span className="cover-style-preview-mark cover-style-preview-mark-c" />
      <span className="cover-style-preview-mark cover-style-preview-mark-d" />
      <span className="cover-style-preview-line cover-style-preview-line-a" />
      <span className="cover-style-preview-line cover-style-preview-line-b" />
      {motif === "memory-album" || motif === "comic-panels" || motif === "creative-studio" ? (
        <>
          <span className="cover-style-preview-panel cover-style-preview-panel-a" />
          <span className="cover-style-preview-panel cover-style-preview-panel-b" />
        </>
      ) : null}
      {motif === "space-explorer" || motif === "starry-stage" || motif === "bedtime-story" ? (
        <>
          <span className="cover-style-preview-orbit cover-style-preview-orbit-a" />
          <span className="cover-style-preview-orbit cover-style-preview-orbit-b" />
        </>
      ) : null}
      {motif === "adventure-map" || motif === "field-notebook" || motif === "dino-discovery" ? (
        <span className="cover-style-preview-badge" />
      ) : null}
    </>
  );
}

export function CoverStylePreview({
  styleCode,
  kicker,
  subtitle = "A little coloring book",
  title,
}: CoverStylePreviewProps) {
  const design = getCoverDesign(styleCode);
  const titleLines = splitTitle(title);
  const kickerText = kicker.trim();

  return (
    <div
      className={`cover-style-preview cover-style-preview-premium cover-style-preview-${design.motif} cover-style-preview-type-${design.typography}`}
      style={cssVars(design.id)}
    >
      <div className="cover-style-preview-book">
        <span aria-hidden="true" className="cover-style-preview-spine" />
        <div className="cover-style-preview-surface">
          <div aria-hidden="true" className="cover-style-preview-art">
            <MotifMarks motif={design.motif} />
          </div>

          <div aria-hidden="true" className={`cover-style-preview-hero cover-style-preview-hero-${design.heroTreatment}`}>
            <span className="cover-style-preview-hero-inner">LC</span>
          </div>

          <div className="cover-style-preview-copy">
            {kickerText ? <span className="cover-style-preview-kicker">{kickerText}</span> : null}
            <div className="cover-style-preview-title" aria-label={title}>
              {titleLines.map((line) => (
                <span className="cover-style-preview-title-line" key={line}>
                  {line}
                </span>
              ))}
            </div>
            <span className="cover-style-preview-subtitle">{subtitle}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
