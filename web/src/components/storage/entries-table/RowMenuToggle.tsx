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
 * The way into a row's menu: three dots, stacked.
 *
 * Stacked rather than in a line, which is the disagreement this settles. The
 * installer draws both, and the two are not interchangeable by convention: a
 * column of dots is what a row's own menu wears, a row of them belongs to a
 * card or a section. PatternFly's own tables draw the column, so a row here
 * looks like a row anywhere else in the product.
 *
 * The label is required rather than defaulted. A list of eight devices carries
 * eight of these, and eight controls all called "Actions" tell a reader who
 * meets them one at a time nothing about which device they are on.
 */
const RowMenuToggle = React.forwardRef<HTMLButtonElement, RowMenuToggleProps>(
  ({ label, ...props }, ref) => (
    <MenuToggle ref={ref} variant="plain" aria-label={label} {...props}>
      <Icon name="more_vert" />
    </MenuToggle>
  ),
);

RowMenuToggle.displayName = "RowMenuToggle";

export default RowMenuToggle;
