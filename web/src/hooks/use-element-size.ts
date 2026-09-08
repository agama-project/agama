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
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import { useEffect, useState } from "react";

/** How big an element is, or nothing while there is nothing to measure. */
type ElementSize = { width?: number; height?: number };

/**
 * Tracks the rendered size of an element.
 *
 * What a component can afford is often a question about the room it has rather
 * than about the window: a page beside an open panel is a narrow strip on a
 * wide screen, and a media query still reports a wide screen. This answers the
 * first question, which CSS container queries also answer but only in CSS.
 *
 * Takes the element itself rather than a ref object, and that is deliberate.
 * Moving a component between parents builds it a new element, and a ref object
 * does not change when that happens: an observer set up from `ref.current`
 * keeps watching a node that has left the document, and reports the size it had
 * when it left. Held in state through a callback ref, the observer follows the
 * element that exists.
 *
 * Both values are undefined until the first measurement, rather than zero:
 * "is there room for this" and "is it too tight for that" want opposite answers
 * before anything is known, and only the caller knows which it is asking.
 *
 * @example
 * const [node, setNode] = useState<HTMLDivElement | null>(null);
 * const { width = Number.POSITIVE_INFINITY } = useElementSize(node);
 *
 * return <div ref={setNode}>{width < 640 ? <Compact /> : <Full />}</div>;
 */
const useElementSize = (node: HTMLElement | null): ElementSize => {
  const [size, setSize] = useState<ElementSize>({});

  useEffect(() => {
    /* Nothing to measure is not "as big as it last was": whatever the caller
       renders next starts unmeasured. */
    if (!node) {
      setSize({});
      return;
    }

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, [node]);

  return size;
};

export { useElementSize };
export type { ElementSize };
