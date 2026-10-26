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
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { useSheet } from "~/components/storage/shared/use-sheet";

/** What the sheet shows, read from one address. */
const subjectAt = (address: string) => {
  const { result } = renderHook(() => useSheet(), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={[address]}>{children}</MemoryRouter>,
  });

  return result.current.subject;
};

describe("useSheet", () => {
  it("reads the entry the address names", () => {
    expect(subjectAt("/storage?sheet=volumeGroups.1")).toEqual({
      collection: "volumeGroups",
      index: 1,
    });
  });

  it("reads an address naming nothing as a shut sheet", () => {
    expect(subjectAt("/storage")).toBeNull();
  });

  it("reads an old address naming the whole result as a shut sheet", () => {
    expect(subjectAt("/storage?sheet=result")).toBeNull();
  });
});
