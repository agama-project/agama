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
import { ProposalDeviceSection } from "~/components/storage";

const sda = {
  sid: "59",
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
  sid: "62",
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

const vda = {
  sid: "59",
  type: "disk",
  vendor: "Micron",
  model: "Micron 1100 SATA",
  driver: ["ahci", "mmcblk"],
  bus: "IDE",
  transport: "usb",
  dellBOSS: false,
  sdCard: true,
  active: true,
  name: "/dev/vda",
  size: 1024,
  systems: ["Windows", "openSUSE Leap 15.2"],
  udevIds: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"],
  udevPaths: ["pci-0000:00-12", "pci-0000:00-12-ata"],
  partitionTable: { type: "gpt", partitions: [] }
};

const md0 = {
  sid: "62",
  type: "md",
  level: "raid0",
  uuid: "12345:abcde",
  members: ["/dev/vdb"],
  active: true,
  name: "/dev/md0",
  size: 2048,
  systems: [],
  udevIds: [],
  udevPaths: []
};

const md1 = {
  sid: "63",
  type: "md",
  level: "raid0",
  uuid: "12345:abcde",
  members: ["/dev/vdc"],
  active: true,
  name: "/dev/md1",
  size: 4096,
  systems: [],
  udevIds: [],
  udevPaths: []
};

const props = {
  settings: {
    target: "disk",
    targetDevice: "/dev/sda",
  },
  availableDevices: [sda, sdb],
  isLoading: false,
  onChange: jest.fn()
};

describe("ProposalDeviceSection", () => {
  describe("Installation device field", () => {
    describe("when set as loading", () => {
      beforeEach(() => {
        props.isLoading = true;
      });

      describe("and selected device is not defined yet", () => {
        beforeEach(() => {
          props.settings = { targetDevice: undefined };
        });

        it("renders a loading hint", () => {
          plainRender(<ProposalDeviceSection {...props} />);
          screen.getByText("Waiting for information about selected device");
        });
      });
    });
    describe("when installation device is not selected yet", () => {
      beforeEach(() => {
        props.settings = { targetDevice: "" };
      });

      it("uses a 'No device selected yet' text for the selection button", async () => {
        const { user } = plainRender(<ProposalDeviceSection {...props} />);
        const button = screen.getByRole("button", { name: "No device selected yet" });

        await user.click(button);

        screen.getByRole("dialog", { name: "Installation device" });
      });
    });

    describe("when installation device is selected", () => {
      beforeEach(() => {
        props.settings = { targetDevice: "/dev/sda" };
      });

      it("uses its name as part of the text for the selection button", async () => {
        const { user } = plainRender(<ProposalDeviceSection {...props} />);
        const button = screen.getByRole("button", { name: /\/dev\/sda/ });

        await user.click(button);

        screen.getByRole("dialog", { name: "Installation device" });
      });
    });

    it("allows changing the selected device", async () => {
      const { user } = plainRender(<ProposalDeviceSection {...props} />);
      const button = screen.getByRole("button", { name: "/dev/sda, 1 KiB" });

      await user.click(button);

      const selector = await screen.findByRole("dialog", { name: "Installation device" });
      const sdbOption = within(selector).getByRole("radio", { name: /sdb/ });
      const accept = within(selector).getByRole("button", { name: "Accept" });

      await user.click(sdbOption);
      await user.click(accept);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(props.onChange).toHaveBeenCalledWith({ targetDevice: sdb.name });
    });

    it("allows canceling a device selection", async () => {
      const { user } = plainRender(<ProposalDeviceSection {...props} />);
      const button = screen.getByRole("button", { name: "/dev/sda, 1 KiB" });

      await user.click(button);

      const selector = await screen.findByRole("dialog", { name: "Installation device" });
      const sdbOption = within(selector).getByRole("radio", { name: /sdb/ });
      const cancel = within(selector).getByRole("button", { name: "Cancel" });

      await user.click(sdbOption);
      await user.click(cancel);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(props.onChange).not.toHaveBeenCalled();
    });

    it("does not trigger the onChange callback when selection actually did not change", async () => {
      const { user } = plainRender(<ProposalDeviceSection {...props} />);
      const button = screen.getByRole("button", { name: "/dev/sda, 1 KiB" });

      await user.click(button);

      const selector = await screen.findByRole("dialog", { name: "Installation device" });
      const sdaOption = within(selector).getByRole("radio", { name: /sda/ });
      const sdbOption = within(selector).getByRole("radio", { name: /sdb/ });
      const accept = within(selector).getByRole("button", { name: "Accept" });

      // User selects a different device
      await user.click(sdbOption);
      // but then goes back to the selected device
      await user.click(sdaOption);
      // and clicks on Accept button
      await user.click(accept);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      // There is no reason for triggering the onChange callback
      expect(props.onChange).not.toHaveBeenCalled();
    });
  });
});
