"use client";

import type { CSSProperties } from "react";
import { useId, useState } from "react";

type BeforeAfterSliderProps = {
  afterLabel?: string;
  afterSrc: string;
  beforeLabel?: string;
  beforeSrc: string;
};

export function BeforeAfterSlider({
  afterLabel = "Coloring page",
  afterSrc,
  beforeLabel = "Original photo",
  beforeSrc,
}: BeforeAfterSliderProps) {
  const sliderId = useId();
  const [position, setPosition] = useState(50);

  return (
    <div className="before-after-slider">
      <div
        aria-label="Interactive comparison between the original photo and the coloring page"
        className="before-after-stage"
        role="img"
        style={{ "--compare-position": `${position}%` } as CSSProperties}
      >
        <img alt="" className="before-after-image before-after-image-after" src={afterSrc} />
        <div className="before-after-overlay" aria-hidden="true">
          <img alt="" className="before-after-image before-after-image-before" src={beforeSrc} />
        </div>
        <div className="before-after-divider" aria-hidden="true">
          <div className="before-after-handle">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="before-after-label before-after-label-before">{beforeLabel}</div>
        <div className="before-after-label before-after-label-after">{afterLabel}</div>
      </div>

      <label className="before-after-control" htmlFor={sliderId}>
        <span>Drag to compare</span>
        <input
          aria-label="Drag to compare the original photo and the coloring page"
          id={sliderId}
          max={100}
          min={0}
          onChange={(event) => setPosition(Number(event.currentTarget.value))}
          type="range"
          value={position}
        />
      </label>
    </div>
  );
}
