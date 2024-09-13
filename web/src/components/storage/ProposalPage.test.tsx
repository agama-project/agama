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

/*
 * NOTE: this test is not useful. The ProposalPage loads several queries but,
 * perhaps, each nested component should be responsible for loading the
 * information they need.
 */
import React from "react";
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { ProposalPage } from "~/components/storage";
import {
  ProposalResult,
  ProposalTarget,
  StorageDevice,
  Volume,
  VolumeTarget,
} from "~/types/storage";

jest.mock("~/queries/issues", () => ({
  ...jest.requireActual("~/queries/issues"),
  useIssuesChanges: jest.fn(),
  useIssues: () => [],
}));

jest.mock("./ProposalSettingsSection", () => () => <div>proposal settings</div>);
jest.mock("./ProposalActionsSummary", () => () => <div>actions section</div>);
jest.mock("./ProposalResultSection", () => () => <div>result section</div>);
jest.mock("./ProposalTransactionalInfo", () => () => <div>trasactional info</div>);

const vda: StorageDevice = {
  sid: 59,
  type: "disk",
  isDrive: true,
  description: "",
  vendor: "Micron",
  model: "Micron 1100 SATA",
  driver: ["ahci", "mmcblk"],
  bus: "IDE",
  transport: "usb",
  dellBOSS: false,
  sdCard: true,
  active: true,
  name: "/dev/vda",
  size: 1e12,
  systems: ["Windows 11", "openSUSE Leap 15.2"],
  udevIds: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"],
  udevPaths: ["pci-0000:00-12", "pci-0000:00-12-ata"],
};

const vdb: StorageDevice = {
  sid: 60,
  type: "disk",
  isDrive: true,
  description: "",
  vendor: "Seagate",
  model: "Unknown",
  driver: ["ahci", "mmcblk"],
  bus: "IDE",
  name: "/dev/vdb",
  size: 1e6,
};

/**
 * Returns a volume specification with the given path.
 */
const volume = (mountPath: string): Volume => {
  return {
    mountPath,
    target: VolumeTarget.DEFAULT,
    fsType: "Btrfs",
    minSize: 1024,
    maxSize: 1024,
    autoSize: false,
    snapshots: false,
    transactional: false,
    outline: {
      required: false,
      fsTypes: ["Btrfs"],
      supportAutoSize: false,
      snapshotsConfigurable: false,
      snapshotsAffectSizes: false,
      sizeRelevantVolumes: [],
      adjustByRam: false,
      productDefined: false,
    },
  };
};

const mockProposalResult: ProposalResult = {
  settings: {
    target: ProposalTarget.DISK,
    targetPVDevices: [],
    configureBoot: false,
    bootDevice: "",
    defaultBootDevice: "",
    encryptionPassword: "",
    encryptionMethod: "",
    spacePolicy: "",
    spaceActions: [],
    volumes: [],
    installationDevices: [],
  },
  actions: [],
};

jest.mock("~/queries/storage", () => ({
  ...jest.requireActual("~/queries/storage"),
  useDevices: () => [vda, vdb],
  useAvailableDevices: () => [vda, vdb],
  useVolumeDevices: () => [vda, vdb],
  useVolumeTemplates: () => [volume("/")],
  useProductParams: () => ({
    encryptionMethods: [],
    mountPoints: ["/", "swap"],
  }),
  useProposalResult: () => mockProposalResult,
  useDeprecated: () => false,
  useDeprecatedChanges: jest.fn(),
  useProposalMutation: jest.fn(),
}));

it("renders the device, settings and result sections", () => {
  plainRender(<ProposalPage />);
  screen.findByText("Device");
});
