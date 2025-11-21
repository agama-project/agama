/*
 * Copyright (c) [2025] SUSE LLC
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
import { StorageDevice } from "~/storage";
import DeviceSelectorModal from "./DeviceSelectorModal";

const sda: StorageDevice = {
  sid: 59,
  isDrive: true,
  type: "disk",
  vendor: "Micron",
  model: "Micron 1100 SATA",
  driver: ["ahci", "mmcblk"],
  bus: "IDE",
  busId: "",
  transport: "usb",
  dellBOSS: false,
  sdCard: true,
  active: true,
  name: "/dev/sda",
  size: 1024,
  shrinking: { unsupported: ["Resizing is not supported"] },
  systems: [],
  udevIds: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"],
  udevPaths: ["pci-0000:00-12", "pci-0000:00-12-ata"],
  description: "SDA drive",
};

const sdb: StorageDevice = {
  sid: 62,
  isDrive: true,
  type: "disk",
  vendor: "Samsung",
  model: "Samsung Evo 8 Pro",
  driver: ["ahci"],
  bus: "IDE",
  busId: "",
  transport: "",
  dellBOSS: false,
  sdCard: false,
  active: true,
  name: "/dev/sdb",
  size: 2048,
  shrinking: { unsupported: ["Resizing is not supported"] },
  systems: [],
  udevIds: [],
  udevPaths: ["pci-0000:00-19"],
  description: "SDB drive",
};

const onCancelMock = jest.fn();
const onConfirmMock = jest.fn();

describe("DeviceSelectorModal", () => {
  it("renders a modal dialog with a table for selecting a device", () => {
    plainRender(
      <DeviceSelectorModal
        devices={[sda, sdb]}
        title="Select a device"
        onCancel={onCancelMock}
        onConfirm={onConfirmMock}
      />,
    );
    screen.getByRole("dialog", { name: "Select a device" });
  });

  it("renders type, name, content, and filesystems columns", () => {
    plainRender(
      <DeviceSelectorModal
        devices={[sda, sdb]}
        title="Select a device"
        onCancel={onCancelMock}
        onConfirm={onConfirmMock}
      />,
    );
    const table = screen.getByRole("grid");
    within(table).getByRole("columnheader", { name: "Device" });
    within(table).getByRole("columnheader", { name: "Size" });
    within(table).getByRole("columnheader", { name: "Description" });
    within(table).getByRole("columnheader", { name: "Current content" });
  });

  it.todo("renders type, name, content, and filesystems of each device");
  it.todo("renders corresponding control (radio or checkbox) as checked for given selected device");

  it("allows sorting by device name", async () => {
    const { user } = plainRender(
      <DeviceSelectorModal
        devices={[sda, sdb]}
        title="Select a device"
        onCancel={onCancelMock}
        onConfirm={onConfirmMock}
      />,
    );

    const table = screen.getByRole("grid");
    const sortByDeviceButton = within(table).getByRole("button", { name: "Device" });

    expect(getColumnValues(table, "Device")).toEqual(["/dev/sda", "/dev/sdb"]);

    await user.click(sortByDeviceButton);

    expect(getColumnValues(table, "Device")).toEqual(["/dev/sdb", "/dev/sda"]);
  });

  it("allows sorting by device size", async () => {
    const { user } = plainRender(
      <DeviceSelectorModal
        devices={[sda, sdb]}
        title="Select a device"
        onCancel={onCancelMock}
        onConfirm={onConfirmMock}
      />,
    );

    const table = screen.getByRole("grid");
    const sortBySizeButton = within(table).getByRole("button", { name: "Size" });

    // By default, table is sorted by device name. Switch sorting to size in asc direction
    await user.click(sortBySizeButton);

    expect(getColumnValues(table, "Size")).toEqual(["1 KiB", "2 KiB"]);

    // Now keep sorting by size, but in desc direction
    await user.click(sortBySizeButton);

    expect(getColumnValues(table, "Size")).toEqual(["2 KiB", "1 KiB"]);
  });

  it("triggers onCancel callback when users selects `Cancel` action", async () => {
    const { user } = plainRender(
      <DeviceSelectorModal
        devices={[sda, sdb]}
        title="Select a device"
        onCancel={onCancelMock}
        onConfirm={onConfirmMock}
      />,
    );

    const cancelAction = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelAction);
    expect(onCancelMock).toHaveBeenCalled();
  });

  it("triggers `onCancel` callback when users selects `Cancel` action", async () => {
    const { user } = plainRender(
      <DeviceSelectorModal
        devices={[sda, sdb]}
        title="Select a device"
        onCancel={onCancelMock}
        onConfirm={onConfirmMock}
      />,
    );

    const cancelAction = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelAction);
    expect(onCancelMock).toHaveBeenCalled();
  });

  it("triggers `onConfirm` callback with selected devices when users selects `Confirm` action", async () => {
    const { user } = plainRender(
      <DeviceSelectorModal
        devices={[sda, sdb]}
        title="Select a device"
        onCancel={onCancelMock}
        onConfirm={onConfirmMock}
      />,
    );

    const sdbRow = screen.getByRole("row", { name: /\/dev\/sdb/ });
    const sdbRadio = within(sdbRow).getByRole("radio");
    await user.click(sdbRadio);
    const confirmAction = screen.getByRole("button", { name: "Confirm" });
    await user.click(confirmAction);
    expect(onConfirmMock).toHaveBeenCalledWith([sdb]);
  });
});
