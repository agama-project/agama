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

import React from "react";

type Tablist = {
  /** Goes on the element wrapping the strip. */
  containerProps: {
    ref: React.RefObject<HTMLDivElement>;
    onKeyDown: (event: React.KeyboardEvent) => void;
  };
  /** Goes on each tab, so that the strip is one stop rather than several. */
  tabProps: (key: string) => { tabIndex: number };
};

/**
 * The keyboard a strip of tabs is expected to have, which PatternFly does not
 * provide.
 *
 * Its tabs are each a tab stop and no arrow key does anything, so a reader
 * walking a page with a four-tab strip on it presses Tab four times to get past
 * it. What the pattern asks for is the opposite: the strip is one stop, and the
 * arrows move within it.
 *
 * Moving also selects, which suits a strip whose panels are already rendered
 * and cost nothing to show. A reader arrowing along it reads each panel as they
 * arrive rather than having to press again to see it.
 *
 * @example
 * const { containerProps, tabProps } = useTablistKeyboard(["a", "b"], tab, setTab);
 *
 * <div {...containerProps}>
 *   <Tabs activeKey={tab} onSelect={(_, key) => setTab(String(key))}>
 *     <Tab eventKey="a" {...tabProps("a")} title={...} />
 *   </Tabs>
 * </div>
 */
function useTablistKeyboard(
  keys: string[],
  active: string,
  onSelect: (key: string) => void,
): Tablist {
  const ref = React.useRef<HTMLDivElement>(null);

  /* Focused through the document rather than through a ref per tab: the tabs
     are drawn by PatternFly, and asking it for the nth of them is steadier than
     threading a ref into each. */
  const focusAt = (index: number) => {
    const tabs = ref.current?.querySelectorAll<HTMLElement>('[role="tab"]');
    tabs?.[index]?.focus();
  };

  const moveTo = (index: number) => {
    if (index < 0 || index >= keys.length) return;

    onSelect(keys[index]);
    focusAt(index);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const at = keys.indexOf(active);
    if (at === -1) return;

    switch (event.key) {
      case "ArrowRight":
        /* Round, because a strip has no end to fall off: the pattern asks for
           the first tab after the last. */
        moveTo((at + 1) % keys.length);
        break;
      case "ArrowLeft":
        moveTo((at - 1 + keys.length) % keys.length);
        break;
      case "Home":
        moveTo(0);
        break;
      case "End":
        moveTo(keys.length - 1);
        break;
      default:
        return;
    }

    event.preventDefault();
  };

  return {
    containerProps: { ref, onKeyDown },
    tabProps: (key: string) => ({ tabIndex: key === active ? 0 : -1 }),
  };
}

export { useTablistKeyboard };
