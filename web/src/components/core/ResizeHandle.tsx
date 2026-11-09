/*
 * Copyright (c) [2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React, { useCallback, useRef } from "react";
import { clamp } from "radashi";
import Icon from "~/components/layout/Icon";

import type { TranslatedString } from "~/i18n";

/** Pixels each arrow-key press adds to or removes from the panel. */
const KEYBOARD_STEP = 32;

type ResizeHandleProps = {
  /**
   * Where the resized panel sits, next to the handle: under it, or after it
   * along the line of text (on the right in left-to-right languages, on the
   * left in right-to-left ones). Decides the handle's direction and which keys
   * make the panel bigger.
   */
  panelAt: "bottom" | "end";
  /** The id of the panel the handle resizes. */
  controls: string;
  /** How big the panel is now, in pixels: its height, or its width. */
  size: number;
  /** The smallest the panel may get, in pixels. */
  min: number;
  /** The biggest the panel may get, in pixels. */
  max: number;
  /** Reports the size the panel should take, already kept within its limits. */
  onResize: (size: number) => void;
  /**
   * Reports a drag to a new pointer position: the pointer's vertical
   * coordinate (clientY) for a panel at the bottom, its horizontal one
   * (clientX) for a panel at the end. The parent maps it to a panel size.
   */
  onDrag: (coordinate: number) => void;
  /** Accessible label describing what the handle resizes. */
  label: TranslatedString;
};

/**
 * The line between a panel and what it shares the screen with, dragged or
 * moved with the keyboard to make the panel bigger or smaller.
 *
 * Follows the WAI-ARIA window splitter pattern: a focusable separator that
 * tells assistive technologies which panel it resizes and how big that panel
 * is within its limits. The arrow keys pointing towards the rest of the screen
 * make the panel bigger, the opposite ones smaller; Home and End take it to its
 * smallest and biggest.
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/
 */
export default function ResizeHandle({
  panelAt,
  controls,
  size,
  min,
  max,
  onResize,
  onDrag,
  label,
}: ResizeHandleProps) {
  const frame = useRef<number | null>(null);
  const isVertical = panelAt === "end";

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (frame.current !== null) return;

      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        onDrag(isVertical ? event.clientX : event.clientY);
      });
    },
    [onDrag, isVertical],
  );

  const stopDragging = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    document.removeEventListener("pointermove", handlePointerMove);
    document.removeEventListener("pointerup", stopDragging);
  }, [handlePointerMove]);

  const startDragging = (event: React.PointerEvent) => {
    event.preventDefault();
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", stopDragging);
  };

  /** The key moving the handle away from the panel, which makes it bigger. */
  const growKey = (target: HTMLElement) => {
    if (!isVertical) return "ArrowUp";
    const isRTL = getComputedStyle(target).direction === "rtl";
    return isRTL ? "ArrowRight" : "ArrowLeft";
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const grow = growKey(event.currentTarget);
    const shrinkKeys = isVertical
      ? ["ArrowLeft", "ArrowRight"].filter((k) => k !== grow)
      : ["ArrowDown"];

    let next: number;
    if (event.key === grow) {
      next = size + KEYBOARD_STEP;
    } else if (shrinkKeys.includes(event.key)) {
      next = size - KEYBOARD_STEP;
    } else if (event.key === "Home") {
      next = min;
    } else if (event.key === "End") {
      next = max;
    } else {
      return;
    }

    event.preventDefault();
    onResize(clamp(next, min, max));
  };

  return (
    <div
      role="separator"
      aria-orientation={isVertical ? "vertical" : "horizontal"}
      aria-label={label}
      aria-controls={controls}
      aria-valuenow={Math.round(size)}
      aria-valuemin={Math.round(min)}
      aria-valuemax={Math.round(max)}
      tabIndex={0}
      className={isVertical ? "agm-resize-handle agm-resize-handle--vertical" : "agm-resize-handle"}
      onPointerDown={startDragging}
      onKeyDown={handleKeyDown}
    >
      <Icon name="drag_indicator" size="sm" aria-hidden />
    </div>
  );
}
