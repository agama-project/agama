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
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Storage } from "~/model/system";
import EntriesTable from "~/components/storage/entries-table/EntriesTable";

const mockConfig = jest.fn();
const mockSystemDevice = jest.fn();
const mockScrollsSideways = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig(),
}));

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useDevice: (name: string) => mockSystemDevice(name),
  useFlattenDevices: () => [],
}));

/* jsdom lays nothing out, so whether the table overflows its box is said here. */
jest.mock("~/hooks/use-scrolls-sideways", () => ({
  useScrollsSideways: () => mockScrollsSideways(),
}));

/* The row menus have their own tests; here only that each row has one. */
jest.mock("~/components/storage/entries-table/DriveMenu", () => ({ entry }) => (
  <button>Actions for {entry.name}</button>
));
jest.mock("~/components/storage/entries-table/VolumeGroupMenu", () => ({ group }) => (
  <button>Actions for {group.vgName}</button>
));

const GiB = 1024 ** 3;

const disk = (name: string, model: string, partitions = []): Storage.Device =>
  ({
    sid: 1,
    name,
    class: "drive",
    description: "Disk",
    block: { size: 20 * GiB, start: 0, shrinking: { supported: false } },
    drive: { model, info: { sdCard: false } },
    partitions,
  }) as Storage.Device;

const config = (values: Partial<ConfigModel.Config> = {}): ConfigModel.Config => ({
  drives: [],
  mdRaids: [],
  volumeGroups: [],
  ...values,
});

const table = () => screen.getByRole("table", { name: "Devices of the installation" });
const row = (name: string) =>
  within(table())
    .getAllByRole("row")
    .find((r) => within(r).queryByRole("rowheader")?.textContent?.startsWith(name));

