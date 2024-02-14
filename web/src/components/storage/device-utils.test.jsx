/*
 * Copyright (c) [2022-2024] SUSE LLC
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

import React, { useState } from "react";
import { screen, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { DeviceList, DeviceSelector } from "~/components/storage/device-utils";

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

const availableDevices = [
  vda,
  md0,
  raid,
  multipath,
  dasd
];

const renderOptions = (Component) => {
  return () => describe("DeviceContent", () => {
    it("renders the device size", () => {
      plainRender(<Component devices={[vda]} />);
      screen.getByText("1 KiB");
    });

    it("renders the device name", () => {
      plainRender(<Component devices={[vda]} />);
      screen.getByText("/dev/vda");
    });

    it("renders the device model", () => {
      plainRender(<Component devices={[vda]} />);
      screen.getByText("Micron 1100 SATA");
    });

    describe("when device is a SDCard", () => {
      it("renders 'SD Card'", () => {
        const sdCard = { ...vda, sdCard: true };
        plainRender(<Component devices={[sdCard]} />);
        screen.getByText("SD Card");
      });
    });

    describe("when content is given", () => {
      it("renders the partition table info", () => {
        plainRender(<Component devices={[vda]} />);
        screen.getByText("GPT with 2 partitions");
      });

      it("renders systems info", () => {
        plainRender(<Component devices={[vda]} />);
        screen.getByText("Windows 11");
        screen.getByText("openSUSE Leap 15.2");
      });
    });

    describe("when content is not given", () => {
      it("renders 'No content found'", () => {
        plainRender(<Component devices={[multipath]} />);
        screen.getByText("No content found");
      });
    });

    describe("when device is software RAID", () => {
      it("renders its level", () => {
        plainRender(<Component devices={[md0]} />);
        screen.getByText("Software RAID0");
      });

      it("renders its members", () => {
        plainRender(<Component devices={[md0]} />);
        screen.getByText(/Members/);
        screen.getByText(/vdb/);
      });
    });

    describe("when device is RAID", () => {
      it("renders its devices", () => {
        plainRender(<Component devices={[raid]} />);
        screen.getByText(/Devices/);
        screen.getByText(/sda/);
        screen.getByText(/sdb/);
      });
    });

    describe("when device is a multipath", () => {
      it("renders 'Multipath'", () => {
        plainRender(<Component devices={[multipath]} />);
        screen.getByText("Multipath");
      });

      it("renders its wires", () => {
        plainRender(<Component devices={[multipath]} />);
        screen.getByText(/Wires/);
        screen.getByText(/sdc/);
        screen.getByText(/sdd/);
      });
    });

    describe("when device is DASD", () => {
      it("renders its bus id", () => {
        plainRender(<Component devices={[dasd]} />);
        screen.getByText("DASD 0.0.0150");
      });
    });
  });
};

describe("DeviceList", renderOptions(DeviceList));
describe("DeviceList", () => {
  describe("when no devices are given", () => {
    it("renders an empty list", () => {
      plainRender(<DeviceList devices={[]} />);

      const list = screen.queryByRole("list");
      expect(list).toBeEmptyDOMElement();
    });
  });

  describe("when devices are given", () => {
    it("renders a list with an option per device", () => {
      plainRender(<DeviceList devices={[vda, md0]} />);

      const list = screen.getByRole("list");

      within(list).getByRole("listitem", { name: /vda/ });
      within(list).getByRole("listitem", { name: /md0/ });
    });
  });
});

describe("DeviceSelector", renderOptions(DeviceSelector));
describe("DeviceSelector", () => {
  describe("when no devices are given", () => {
    it("renders an empty grid", () => {
      plainRender(<DeviceSelector devices={[]} />);

      const selector = screen.queryByRole("grid");
      expect(selector).toBeEmptyDOMElement();
    });
  });

  it("renders a grid with an option per device", () => {
    plainRender(<DeviceSelector devices={[vda, md0]} />);

    const selector = screen.getByRole("grid");
    within(selector).getByRole("row", { name: /vda/ });
    within(selector).getByRole("row", { name: /md0/ });
  });

  it("renders as selected options matching selected device(s)", () => {
    plainRender(
      <DeviceSelector
        devices={[vda, md0, raid, dasd]}
        selected={[vda, dasd]}
      />
    );

    const selectedOptions = screen.queryAllByRole("row", { selected: true });
    const vdaOption = screen.getByRole("row", { name: /vda/ });
    const dasdOption = screen.getByRole("row", { name: /dasda/ });
    expect(selectedOptions).toEqual([vdaOption, dasdOption]);
  });

  describe("when user clicks an option", () => {
    describe("and it only allows single selection", () => {
      const onChangeFn = jest.fn();

      const TestSingleDeviceSelection = () => {
        const [selected, setSelected] = useState(vda);

        onChangeFn.mockImplementation(device => setSelected(device));

        return (
          <DeviceSelector
            devices={[vda, md0]}
            selected={selected}
            onChange={onChangeFn}
          />
        );
      };

      it("notifies selected device if it has changed", async () => {
        const { user } = plainRender(<TestSingleDeviceSelection />);

        const vdaOption = screen.getByRole("row", { name: /vda/ });
        const md0Option = screen.getByRole("row", { name: /md0/ });

        // click on selected device to check nothing is notified
        await user.click(vdaOption);
        expect(onChangeFn).not.toHaveBeenCalled();

        await user.click(md0Option);
        expect(onChangeFn).toHaveBeenCalledWith(md0.sid);

        await user.click(vdaOption);
        expect(onChangeFn).toHaveBeenCalledWith(vda.sid);
      });
    });

    describe("and it allows multiple selection", () => {
      const onChangeFn = jest.fn();

      const TestMultipleDeviceSelection = () => {
        const [selected, setSelected] = useState(vda);

        onChangeFn.mockImplementation(selection => setSelected(
          availableDevices.filter(d => selection.includes(d.sid)))
        );

        return (
          <DeviceSelector
            isMultiple
            devices={[vda, md0, dasd]}
            selected={selected}
            onChange={onChangeFn}
          />
        );
      };

      it("notifies selected devices", async () => {
        const { user } = plainRender(<TestMultipleDeviceSelection />);

        const vdaOption = screen.getByRole("row", { name: /vda/ });
        const md0Option = screen.getByRole("row", { name: /md0/ });
        const dasdOption = screen.getByRole("row", { name: /dasda/ });

        await user.click(md0Option);
        expect(onChangeFn).toHaveBeenCalledWith([vda.sid, md0.sid]);

        await user.click(dasdOption);
        expect(onChangeFn).toHaveBeenCalledWith([vda.sid, md0.sid, dasd.sid]);

        // click on selected device to check it is notified as not selected
        await user.click(vdaOption);
        expect(onChangeFn).toHaveBeenCalledWith([md0.sid, dasd.sid]);
      });
    });
  });
});
