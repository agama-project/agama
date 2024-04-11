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

let props;

describe("ProposalDeviceSection", () => {
  beforeEach(() => {
    props = {
      settings: {
        target: "DISK",
        targetDevice: "/dev/sda",
      },
      availableDevices: [sda, sdb],
      isLoading: false,
      onChange: jest.fn()
    };
  });

  describe("Installation device field", () => {
    describe("when set as loading", () => {
      beforeEach(() => {
        props.isLoading = true;
      });

      describe("and selected device is not defined yet", () => {
        beforeEach(() => {
          props.settings.target = undefined;
        });

        it("renders a loading hint", () => {
          plainRender(<ProposalDeviceSection {...props} />);
          screen.getByText("Waiting for information about selected device");
        });
      });
    });

    describe("when the target is a disk", () => {
      beforeEach(() => {
        props.settings.target = "DISK";
      });

      describe("and installation device is not selected yet", () => {
        beforeEach(() => {
          props.settings.targetDevice = "";
        });

        it("uses a 'No device selected yet' text for the selection button", async () => {
          const { user } = plainRender(<ProposalDeviceSection {...props} />);
          const button = screen.getByRole("button", { name: "No device selected yet" });

          await user.click(button);

          screen.getByRole("dialog", { name: /Device for installing/i });
        });
      });

      describe("and an installation device is selected", () => {
        beforeEach(() => {
          props.settings.targetDevice = "/dev/sda";
        });

        it("uses its name as part of the text for the selection button", async () => {
          const { user } = plainRender(<ProposalDeviceSection {...props} />);
          const button = screen.getByRole("button", { name: /\/dev\/sda/ });

          await user.click(button);

          screen.getByRole("dialog", { name: /Device for installing/i });
        });
      });
    });

    describe("when the target is a new LVM volume group", () => {
      beforeEach(() => {
        props.settings.target = "NEW_LVM_VG";
      });

      describe("and the target devices are not selected yet", () => {
        beforeEach(() => {
          props.settings.targetPVDevices = [];
        });

        it("uses a 'No device selected yet' text for the selection button", async () => {
          const { user } = plainRender(<ProposalDeviceSection {...props} />);
          const button = screen.getByRole("button", { name: "No device selected yet" });

          await user.click(button);

          screen.getByRole("dialog", { name: /Device for installing/i });
        });
      });

      describe("and there is a selected device", () => {
        beforeEach(() => {
          props.settings.targetPVDevices = ["/dev/sda"];
        });

        it("uses its name as part of the text for the selection button", async () => {
          const { user } = plainRender(<ProposalDeviceSection {...props} />);
          const button = screen.getByRole("button", { name: /new LVM .* \/dev\/sda/ });

          await user.click(button);

          screen.getByRole("dialog", { name: /Device for installing/i });
        });
      });

      describe("and there are more than one selected device", () => {
        beforeEach(() => {
          props.settings.targetPVDevices = ["/dev/sda", "/dev/sdb"];
        });

        it("does not use the names as part of the text for the selection button", async () => {
          const { user } = plainRender(<ProposalDeviceSection {...props} />);
          const button = screen.getByRole("button", { name: "new LVM volume group" });

          await user.click(button);

          screen.getByRole("dialog", { name: /Device for installing/i });
        });
      });
    });

    it("allows changing the selected device", async () => {
      const { user } = plainRender(<ProposalDeviceSection {...props} />);
      const button = screen.getByRole("button", { name: "/dev/sda, 1 KiB" });

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
        targetDevice: sdb.name,
        targetPVDevices: []
      });
    });

    it("allows canceling a device selection", async () => {
      const { user } = plainRender(<ProposalDeviceSection {...props} />);
      const button = screen.getByRole("button", { name: "/dev/sda, 1 KiB" });

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
  });
});
