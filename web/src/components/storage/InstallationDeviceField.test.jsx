/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

// @ts-check

import React from "react";
import { screen, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import InstallationDeviceField from "~/components/storage/InstallationDeviceField";

/**
 * @typedef {import ("~/components/storage/InstallationDeviceField").InstallationDeviceFieldProps} InstallationDeviceFieldProps
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 */

/** @type {StorageDevice} */
const sda = {
  sid: 59,
  isDrive: true,
  type: "disk",
  description: "",
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
  recoverableSize: 0,
  systems : [],
  udevIds: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"],
  udevPaths: ["pci-0000:00-12", "pci-0000:00-12-ata"],
};

/** @type {StorageDevice} */
const sdb = {
  sid: 62,
  isDrive: true,
  type: "disk",
  description: "",
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
  recoverableSize: 0,
  systems : [],
  udevIds: [],
  udevPaths: ["pci-0000:00-19"]
};

/** @type {InstallationDeviceFieldProps} */
let props;

beforeEach(() => {
  props = {
    target: "DISK",
    targetDevice: sda,
    targetPVDevices: [],
    devices: [sda, sdb],
    isLoading: false,
    onChange: jest.fn()
  };
});

describe("when set as loading", () => {
  beforeEach(() => {
    props.isLoading = true;
  });

  it("renders a loading hint", () => {
    plainRender(<InstallationDeviceField {...props} />);
    screen.getByText("Waiting for information about selected device");
  });
});

describe("when the target is a disk", () => {
  beforeEach(() => {
    props.target = "DISK";
  });

  describe("and installation device is not selected yet", () => {
    beforeEach(() => {
      props.targetDevice = undefined;
    });

    it("uses a 'No device selected yet' text for the selection button", async () => {
      plainRender(<InstallationDeviceField {...props} />);
      screen.getByText("No device selected yet");
    });
  });

  describe("and an installation device is selected", () => {
    beforeEach(() => {
      props.targetDevice = sda;
    });

    it("uses its name as part of the text for the selection button", async () => {
      plainRender(<InstallationDeviceField {...props} />);
      screen.getByText(/\/dev\/sda/);
    });
  });
});

describe("when the target is a new LVM volume group", () => {
  beforeEach(() => {
    props.target = "NEW_LVM_VG";
  });

  describe("and the target devices are not selected yet", () => {
    beforeEach(() => {
      props.targetPVDevices = [];
    });

    it("uses a 'No device selected yet' text for the selection button", async () => {
      plainRender(<InstallationDeviceField {...props} />);
      screen.getByText("No device selected yet");
    });
  });

  describe("and there is a selected device", () => {
    beforeEach(() => {
      props.targetPVDevices = [sda];
    });

    it("uses its name as part of the text for the selection button", async () => {
      plainRender(<InstallationDeviceField {...props} />);
      screen.getByText(/new LVM .* \/dev\/sda/);
    });
  });

  describe("and there are more than one selected device", () => {
    beforeEach(() => {
      props.targetPVDevices = [sda, sdb];
    });

    it("does not use the names as part of the text for the selection button", async () => {
      plainRender(<InstallationDeviceField {...props} />);
      screen.getByText("new LVM volume group");
    });
  });
});

it("allows changing the selected device", async () => {
  const { user } = plainRender(<InstallationDeviceField {...props} />);
  const button = screen.getByRole("button", { name: /installation device/i });

  await user.click(button);

  const selector = await screen.findByRole("dialog", { name: /Device for installing/ });
  const diskGrid = within(selector).getByRole("grid", { name: /target disk/ });
  const sdbRow = within(diskGrid).getByRole("row", { name: /sdb/ });
  const sdbOption = within(sdbRow).getByRole("radio");
  const accept = within(selector).getByRole("button", { name: "Confirm" });

  await user.click(sdbOption);
  await user.click(accept);

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(props.onChange).toHaveBeenCalledWith({
    target: "DISK",
    targetDevice: sdb,
    targetPVDevices: []
  });
});

it("allows canceling a device selection", async () => {
  const { user } = plainRender(<InstallationDeviceField {...props} />);
  const button = screen.getByRole("button", { name: /installation device/i });

  await user.click(button);

  const selector = await screen.findByRole("dialog", { name: /Device for installing/ });
  const diskGrid = within(selector).getByRole("grid", { name: /target disk/ });
  const sdbRow = within(diskGrid).getByRole("row", { name: /sdb/ });
  const sdbOption = within(sdbRow).getByRole("radio");
  const cancel = within(selector).getByRole("button", { name: "Cancel" });

  await user.click(sdbOption);
  await user.click(cancel);

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(props.onChange).not.toHaveBeenCalled();
});
