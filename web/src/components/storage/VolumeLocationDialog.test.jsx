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
import VolumeLocationDialog from "~/components/storage/VolumeLocationDialog";

/**
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 * @typedef {import ("~/client/storage").Volume} Volume
 * @typedef {import ("~/components/storage/VolumeLocationDialog").VolumeLocationDialogProps} VolumeLocationDialogProps
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

/** @type {StorageDevice} */
const sdc = {
  sid: 63,
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
  name: "/dev/sdc",
  size: 2048,
  recoverableSize: 0,
  systems : [],
  udevIds: [],
  udevPaths: ["pci-0000:00-19"]
};

/** @type {Volume} */
const volume = {
  mountPath: "/",
  target: "DEFAULT",
  fsType: "Btrfs",
  minSize: 1024,
  maxSize: 2048,
  autoSize: false,
  snapshots: false,
  transactional: false,
  outline: {
    required: true,
    fsTypes: ["Btrfs", "Ext4"],
    supportAutoSize: true,
    snapshotsConfigurable: true,
    snapshotsAffectSizes: true,
    sizeRelevantVolumes: [],
    adjustByRam: false
  }
};

/** @type {VolumeLocationDialogProps} */
let props;

describe("VolumeLocationDialog", () => {
  beforeEach(() => {
    props = {
      isOpen: true,
      volume,
      devices: [sda, sdb, sdc],
      target: "DISK",
      targetDevice: sda,
      onCancel: jest.fn(),
      onAccept: jest.fn()
    };
  });

  const automaticOption = () => screen.queryByRole("radio", { name: "Automatic" });
  const selectDiskOption = () => screen.queryByRole("radio", { name: "Select a disk" });
  const diskSelector = () => screen.queryByRole("combobox", { name: /choose a disk/i });
  const lvmSelector = () => screen.queryByRole("checkbox", { name: /dedicated lvm/i });

  it("offers an option to use the installation disk", () => {
    plainRender(<VolumeLocationDialog {...props} />);
    expect(automaticOption()).toBeInTheDocument();
  });

  it("offers an option to selected a disk", () => {
    plainRender(<VolumeLocationDialog {...props} />);
    expect(selectDiskOption()).toBeInTheDocument();
    expect(diskSelector()).toBeInTheDocument();
    expect(lvmSelector()).toBeInTheDocument();
  });

  describe("if the current value is set to use the installation disk", () => {
    beforeEach(() => {
      props.volume.target = "DEFAULT";
      props.targetDevice = sda;
    });

    it("selects 'Automatic' option by default", () => {
      plainRender(<VolumeLocationDialog {...props} />);
      expect(automaticOption()).toBeChecked();
      expect(selectDiskOption()).not.toBeChecked();
      expect(diskSelector()).toBeDisabled();
      expect(lvmSelector()).toBeDisabled();
    });
  });

  describe("if the current value is set to use a selected disk", () => {
    beforeEach(() => {
      props.volume.target = "NEW_PARTITION";
      props.targetDevice = sda;
    });

    it("selects 'Select a disk' option by default", () => {
      plainRender(<VolumeLocationDialog {...props} />);
      expect(automaticOption()).not.toBeChecked();
      expect(selectDiskOption()).toBeChecked();
      expect(diskSelector()).toBeEnabled();
      expect(lvmSelector()).toBeEnabled();
      expect(lvmSelector()).not.toBeChecked();
    });
  });

  describe("if the current value is set to use a selected disk for a dedicated LVM", () => {
    beforeEach(() => {
      props.volume.target = "NEW_VG";
      props.targetDevice = sda;
    });

    it("selects 'Select a disk' option and check LVM by default", () => {
      plainRender(<VolumeLocationDialog {...props} />);
      expect(automaticOption()).not.toBeChecked();
      expect(selectDiskOption()).toBeChecked();
      expect(diskSelector()).toBeEnabled();
      expect(lvmSelector()).toBeEnabled();
      expect(lvmSelector()).toBeChecked();
    });
  });

  it("does not call onAccept on cancel", async () => {
    const { user } = plainRender(<VolumeLocationDialog {...props} />);
    const cancel = screen.getByRole("button", { name: "Cancel" });

    await user.click(cancel);

    expect(props.onAccept).not.toHaveBeenCalled();
  });

  describe("if the 'Automatic' option is selected", () => {
    beforeEach(() => {
      props.volume.target = "NEW_PARTITION";
      props.volume.targetDevice = sda;
    });

    it("calls onAccept with the selected options on accept", async () => {
      const { user } = plainRender(<VolumeLocationDialog {...props} />);

      await user.click(automaticOption());

      const accept = screen.getByRole("button", { name: "Confirm" });
      await user.click(accept);

      expect(props.onAccept).toHaveBeenCalledWith(expect.objectContaining(
        { target: "DEFAULT", targetDevice: undefined }
      ));
    });
  });

  describe("if the 'Select a disk' option is selected", () => {
    beforeEach(() => {
      props.volume.target = "DEFAULT";
      props.volume.targetDevice = undefined;
    });

    it("calls onAccept with the selected options on accept", async () => {
      const { user } = plainRender(<VolumeLocationDialog {...props} />);

      await user.click(selectDiskOption());
      const selector = diskSelector();
      const sdbOption = within(selector).getByRole("option", { name: /sdb/ });
      await user.selectOptions(selector, sdbOption);

      const accept = screen.getByRole("button", { name: "Confirm" });
      await user.click(accept);

      expect(props.onAccept).toHaveBeenCalledWith(expect.objectContaining(
        { target: "NEW_PARTITION", targetDevice: sdb }
      ));
    });

    describe("and dedicated LVM is checked", () => {
      it("calls onAccept with the selected options on accept", async () => {
        const { user } = plainRender(<VolumeLocationDialog {...props} />);

        await user.click(selectDiskOption());
        const selector = diskSelector();
        const sdbOption = within(selector).getByRole("option", { name: /sdb/ });
        await user.selectOptions(selector, sdbOption);
        await user.click(lvmSelector());

        const accept = screen.getByRole("button", { name: "Confirm" });
        await user.click(accept);

        expect(props.onAccept).toHaveBeenCalledWith(expect.objectContaining(
          { target: "NEW_VG", targetDevice: sdb }
        ));
      });
    });
  });
});
