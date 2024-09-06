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
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import BootConfigField, { BootConfigFieldProps } from "~/components/storage/BootConfigField";
import { StorageDevice } from "~/types/storage";

const sda: StorageDevice = {
  sid: 59,
  description: "A fake disk for testing",
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
  shrinking: { unsupported: ["Resizing is not supported"] },
  systems: [],
  udevIds: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"],
  udevPaths: ["pci-0000:00-12", "pci-0000:00-12-ata"],
};

const props: BootConfigFieldProps = {
  configureBoot: false,
  bootDevice: undefined,
  defaultBootDevice: undefined,
  availableDevices: [sda],
  isLoading: false,
};

describe.skip("BootConfigField", () => {
  describe("when installation is set for not configuring boot", () => {
    it("renders a text warning about it", () => {
      plainRender(<BootConfigField {...props} />);
      screen.getByText(/will not configure partitions/);
    });
  });

  describe("when installation is set for automatically configuring boot", () => {
    it("renders a text reporting about it", () => {
      plainRender(<BootConfigField {...props} configureBoot />);
      screen.getByText(/configure partitions for booting at the installation disk/);
    });
  });

  describe("when installation is set for configuring boot at specific device", () => {
    it("renders a text reporting about it", () => {
      plainRender(<BootConfigField {...props} configureBoot bootDevice={sda} />);
      screen.getByText(/partitions for booting at \/dev\/sda/);
    });
  });
});
