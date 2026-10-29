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
import type { ConfigModel } from "~/model/storage/config-model";
import { useSheet } from "~/components/storage/shared/use-sheet";

const mockConfig: ConfigModel.Config = {
  drives: [{ name: "/dev/vdb" }, { name: "/dev/sda.1" }],
  mdRaids: [{ name: "/dev/md/data" }],
  volumeGroups: [{ vgName: "system" }, { vgName: "vdb" }],
};

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig,
}));

/** The sheet's state, read from one address. */
const sheetAt = (address: string) => {
  const { result } = renderHook(() => useSheet(), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={[address]}>{children}</MemoryRouter>,
  });

  return result.current;
};

describe("useSheet", () => {
  it("reads the entry the address names, by its name", () => {
    expect(sheetAt("/storage?device=drives.vdb").subject).toEqual({
      collection: "drives",
      index: 0,
    });
    expect(sheetAt("/storage?device=volumeGroups.system").subject).toEqual({
      collection: "volumeGroups",
      index: 0,
    });
  });

  it("tells a volume group from a disk of the same name", () => {
    expect(sheetAt("/storage?device=volumeGroups.vdb").subject).toEqual({
      collection: "volumeGroups",
      index: 1,
    });
  });

  it("reads names holding slashes and full stops", () => {
    expect(sheetAt("/storage?device=mdRaids.md%2Fdata").subject).toEqual({
      collection: "mdRaids",
      index: 0,
    });
    expect(sheetAt("/storage?device=drives.sda.1").subject).toEqual({
      collection: "drives",
      index: 1,
    });
  });

  it("reads an address naming nothing as a shut sheet with nothing to clean up", () => {
    const sheet = sheetAt("/storage");

    expect(sheet.subject).toBeNull();
    expect(sheet.isStale).toBe(false);
  });

  it("reads an address naming an entry the configuration does not have as stale", () => {
    const sheet = sheetAt("/storage?device=drives.vdz");

    expect(sheet.subject).toBeNull();
    expect(sheet.isStale).toBe(true);
  });

  it("reads older addresses, by position or for the whole result, as stale", () => {
    expect(sheetAt("/storage?device=drives.0").isStale).toBe(true);
    expect(sheetAt("/storage?device=result").isStale).toBe(true);
  });

  it("points at an entry by its name", () => {
    const sheet = sheetAt("/storage?settingsTab=1");

    expect(sheet.addressOf({ collection: "drives", index: 0 })).toEqual({
      search: "?settingsTab=1&device=drives.vdb",
    });
    expect(sheet.addressOf({ collection: "volumeGroups", index: 1 })).toEqual({
      search: "?settingsTab=1&device=volumeGroups.vdb",
    });
  });
});
