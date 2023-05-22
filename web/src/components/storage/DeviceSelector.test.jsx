/*
 * Copyright (c) [2022-2023] SUSE LLC
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

// cspell:ignore dasda ddgdcbibhd

import React from "react";
import { screen, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { DeviceSelector } from "~/components/storage";

let props;
const onSelectFn = jest.fn();

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
  systems : ["Windows 11", "openSUSE Leap 15.2"],
  udevIds: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"],
  udevPaths: ["pci-0000:00-12", "pci-0000:00-12-ata"],
  partitionTable: { type: "gpt", partitions: ["/dev/vda1", "/dev/vda2"] }
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
  systems : [],
  udevIds: [],
  udevPaths: []
};

const raid = {
  sid: "63",
  type: "raid",
  devices: ["/dev/sda", "/dev/sdb"],
  vendor: "Dell",
  model: "Dell BOSS-N1 Modular",
  driver: [],
  bus: "",
  busId: "",
  transport: "",
  dellBOSS: true,
  sdCard: false,
  active: true,
  name: "/dev/mapper/isw_ddgdcbibhd_244",
  size: 2048,
  systems : [],
  udevIds: [],
  udevPaths: []
};

const multipath = {
  sid: "64",
  type: "multipath",
  wires: ["/dev/sdc", "/dev/sdd"],
  vendor: "",
  model: "",
  driver: [],
  bus: "",
  busId: "",
  transport: "",
  dellBOSS: false,
  sdCard: false,
  active: true,
  name: "/dev/mapper/36005076305ffc73a00000000000013b4",
  size: 2048,
  systems : [],
  udevIds: [],
  udevPaths: []
};

const dasd = {
  sid: "65",
  type: "dasd",
  vendor: "IBM",
  model: "IBM",
  driver: [],
  bus: "",
  busId: "0.0.0150",
  transport: "",
  dellBOSS: false,
  sdCard: false,
  active: true,
  name: "/dev/dasda",
  size: 2048,
  systems : [],
  udevIds: [],
  udevPaths: []
};

describe("DeviceSelector", () => {
  describe("when no devices are given", () => {
    it("renders an empty listbox", () => {
      plainRender(<DeviceSelector />);

      const listbox = screen.queryByRole("listbox");

      expect(listbox).toBeEmptyDOMElement();
    });
  });

  describe("when devices are given", () => {
    beforeEach(() => {
      props = { devices: [vda, md0], selected: vda, onSelect: onSelectFn };
    });

    it("renders a listbox with an option per device", () => {
      plainRender(<DeviceSelector {...props} />);

      const listbox = screen.queryByRole("listbox");

      within(listbox).getByRole("option", { name: /vda/ });
      within(listbox).getByRole("option", { name: /md0/ });
    });

    it("renders as selected the option matching with the selected device", () => {
      plainRender(<DeviceSelector {...props} />);

      const selectedOptions = screen.queryByRole("option", { selected: true });
      const vdaOption = screen.getByRole("option", { name: /vda/ });
      expect(selectedOptions).toEqual(vdaOption);
    });

    it("updates the selection when the user clicks an option", async () => {
      const { user } = plainRender(<DeviceSelector {...props} />);

      const vdaOption = screen.getByRole("option", { name: /vda/ });
      const md0Option = screen.getByRole("option", { name: /md0/ });

      expect(vdaOption).toHaveAttribute("aria-selected");
      expect(md0Option).not.toHaveAttribute("aria-selected");

      await user.click(md0Option);

      expect(vdaOption).not.toHaveAttribute("aria-selected");
      expect(md0Option).toHaveAttribute("aria-selected");
    });

    it("triggers the onSelect callback when the selection change", async () => {
      const { user } = plainRender(<DeviceSelector {...props} />);

      const vdaOption = screen.getByRole("option", { name: /vda/ });
      const md0Option = screen.getByRole("option", { name: /md0/ });

      // Clicking on an already selected option must do nothing
      await user.click(vdaOption);
      expect(onSelectFn).not.toHaveBeenCalled();

      // Clicking multiple times in a not selected option must trigger change
      // only once
      await user.click(md0Option);
      await user.click(md0Option);

      expect(onSelectFn).toHaveBeenCalledTimes(1);
      expect(onSelectFn).toHaveBeenCalledWith(md0);
    });
  });

  describe("DeviceSelector options content", () => {
    it("renders the device size", () => {
      plainRender(<DeviceSelector devices={[vda]} />);
      screen.getByText("1 KiB");
    });

    it("renders the device name", () => {
      plainRender(<DeviceSelector devices={[vda]} />);
      screen.getByText("/dev/vda");
    });

    it("renders the device model", () => {
      plainRender(<DeviceSelector devices={[vda]} />);
      screen.getByText("Micron 1100 SATA");
    });

    describe("when device is a SDCard", () => {
      it("renders 'SD Card'", () => {
        const sdCard = { ...vda, sdCard: true };
        plainRender(<DeviceSelector devices={[sdCard]} />);
        screen.getByText("SD Card");
      });
    });

    describe("when content is given", () => {
      it("renders the partition table info", () => {
        plainRender(<DeviceSelector devices={[vda]} />);
        screen.getByText("GPT with 2 partitions");
      });

      it("renders systems info", () => {
        plainRender(<DeviceSelector devices={[vda]} />);
        screen.getByText("Windows 11");
        screen.getByText("openSUSE Leap 15.2");
      });
    });

    describe("when content is not given", () => {
      it("renders 'No content found'", () => {
        plainRender(<DeviceSelector devices={[multipath]} />);
        screen.getByText("No content found");
      });
    });

    describe("when device is software RAID", () => {
      it("renders its level", () => {
        plainRender(<DeviceSelector devices={[md0]} />);
        screen.getByText("Software RAID0");
      });

      it("renders its members", () => {
        plainRender(<DeviceSelector devices={[md0]} />);
        screen.getByText(/Members/);
        screen.getByText(/vdb/);
      });
    });

    describe("when device is RAID", () => {
      it("renders its devices", () => {
        plainRender(<DeviceSelector devices={[raid]} />);
        screen.getByText(/Devices/);
        screen.getByText(/sda/);
        screen.getByText(/sdb/);
      });
    });

    describe("when device is a multipath", () => {
      it("renders 'Multipath'", () => {
        plainRender(<DeviceSelector devices={[multipath]} />);
        screen.getByText("Multipath");
      });

      it("renders its wires", () => {
        plainRender(<DeviceSelector devices={[multipath]} />);
        screen.getByText(/Wires/);
        screen.getByText(/sdc/);
        screen.getByText(/sdd/);
      });
    });

    describe("when device is DASD", () => {
      it("renders its bus id", () => {
        plainRender(<DeviceSelector devices={[dasd]} />);
        screen.getByText("DASD 0.0.0150");
      });
    });
  });
});
