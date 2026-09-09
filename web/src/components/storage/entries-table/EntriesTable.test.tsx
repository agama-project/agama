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

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfig(),
}));

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useDevice: (name: string) => mockSystemDevice(name),
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

describe("EntriesTable", () => {
  beforeEach(() => {
    mockSystemDevice.mockReturnValue(null);
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