describe("EntriesTable", () => {
  beforeEach(() => {
    mockSystemDevice.mockReturnValue(null);
    mockScrollsSideways.mockReturnValue(false);
  });

  it("renders nothing when the configuration holds no device", () => {
    mockConfig.mockReturnValue(config());
    installerRender(<EntriesTable />);

    expect(screen.queryByRole("table")).toBeNull();
  });

  it("is a table to read, not a grid, with a header naming its columns", () => {
    mockConfig.mockReturnValue(config({ drives: [{ name: "/dev/sda", partitions: [] }] }));
    installerRender(<EntriesTable />);

    const headers = within(table())
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).toEqual(["Device", "Used for", "Actions on current content", "Actions"]);
  });

  describe("when it holds a single kind of device", () => {
    it("shows no group titles", () => {
      mockConfig.mockReturnValue(
        config({ drives: [{ name: "/dev/sda", partitions: [] }, { name: "/dev/sdb" }] }),
      );
      installerRender(<EntriesTable />);

      expect(screen.queryByRole("heading")).toBeNull();
      expect(row("sda")).toBeDefined();
      expect(row("sdb")).toBeDefined();
    });
  });

  describe("when it holds several kinds of device", () => {
    beforeEach(() => {
      mockConfig.mockReturnValue(
        config({
          drives: [{ name: "/dev/sda", partitions: [] }],
          volumeGroups: [{ vgName: "system", targetDevices: ["/dev/sda"], logicalVolumes: [] }],
        }),
      );
    });

    it("titles each group with a heading, volume groups before disks", () => {
      installerRender(<EntriesTable />);

      const titles = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
      expect(titles).toEqual(["LVM volume group", "Used disk"]);
    });

    it("names each group of rows by its title", () => {
      installerRender(<EntriesTable />);

      within(table()).getByRole("rowgroup", { name: "LVM volume group" });
      within(table()).getByRole("rowgroup", { name: "Used disk" });
    });

    it("takes the level its titles need", () => {
      installerRender(<EntriesTable groupHeadingLevel="h3" />);

      expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
    });

    it("keeps the first column headed Device", () => {
      installerRender(<EntriesTable />);

      within(table()).getByRole("columnheader", { name: "Device" });
    });
  });

  describe("a disk row", () => {
    it("names the disk with its size, and its model under it", () => {
      mockConfig.mockReturnValue(config({ drives: [{ name: "/dev/sda", partitions: [] }] }));
      mockSystemDevice.mockImplementation((name) =>
        name === "/dev/sda" ? disk("/dev/sda", "Samsung SSD") : null,
      );
      installerRender(<EntriesTable />);

      expect(row("sda")).toHaveTextContent("sda · 20 GiB");
      expect(row("sda")).toHaveTextContent("Samsung SSD");
    });

    it("says it installs and boots the system", () => {
      mockConfig.mockReturnValue(
        config({
          boot: { configure: true, device: { default: true, name: "/dev/sda" } },
          drives: [{ name: "/dev/sda", partitions: [{ mountPath: "/" }] }],
        }),
      );
      installerRender(<EntriesTable />);

      expect(row("sda")).toHaveTextContent("Installing and booting the system");
    });

    it("reads quieter when nothing is planned on it yet", () => {
      mockConfig.mockReturnValue(
        config({
          drives: [
            { name: "/dev/sda", partitions: [{ mountPath: "/" }] },
            { name: "/dev/sdb", partitions: [] },
          ],
        }),
      );
      installerRender(<EntriesTable />);

      expect(row("sdb")).toHaveTextContent("Nothing yet (skipped)");
      expect(row("sdb")).toHaveClass("agm-entries-table__row--idle");
      expect(row("sda")).not.toHaveClass("agm-entries-table__row--idle");
    });

    it("says the current data is kept when nothing on it changes", () => {
      mockConfig.mockReturnValue(
        config({
          drives: [
            {
              name: "/dev/sda",
              partitions: [
                {
                  name: "/dev/sda1",
                  mountPath: "/data",
                  filesystem: { reuse: true, default: false },
                },
              ],
            },
          ],
        }),
      );
      mockSystemDevice.mockImplementation((name) =>
        name === "/dev/sda"
          ? disk("/dev/sda", "Samsung SSD", [{ name: "/dev/sda1", block: {} }])
          : null,
      );
      installerRender(<EntriesTable />);

      expect(row("sda")).toHaveTextContent("The current data and partitions will be kept");
    });

    it("has its own menu", () => {
      mockConfig.mockReturnValue(config({ drives: [{ name: "/dev/sda", partitions: [] }] }));
      installerRender(<EntriesTable />);

      within(row("sda")).getByRole("button", { name: "Actions for /dev/sda" });
    });
  });

  describe("a volume group row", () => {
    it("says under its name that it is new, where a title already says what it is", () => {
      mockConfig.mockReturnValue(
        config({
          drives: [{ name: "/dev/sda", partitions: [] }],
          volumeGroups: [{ vgName: "system", targetDevices: ["/dev/sda"], logicalVolumes: [] }],
        }),
      );
      installerRender(<EntriesTable />);

      expect(row("system")).toHaveTextContent("New");
      expect(row("system")).not.toHaveTextContent("New volume group");
    });

    it("says what it is under its name where no title does", () => {
      mockConfig.mockReturnValue(
        config({ volumeGroups: [{ vgName: "system", targetDevices: [], logicalVolumes: [] }] }),
      );
      installerRender(<EntriesTable />);

      expect(row("system")).toHaveTextContent("New volume group");
    });

    it("reads quieter when it exists and nothing is planned in it yet", () => {
      mockConfig.mockReturnValue(
        config({
          volumeGroups: [
            { vgName: "data", name: "/dev/data", logicalVolumes: [] },
            { vgName: "system", targetDevices: [], logicalVolumes: [] },
          ],
        }),
      );
      installerRender(<EntriesTable />);

      expect(row("data")).toHaveTextContent("Nothing yet");
      expect(row("data")).toHaveClass("agm-entries-table__row--idle");
      expect(row("system")).not.toHaveClass("agm-entries-table__row--idle");
    });

    it("has its own menu", () => {
      mockConfig.mockReturnValue(
        config({ volumeGroups: [{ vgName: "system", targetDevices: [], logicalVolumes: [] }] }),
      );
      installerRender(<EntriesTable />);

      within(row("system")).getByRole("button", { name: "Actions for system" });
    });
  });

  describe("when it fits its box", () => {
    it("is still a region named after the table, but not a Tab stop", () => {
      mockConfig.mockReturnValue(config({ drives: [{ name: "/dev/sda", partitions: [] }] }));
      installerRender(<EntriesTable />);

      const region = screen.getByRole("region", { name: "Devices of the installation" });
      expect(region).not.toHaveAttribute("tabindex");
      expect(within(region).getByRole("table")).toBe(table());
    });
  });

  describe("when it is wider than its box", () => {
    it("scrolls in a region named after the table, reachable with Tab", () => {
      mockScrollsSideways.mockReturnValue(true);
      mockConfig.mockReturnValue(config({ drives: [{ name: "/dev/sda", partitions: [] }] }));
      installerRender(<EntriesTable />);

      const region = screen.getByRole("region", { name: "Devices of the installation" });
      expect(region).toHaveAttribute("tabindex", "0");
      expect(within(region).getByRole("table")).toBe(table());
    });
  });
});
