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
import { getColumnValues, plainRender } from "~/test-utils";
import type { Storage } from "~/model/system";
import MdRaidsTable from "./MdRaidsTable";

const sda: Storage.Device = {
  sid: 1,
  class: "drive",
  name: "/dev/sda",
  description: "SDA",
  drive: {
    model: "",
    vendor: "",
    bus: "SATA",
    busId: "",
    transport: "",
    drivers: [],
    info: { boss: false, sdCard: false },
  },
  block: {
    start: 0,
    size: 10240,
    encrypted: false,
    systems: [],
    shrinking: { supported: false },
  },
};

const sdb: Storage.Device = { ...sda, sid: 2, name: "/dev/sdb", description: "SDB" };
const sdc: Storage.Device = { ...sda, sid: 3, name: "/dev/sdc", description: "SDC" };
const sdd: Storage.Device = { ...sda, sid: 4, name: "/dev/sdd", description: "SDD" };
const sde: Storage.Device = { ...sda, sid: 5, name: "/dev/sde", description: "SDE" };

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useFlattenDevices: () => [sda, sdb, sdc, sdd, sde],
}));

const md0: Storage.Device = {
  sid: 70,
  class: "mdRaid",
  name: "/dev/md0",
  description: "MD RAID 0",
  md: { level: "raid1", devices: [1, 2] },
  block: {
    start: 0,
    size: 10240,
    encrypted: false,
    systems: [],
    shrinking: { supported: false },
  },
};

const md1: Storage.Device = {
  sid: 71,
  class: "mdRaid",
  name: "/dev/md1",
  description: "MD RAID 1",
  md: { level: "raid5", devices: [3, 4, 5] },
  block: {
    start: 0,
    size: 20480,
    encrypted: false,
    systems: [],
    shrinking: { supported: false },
  },
};

const onSelectionChangeMock = jest.fn();

describe("MdRaidsTable", () => {
  it("renders Device, Size, Level, Members, and Current content columns", () => {
    plainRender(<MdRaidsTable devices={[md0, md1]} onSelectionChange={onSelectionChangeMock} />);
    const table = screen.getByRole("grid");
    within(table).getByRole("columnheader", { name: "Device" });
    within(table).getByRole("columnheader", { name: "Size" });
    within(table).getByRole("columnheader", { name: "Level" });
    within(table).getByRole("columnheader", { name: "Members" });
    within(table).getByRole("columnheader", { name: "Current content" });
  });

  it("renders a row per RAID device", () => {
    plainRender(<MdRaidsTable devices={[md0, md1]} onSelectionChange={onSelectionChangeMock} />);
    screen.getByRole("row", { name: /md0/ });
    screen.getByRole("row", { name: /md1/ });
  });

  it("renders the RAID level in uppercase", () => {
    plainRender(<MdRaidsTable devices={[md0, md1]} onSelectionChange={onSelectionChangeMock} />);
    const table = screen.getByRole("grid");
    expect(getColumnValues(table, "Level")).toEqual(["RAID1", "RAID5"]);
  });

  it("renders the current content of each member device", () => {
    plainRender(<MdRaidsTable devices={[md0]} onSelectionChange={onSelectionChangeMock} />);
    const md0Row = screen.getByRole("row", { name: /md0/ });
    within(md0Row).getByText("MD RAID 0");
  });

  it("renders the member names", () => {
    plainRender(<MdRaidsTable devices={[md0, md1]} onSelectionChange={onSelectionChangeMock} />);
    const table = screen.getByRole("grid");
    expect(getColumnValues(table, "Members")).toEqual(["sda, sdb", "sdc, sdd, sde"]);
  });

  it("allows sorting by device name", async () => {
    const { user } = plainRender(
      <MdRaidsTable devices={[md0, md1]} onSelectionChange={onSelectionChangeMock} />,
    );

    const table = screen.getByRole("grid");
    const sortButton = within(table).getByRole("button", { name: "Device" });

    expect(getColumnValues(table, "Device")).toEqual(["md0", "md1"]);

    await user.click(sortButton);

    expect(getColumnValues(table, "Device")).toEqual(["md1", "md0"]);
  });

  it("allows sorting by size", async () => {
    const { user } = plainRender(
      <MdRaidsTable devices={[md0, md1]} onSelectionChange={onSelectionChangeMock} />,
    );

    const table = screen.getByRole("grid");
    const sortButton = within(table).getByRole("button", { name: "Size" });

    await user.click(sortButton);
    expect(getColumnValues(table, "Size")).toEqual(["10 KiB", "20 KiB"]);

    await user.click(sortButton);
    expect(getColumnValues(table, "Size")).toEqual(["20 KiB", "10 KiB"]);
  });

  it("calls onSelectionChange when a device is selected", async () => {
    const { user } = plainRender(
      <MdRaidsTable devices={[md0, md1]} onSelectionChange={onSelectionChangeMock} />,
    );

    const md1Row = screen.getByRole("row", { name: /md1/ });
    await user.click(within(md1Row).getByRole("radio"));
    expect(onSelectionChangeMock).toHaveBeenCalledWith([md1]);
  });
});
