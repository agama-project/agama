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

/**
 * Whether the content of an element is wider than the element, so it scrolls
 * sideways.
 *
 * Useful for a scroll box that is a Tab stop only while it scrolls, so keyboard
 * users can scroll it without an extra stop when it fits.
 *
 * Checks again when the element or its children change size. Takes the element,
 * from a callback ref, rather than a ref object, like `useElementSize`.
 *
 * @example
 * const [box, setBox] = useState<HTMLDivElement | null>(null);
 * const scrolls = useScrollsSideways(box);
 *
 * return <div ref={setBox} tabIndex={scrolls ? 0 : undefined}>…</div>;
 */
const useScrollsSideways = (node: HTMLElement | null): boolean => {
  const [scrolls, setScrolls] = useState(false);

  useEffect(() => {
    if (!node) {
      setScrolls(false);
      return;
    }

    const measure = () => setScrolls(node.scrollWidth > node.clientWidth);
    measure();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    Array.from(node.children).forEach((child) => observer.observe(child));

    return () => observer.disconnect();
  }, [node]);

  return scrolls;
};

export { useScrollsSideways };
