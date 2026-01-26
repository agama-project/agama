/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import type { ConfigModel } from "~/model/storage/config-model";
import type { Storage } from "~/model/system";
import { gib } from "./utils";

jest.mock("./ProposalResultSection", () => () => <div>result section</div>);

const sda1: Storage.Device = {
  sid: 69,
  class: "partition",
  name: "/dev/sda1",
  description: "Swap partition",
  block: {
    start: 1,
    size: gib(2),
    shrinking: { supported: false },
  },
};

const sda: Storage.Device = {
  sid: 59,
  class: "drive",
  name: "/dev/sda",
  description: "SDA drive",
  drive: {
    type: "disk",
    model: "Micron 1100 SATA",
    vendor: "Micron",
    bus: "IDE",
    busId: "",
    transport: "usb",
    driver: ["ahci", "mmcblk"],
    info: {
      dellBoss: false,
      sdCard: true,
    },
  },
  block: {
    start: 1,
    size: gib(20),
    active: true,
    encrypted: false,
    systems: [],
    shrinking: { supported: false },
  },
  partitions: [sda1],
};

const swap: ConfigModel.Partition = {
  mountPath: "swap",
  size: {
    min: gib(2),
    default: false,
  },
  filesystem: { default: false, type: "swap" },
};

const home: ConfigModel.Partition = {
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
};

const drive: ConfigModel.Drive = {
  name: "/dev/sda",
  spacePolicy: "delete",
  partitions: [swap],
};

const driveWithHome: ConfigModel.Drive = {
  name: "/dev/sda",
  spacePolicy: "delete",
  partitions: [swap, home],
};

const homeVolume: Storage.Volume = {
  mountPath: "/home",
  fsType: "btrfs",
  minSize: 1024,
  maxSize: 1024,
  snapshots: false,
  autoSize: false,
  outline: {
    required: false,
    fsTypes: ["btrfs"],
    snapshotsConfigurable: false,
    snapshotsAffectSizes: false,
    supportAutoSize: false,
    sizeRelevantVolumes: [],
  },
};

const mockUseDevice = jest.fn();
const mockUsePartitionable = jest.fn();
const mockUseConfigModel = jest.fn();
const mockUseSolvedConfigModel = jest.fn();
const mockUseMissingMountPaths = jest.fn();
const mockUseVolumeTemplate = jest.fn();
const mockAddPartition = jest.fn();
const mockEditPartition = jest.fn();

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useDevice: (name: string) => mockUseDevice(name),
  useVolumeTemplate: (mountPath: string) => mockUseVolumeTemplate(mountPath),
}));

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  usePartitionable: (collection: string, index: number) => mockUsePartitionable(collection, index),
  useConfigModel: () => mockUseConfigModel(),
  useSolvedConfigModel: (model?: ConfigModel.Config) => mockUseSolvedConfigModel(model),
  useMissingMountPaths: () => mockUseMissingMountPaths(),
  useAddPartition: () => mockAddPartition,
  useEditPartition: () => mockEditPartition,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams({ collection: "drives", index: "0" });
  mockUsePartitionable.mockReturnValue(drive);
  mockUseDevice.mockReturnValue(sda);
  mockUseConfigModel.mockReturnValue({ drives: [drive] });
  mockUseSolvedConfigModel.mockReturnValue({ drives: [driveWithHome] });
  mockUseMissingMountPaths.mockReturnValue(["/home", "swap"]);
  mockUseVolumeTemplate.mockReturnValue(homeVolume);
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
    const customSize = within(sizeModes).getByRole("option", { name: /Manual/ });
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
    const customSize = within(sizeModes).getByRole("option", { name: /Manual/ });
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
      mockParams({ collection: "drives", index: "0", partitionId: "/home" });
      mockUsePartitionable.mockReturnValue(driveWithHome);
      mockUseConfigModel.mockReturnValue({ drives: [driveWithHome] });
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
      within(sizeModeButton).getByText("Manual");
      const sizeInput = screen.getByRole("textbox", { name: "Size" });
      expect(sizeInput).toHaveValue("5 GiB");
      const growCheck = screen.getByRole("checkbox", { name: "Allow growing" });
      expect(growCheck).not.toBeChecked();
    });

    describe("if the max size is unlimited", () => {
      beforeEach(() => {
        const unlimitedHome = {
          ...home,
          size: { default: false, min: gib(5) },
        };
        const driveWithUnlimited = {
          ...driveWithHome,
          partitions: [swap, unlimitedHome],
        };
        mockUsePartitionable.mockReturnValue(driveWithUnlimited);
        mockUseConfigModel.mockReturnValue({ drives: [driveWithUnlimited] });
      });

      it("checks allow growing", async () => {
        installerRender(<PartitionPage />);
        const growCheck = screen.getByRole("checkbox", { name: "Allow growing" });
        expect(growCheck).toBeChecked();
      });
    });

    describe("if the max size has a value", () => {
      beforeEach(() => {
        const rangedHome = {
          ...home,
          size: { default: false, min: gib(5), max: gib(10) },
        };
        const driveWithRange = {
          ...driveWithHome,
          partitions: [swap, rangedHome],
        };
        mockUsePartitionable.mockReturnValue(driveWithRange);
        mockUseConfigModel.mockReturnValue({ drives: [driveWithRange] });
      });

      it("allows switching to a fixed size", async () => {
        const { user } = installerRender(<PartitionPage />);
        const switchButton = screen.getByRole("button", { name: /Discard the maximum/ });
        await user.click(switchButton);
        const sizeInput = screen.getByRole("textbox", { name: "Size" });
        expect(sizeInput).toHaveValue("5 GiB");
        const growCheck = screen.getByRole("checkbox", { name: "Allow growing" });
        expect(growCheck).toBeChecked();
      });
    });

    describe("if the default size has a max value", () => {
      beforeEach(() => {
        const rangedDefaultHome = {
          ...home,
          size: { default: true, min: gib(5), max: gib(10) },
        };
        const driveWithDefaultRange = {
          ...driveWithHome,
          partitions: [swap, rangedDefaultHome],
        };
        mockUsePartitionable.mockReturnValue(driveWithDefaultRange);
        mockUseConfigModel.mockReturnValue({ drives: [driveWithDefaultRange] });
      });

      it("allows switching to a custom size", async () => {
        const { user } = installerRender(<PartitionPage />);
        const sizeModeButton = screen.getByRole("button", { name: "Size mode" });
        await user.click(sizeModeButton);
        const sizeModes = screen.getByRole("listbox", { name: "Size modes" });
        const customSize = within(sizeModes).getByRole("option", { name: /Manual/ });
        await user.click(customSize);
        const sizeInput = screen.getByRole("textbox", { name: "Size" });
        expect(sizeInput).toHaveValue("5 GiB");
        const growCheck = screen.getByRole("checkbox", { name: "Allow growing" });
        expect(growCheck).toBeChecked();
      });
    });
  });
});
