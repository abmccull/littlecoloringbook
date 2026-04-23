import {
  featuredCoverDesigns,
  moreCoverDesigns,
  type CoverDesign,
  type CoverStyleCode,
} from "@littlecolorbook/shared";
import { CoverStylePreview } from "./cover-style-preview";

type CoverDesignPickerProps = {
  kicker: string;
  onSelect: (styleCode: CoverStyleCode) => void;
  selected: CoverStyleCode;
  subtitle?: string;
  title: string;
};

function CoverDesignSection({
  designs,
  kicker,
  label,
  onSelect,
  selected,
  subtitle,
  title,
}: CoverDesignPickerProps & {
  designs: readonly CoverDesign[];
  label: string;
}) {
  return (
    <div className="cover-style-picker-section">
      <div className="cover-style-picker-head">
        <span className="pill pill-sun">{label}</span>
        <p className="muted">
          {label === "Featured covers"
            ? "The strongest universal directions appear first."
            : "More premium directions for specific kids, occasions, and camera rolls."}
        </p>
      </div>
      <div className="cover-style-grid cover-style-grid-premium">
        {designs.map((design) => {
          const isActive = selected === design.id;

          return (
            <button
              key={design.id}
              className={`cover-style-card cover-style-card-premium${isActive ? " active" : ""}`}
              type="button"
              onClick={() => onSelect(design.id as CoverStyleCode)}
            >
              <div className="cover-style-card-media">
                <CoverStylePreview
                  kicker={kicker || design.shortLabel}
                  styleCode={design.id}
                  subtitle={subtitle}
                  title={title}
                />
              </div>
              <div className="cover-style-card-copy">
                <span className="pill pill-sun">{design.shortLabel}</span>
                <strong>{design.label}</strong>
                <p>{design.description}</p>
                <p className="offer-meta">{design.bestFor}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CoverDesignPicker(props: CoverDesignPickerProps) {
  return (
    <div className="cover-style-picker">
      <CoverDesignSection {...props} designs={featuredCoverDesigns} label="Featured covers" />
      <CoverDesignSection {...props} designs={moreCoverDesigns} label="More styles" />
    </div>
  );
}
