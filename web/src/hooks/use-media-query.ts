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
 * Whether the window currently matches a media query.
 *
 * For the decisions that are genuinely about the window rather than about the
 * room a component has: how a page and a panel divide the screen between them,
 * say. Where the question is how much room this element has, ask that instead,
 * with `useElementSize`, since a component beside an open panel is narrow
 * however wide the window is.
 *
 * @example
 * const isWide = useMediaQuery("(min-width: 75rem)");
 */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);

    /* Read once here rather than as the initial state: the first render has to
       match what the server or a test renders, and it also lets the value
       follow a query that changes. */
    update();
    list.addEventListener("change", update);

    return () => list.removeEventListener("change", update);
  }, [query]);

  return matches;
}

export { useMediaQuery };
