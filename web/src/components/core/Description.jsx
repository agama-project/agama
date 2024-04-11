/*
 * Copyright (c) [2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

// @ts-check

import React from "react";
import { Popover, Button } from "@patternfly/react-core";

/**
 * Displays details popup after clicking the children elements
 * @component
 *
 * @param {object} props
 * @param {React.ReactElement} props.description - Content displayed in a popup.
 * @param {React.ReactNode} props.children - The wrapped content.
 * @param {import("@patternfly/react-core").PopoverProps} [props.otherProps]
 */
export default function Description ({ description, children, ...otherProps }) {
  if (description) {
    return (
      <Popover showClose={false} bodyContent={description} {...otherProps}>
        <Button variant="link" isInline>{children}</Button>
      </Popover>
    );
  }

  // none or empty description, just return the children
  return children;
}
