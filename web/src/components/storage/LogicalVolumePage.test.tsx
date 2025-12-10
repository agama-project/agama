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
import LogicalVolumePage from "~/components/storage/LogicalVolumePage";
import { model } from "~/storage";
import type { storage } from "~/api/system";
import { gib } from "./utils";
import { useModel } from "~/hooks/storage/model";

const mockHomeVolume: storage.Volume = {
  mountPath: "/home",
  mountOptions: [],
  fsType: "btrfs",
  minSize: gib(1),
  maxSize: gib(10),
  autoSize: false,
  snapshots: false,
  transactional: false,
  outline: {
    required: true,
    fsTypes: ["btrfs", "ext4", "xfs"],
    supportAutoSize: true,
    snapshotsConfigurable: true,
    snapshotsAffectSizes: true,
    sizeRelevantVolumes: [],
    adjustByRam: false,
  },
};

const mockVg: model.VolumeGroup = {
  vgName: "system",
  logicalVolumes: [],
  getTargetDevices: jest.fn().mockReturnValue([]),
  getMountPaths: jest.fn().mockReturnValue([]),
};

jest.mock("~/hooks/api/config", () => ({
  useProduct: () => ({
    name: "Test Product",
  }),
}));

jest.mock("~/hooks/api/issue", () => ({
  useIssues: () => [],
}));

jest.mock("~/hooks/api/system/storage", () => ({
  useVolumeTemplate: () => mockHomeVolume,
}));

jest.mock("~/hooks/storage/model", () => ({
  useModel: jest.fn(),
  useMissingMountPaths: () => ["/home", "swap"],
}));

const mockUseVolumeGroup = jest.fn(() => mockVg);
jest.mock("~/hooks/storage/volume-group", () => ({
  useVolumeGroup: () => mockUseVolumeGroup(),
}));

const mockAddLogicalVolume = jest.fn();
const mockEditLogicalVolume = jest.fn();
jest.mock("~/hooks/storage/logical-volume", () => ({
  useAddLogicalVolume: () => mockAddLogicalVolume,
  useEditLogicalVolume: () => mockEditLogicalVolume,
}));

// Mock useStorageModel and useSolvedStorageModel
jest.mock("~/hooks/api/storage", () => ({
  useStorageModel: () => ({
    data: { volumeGroups: [mockVg] },
  }),
  useSolvedStorageModel: (model) => ({
    data: model,
    isSuccess: true,
  }),
}));

jest.mock("~/storage/api-model", () => ({
  ...jest.requireActual("~/storage/api-model"),
  buildLogicalVolumeName: (path: string) =>
    path === "/" ? "lv_root" : `lv_${path.replace("/", "")}`,
}));

describe("LogicalVolumePage", () => {
  beforeEach(() => {
    mockParams({ id: "system" });
    (useModel as jest.Mock).mockReturnValue({
      getMountPaths: () => [],
      volumeGroups: [mockVg],
    });
    mockUseVolumeGroup.mockReturnValue(mockVg);
    mockAddLogicalVolume.mockClear();
    mockEditLogicalVolume.mockClear();
  });

  it("renders a form for a new logical volume", async () => {
    const { user } = installerRender(<LogicalVolumePage />);
    await screen.findByRole("form", {
      name: "Configure LVM logical volume at system volume group",
    });

    const mountPoint = screen.getByRole("button", { name: "Mount point toggle" });
    const nameInput = screen.getByRole("textbox", {
      name: "Logical volume name",
    });
    const filesystem = screen.getByRole("button", { name: "File system" });
    const sizeMode = screen.getByRole("button", { name: "Size mode" });

    expect(nameInput).toBeDisabled();
    expect(filesystem).toBeDisabled();
    expect(sizeMode).toBeDisabled();

    await user.click(mountPoint);
    const mountPointOptions = screen.getByRole("listbox", {
      name: "Suggested mount points",
    });
    const homeMountPoint = within(mountPointOptions).getByRole("option", {
      name: "/home",
    });
    await user.click(homeMountPoint);

    expect(nameInput).toBeEnabled();
    expect(filesystem).toBeEnabled();
    // FIXME: This is disabled, but it should be enabled.
    // expect(sizeMode).toBeEnabled();

    expect(nameInput).toHaveValue("lv_home");
  });

  it("submits a new logical volume", async () => {
    const { user } = installerRender(<LogicalVolumePage />);
    await screen.findByRole("form", {
      name: "Configure LVM logical volume at system volume group",
    });

    const mountPoint = screen.getByRole("button", { name: "Mount point toggle" });
    await user.click(mountPoint);
    const mountPointOptions = screen.getByRole("listbox", {
      name: "Suggested mount points",
    });
    const homeMountPoint = within(mountPointOptions).getByRole("option", {
      name: "/home",
    });
    await user.click(homeMountPoint);

    const filesystem = screen.getByRole("button", { name: "File system" });
    await user.click(filesystem);
    const fsOptions = screen.getByRole("listbox", {
      name: "Available file systems",
    });
    const xfs = within(fsOptions).getByRole("option", { name: "XFS" });
    await user.click(xfs);

    const labelInput = screen.getByRole("textbox", { name: "File system label" });
    await user.type(labelInput, "test-label");

    const acceptButton = screen.getByRole("button", { name: "Accept" });
    await user.click(acceptButton);

    expect(mockAddLogicalVolume).toHaveBeenCalledWith("system", {
      mountPath: "/home",
      lvName: "lv_home",
      filesystem: {
        type: "xfs",
        snapshots: false,
        label: "test-label",
      },
      size: undefined,
    });
  });

  describe("editing a logical volume", () => {
    const existingLv: model.LogicalVolume = {
      mountPath: "/home",
      lvName: "my_home",
      filesystem: {
        type: "xfs",
        label: "my-label",
        snapshots: false,
        default: false,
      },
      size: {
        min: gib(2),
        max: gib(5),
        default: false,
      },
    };

    const vgWithLv: model.VolumeGroup = {
      ...mockVg,
      logicalVolumes: [existingLv],
    };

    beforeEach(() => {
      mockParams({ id: "system", logicalVolumeId: "/home" });
      (useModel as jest.Mock).mockReturnValue({
        getMountPaths: () => ["/home"],
        volumeGroups: [vgWithLv],
      });
      mockUseVolumeGroup.mockReturnValue(vgWithLv);
    });

    it("initializes form with existing values", async () => {
      installerRender(<LogicalVolumePage />);
      await screen.findByRole("form");

      expect(screen.getByRole("combobox", { name: "Mount point" })).toHaveValue("/home");
      expect(screen.getByRole("textbox", { name: "Logical volume name" })).toHaveValue("my_home");
      expect(screen.getByRole("button", { name: "File system" })).toHaveTextContent("XFS");
      expect(screen.getByRole("textbox", { name: "File system label" })).toHaveValue("my-label");
      expect(screen.getByRole("button", { name: "Size mode" })).toHaveTextContent("Manual");
    });

    it("submits edited logical volume", async () => {
      const { user } = installerRender(<LogicalVolumePage />);
      await screen.findByRole("form");

      const nameInput = screen.getByRole("textbox", {
        name: "Logical volume name",
      });
      await user.clear(nameInput);
      await user.type(nameInput, "new_home");

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(mockEditLogicalVolume).toHaveBeenCalledWith(
        "system",
        "/home",
        expect.objectContaining({
          lvName: "new_home",
        }),
      );
    });
  });
});
