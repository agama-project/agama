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
import { Label } from "@patternfly/react-core";

import { Description } from "~/components/core";
import { Icon } from "~/components/layout";

/**
 * Display a label with additional details. The details are displayed after
 * clicking the label and the "i" icon indicates available details.
 * If the label is not defined or is empty it behaves like a plain label.
 * @component
 *
 * @param {object} props
 * @param {React.ReactElement} props.description - Details displayed after clicking the label.
 * @param {React.ReactNode} props.children - The content of the label.
 */
export default function Tip({ description, children }) {
  if (description) {
    return (
      <Description description={description}>
        <Label isCompact className="label-tip">
          {children}
          <Icon name="info" size="xxs" />
        </Label>
      </Description>
    );
  }

  return <Label isCompact>{children}</Label>;
}
