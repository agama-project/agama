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
import { MenuToggle, MenuToggleProps } from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import VisualTooltip from "~/components/core/VisualTooltip";
import type { IconProps } from "~/components/layout/Icon";

export type RowMenuToggleProps = Omit<MenuToggleProps, "ref"> & {
  /** The toggle name, saying which item the menu is about. */
  label: string;
  /**
   * The toggle icon. Defaults to three dots in a line. A toggle ending a
   * sentence takes another icon, so it does not read as the sentence trailing
   * off.
   */
  icon?: Extract<IconProps["name"], "more_horiz" | "home_storage_gear">;
  /**
   * Whether the label also shows in a tooltip on hover and focus, for an icon
   * that does not say what it opens.
   */
  hasTooltip?: boolean;
};

/**
 * The toggle of an item menu, such as the one of a table row: three dots in a
 * line, the same mark wherever a menu of actions opens.
 *
 * The label is required, since a page with several of these needs each one
 * named after its item.
 */
const RowMenuToggle = React.forwardRef<HTMLButtonElement, RowMenuToggleProps>(
  ({ label, icon = "more_horiz", hasTooltip = false, ...props }, ref) => {
    const toggle = (
      <MenuToggle ref={ref} variant="plain" aria-label={label} {...props}>
        <Icon name={icon} />
      </MenuToggle>
    );

    return hasTooltip ? <VisualTooltip content={label}>{toggle}</VisualTooltip> : toggle;
  },
);

RowMenuToggle.displayName = "RowMenuToggle";

export default RowMenuToggle;
