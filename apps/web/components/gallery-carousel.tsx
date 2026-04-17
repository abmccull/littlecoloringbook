"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GalleryExample } from "../lib/consumer-content";

type GalleryCarouselProps = {
  examples: GalleryExample[];
  /** Milliseconds between auto-advances. Default: 4500 */
  interval?: number;
};

export function GalleryCarousel({ examples, interval = 4500 }: GalleryCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = examples.length;

  const goTo = useCallback(
    (index: number) => {
      if (isTransitioning || index === activeIndex) return;
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveIndex(index);
        setIsTransitioning(false);
      }, 220);
    },
    [activeIndex, isTransitioning],
  );

  const advance = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveIndex((current) => (current + 1) % count);
      setIsTransitioning(false);
    }, 220);
  }, [count]);

  // Auto-advance timer — resets on manual navigation
  useEffect(() => {
    timerRef.current = setTimeout(advance, interval);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [advance, interval, activeIndex]);

  const example = examples[activeIndex];

  if (!example) return null;

  return (
    <div className="gallery-carousel" aria-label="Before and after coloring page examples">
      <div
        className={`gallery-carousel-stage${isTransitioning ? " gallery-carousel-stage-fade-out" : ""}`}
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="gallery-carousel-pair">
          <figure className="gallery-carousel-figure">
            <div className="gallery-carousel-img-wrap gallery-carousel-img-photo">
              <img
                alt={example.photoAlt}
                className="gallery-carousel-img"
                src={example.photoSrc}
              />
              <span className="gallery-carousel-badge">Your photo</span>
            </div>
          </figure>

          <div className="gallery-carousel-arrow" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <figure className="gallery-carousel-figure">
            <div className="gallery-carousel-img-wrap gallery-carousel-img-page">
              <img
                alt={example.pageAlt}
                className="gallery-carousel-img gallery-carousel-img-coloring"
                src={example.pageSrc}
              />
              <span className="gallery-carousel-badge">Coloring page</span>
            </div>
          </figure>
        </div>

        <p className="gallery-carousel-caption">{example.caption}</p>
      </div>

      <div className="gallery-carousel-dots" role="tablist" aria-label="Gallery slides">
        {examples.map((ex, i) => (
          <button
            key={ex.photoSrc}
            type="button"
            role="tab"
            aria-selected={i === activeIndex}
            aria-label={`Show example ${i + 1}: ${ex.caption}`}
            className={`gallery-carousel-dot${i === activeIndex ? " gallery-carousel-dot-active" : ""}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </div>
  );
}
