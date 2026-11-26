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

/** The rendered size of an element, unset until it is measured. */
type ElementSize = { width?: number; height?: number };

/**
 * Tracks the rendered size of an element.
 *
 * Takes the element, from a callback ref, rather than a ref object: a ref
 * object does not change when the element is replaced, and the observer would
 * keep watching a node that left the document.
 *
 * Both values are undefined until the first measurement, so the caller picks
 * the fallback that suits its question.
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
    /* Without an element, the size is unknown again. */
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
