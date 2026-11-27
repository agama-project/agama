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

import React, { useRef } from "react";

type Tablist = {
  /** Props for the element wrapping the tabs. */
  containerProps: {
    ref: React.RefObject<HTMLDivElement>;
    onKeyDown: (event: React.KeyboardEvent) => void;
  };
  /** Props for each tab, making the tabs a single Tab stop. */
  tabProps: (key: string) => { tabIndex: number };
};

/**
 * The keyboard support of the ARIA tabs pattern, which PatternFly tabs lack:
 * the tabs are a single Tab stop, the arrow keys move between them (wrapping
 * around), and Home and End go to the first and last.
 *
 * Moving also selects the tab, which suits panels that are cheap to show.
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
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
  const ref = useRef<HTMLDivElement>(null);

  /* PatternFly renders the tabs, so they are found in the DOM. */
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
