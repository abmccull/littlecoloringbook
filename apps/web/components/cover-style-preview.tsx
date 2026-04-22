type CoverStylePreviewProps = {
  styleCode: string;
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

export function CoverStylePreview({
  styleCode,
  kicker,
  subtitle = "A little coloring book",
  title,
}: CoverStylePreviewProps) {
  const titleLines = splitTitle(title);

  return (
    <div className={`cover-style-preview cover-style-preview-${styleCode}`}>
      <div className="cover-style-preview-book">
        <span aria-hidden="true" className="cover-style-preview-spine" />
        <div className="cover-style-preview-surface">
          <div aria-hidden="true" className="cover-style-preview-art">
            {styleCode === "storybook" ? (
              <>
                <span className="cover-style-preview-frame-line" />
                <span className="cover-style-preview-corner cover-style-preview-corner-tl" />
                <span className="cover-style-preview-corner cover-style-preview-corner-tr" />
                <span className="cover-style-preview-corner cover-style-preview-corner-bl" />
                <span className="cover-style-preview-corner cover-style-preview-corner-br" />
              </>
            ) : null}

            {styleCode === "sunshine" ? (
              <>
                <span className="cover-style-preview-sun" />
                <span className="cover-style-preview-cloud cover-style-preview-cloud-left" />
                <span className="cover-style-preview-cloud cover-style-preview-cloud-right" />
                <span className="cover-style-preview-hill" />
              </>
            ) : null}

            {styleCode === "crayon" ? (
              <>
                <span className="cover-style-preview-doodle cover-style-preview-doodle-star" />
                <span className="cover-style-preview-doodle cover-style-preview-doodle-heart" />
                <span className="cover-style-preview-doodle cover-style-preview-doodle-loop" />
              </>
            ) : null}

            {styleCode === "minimal" ? (
              <>
                <span className="cover-style-preview-rule cover-style-preview-rule-top" />
                <span className="cover-style-preview-rule cover-style-preview-rule-bottom" />
                <span className="cover-style-preview-dot-grid" />
              </>
            ) : null}
          </div>

          <div className="cover-style-preview-copy">
            <span className="cover-style-preview-kicker">{kicker}</span>
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
