"use client";

import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useId, useRef, useState } from "react";

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
  const sliderHintId = useId();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);

  const updatePositionFromClientX = useCallback((clientX: number) => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const bounds = stage.getBoundingClientRect();
    const nextPosition = ((clientX - bounds.left) / bounds.width) * 100;
    setPosition(Math.min(100, Math.max(0, nextPosition)));
  }, []);

  const startDragging = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(true);
      updatePositionFromClientX(event.clientX);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [updatePositionFromClientX],
  );

  const continueDragging = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging) {
        return;
      }

      updatePositionFromClientX(event.clientX);
    },
    [dragging, updatePositionFromClientX],
  );

  const stopDragging = useCallback((event?: ReactPointerEvent<HTMLDivElement>) => {
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setDragging(false);
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        event.preventDefault();
        setPosition((current) => Math.max(0, current - 5));
        break;
      case "ArrowRight":
      case "ArrowUp":
        event.preventDefault();
        setPosition((current) => Math.min(100, current + 5));
        break;
      case "Home":
        event.preventDefault();
        setPosition(0);
        break;
      case "End":
        event.preventDefault();
        setPosition(100);
        break;
      default:
        break;
    }
  }, []);

  return (
    <div className="before-after-slider">
      <div
        className="before-after-stage"
        onPointerCancel={stopDragging}
        onPointerDown={startDragging}
        onPointerMove={continueDragging}
        onPointerUp={stopDragging}
        onLostPointerCapture={stopDragging}
        ref={stageRef}
        style={{ "--compare-position": `${position}%` } as CSSProperties}
      >
        <img alt="" className="before-after-image before-after-image-after" src={afterSrc} />
        <div className="before-after-overlay" aria-hidden="true">
          <img alt="" className="before-after-image before-after-image-before" src={beforeSrc} />
        </div>
        <div
          aria-describedby={sliderHintId}
          aria-label="Drag to compare the original photo and the coloring page"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(position)}
          aria-valuetext={`${Math.round(position)} percent of the original photo is visible`}
          aria-orientation="horizontal"
          className={`before-after-divider${dragging ? " is-dragging" : ""}`}
          onKeyDown={handleKeyDown}
          role="slider"
          tabIndex={0}
        >
          <div className="before-after-handle">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="before-after-label before-after-label-before">{beforeLabel}</div>
        <div className="before-after-label before-after-label-after">{afterLabel}</div>
      </div>
      <input
        aria-hidden="true"
        className="sr-only"
        id={sliderId}
        max={100}
        min={0}
        onChange={(event) => setPosition(Number(event.currentTarget.value))}
        tabIndex={-1}
        type="range"
        value={position}
      />
      <p className="sr-only" id={sliderHintId}>
        Drag the center handle left or right to compare the original photo and the coloring page.
      </p>
    </div>
  );
}
