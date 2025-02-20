/*
 * Copyright (c) [2024-2025] SUSE LLC
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
import { installerRender, mockNavigateFn } from "~/test-utils";
import BootSelection from "./BootSelection";
import { StorageDevice } from "~/types/storage";
import { BootHook } from "~/queries/storage/config-model";

// FIXME: drop this mock once a better solution for dealing with
// ProductRegistrationAlert, which uses a query with suspense,
jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>ProductRegistrationAlert Mock</div>
));

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
  description: "",
  size: 1024,
  shrinking: { unsupported: ["Resizing is not supported"] },
  systems: [],
  udevIds: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"],
  udevPaths: ["pci-0000:00-12", "pci-0000:00-12-ata"],
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
  description: "",
  size: 2048,
  shrinking: { unsupported: ["Resizing is not supported"] },
  systems: [],
  udevIds: [],
  udevPaths: ["pci-0000:00-19"],
};

const sdc: StorageDevice = {
  sid: 63,
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
  name: "/dev/sdc",
  description: "",
  size: 2048,
  shrinking: { unsupported: ["Resizing is not supported"] },
  systems: [],
  udevIds: [],
  udevPaths: ["pci-0000:00-19"],
};

const mockAvailableDevices = [sda, sdb, sdc];

const mockBoot: BootHook = {
  configure: false,
  isDefault: false,
  deviceName: undefined,
  setDevice: jest.fn(),
  setDefault: jest.fn(),
  disable: jest.fn(),
};

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigateFn,
}));

jest.mock("~/queries/storage", () => ({
  ...jest.requireActual("~/queries/storage"),
  useAvailableDevices: () => mockAvailableDevices,
}));

jest.mock("~/queries/storage/config-model", () => ({
  ...jest.requireActual("~/queries/storage/config-model"),
  useBoot: () => mockBoot,
}));

describe("BootSelection", () => {
  const automaticOption = () => screen.getByRole("radio", { name: "Automatic" });
  const selectDiskOption = () => screen.getByRole("radio", { name: "Select a disk" });
  const notConfigureOption = () => screen.getByRole("radio", { name: "Do not configure" });
  const diskSelector = () => screen.getByRole("combobox", { name: /choose a disk/i });

  it("offers an option to configure boot in the installation disk", () => {
    installerRender(<BootSelection />);
    expect(automaticOption()).toBeInTheDocument();
  });

  it("offers an option to configure boot in a selected disk", () => {
    installerRender(<BootSelection />);
    expect(selectDiskOption()).toBeInTheDocument();
    expect(diskSelector()).toBeInTheDocument();
  });

  it("offers an option to not configure boot", () => {
    installerRender(<BootSelection />);
    expect(notConfigureOption()).toBeInTheDocument();
  });

  describe("if the current value is set to boot from the installation disk", () => {
    beforeEach(() => {
      mockBoot.configure = true;
      mockBoot.isDefault = true;
    });

    it("selects 'Automatic' option by default", () => {
      installerRender(<BootSelection />);
      expect(automaticOption()).toBeChecked();
      expect(selectDiskOption()).not.toBeChecked();
      expect(diskSelector()).toBeDisabled();
      expect(notConfigureOption()).not.toBeChecked();
    });
  });

  describe("if the current value is set to boot from a selected disk", () => {
    beforeEach(() => {
      mockBoot.configure = true;
      mockBoot.isDefault = false;
      mockBoot.deviceName = sda.name;
    });

    it("selects 'Select a disk' option by default", () => {
      installerRender(<BootSelection />);
      expect(automaticOption()).not.toBeChecked();
      expect(selectDiskOption()).toBeChecked();
      expect(diskSelector()).toBeEnabled();
      expect(notConfigureOption()).not.toBeChecked();
    });
  });

  describe("if the current value is set to not configure boot", () => {
    beforeEach(() => {
      mockBoot.configure = false;
    });

    it("selects 'Do not configure' option by default", () => {
      installerRender(<BootSelection />);
      expect(automaticOption()).not.toBeChecked();
      expect(selectDiskOption()).not.toBeChecked();
      expect(diskSelector()).toBeDisabled();
      expect(notConfigureOption()).toBeChecked();
    });
  });

  it("does not change the boot options on cancel", async () => {
    const { user } = installerRender(<BootSelection />);
    const cancel = screen.getByRole("link", { name: "Cancel" });

    await user.click(cancel);

    expect(mockBoot.setDevice).not.toHaveBeenCalled();
    expect(mockBoot.setDefault).not.toHaveBeenCalled();
    expect(mockBoot.disable).not.toHaveBeenCalled();
  });

  it("applies the expected boot options when 'Automatic' is selected", async () => {
    const { user } = installerRender(<BootSelection />);
    await user.click(automaticOption());

    const accept = screen.getByRole("button", { name: "Accept" });
    await user.click(accept);

    expect(mockBoot.setDefault).toHaveBeenCalled();
  });

  it("applies the expected boot options when a disk is selected", async () => {
    const { user } = installerRender(<BootSelection />);

    await user.click(selectDiskOption());
    const selector = diskSelector();
    const sdbOption = within(selector).getByRole("option", { name: /sdb/ });
    await user.selectOptions(selector, sdbOption);

    const accept = screen.getByRole("button", { name: "Accept" });
    await user.click(accept);

    expect(mockBoot.setDevice).toHaveBeenCalledWith(sdb.name);
  });

  it("applies the expected boot options when 'No configure' is selected", async () => {
    const { user } = installerRender(<BootSelection />);
    await user.click(notConfigureOption());

    const accept = screen.getByRole("button", { name: "Accept" });
    await user.click(accept);

    expect(mockBoot.disable).toHaveBeenCalled();
  });
});
