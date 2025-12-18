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
import FormattableDevicePage from "~/components/storage/FormattableDevicePage";
import type { Storage } from "~/model/system";
import type { ConfigModel } from "~/model/storage/config-model";
import { gib } from "./utils";

const sda: Storage.Device = {
  sid: 59,
  class: "drive",
  name: "/dev/sda",
  description: "",
  block: {
    start: 1,
    size: gib(10),
  },
};

const sdaModel: ConfigModel.Drive = {
  name: "/dev/sda",
  spacePolicy: "keep",
  partitions: [],
};

const homeVolume: Storage.VolumeTemplate = {
  mountPath: "/home",
  mountOptions: [],
  target: "default",
  fsType: "btrfs",
  minSize: gib(1),
  maxSize: gib(5),
  autoSize: false,
  snapshots: false,
  transactional: false,
  outline: {
    required: false,
    fsTypes: ["btrfs", "xfs"],
    supportAutoSize: false,
    snapshotsConfigurable: false,
    snapshotsAffectSizes: false,
    sizeRelevantVolumes: [],
    adjustByRam: false,
  },
};

const mockUseDevice = jest.fn();
const mockUsePartitionable = jest.fn();
const mockUseConfigModel = jest.fn();
const mockUseMissingMountPaths = jest.fn();
const mockUseVolumeTemplate = jest.fn();
const mockSetFilesystem = jest.fn();

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useDevice: (name: string) => mockUseDevice(name),
  useVolumeTemplate: (mountPath: string) => mockUseVolumeTemplate(mountPath),
}));

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  usePartitionable: (collection: string, index: number) => mockUsePartitionable(collection, index),
  useConfigModel: () => mockUseConfigModel(),
  useMissingMountPaths: () => mockUseMissingMountPaths(),
  useSetFilesystem: () => mockSetFilesystem,
}));

jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>registration alert</div>
));

beforeEach(() => {
  mockParams({ collection: "drives", index: "0" });
  mockUsePartitionable.mockReturnValue(sdaModel);
  mockUseDevice.mockReturnValue(sda);
  mockUseConfigModel.mockReturnValue({ drives: [sdaModel] });
  mockUseMissingMountPaths.mockReturnValue(["/home", "swap"]);
  mockUseVolumeTemplate.mockReturnValue(homeVolume);
});

describe("FormattableDevicePage", () => {
  it("renders a form for formatting the device", async () => {
    const { user } = installerRender(<FormattableDevicePage />);
    screen.getByRole("form", { name: "Configure device /dev/sda" });
    const mountPoint = screen.getByRole("button", { name: "Mount point toggle" });
    const filesystem = screen.getByRole("button", { name: "File system" });
    // File system and size fields disabled until valid mount point selected
    expect(filesystem).toBeDisabled();
    expect(screen.queryByRole("textbox", { name: "File system label" })).not.toBeInTheDocument();

    await user.click(mountPoint);
    const mountPointOptions = screen.getByRole("listbox", { name: "Suggested mount points" });
    const homeMountPoint = within(mountPointOptions).getByRole("option", { name: "/home" });
    await user.click(homeMountPoint);
    // Valid mount point selected, enable file system field
    expect(filesystem).toBeEnabled();
    expect(screen.queryByRole("textbox", { name: "File system label" })).toBeInTheDocument();
    // Display available file systems
    await user.click(filesystem);
    screen.getByRole("listbox", { name: "Available file systems" });
  });

  it("allows reseting the chosen mount point", async () => {
    const { user } = installerRender(<FormattableDevicePage />);
    // Note that the underline PF component gives the role combobox to the input
    const mountPoint = screen.getByRole("combobox", { name: "Mount point" });
    const filesystem = screen.getByRole("button", { name: "File system" });
    expect(mountPoint).toHaveValue("");
    // File system field is disabled until a valid mount point selected
    expect(filesystem).toBeDisabled();
    const mountPointToggle = screen.getByRole("button", { name: "Mount point toggle" });
    await user.click(mountPointToggle);
    const mountPointOptions = screen.getByRole("listbox", { name: "Suggested mount points" });
    const homeMountPoint = within(mountPointOptions).getByRole("option", { name: "/home" });
    await user.click(homeMountPoint);
    expect(mountPoint).toHaveValue("/home");
    expect(filesystem).toBeEnabled();
    expect(screen.queryByRole("textbox", { name: "File system label" })).toBeInTheDocument();
    const clearMountPointButton = screen.getByRole("button", {
      name: "Clear selected mount point",
    });
    await user.click(clearMountPointButton);
    expect(mountPoint).toHaveValue("");
    // File system field is disabled until a valid mount point selected
    expect(filesystem).toBeDisabled();
    expect(screen.queryByRole("textbox", { name: "File system label" })).not.toBeInTheDocument();
  });

  describe("if the device has already a filesystem config", () => {
    const formattedSdaModel: model.Drive = {
      ...sdaModel,
      mountPath: "/home",
      filesystem: {
        default: false,
        type: "xfs",
        label: "HOME",
      },
    };

    const formattedSda: storage.Device = {
      ...sda,
      filesystem: { type: "xfs" },
    };

    beforeEach(() => {
      mockUsePartitionable.mockReturnValue(formattedSdaModel);
      mockUseDevice.mockReturnValue(formattedSda);
      mockUseConfigModel.mockReturnValue({drives: [formattedSdaModel]});
    });

    it("initializes the form with the current values", async () => {
      installerRender(<FormattableDevicePage />);
      const mountPointSelector = screen.getByRole("combobox", { name: "Mount point" });
      expect(mountPointSelector).toHaveValue("/home");
      const filesystemButton = screen.getByRole("button", { name: "File system" });
      within(filesystemButton).getByText("XFS");
      const label = screen.getByRole("textbox", { name: "File system label" });
      expect(label).toHaveValue("HOME");
    });
  });

  describe("if the form is accepted", () => {
    it("changes the device config", async () => {
      const { user } = installerRender(<FormattableDevicePage />);
      const mountPointToggle = screen.getByRole("button", { name: "Mount point toggle" });
      await user.click(mountPointToggle);
      const mountPointOptions = screen.getByRole("listbox", { name: "Suggested mount points" });
      const homeMountPoint = within(mountPointOptions).getByRole("option", { name: "/home" });
      await user.click(homeMountPoint);
      const filesystemButton = screen.getByRole("button", { name: "File system" });
      await user.click(filesystemButton);
      const filesystemOptions = screen.getByRole("listbox", { name: "Available file systems" });
      const xfs = within(filesystemOptions).getByRole("option", { name: "XFS" });
      await user.click(xfs);
      const labelInput = screen.getByRole("textbox", { name: "File system label" });
      await user.type(labelInput, "TEST");
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);
      expect(mockSetFilesystem).toHaveBeenCalledWith("drives", 0, {
        mountPath: "/home",
        filesystem: {
          type: "xfs",
          snapshots: false,
          label: "TEST",
        },
      });
    });
  });
});
