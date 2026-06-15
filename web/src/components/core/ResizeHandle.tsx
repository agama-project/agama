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
import Icon from "~/components/layout/Icon";

/** Pixels each arrow-key press adds to or removes from the panel height. */
const KEYBOARD_STEP = 32;

type ResizeHandleProps = {
  /**
   * Reports a drag to a new pointer position. Receives the pointer's vertical
   * coordinate (clientY); the parent maps it to a panel height.
   */
  onDrag: (clientY: number) => void;
  /**
   * Reports a keyboard-driven resize. Receives a signed pixel delta, positive
   * to make the panel taller and negative to make it shorter.
   */
  onStep: (delta: number) => void;
  /** Accessible label describing what the handle resizes. */
  label: string;
};

/**
 * Draggable horizontal divider that resizes the panel sitting below it.
 *
 * It supports both pointer dragging and keyboard control (up and down arrow
 * keys), following the ARIA window splitter pattern.
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/
 */
export default function ResizeHandle({ onDrag, onStep, label }: ResizeHandleProps) {
  const frame = useRef<number | null>(null);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (frame.current !== null) return;

      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        onDrag(event.clientY);
      });
    },
    [onDrag],
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

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // The panel sits below, so pressing up makes it taller and down makes it
    // shorter, matching the direction the handle would move under the pointer.
    if (event.key === "ArrowUp") {
      event.preventDefault();
      onStep(KEYBOARD_STEP);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      onStep(-KEYBOARD_STEP);
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      tabIndex={0}
      className="agm-terminal-dock__handle"
      onPointerDown={startDragging}
      onKeyDown={handleKeyDown}
    >
      <Icon name="drag_indicator" size="sm" aria-hidden />
    </div>
  );
}
