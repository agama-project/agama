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
import DrivesTable from "./DrivesTable";

const sda: Storage.Device = {
  sid: 59,
  class: "drive",
  name: "/dev/sda",
  description: "SDA drive",
  drive: {
    model: "Micron 1100 SATA",
    vendor: "Micron",
    bus: "SATA",
    busId: "",
    transport: "sata",
    drivers: [],
    info: { boss: false, sdCard: false },
  },
  block: {
    start: 0,
    size: 1024,
    encrypted: false,
    systems: [],
    shrinking: { supported: false },
  },
};

const sdb: Storage.Device = {
  sid: 62,
  class: "drive",
  name: "/dev/sdb",
  description: "SDB drive",
  drive: {
    model: "Samsung Evo 8 Pro",
    vendor: "Samsung",
    bus: "USB",
    busId: "",
    transport: "usb",
    drivers: [],
    info: { boss: false, sdCard: false },
  },
  block: {
    start: 0,
    size: 2048,
    encrypted: false,
    systems: [],
    shrinking: { supported: false },
  },
};

const onSelectionChangeMock = jest.fn();

describe("DrivesTable", () => {
  it("renders Device, Size, Description, and Current content columns", () => {
    plainRender(<DrivesTable devices={[sda, sdb]} onSelectionChange={onSelectionChangeMock} />);
    const table = screen.getByRole("grid");
    within(table).getByRole("columnheader", { name: "Device" });
    within(table).getByRole("columnheader", { name: "Size" });
    within(table).getByRole("columnheader", { name: "Description" });
    within(table).getByRole("columnheader", { name: "Current content" });
  });

  it("renders a row per device", () => {
    plainRender(<DrivesTable devices={[sda, sdb]} onSelectionChange={onSelectionChangeMock} />);
    screen.getByRole("row", { name: /sda/ });
    screen.getByRole("row", { name: /sdb/ });
  });

  it("allows sorting by device name", async () => {
    const { user } = plainRender(
      <DrivesTable devices={[sda, sdb]} onSelectionChange={onSelectionChangeMock} />,
    );

    const table = screen.getByRole("grid");
    const sortButton = within(table).getByRole("button", { name: "Device" });

    expect(getColumnValues(table, "Device")).toEqual(["sda", "sdb"]);

    await user.click(sortButton);

    expect(getColumnValues(table, "Device")).toEqual(["sdb", "sda"]);
  });

  it("allows sorting by size", async () => {
    const { user } = plainRender(
      <DrivesTable devices={[sda, sdb]} onSelectionChange={onSelectionChangeMock} />,
    );

    const table = screen.getByRole("grid");
    const sortButton = within(table).getByRole("button", { name: "Size" });

    await user.click(sortButton);
    expect(getColumnValues(table, "Size")).toEqual(["1 KiB", "2 KiB"]);

    await user.click(sortButton);
    expect(getColumnValues(table, "Size")).toEqual(["2 KiB", "1 KiB"]);
  });

  it("calls onSelectionChange when a device is selected", async () => {
    const { user } = plainRender(
      <DrivesTable devices={[sda, sdb]} onSelectionChange={onSelectionChangeMock} />,
    );

    const sdbRow = screen.getByRole("row", { name: /sdb/ });
    await user.click(within(sdbRow).getByRole("radio"));
    expect(onSelectionChangeMock).toHaveBeenCalledWith([sdb]);
  });
});
