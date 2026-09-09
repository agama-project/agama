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
import { plainRender } from "~/test-utils";
import type { ConfigModel } from "~/model/storage/config-model";
import EntriesTable from "~/components/storage/entries-table/EntriesTable";

const mockConfig = jest.fn();
const mockSystemDevice = jest.fn();
const mockSystemDevices = jest.fn();
const mockActions = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig(),
}));

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useDevice: (name: string) => mockSystemDevice(name),
  useFlattenDevices: () => mockSystemDevices(),
}));

jest.mock("~/hooks/model/proposal/storage", () => ({
  ...jest.requireActual("~/hooks/model/proposal/storage"),
  useFlattenDevices: () => [],
  useActions: () => mockActions(),
}));

const config = (values: Partial<ConfigModel.Config> = {}): ConfigModel.Config => ({
  drives: [],
  mdRaids: [],
  volumeGroups: [],
  ...values,
});

/**
 * The list, as a reader who cannot see the arrangement meets it.
 *
 * Asking for a table rather than for the element also guards the one prop that
 * would fail quietly: PatternFly calls its tables grids by default, and a grid
 * is an interactive widget rather than something to read.
 */
const table = () => screen.getByRole("table", { name: "Configured devices" });

/** Every name the list reads out, in the order it reads them. */
const names = () =>
  within(table())
    .getAllByRole("rowheader")
    .map((cell) => cell.textContent);

/** What the row says the installer will do, and what that costs. */
const rowText = (name: string) =>
  within(table())
    .getAllByRole("row")
    .find((row) => within(row).queryByRole("rowheader")?.textContent?.startsWith(name))
    ?.textContent;

