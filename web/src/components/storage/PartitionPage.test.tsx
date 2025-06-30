/*
 * Copyright (c) [2025] SUSE LLC
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
import { installerRender, mockParams } from "~/test-utils";
import PartitionPage from "./PartitionPage";
import { StorageDevice, model } from "~/types/storage";
import { apiModel, Volume } from "~/api/storage/types";
import { gib } from "./utils";

jest.mock("~/queries/issues", () => ({
  ...jest.requireActual("~/queries/issues"),
  useIssuesChanges: jest.fn(),
  useIssues: () => [],
}));

jest.mock("./ProposalResultSection", () => () => <div>result section</div>);
jest.mock("./ProposalTransactionalInfo", () => () => <div>transactional info</div>);

const mockGetPartition = jest.fn();

const sda1: StorageDevice = {
  sid: 69,
  name: "/dev/sda1",
  description: "Swap partition",
  isDrive: false,
  type: "partition",
  size: gib(2),
  shrinking: { unsupported: ["Resizing is not supported"] },
  start: 1,
};

const sda: StorageDevice = {
  sid: 59,
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
  partitionTable: {
    type: "gpt",
    partitions: [sda1],
    unpartitionedSize: 0,
    unusedSlots: [{ start: 3, size: gib(2) }],
  },
  udevIds: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"],
  udevPaths: ["pci-0000:00-12", "pci-0000:00-12-ata"],
  description: "",
};

const mockPartition: model.Partition = {
  isNew: false,
  isUsed: true,
  isReused: false,
  isUsedBySpacePolicy: false,
};

const mockDrive: model.Drive = {
  name: "/dev/sda",
  spacePolicy: "delete",
  partitions: [
    {
      mountPath: "swap",
      size: {
        min: gib(2),
        default: false, // false: user provided, true: calculated
      },
      filesystem: { default: false, type: "swap" },
      isNew: true,
      isUsed: false,
      isReused: false,
      isUsedBySpacePolicy: false,
    },
    {
      mountPath: "/home",
      size: {
        min: gib(16),
        default: true,
      },
      filesystem: { default: false, type: "xfs" },
      isNew: true,
      isUsed: false,
      isReused: false,
      isUsedBySpacePolicy: false,
    },
  ],
  list: "drives",
  listIndex: 1,
  isExplicitBoot: false,
  isUsed: true,
  isAddingPartitions: true,
  isReusingPartitions: true,
  isTargetDevice: false,
  isBoot: true,
  getMountPaths: jest.fn(),
  getVolumeGroups: jest.fn(),
  getPartition: mockGetPartition,
  getConfiguredExistingPartitions: () => [mockPartition],
};

const mockSolvedConfigModel: apiModel.Config = {
  drives: [mockDrive],
};

const mockHomeVolume: Volume = {
  mountPath: "/home",
  mountOptions: [],
  target: "default",
  fsType: "btrfs",
  minSize: 1024,
  maxSize: 1024,
  autoSize: false,
  snapshots: false,
  transactional: false,
  outline: {
    required: false,
    fsTypes: ["btrfs"],
    supportAutoSize: false,
    snapshotsConfigurable: false,
    snapshotsAffectSizes: false,
    sizeRelevantVolumes: [],
    adjustByRam: false,
  },
};

jest.mock("~/queries/storage", () => ({
  ...jest.requireActual("~/queries/storage"),
  useDevices: () => [sda],
  useVolume: () => mockHomeVolume,
}));

jest.mock("~/hooks/storage/model", () => ({
  ...jest.requireActual("~/hooks/storage/model"),
  useModel: () => ({
    drives: [mockDrive],
    getMountPaths: () => [],
  }),
}));

jest.mock("~/hooks/storage/product", () => ({
  ...jest.requireActual("~/hooks/storage/product"),
  useMissingMountPaths: () => ["/home", "swap"],
}));

jest.mock("~/queries/storage/config-model", () => ({
  ...jest.requireActual("~/queries/storage/config-model"),
  useConfigModel: () => ({ drives: [mockDrive] }),
  useSolvedConfigModel: () => mockSolvedConfigModel,
}));

beforeEach(() => {
  mockParams({ list: "drives", listIndex: "0" });
});

describe("PartitionPage", () => {
  it("renders a form for defining a partition", async () => {
    const { user } = installerRender(<PartitionPage />);
    screen.getByRole("form", { name: "Configure partition at /dev/sda" });
    const mountPoint = screen.getByRole("button", { name: "Mount point toggle" });
    const mountPointMode = screen.getByRole("button", { name: "Mount point mode" });
    const filesystem = screen.getByRole("button", { name: "File system" });
    const waitingSize = screen.getByRole("button", { name: "Size mode" });
    // File system and size fields disabled until valid mount point selected
    expect(filesystem).toBeDisabled();
    expect(screen.queryByRole("textbox", { name: "File system label" })).not.toBeInTheDocument();
    expect(waitingSize).toBeDisabled();

    await user.click(mountPoint);
    const mountPointOptions = screen.getByRole("listbox", { name: "Suggested mount points" });
    const homeMountPoint = within(mountPointOptions).getByRole("option", { name: "/home" });
    await user.click(homeMountPoint);
    const size = screen.getByRole("button", { name: "Size mode" });
    // Valid mount point selected, enable file system and size fields
    expect(filesystem).toBeEnabled();
    expect(screen.queryByRole("textbox", { name: "File system label" })).toBeInTheDocument();
    expect(size).toBeEnabled();
    // Display mount point options
    await user.click(mountPointMode);
    screen.getByRole("listbox", { name: "Mount point options" });
    // Display available file systems
    await user.click(filesystem);
    screen.getByRole("listbox", { name: "Available file systems" });
    // Display size modes
    await user.click(size);
    const sizeModes = screen.getByRole("listbox", { name: "Size modes" });
    // Display custom size
    const customSize = within(sizeModes).getByRole("option", { name: /Custom/ });
    await user.click(customSize);
    screen.getByRole("textbox", { name: "Size" });
    screen.getByRole("checkbox", { name: "Allow growing" });
  });

  it("allows reseting the chosen mount point", async () => {
    const { user } = installerRender(<PartitionPage />);
    // Note that the underline PF component gives the role combobox to the input
    const mountPoint = screen.getByRole("combobox", { name: "Mount point" });
    const filesystem = screen.getByRole("button", { name: "File system" });
    let size = screen.getByRole("button", { name: "Size mode" });
    expect(mountPoint).toHaveValue("");
    // File system and size fields disabled until valid mount point selected
    expect(filesystem).toBeDisabled();
    expect(size).toBeDisabled();
    const mountPointToggle = screen.getByRole("button", { name: "Mount point toggle" });
    await user.click(mountPointToggle);
    const mountPointOptions = screen.getByRole("listbox", { name: "Suggested mount points" });
    const homeMountPoint = within(mountPointOptions).getByRole("option", { name: "/home" });
    await user.click(homeMountPoint);
    expect(mountPoint).toHaveValue("/home");
    expect(filesystem).toBeEnabled();
    expect(screen.queryByRole("textbox", { name: "File system label" })).toBeInTheDocument();
    size = screen.getByRole("button", { name: "Size mode" });
    expect(size).toBeEnabled();
    const clearMountPointButton = screen.getByRole("button", {
      name: "Clear selected mount point",
    });
    await user.click(clearMountPointButton);
    expect(mountPoint).toHaveValue("");
    // File system and size fields disabled until valid mount point selected
    expect(filesystem).toBeDisabled();
    expect(screen.queryByRole("textbox", { name: "File system label" })).not.toBeInTheDocument();
    size = screen.getByRole("button", { name: "Size mode" });
    expect(size).toBeDisabled();
  });

  it("does not allow sending sizes without units", async () => {
    const { user } = installerRender(<PartitionPage />);
    screen.getByRole("form", { name: "Configure partition at /dev/sda" });
    const mountPoint = screen.getByRole("button", { name: "Mount point toggle" });
    const acceptButton = screen.getByRole("button", { name: "Accept" });

    await user.click(mountPoint);
    const mountPointOptions = screen.getByRole("listbox", { name: "Suggested mount points" });
    const homeMountPoint = within(mountPointOptions).getByRole("option", { name: "/home" });
    await user.click(homeMountPoint);
    expect(acceptButton).toBeEnabled();

    // Display size modes
    const sizeMode = screen.getByRole("button", { name: "Size mode" });
    await user.click(sizeMode);
    const sizeModes = screen.getByRole("listbox", { name: "Size modes" });
    // Display custom size
    const customSize = within(sizeModes).getByRole("option", { name: /Custom/ });
    await user.click(customSize);
    const size = screen.getByRole("textbox", { name: "Size" });

    await user.clear(size);
    await user.type(size, "1");
    expect(acceptButton).toBeDisabled();
    await user.type(size, " GiB");
    expect(acceptButton).toBeEnabled();
  });

  describe("if editing a partition", () => {
    beforeEach(() => {
      mockParams({ list: "drives", listIndex: "0", partitionId: "/home" });
      mockGetPartition.mockReturnValue({
        mountPath: "/home",
        size: {
          default: false,
          min: gib(5),
          max: gib(5),
        },
        filesystem: {
          default: false,
          type: "xfs",
          label: "HOME",
        },
      });
    });

    it("initializes the form with the partition values", async () => {
      installerRender(<PartitionPage />);
      const mountPointSelector = screen.getByRole("combobox", { name: "Mount point" });
      expect(mountPointSelector).toHaveValue("/home");
      const targetButton = screen.getByRole("button", { name: "Mount point mode" });
      within(targetButton).getByText(/As a new partition/);
      const filesystemButton = screen.getByRole("button", { name: "File system" });
      within(filesystemButton).getByText("XFS");
      const label = screen.getByRole("textbox", { name: "File system label" });
      expect(label).toHaveValue("HOME");
      const sizeModeButton = screen.getByRole("button", { name: "Size mode" });
      within(sizeModeButton).getByText("Custom");
      const sizeInput = screen.getByRole("textbox", { name: "Size" });
      expect(sizeInput).toHaveValue("5 GiB");
      const growCheck = screen.getByRole("checkbox", { name: "Allow growing" });
      expect(growCheck).not.toBeChecked();
    });

    describe("if the max size is unlimited", () => {
      beforeEach(() => {
        mockParams({ list: "drives", listIndex: "0", partitionId: "/home" });
        mockGetPartition.mockReturnValue({
          mountPath: "/home",
          size: {
            default: false,
            min: gib(5),
          },
          filesystem: {
            default: false,
            type: "xfs",
          },
        });
      });

      it("checks allow growing", async () => {
        installerRender(<PartitionPage />);
        const growCheck = screen.getByRole("checkbox", { name: "Allow growing" });
        expect(growCheck).toBeChecked();
      });
    });

    describe("if the max size has a value", () => {
      beforeEach(() => {
        mockParams({ list: "drives", listIndex: "0", partitionId: "/home" });
        mockGetPartition.mockReturnValue({
          mountPath: "/home",
          size: {
            default: false,
            min: gib(5),
            max: gib(10),
          },
          filesystem: {
            default: false,
            type: "xfs",
          },
        });
      });

      it("allows switching to a fixed size", async () => {
        const { user } = installerRender(<PartitionPage />);
        const switchButton = screen.getByRole("button", { name: /use a supported size\?/ });
        await user.click(switchButton);
        const sizeInput = screen.getByRole("textbox", { name: "Size" });
        expect(sizeInput).toHaveValue("5 GiB");
        const growCheck = screen.getByRole("checkbox", { name: "Allow growing" });
        expect(growCheck).toBeChecked();
      });
    });

    describe("if the default size has a max value", () => {
      beforeEach(() => {
        mockParams({ list: "drives", listIndex: "0", partitionId: "/home" });
        mockGetPartition.mockReturnValue({
          mountPath: "/home",
          size: {
            default: true,
            min: gib(5),
            max: gib(10),
          },
          filesystem: {
            default: false,
            type: "xfs",
          },
        });
      });

      it("allows switching to a custom size", async () => {
        const { user } = installerRender(<PartitionPage />);
        const sizeModeButton = screen.getByRole("button", { name: "Size mode" });
        await user.click(sizeModeButton);
        const sizeModes = screen.getByRole("listbox", { name: "Size modes" });
        const customSize = within(sizeModes).getByRole("option", { name: /Custom/ });
        await user.click(customSize);
        const sizeInput = screen.getByRole("textbox", { name: "Size" });
        expect(sizeInput).toHaveValue("5 GiB");
        const growCheck = screen.getByRole("checkbox", { name: "Allow growing" });
        expect(growCheck).toBeChecked();
      });
    });
  });
});
