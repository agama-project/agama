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

import React from "react";
import { screen, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { BootSelectionDialog } from "~/components/storage";

const sda = {
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
  recoverableSize: 0,
  systems : [],
  udevIds: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"],
  udevPaths: ["pci-0000:00-12", "pci-0000:00-12-ata"],
};

const sdb = {
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
  recoverableSize: 0,
  systems : [],
  udevIds: [],
  udevPaths: ["pci-0000:00-19"]
};

const sdc = {
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
  size: 2048,
  recoverableSize: 0,
  systems : [],
  udevIds: [],
  udevPaths: ["pci-0000:00-19"]
};

let props;

describe("BootSelectionDialog", () => {
  beforeEach(() => {
    props = {
      isOpen: true,
      configureBoot: false,
      devices: [sda, sdb, sdc],
      onCancel: jest.fn(),
      onAccept: jest.fn()
    };
  });

  const automaticOption = () => screen.queryByRole("radio", { name: "Automatic" });
  const selectDiskOption = () => screen.queryByRole("radio", { name: "Select a disk" });
  const notConfigureOption = () => screen.queryByRole("radio", { name: "Do not configure" });
  const diskSelector = () => screen.queryByRole("combobox", { name: /choose a disk/i });

  it("offers an option to configure boot in the installation disk", () => {
    plainRender(<BootSelectionDialog {...props} />);
    expect(automaticOption()).toBeInTheDocument();
  });

  it("offers an option to configure boot in a selected disk", () => {
    plainRender(<BootSelectionDialog {...props} />);
    expect(selectDiskOption()).toBeInTheDocument();
    expect(diskSelector()).toBeInTheDocument();
  });

  it("offers an option to not configure boot", () => {
    plainRender(<BootSelectionDialog {...props} />);
    expect(notConfigureOption()).toBeInTheDocument();
  });

  describe("if the current value is set to boot from the installation disk", () => {
    beforeEach(() => {
      props.configureBoot = true;
      props.bootDevice = undefined;
    });

    it("selects 'Automatic' option by default", () => {
      plainRender(<BootSelectionDialog {...props} />);
      expect(automaticOption()).toBeChecked();
      expect(selectDiskOption()).not.toBeChecked();
      expect(diskSelector()).toBeDisabled();
      expect(notConfigureOption()).not.toBeChecked();
    });
  });

  describe("if the current value is set to boot from a selected disk", () => {
    beforeEach(() => {
      props.configureBoot = true;
      props.bootDevice = sdb;
    });

    it("selects 'Select a disk' option by default", () => {
      plainRender(<BootSelectionDialog {...props} />);
      expect(automaticOption()).not.toBeChecked();
      expect(selectDiskOption()).toBeChecked();
      expect(diskSelector()).toBeEnabled();
      expect(notConfigureOption()).not.toBeChecked();
    });
  });

  describe("if the current value is set to not configure boot", () => {
    beforeEach(() => {
      props.configureBoot = false;
      props.bootDevice = sdb;
    });

    it("selects 'Do not configure' option by default", () => {
      plainRender(<BootSelectionDialog {...props} />);
      expect(automaticOption()).not.toBeChecked();
      expect(selectDiskOption()).not.toBeChecked();
      expect(diskSelector()).toBeDisabled();
      expect(notConfigureOption()).toBeChecked();
    });
  });

  it("does not call onAccept on cancel", async () => {
    const { user } = plainRender(<BootSelectionDialog {...props} />);
    const cancel = screen.getByRole("button", { name: "Cancel" });

    await user.click(cancel);

    expect(props.onAccept).not.toHaveBeenCalled();
  });

  describe("if the 'Automatic' option is selected", () => {
    beforeEach(() => {
      props.configureBoot = false;
      props.bootDevice = undefined;
    });

    it("calls onAccept with the selected options on accept", async () => {
      const { user } = plainRender(<BootSelectionDialog {...props} />);

      await user.click(automaticOption());

      const accept = screen.getByRole("button", { name: "Confirm" });
      await user.click(accept);

      expect(props.onAccept).toHaveBeenCalledWith({
        configureBoot: true,
        bootDevice: undefined
      });
    });
  });

  describe("if the 'Select a disk' option is selected", () => {
    beforeEach(() => {
      props.configureBoot = false;
      props.bootDevice = undefined;
    });

    it("calls onAccept with the selected options on accept", async () => {
      const { user } = plainRender(<BootSelectionDialog {...props} />);

      await user.click(selectDiskOption());
      const selector = diskSelector();
      const sdbOption = within(selector).getByRole("option", { name: /sdb/ });
      await user.selectOptions(selector, sdbOption);

      const accept = screen.getByRole("button", { name: "Confirm" });
      await user.click(accept);

      expect(props.onAccept).toHaveBeenCalledWith({
        configureBoot: true,
        bootDevice: sdb
      });
    });
  });

  describe("if the 'Do not configure' option is selected", () => {
    beforeEach(() => {
      props.configureBoot = true;
      props.bootDevice = undefined;
    });

    it("calls onAccept with the selected options on accept", async () => {
      const { user } = plainRender(<BootSelectionDialog {...props} />);

      await user.click(notConfigureOption());

      const accept = screen.getByRole("button", { name: "Confirm" });
      await user.click(accept);

      expect(props.onAccept).toHaveBeenCalledWith({
        configureBoot: false,
        bootDevice: undefined
      });
    });
  });
});
