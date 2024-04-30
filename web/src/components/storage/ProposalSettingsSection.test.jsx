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

// @ts-check

import React from "react";
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { ProposalSettingsSection } from "~/components/storage";

/**
 * @typedef {import ("~/components/storage/ProposalSettingsSection").ProposalSettingsSectionProps} ProposalSettingsSectionProps
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 */

jest.mock("@patternfly/react-core", () => {
  const original = jest.requireActual("@patternfly/react-core");

  return {
    ...original,
    Skeleton: () => <div>PFSkeleton</div>
  };
});

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

/** @type {ProposalSettingsSectionProps} */
let props;

beforeEach(() => {
  props = {
    settings: {
      target: "DISK",
      targetDevice: "/dev/sda",
      targetPVDevices: [],
      configureBoot: false,
      bootDevice: "",
      defaultBootDevice: "",
      encryptionPassword: "",
      encryptionMethod: "",
      spacePolicy: "delete",
      spaceActions: [],
      volumes: [],
      installationDevices: [sda, sdb]
    },
    availableDevices: [],
    encryptionMethods: [],
    volumeTemplates: [],
    onChange: jest.fn()
  };
});

it("allows changing the selected device", async () => {
  const { user } = installerRender(<ProposalSettingsSection {...props} />);
  const button = screen.getByRole("button", { name: /installation device/i });

  await user.click(button);
  await screen.findByRole("dialog", { name: /Device for installing/ });
});

it("allows changing the encryption settings", async () => {
  const { user } = installerRender(<ProposalSettingsSection {...props} />);
  const button = screen.getByRole("button", { name: /Encryption/ });

  await user.click(button);
  await screen.findByRole("dialog", { name: /Encryption/ });
});

it("renders a section holding file systems related stuff", () => {
  installerRender(<ProposalSettingsSection {...props} />);
  screen.getByRole("button", { name: /Partitions and file systems/ });
});

it("allows changing the space policy settings", async () => {
  const { user } = installerRender(<ProposalSettingsSection {...props} />);
  const button = screen.getByRole("button", { name: /Find space/ });

  await user.click(button);
  await screen.findByRole("dialog", { name: /Find space/ });
});