describe("EntriesTable", () => {
  beforeEach(() => {
    mockSystemDevice.mockReturnValue(null);
    mockSystemDevices.mockReturnValue([]);
    mockActions.mockReturnValue([]);
  });

  describe("when the configuration holds nothing", () => {
    it("renders no list at all", () => {
      mockConfig.mockReturnValue(config());
      plainRender(<EntriesTable />);

      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });

  it("names each category over the entries it heads", () => {
    mockConfig.mockReturnValue(
      config({ drives: [{ name: "/dev/sda" }], volumeGroups: [{ vgName: "system" }] }),
    );
    plainRender(<EntriesTable />);

    within(table()).getByRole("rowheader", { name: "Volume groups" });
    within(table()).getByRole("rowheader", { name: "Disks" });
  });

  it("reads from what is defined down to the hardware it is defined on", () => {
    mockConfig.mockReturnValue(
      config({
        drives: [{ name: "/dev/sda" }, { name: "/dev/sdb" }],
        mdRaids: [{ name: "/dev/md0" }],
        volumeGroups: [{ vgName: "system" }],
      }),
    );
    plainRender(<EntriesTable />);

    expect(names()).toEqual([
      "Volume groups",
      "system",
      "RAID devices",
      "md0",
      "Disks",
      "sda",
      "sdb",
    ]);
  });

  it("says how big a disk is and what it is, beside its name", () => {
    mockConfig.mockReturnValue(config({ drives: [{ name: "/dev/sda" }] }));
    mockSystemDevice.mockReturnValue({
      name: "/dev/sda",
      class: "drive",
      drive: { type: "disk", info: {} },
      block: { size: 64424509440 },
      partitionTable: { type: "gpt" },
    });
    plainRender(<EntriesTable />);

    within(table()).getByRole("rowheader", { name: /sda\s+60 GiB\s+·\s+Disk\s+·\s+GPT/ });
  });

  it("says nothing about a device the machine does not have", () => {
    mockConfig.mockReturnValue(config({ drives: [{ name: "/dev/sdz" }] }));
    plainRender(<EntriesTable />);

    within(table()).getByRole("rowheader", { name: "sdz" });
  });
});

describe("what a row says the installer will do", () => {
  beforeEach(() => {
    mockSystemDevice.mockReturnValue(null);
    mockSystemDevices.mockReturnValue([]);
    mockActions.mockReturnValue([]);
  });

  it("names both jobs of a disk that holds a volume group and starts the machine", () => {
    mockConfig.mockReturnValue(
      config({
        drives: [{ name: "/dev/sda" }],
        volumeGroups: [{ vgName: "system", targetDevices: ["/dev/sda"] }],
        boot: { configure: true, device: { default: false, name: "/dev/sda" } },
      }),
    );
    plainRender(<EntriesTable />);

    expect(rowText("sda")).toContain("Host LVM and boot");
  });

  it("counts the partitions it creates and the ones it takes over", () => {
    mockConfig.mockReturnValue(
      config({
        drives: [
          {
            name: "/dev/sda",
            partitions: [
              { mountPath: "/" },
              { mountPath: "swap" },
              {
                name: "/dev/sda3",
                mountPath: "/home",
                filesystem: { default: false, reuse: true },
              },
            ],
          },
        ],
      }),
    );
    plainRender(<EntriesTable />);

    expect(rowText("sda")).toContain("Create 2 partitions");
    expect(rowText("sda")).toContain("Reuse 1 partition");
  });

  it("says where a volume group sits and what it will hold", () => {
    mockConfig.mockReturnValue(
      config({
        drives: [{ name: "/dev/sda" }],
        volumeGroups: [
          {
            vgName: "system",
            targetDevices: ["/dev/sda"],
            logicalVolumes: [{ mountPath: "/" }, { mountPath: "swap" }],
          },
        ],
      }),
    );
    plainRender(<EntriesTable />);

    expect(rowText("system")).toContain("Create LVM volume group on sda");
    expect(rowText("system")).toContain("Define 2 logical volumes");
  });

  it("counts the disks a volume group is spread over rather than naming them", () => {
    mockConfig.mockReturnValue(
      config({
        drives: [{ name: "/dev/sda" }, { name: "/dev/sdb" }],
        volumeGroups: [{ vgName: "system", targetDevices: ["/dev/sda", "/dev/sdb"] }],
      }),
    );
    plainRender(<EntriesTable />);

    expect(rowText("system")).toContain("Create LVM volume group on 2 disks");
  });
});

describe("what a row says it costs", () => {
  /** A disk carrying Windows, which the installation is about to remove. */
  const windowsPartition = {
    sid: 41,
    name: "/dev/sda1",
    class: "partition",
    block: { systems: ["Windows 11"] },
  };

  beforeEach(() => {
    mockConfig.mockReturnValue(config({ drives: [{ name: "/dev/sda" }] }));
    mockSystemDevice.mockReturnValue({ name: "/dev/sda", partitions: [windowsPartition] });
    mockSystemDevices.mockReturnValue([windowsPartition]);
    mockActions.mockReturnValue([]);
  });

  it("names what the machine loses, rather than counting it", () => {
    mockActions.mockReturnValue([{ device: 41, text: "", delete: true }]);
    plainRender(<EntriesTable />);

    expect(rowText("sda")).toContain("Windows 11 will be deleted");
  });

  it("counts what it cannot name", () => {
    mockSystemDevice.mockReturnValue({
      name: "/dev/sda",
      partitions: [{ sid: 41, name: "/dev/sda1", class: "partition", block: { systems: [] } }],
    });
    mockSystemDevices.mockReturnValue([
      { sid: 41, name: "/dev/sda1", class: "partition", block: { systems: [] } },
    ]);
    mockActions.mockReturnValue([{ device: 41, text: "", delete: true }]);
    plainRender(<EntriesTable />);

    expect(rowText("sda")).toContain("1 partition will be deleted");
  });

  it("tells a shrink apart from a deletion", () => {
    mockActions.mockReturnValue([{ device: 41, text: "", resize: true }]);
    plainRender(<EntriesTable />);

    expect(rowText("sda")).toContain("1 partition will shrink");
    expect(rowText("sda")).not.toContain("deleted");
  });

  it("says nothing where the installation costs nothing", () => {
    plainRender(<EntriesTable />);

    expect(rowText("sda")).toBe("sda");
  });
});
