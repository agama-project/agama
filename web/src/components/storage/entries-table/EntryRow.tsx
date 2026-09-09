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
import { Th, Tr } from "@patternfly/react-table";
import Text from "~/components/core/Text";

export type EntryRowProps = {
  /** What the entry is called, as the page names things: `sda`, `system`. */
  name: string;
  /** What it is, beside the name: how big, what kind, how it is partitioned. */
  description?: string;
};

/**
 * One entry of the configuration, as a row of the list.
 *
 * The name heads the row rather than sitting in a cell of it, so that a screen
 * reader reading any other cell says which entry it belongs to first. What the
 * entry is follows the name on the same line: a name on a line of its own
 * spends a whole line saying one word, and the facts beside it are read as
 * belonging to it rather than as a column of their own.
 *
 * @example
 * <EntryRow name="sda" description="60 GiB · Disk · GPT" />
 */
export default function EntryRow({ name, description }: EntryRowProps): React.ReactNode {
  return (
    <Tr>
      <Th scope="row">
        <Text isBold>{name}</Text>
        {description && <span className="agm-entries-table__facts"> {description}</span>}
      </Th>
    </Tr>
  );
}
