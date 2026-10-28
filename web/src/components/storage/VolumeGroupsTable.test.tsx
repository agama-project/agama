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
import VolumeGroupsTable from "./VolumeGroupsTable";

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

const vg0: Storage.Device = {
  sid: 80,
  class: "volumeGroup",
  name: "/dev/vg0",
  description: "Volume group 0",
  volumeGroup: { size: 51200, physicalVolumes: [1, 2] },
  logicalVolumes: [
    { sid: 81, name: "/dev/vg0/lv0", class: "logicalVolume" },
    { sid: 82, name: "/dev/vg0/lv1", class: "logicalVolume" },
  ],
};

const vg1: Storage.Device = {
  sid: 83,
  class: "volumeGroup",
  name: "/dev/vg1",
  description: "Volume group 1",
  volumeGroup: { size: 102400, physicalVolumes: [3, 4, 5] },
  logicalVolumes: [{ sid: 84, name: "/dev/vg1/lv0", class: "logicalVolume" }],
};

const onSelectionChangeMock = jest.fn();

describe("VolumeGroupsTable", () => {
  it("renders Device, Size, Logical volumes, and Physical volumes columns", () => {
    plainRender(
      <VolumeGroupsTable devices={[vg0, vg1]} onSelectionChange={onSelectionChangeMock} />,
    );
    const table = screen.getByRole("grid");
    within(table).getByRole("columnheader", { name: "Device" });
    within(table).getByRole("columnheader", { name: "Size" });
    within(table).getByRole("columnheader", { name: "Logical volumes" });
    within(table).getByRole("columnheader", { name: "Physical volumes" });
  });

  it("renders a row per volume group", () => {
    plainRender(
      <VolumeGroupsTable devices={[vg0, vg1]} onSelectionChange={onSelectionChangeMock} />,
    );
    screen.getByRole("row", { name: /vg0/ });
    screen.getByRole("row", { name: /vg1/ });
  });

  it("renders the logical volume names", () => {
    plainRender(
      <VolumeGroupsTable devices={[vg0, vg1]} onSelectionChange={onSelectionChangeMock} />,
    );
    const table = screen.getByRole("grid");
    expect(getColumnValues(table, "Logical volumes")).toEqual(["lv0, lv1", "lv0"]);
  });

  it("renders the physical volume names", () => {
    plainRender(
      <VolumeGroupsTable devices={[vg0, vg1]} onSelectionChange={onSelectionChangeMock} />,
    );
    const table = screen.getByRole("grid");
    expect(getColumnValues(table, "Physical volumes")).toEqual(["sda, sdb", "sdc, sdd, sde"]);
  });

  it("allows sorting by device name", async () => {
    const { user } = plainRender(
      <VolumeGroupsTable devices={[vg0, vg1]} onSelectionChange={onSelectionChangeMock} />,
    );

    const table = screen.getByRole("grid");
    const sortButton = within(table).getByRole("button", { name: "Device" });

    expect(getColumnValues(table, "Device")).toEqual(["vg0", "vg1"]);

    await user.click(sortButton);

    expect(getColumnValues(table, "Device")).toEqual(["vg1", "vg0"]);
  });

  it("allows sorting by size", async () => {
    const { user } = plainRender(
      <VolumeGroupsTable devices={[vg0, vg1]} onSelectionChange={onSelectionChangeMock} />,
    );

    const table = screen.getByRole("grid");
    const sortButton = within(table).getByRole("button", { name: "Size" });

    await user.click(sortButton);
    expect(getColumnValues(table, "Size")).toEqual(["50 KiB", "100 KiB"]);

    await user.click(sortButton);
    expect(getColumnValues(table, "Size")).toEqual(["100 KiB", "50 KiB"]);
  });

  it("calls onSelectionChange when a device is selected", async () => {
    const { user } = plainRender(
      <VolumeGroupsTable devices={[vg0, vg1]} onSelectionChange={onSelectionChangeMock} />,
    );

    const vg1Row = screen.getByRole("row", { name: /vg1/ });
    await user.click(within(vg1Row).getByRole("radio"));
    expect(onSelectionChangeMock).toHaveBeenCalledWith([vg1]);
  });
});
