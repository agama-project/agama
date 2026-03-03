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

import React, { useState } from "react";
import {
  Divider,
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownList,
  MenuToggle,
} from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";

/**
 * Represents a single action item in a {@link SimpleDropdown} menu.
 */
type SimpleDropdownItem = {
  /** Label to display for the action. */
  title: React.ReactNode;
  /** Callback invoked when the action is clicked. */
  onClick: () => void;
  /**
   * When true, renders the item in a danger style.
   * Typically used for destructive actions such as formatting or deleting.
   */
  isDanger?: boolean;
};

/**
 * Props for the `SimpleDropdown` component.
 */
type SimpleDropdownProps = {
  /**
   * Actions to display in the dropdown menu.
   *
   * Each action requires a `title` and an `onClick` handler. The optional
   * `isDanger` flag renders the item in a danger style, typically used for
   * destructive actions.
   */
  items: SimpleDropdownItem[];
  /**
   * Accessible label for the toggle button.
   *
   * Also rendered as the dropdown group label when the menu is open,
   * providing visual and accessible context about which row or entity
   * the actions belong to.
   */
  label: string;
  /**
   * Props to pass to the PF Dropdown popper for controlling positioning.
   * Defaults to `{ position: "right" }` to align the menu to the right
   * edge of the toggle, which is the standard behavior for action menus
   * in tables.
   */
  popperProps?: React.ComponentProps<typeof Dropdown>["popperProps"];
};

/**
 * A plain dropdown menu with a "more actions" toggle and a labeled group.
 *
 * Intended as a (temporary?) replacement for PatternFly's `ActionsColumn` when
 * a group label is needed to provide context about which row the actions apply
 * to. The label is shown both as the `aria-label` of the toggle button and as
 * the visible group header inside the open menu.
 *
 * @example
 * ```tsx
 * <SimpleDropdown
 *   label="Actions for 0.0.0160"
 *   items={[
 *     { title: "Activate", onClick: () => activate() },
 *     { title: "Format", onClick: () => format(), isDanger: true },
 *   ]}
 * />
 * ```
 */
export default function SimpleDropdown({
  items,
  label,
  popperProps = { position: "right" },
}: SimpleDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dropdown
      isOpen={isOpen}
      onSelect={() => setIsOpen(false)}
      onOpenChange={(isOpen) => setIsOpen(isOpen)}
      popperProps={popperProps}
      toggle={(toggleRef) => (
        <MenuToggle
          ref={toggleRef}
          onClick={() => setIsOpen(!isOpen)}
          variant="plain"
          aria-label={label}
          isExpanded={isOpen}
        >
          <Icon name="more_horiz" />
        </MenuToggle>
      )}
    >
      <DropdownGroup label={label}>
        <Divider />
        <DropdownList>
          {items.map(({ title, onClick, isDanger }, i) => (
            <DropdownItem key={i} onClick={onClick} isDanger={isDanger}>
              {title}
            </DropdownItem>
          ))}
        </DropdownList>
      </DropdownGroup>
    </Dropdown>
  );
}
