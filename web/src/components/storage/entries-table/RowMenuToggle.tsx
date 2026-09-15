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

export type RowMenuToggleProps = Omit<MenuToggleProps, "ref"> & {
  /** Says which entry the menu is about, since three dots say nothing. */
  label: string;
};

/**
 * The way into a menu of more options: three dots, in a line.
 *
 * In a line rather than stacked, which is the disagreement this settles. One
 * gesture wears one mark: a reader who learns the dots on the page's own line
 * should meet the same dots on a row, in a table inside the panel, and at the
 * head of the panel itself. Telling a column of dots from a row of them is a
 * distinction the reader has to be taught before it says anything, and it says
 * nothing they cannot see from where the control sits.
 *
 * The label is required rather than defaulted. A list of eight devices carries
 * eight of these, and eight controls all called "Actions" tell a reader who
 * meets them one at a time nothing about which device they are on.
 */
const RowMenuToggle = React.forwardRef<HTMLButtonElement, RowMenuToggleProps>(
  ({ label, ...props }, ref) => (
    <MenuToggle ref={ref} variant="plain" aria-label={label} {...props}>
      <Icon name="more_horiz" />
    </MenuToggle>
  ),
);

RowMenuToggle.displayName = "RowMenuToggle";

export default RowMenuToggle;
