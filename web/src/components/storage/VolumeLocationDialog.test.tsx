/*
 * Copyright (c) [2024] SUSE LLC
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
import VolumeLocationDialog, {
  VolumeLocationDialogProps,
} from "~/components/storage/VolumeLocationDialog";
import { StorageDevice, Volume, VolumeTarget } from "~/types/storage";

const sda: StorageDevice = {
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
  shrinking: { unsupported: ["Resizing is not supported"] },
  systems: [],
  udevIds: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"],
  udevPaths: ["pci-0000:00-12", "pci-0000:00-12-ata"],
};

const sda1: StorageDevice = {
  sid: 69,
  name: "/dev/sda1",
  description: "",
  isDrive: false,
  type: "partition",
  size: 256,
  filesystem: {
    sid: 169,
    type: "Swap",
  },
};

const sda2: StorageDevice = {
  sid: 79,
  name: "/dev/sda2",
  description: "",
  isDrive: false,
  type: "partition",
  size: 512,
  filesystem: {
    sid: 179,
    type: "Ext4",
  },
};

sda.partitionTable = {
  type: "gpt",
  partitions: [sda1, sda2],
  unpartitionedSize: 0,
  unusedSlots: [],
};

const sdb: StorageDevice = {
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
  shrinking: { unsupported: ["Resizing is not supported"] },
  systems: [],
  udevIds: [],
  udevPaths: ["pci-0000:00-19"],
};

const volume: Volume = {
  mountPath: "/",
  target: VolumeTarget.DEFAULT,
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
    adjustByRam: false,
    productDefined: true,
  },
};

let props: VolumeLocationDialogProps;

describe("VolumeLocationDialog", () => {
  beforeEach(() => {
    props = {
      isOpen: true,
      volume,
      volumes: [],
      volumeDevices: [sda, sdb],
      targetDevices: [sda],
      onCancel: jest.fn(),
      onAccept: jest.fn(),
    };
  });

  it("offers an option to create a new partition", () => {
    plainRender(<VolumeLocationDialog {...props} />);
    screen.getByRole("radio", { name: "Create a new partition" });
  });

  it("offers an option to create a dedicated VG", () => {
    plainRender(<VolumeLocationDialog {...props} />);
    screen.getByRole("radio", { name: /Create a dedicated LVM/ });
  });

  it("offers an option to format the device", () => {
    plainRender(<VolumeLocationDialog {...props} />);
    screen.getByRole("radio", { name: "Format the device" });
  });

  it("offers an option to mount the file system", () => {
    plainRender(<VolumeLocationDialog {...props} />);
    screen.getByRole("radio", { name: "Mount the file system" });
  });

  describe("if the selected device cannot be partitioned", () => {
    beforeEach(async () => {
      const { user } = plainRender(<VolumeLocationDialog {...props} />);
      const sda1Row = screen.getByRole("row", { name: /sda1/ });
      const sda1Radio = within(sda1Row).getByRole("radio");
      await user.click(sda1Radio);
    });

    it("disables the option for creating a new partition", () => {
      const option = screen.getByRole("radio", { name: "Create a new partition" });
      expect(option).toBeDisabled();
    });

    it("disables the option for creating a dedicated VG", () => {
      const option = screen.getByRole("radio", { name: /Create a dedicated LVM/ });
      expect(option).toBeDisabled();
    });
  });

  describe("if the selected device has not a compatible file system", () => {
    beforeEach(async () => {
      const { user } = plainRender(<VolumeLocationDialog {...props} />);
      const sda1Row = screen.getByRole("row", { name: /sda1/ });
      const sda1Radio = within(sda1Row).getByRole("radio");
      await user.click(sda1Radio);
    });

    it("disables the option for mounting the file system", () => {
      const option = screen.getByRole("radio", { name: "Mount the file system" });
      expect(option).toBeDisabled();
    });
  });

  describe("if the selected device has a compatible file system", () => {
    beforeEach(async () => {
      const { user } = plainRender(<VolumeLocationDialog {...props} />);
      const sda2Row = screen.getByRole("row", { name: /sda2/ });
      const sda2Radio = within(sda2Row).getByRole("radio");
      await user.click(sda2Radio);
    });

    it("enables the option for mounting the file system", () => {
      const option = screen.getByRole("radio", { name: "Mount the file system" });
      expect(option).toBeEnabled();
    });
  });

  it("calls onAccept with the selected options on accept", async () => {
    const { user } = plainRender(<VolumeLocationDialog {...props} />);

    const sdbRow = screen.getByRole("row", { name: /sdb/ });
    const sdbRadio = within(sdbRow).getByRole("radio");
    await user.click(sdbRadio);

    const formatRadio = screen.getByRole("radio", { name: /format the device/i });
    await user.click(formatRadio);

    const accept = screen.getByRole("button", { name: "Confirm" });
    await user.click(accept);

    expect(props.onAccept).toHaveBeenCalledWith(
      expect.objectContaining({ target: VolumeTarget.DEVICE, targetDevice: sdb }),
    );
  });

  it("does not call onAccept on cancel", async () => {
    const { user } = plainRender(<VolumeLocationDialog {...props} />);
    const cancel = screen.getByRole("button", { name: "Cancel" });

    await user.click(cancel);

    expect(props.onAccept).not.toHaveBeenCalled();
  });
});
