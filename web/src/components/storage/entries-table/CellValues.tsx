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

export type CellValuesProps = {
  /** The values of a table cell, in the order they are read. */
  values: React.ReactNode[];
};

/**
 * The values of a table cell, one per line.
 *
 * Two or more are a list, so screen readers say how many there are and pause
 * between them. A single value is plain text, since a list of one adds only
 * noise.
 *
 * The explicit `role="list"` keeps the list semantics in Safari, which drops
 * them from lists without bullets.
 *
 * @example
 * <Td dataLabel={_("Used for")}>
 *   <CellValues values={[_("Installing the system"), _("Booting the system")]} />
 * </Td>
 */
export default function CellValues({ values }: CellValuesProps) {
  if (values.length < 2) return values[0];

  return (
    <ul role="list">
      {values.map((value, index) => (
        <li key={index}>{value}</li>
      ))}
    </ul>
  );
}
