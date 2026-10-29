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

import { columnProps, tableProps } from "~/components/storage/shared/table-columns";

describe("tableProps", () => {
  it("makes a storage table without a rule under its header row by default", () => {
    expect(tableProps()).toEqual({ className: "agm-storage-table" });
  });

  it("adds the rule under the header row where asked for", () => {
    expect(tableProps({ hasHeaderRule: true })).toEqual({
      className: "agm-storage-table agm-storage-table--header-rule",
    });
  });
});

describe("columnProps", () => {
  it("gives a column a rule before it where asked for", () => {
    expect(columnProps({ hasBorderBefore: true }).hasLeftBorder).toBe(true);
    expect(columnProps({}).hasLeftBorder).toBeUndefined();
  });

  it("aligns a column to the end and passes its width rule on", () => {
    expect(columnProps({ isEndAligned: true, modifier: "fitContent" })).toEqual({
      hasLeftBorder: undefined,
      className: "pf-v6-u-text-align-end",
      modifier: "fitContent",
    });
  });
});
