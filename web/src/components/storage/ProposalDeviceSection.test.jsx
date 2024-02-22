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
    bootDevice: "/dev/sda",
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
          props.settings = { bootDevice: undefined };
        });

        it("renders a loading hint", () => {
          plainRender(<ProposalDeviceSection {...props} />);
          screen.getByText("Loading selected device");
        });
      });
    });
    describe("when installation device is not selected yet", () => {
      beforeEach(() => {
        props.settings = { bootDevice: "" };
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
        props.settings = { bootDevice: "/dev/sda" };
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
      expect(props.onChange).toHaveBeenCalledWith({ bootDevice: sdb.name });
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

  describe("LVM field", () => {
    describe("if LVM setting is not set yet", () => {
      beforeEach(() => {
        props.settings = {};
      });

      it("does not render the LVM switch", () => {
        plainRender(<ProposalDeviceSection {...props} />);

        expect(screen.queryByLabelText(/Use logical volume/)).toBeNull();
      });
    });

    describe("if LVM setting is set", () => {
      beforeEach(() => {
        props.settings = { lvm: false };
      });

      it("renders the LVM switch", () => {
        plainRender(<ProposalDeviceSection {...props} />);

        screen.getByRole("checkbox", { name: /Use logical volume/ });
      });
    });

    describe("if LVM is set to true", () => {
      beforeEach(() => {
        props.availableDevices = [vda, md0, md1];
        props.settings = { bootDevice: "/dev/vda", lvm: true, systemVGDevices: [] };
        props.onChange = jest.fn();
      });

      it("renders the LVM switch as selected", () => {
        plainRender(<ProposalDeviceSection {...props} />);

        const checkbox = screen.getByRole("checkbox", { name: /Use logical volume/ });
        expect(checkbox).toBeChecked();
      });

      it("renders a button for changing the LVM settings", () => {
        plainRender(<ProposalDeviceSection {...props} />);

        screen.getByRole("button", { name: /LVM settings/ });
      });

      it("changes the selection on click", async () => {
        const { user } = plainRender(<ProposalDeviceSection {...props} />);

        const checkbox = screen.getByRole("checkbox", { name: /Use logical volume/ });
        await user.click(checkbox);

        expect(checkbox).not.toBeChecked();
        expect(props.onChange).toHaveBeenCalled();
      });

      describe("and user clicks on LVM settings", () => {
        it("opens the LVM settings dialog", async () => {
          const { user } = plainRender(<ProposalDeviceSection {...props} />);
          const settingsButton = screen.getByRole("button", { name: /LVM settings/ });

          await user.click(settingsButton);

          const popup = await screen.findByRole("dialog");
          within(popup).getByText("System Volume Group");
        });

        it("allows selecting either installation device or custom devices", async () => {
          const { user } = plainRender(<ProposalDeviceSection {...props} />);
          const settingsButton = screen.getByRole("button", { name: /LVM settings/ });

          await user.click(settingsButton);

          const popup = await screen.findByRole("dialog");
          screen.getByText("System Volume Group");

          within(popup).getByRole("button", { name: "Installation device" });
          within(popup).getByRole("button", { name: "Custom devices" });
        });

        it("allows to set the installation device as system volume group", async () => {
          const { user } = plainRender(<ProposalDeviceSection {...props} />);
          const settingsButton = screen.getByRole("button", { name: /LVM settings/ });

          await user.click(settingsButton);

          const popup = await screen.findByRole("dialog");
          screen.getByText("System Volume Group");

          const bootDeviceButton = within(popup).getByRole("button", { name: "Installation device" });
          const customDevicesButton = within(popup).getByRole("button", { name: "Custom devices" });
          const acceptButton = within(popup).getByRole("button", { name: "Accept" });

          await user.click(customDevicesButton);
          await user.click(bootDeviceButton);
          await user.click(acceptButton);

          expect(props.onChange).toHaveBeenCalledWith(
            expect.objectContaining({ systemVGDevices: [] })
          );
        });

        it("allows customize the system volume group", async () => {
          const { user } = plainRender(<ProposalDeviceSection {...props} />);
          const settingsButton = screen.getByRole("button", { name: /LVM settings/ });

          await user.click(settingsButton);

          const popup = await screen.findByRole("dialog");
          screen.getByText("System Volume Group");

          const customDevicesButton = within(popup).getByRole("button", { name: "Custom devices" });
          const acceptButton = within(popup).getByRole("button", { name: "Accept" });

          await user.click(customDevicesButton);

          const vdaOption = within(popup).getByRole("row", { name: /vda/ });
          const md0Option = within(popup).getByRole("row", { name: /md0/ });
          const md1Option = within(popup).getByRole("row", { name: /md1/ });

          // unselect the boot devices
          await user.click(vdaOption);

          await user.click(md0Option);
          await user.click(md1Option);

          await user.click(acceptButton);

          expect(props.onChange).toHaveBeenCalledWith(
            expect.objectContaining({ systemVGDevices: ["/dev/md0", "/dev/md1"] })
          );
        });
      });
    });

    describe("if LVM is set to false", () => {
      beforeEach(() => {
        props.settings = { lvm: false };
        props.onChange = jest.fn();
      });

      it("renders the LVM switch as not selected", () => {
        plainRender(<ProposalDeviceSection {...props} />);

        const checkbox = screen.getByRole("checkbox", { name: /Use logical volume/ });
        expect(checkbox).not.toBeChecked();
      });

      it("does not render a button for changing the LVM settings", () => {
        plainRender(<ProposalDeviceSection {...props} />);

        const button = screen.queryByRole("button", { name: /LVM settings/ });
        expect(button).toBeNull();
      });

      it("changes the selection on click", async () => {
        const { user } = plainRender(<ProposalDeviceSection {...props} />);

        const checkbox = screen.getByRole("checkbox", { name: /Use logical volume/ });
        await user.click(checkbox);

        expect(checkbox).toBeChecked();
        expect(props.onChange).toHaveBeenCalled();
      });
    });
  });
});
