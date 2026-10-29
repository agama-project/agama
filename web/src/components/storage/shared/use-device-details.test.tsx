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
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router";
import type { ConfigModel } from "~/model/storage/config-model";
import {
  renamedGroupSearch,
  useDeviceDetails,
} from "~/components/storage/shared/use-device-details";

const mockConfig: ConfigModel.Config = {
  drives: [{ name: "/dev/vdb" }, { name: "/dev/sda.1" }],
  mdRaids: [{ name: "/dev/md/data" }],
  volumeGroups: [{ vgName: "system" }, { vgName: "vdb" }],
};

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig,
}));

/** The panel's state, read from one address. */
const detailsAt = (address: string) => {
  const { result } = renderHook(() => useDeviceDetails(), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={[address]}>{children}</MemoryRouter>,
  });

  return result.current;
};

describe("useDeviceDetails", () => {
  it("reads the entry the address names, by its name", () => {
    expect(detailsAt("/storage?device=drives.vdb").subject).toEqual({
      collection: "drives",
      index: 0,
    });
    expect(detailsAt("/storage?device=volumeGroups.system").subject).toEqual({
      collection: "volumeGroups",
      index: 0,
    });
  });

  it("tells a volume group from a disk of the same name", () => {
    expect(detailsAt("/storage?device=volumeGroups.vdb").subject).toEqual({
      collection: "volumeGroups",
      index: 1,
    });
  });

  it("reads names holding slashes and full stops", () => {
    expect(detailsAt("/storage?device=mdRaids.md%2Fdata").subject).toEqual({
      collection: "mdRaids",
      index: 0,
    });
    expect(detailsAt("/storage?device=drives.sda.1").subject).toEqual({
      collection: "drives",
      index: 1,
    });
  });

  it("reads an address naming nothing as a shut panel with nothing to clean up", () => {
    const details = detailsAt("/storage");

    expect(details.subject).toBeNull();
    expect(details.isStale).toBe(false);
  });

  it("reads an address naming an entry the configuration does not have as stale", () => {
    const details = detailsAt("/storage?device=drives.vdz");

    expect(details.subject).toBeNull();
    expect(details.isStale).toBe(true);
  });

  it("reads older addresses, by position or for the whole result, as stale", () => {
    expect(detailsAt("/storage?device=drives.0").isStale).toBe(true);
    expect(detailsAt("/storage?device=result").isStale).toBe(true);
  });

  it("points at an entry by its name", () => {
    const details = detailsAt("/storage?settingsTab=1");

    expect(details.addressOf({ collection: "drives", index: 0 })).toEqual({
      search: "?settingsTab=1&device=drives.vdb",
    });
    expect(details.addressOf({ collection: "volumeGroups", index: 1 })).toEqual({
      search: "?settingsTab=1&device=volumeGroups.vdb",
    });
  });
});

describe("useDeviceDetails and the state the panel keeps in the address", () => {
  /** The panel and the address it reads, rendered at one address. */
  const renderAt = (address: string) =>
    renderHook(() => ({ details: useDeviceDetails(), params: useSearchParams()[0] }), {
      wrapper: ({ children }) => <MemoryRouter initialEntries={[address]}>{children}</MemoryRouter>,
    });

  it("drops an open list when the panel closes, keeping the rest", () => {
    const { result } = renderAt("/storage?device=drives.vdb&expanded=content,other");
    act(() => result.current.details.close());

    expect(result.current.params.toString()).toBe("expanded=other");
  });

  it("drops an open list when the panel moves to another device", () => {
    const { result } = renderAt("/storage?device=drives.vdb&expanded=content");

    expect(result.current.details.addressOf({ collection: "volumeGroups", index: 0 })).toEqual({
      search: "?device=volumeGroups.system",
    });
  });

  it("keeps an open list when the panel is pointed at the device it shows", () => {
    const { result } = renderAt("/storage?device=drives.vdb&expanded=content");

    expect(result.current.details.addressOf({ collection: "drives", index: 0 })).toEqual({
      search: "?device=drives.vdb&expanded=content",
    });
  });
});

describe("renamedGroupSearch", () => {
  it("follows a panel open on the renamed group to its new name", () => {
    expect(renamedGroupSearch("?settingsTab=1&device=volumeGroups.system", "system", "data")).toBe(
      "?settingsTab=1&device=volumeGroups.data",
    );
  });

  it("leaves any other address as it was", () => {
    expect(renamedGroupSearch("?device=volumeGroups.home", "system", "data")).toBe(
      "?device=volumeGroups.home",
    );
    expect(renamedGroupSearch("?device=drives.system", "system", "data")).toBe(
      "?device=drives.system",
    );
    expect(renamedGroupSearch("", "system", "data")).toBe("");
  });
});
