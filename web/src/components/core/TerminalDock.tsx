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

import React, { useCallback, useEffect, useRef, useState } from "react";
import { clamp } from "radashi";
import ResizeHandle from "~/components/core/ResizeHandle";
import TerminalPane from "~/components/core/TerminalPane";
import { useTerminal } from "~/context/terminal";
import { _ } from "~/i18n";

// Minimum screen size to host a usable terminal. Below it the panel shows an
// explanatory message instead, which also guards the terminal from being
// measured at a size too small to fit into. Set to a small laptop (1024x768):
// any smaller and the terminal and the application cannot share the screen
// comfortably.
const MIN_WIDTH = 1024;
const MIN_HEIGHT = 768;

// How the height is shared once the terminal is shown: room kept for the
// application above it, and the smallest the terminal itself shrinks to.
const MIN_MAIN_HEIGHT = 320;
const MIN_TERMINAL_HEIGHT = 200;
// Height the terminal opens with the first time, before the user resizes it.
const DEFAULT_TERMINAL_HEIGHT = 360;

type Size = { width: number; height: number };

/** Tracks the rendered size of an element through a ResizeObserver. */
function useElementSize(ref: React.RefObject<HTMLElement>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, [ref]);

  return size;
}

/**
 * App-shell layout that optionally docks the terminal panel below the
 * application (rendered as `children`). Coupled to the terminal on purpose: it
 * reads the terminal state and hosts {@link TerminalPane}.
 *
 * The terminal panel lives here, above the page-swapping route outlet, so its
 * session survives navigation between pages. When hidden, the application keeps
 * the whole screen; when shown, a draggable divider lets the user share the
 * height between the application (on top) and the terminal (at the bottom).
 *
 * Why the terminal docks at the bottom and not at the side:
 *
 * PatternFly's responsive layout reacts to the width of the browser window
 * (CSS media queries), not to the width of the area a component actually sits
 * in (CSS container queries). Putting the terminal on the side would make the
 * application narrower than the window, but PatternFly, still keying off the
 * full window width, would arrange everything as if nothing had shrunk: the
 * header actions and content would no longer fit and would spill over the
 * terminal. Docking at the bottom keeps the application at full window width,
 * so its layout keeps adapting correctly; only the available height is shared.
 *
 * On screens too small to host both stacked, the application yields the space
 * and the panel explains it needs more room (see {@link TerminalPane}).
 */
export default function TerminalDock({ children }: React.PropsWithChildren) {
  const { isVisible, isMinimized, height, setHeight } = useTerminal();
  const containerRef = useRef<HTMLDivElement>(null);
  const { width: containerWidth, height: containerHeight } = useElementSize(containerRef);

  const enoughSpace = containerWidth >= MIN_WIDTH && containerHeight >= MIN_HEIGHT;

  // Minimizing only applies once the panel actually hosts a terminal; otherwise
  // it just shows its message and there is nothing to collapse.
  const minimized = isMinimized && enoughSpace;

  // The application yields its space only when there is not enough room for a
  // usable split, so the panel can show its message at full size.
  const maxTerminalHeight = Math.max(MIN_TERMINAL_HEIGHT, containerHeight - MIN_MAIN_HEIGHT);
  const terminalHeight = enoughSpace
    ? clamp(height ?? DEFAULT_TERMINAL_HEIGHT, MIN_TERMINAL_HEIGHT, maxTerminalHeight)
    : containerHeight;

  // When minimized, the panel sizes itself to its header bar; otherwise it takes
  // the resolved split height (or the full height to show its message).
  const terminalStyle = minimized ? undefined : { height: terminalHeight };

  const resizeToPointer = useCallback(
    (clientY: number) => {
      const container = containerRef.current;
      if (!container) return;

      const next = container.getBoundingClientRect().bottom - clientY;
      setHeight(clamp(next, MIN_TERMINAL_HEIGHT, maxTerminalHeight));
    },
    [maxTerminalHeight, setHeight],
  );

  const resizeByStep = useCallback(
    (delta: number) => {
      setHeight(clamp(terminalHeight + delta, MIN_TERMINAL_HEIGHT, maxTerminalHeight));
    },
    [terminalHeight, maxTerminalHeight, setHeight],
  );

  return (
    <div ref={containerRef} className="agm-terminal-dock">
      <div className="agm-terminal-dock__main" hidden={isVisible && !enoughSpace}>
        {children}
      </div>
      {isVisible && (
        <>
          {enoughSpace && !minimized && (
            <ResizeHandle
              // TRANSLATORS: accessible name for the divider used to resize the
              // terminal panel by dragging or with the arrow keys
              label={_("Resize terminal")}
              onDrag={resizeToPointer}
              onStep={resizeByStep}
            />
          )}
          <div
            className={
              minimized
                ? "agm-terminal-dock__panel agm-terminal-dock__panel--minimized"
                : "agm-terminal-dock__panel"
            }
            style={terminalStyle}
          >
            <TerminalPane enoughSpace={enoughSpace} />
          </div>
        </>
      )}
    </div>
  );
}
