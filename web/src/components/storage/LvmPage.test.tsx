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
import type { ConfigModel } from "~/model/storage/config-model";
import type { Storage } from "~/model/system";
import { gib } from "./utils";
import LvmPage from "./LvmPage";

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

const sdb: Storage.Device = {
  sid: 60,
  class: "drive",
  name: "/dev/sdb",
  block: {
    start: 1,
    size: gib(10),
    shrinking: { supported: false },
    systems: [],
  },
  drive: {
    type: "disk",
    info: {
      dellBoss: false,
      sdCard: false,
    },
  },
};

const mockSdaDrive: ConfigModel.Drive = {
  name: "/dev/sda",
  spacePolicy: "delete",
  partitions: [
    {
      mountPath: "swap",
      size: {
        min: gib(2),
        default: false,
      },
      filesystem: { default: true, type: "swap" },
    },
    {
      mountPath: "/home",
      size: {
        min: gib(16),
        default: true,
      },
      filesystem: { default: true, type: "xfs" },
    },
  ],
};

const mockRootVolumeGroup: ConfigModel.VolumeGroup = {
  vgName: "fakeRootVg",
  targetDevices: ["/dev/sda"],
  logicalVolumes: [],
};

const mockHomeVolumeGroup: ConfigModel.VolumeGroup = {
  vgName: "fakeHomeVg",
  targetDevices: ["/dev/sda"],
  logicalVolumes: [],
};

const mockAddVolumeGroup = jest.fn();
const mockEditVolumeGroup = jest.fn();
const mockUseConfigModel = jest.fn();
const mockUseVolumeGroup = jest.fn();
const mockUseAvailableDevices = jest.fn();

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useAvailableDevices: () => mockUseAvailableDevices(),
}));

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  __esModule: true,
  useConfigModel: () => mockUseConfigModel(),
  useVolumeGroup: (id?: string) => mockUseVolumeGroup(id),
  useAddVolumeGroup: () => mockAddVolumeGroup,
  useEditVolumeGroup: () => mockEditVolumeGroup,
}));

describe("LvmPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams({});
    mockUseAvailableDevices.mockReturnValue([sda, sdb]);
    mockUseVolumeGroup.mockReturnValue(undefined);
  });

  describe("when creating a new volume group", () => {
    it("allows configuring a new LVM volume group (without moving mount points)", async () => {
      mockUseConfigModel.mockReturnValue({
        drives: [mockSdaDrive],
        mdRaids: [],
        volumeGroups: [],
      });

      const { user } = installerRender(<LvmPage />);
      const name = screen.getByRole("textbox", { name: "Name" });
      const disks = screen.getByRole("group", { name: "Disks" });
      const sdaCheckbox = within(disks).getByRole("checkbox", { name: "sda (20 GiB)" });
      const sdbCheckbox = within(disks).getByRole("checkbox", { name: "sdb (10 GiB)" });
      const moveMountPointsCheckbox = screen.getByRole("checkbox", {
        name: /Move the mount points currently configured at the selected disks to logical volumes/,
      });
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      // Clear default value for name
      await user.clear(name);
      await user.type(name, "root-vg");
      await user.click(sdbCheckbox);

      // sda is selected by default because it is adding partitions.
      expect(sdaCheckbox).toBeChecked();
      // By default move mount points should be checked
      expect(moveMountPointsCheckbox).toBeChecked();
      await user.click(moveMountPointsCheckbox);
      expect(moveMountPointsCheckbox).not.toBeChecked();
      await user.click(acceptButton);
      expect(mockAddVolumeGroup).toHaveBeenCalledWith(
        { vgName: "root-vg", targetDevices: ["/dev/sda", "/dev/sdb"] },
        false,
      );
    });

    it("allows configuring a new LVM volume group (moving mount points)", async () => {
      mockUseConfigModel.mockReturnValue({
        drives: [mockSdaDrive],
        mdRaids: [],
        volumeGroups: [],
      });

      const { user } = installerRender(<LvmPage />);
      const disks = screen.getByRole("group", { name: "Disks" });
      const sdbCheckbox = within(disks).getByRole("checkbox", { name: "sdb (10 GiB)" });
      const moveMountPointsCheckbox = screen.getByRole("checkbox", {
        name: /Move the mount points currently configured at the selected disks to logical volumes/,
      });
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      await user.click(sdbCheckbox);
      expect(moveMountPointsCheckbox).toBeChecked();
      await user.click(acceptButton);
      expect(mockAddVolumeGroup).toHaveBeenCalledWith(
        { vgName: "system", targetDevices: ["/dev/sda", "/dev/sdb"] },
        true,
      );
    });

    it("performs basic validations", async () => {
      mockUseConfigModel.mockReturnValue({
        drives: [mockSdaDrive],
        mdRaids: [],
        volumeGroups: [],
      });

      const { user } = installerRender(<LvmPage />);
      const name = screen.getByRole("textbox", { name: "Name" });
      const disks = screen.getByRole("group", { name: "Disks" });
      const sdaCheckbox = within(disks).getByRole("checkbox", { name: "sda (20 GiB)" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      // Unselect sda
      await user.click(sdaCheckbox);

      // Let's clean the default given name
      await user.clear(name);
      await user.click(acceptButton);
      screen.getByText("Warning alert:");
      screen.getByText(/Enter a name/);
      screen.getByText(/Select at least one disk/);

      // Type a name
      await user.type(name, "root-vg");
      await user.click(acceptButton);
      screen.getByText("Warning alert:");
      expect(screen.queryByText(/Enter a name/)).toBeNull();
      screen.getByText(/Select at least one disk/);

      // Select sda again
      expect(sdaCheckbox).not.toBeChecked();
      await user.click(sdaCheckbox);
      expect(sdaCheckbox).toBeChecked();
      await user.click(acceptButton);
      expect(screen.queryByText("Warning alert:")).toBeNull();
      expect(screen.queryByText(/Enter a name/)).toBeNull();
      expect(screen.queryByText(/Select at least one disk/)).toBeNull();
    });

    describe("when there are LVM volume groups", () => {
      beforeEach(() => {
        mockUseConfigModel.mockReturnValue({
          drives: [mockSdaDrive],
          mdRaids: [],
          volumeGroups: [mockRootVolumeGroup],
        });
      });

      it("does not pre-fill the name input", () => {
        installerRender(<LvmPage />);
        const name = screen.getByRole("textbox", { name: "Name" });
        expect(name).toHaveValue("");
      });
    });

    describe("when there are no LVM volume groups yet", () => {
      beforeEach(() => {
        mockUseConfigModel.mockReturnValue({
          drives: [mockSdaDrive],
          mdRaids: [],
          volumeGroups: [],
        });
      });

      it("pre-fills the name input with 'system'", () => {
        installerRender(<LvmPage />);
        const name = screen.getByRole("textbox", { name: "Name" });
        expect(name).toHaveValue("system");
      });
    });
  });

  describe("when editing", () => {
    beforeEach(() => {
      mockParams({ id: "fakeRootVg" });
      mockUseConfigModel.mockReturnValue({
        drives: [mockSdaDrive],
        mdRaids: [],
        volumeGroups: [mockRootVolumeGroup, mockHomeVolumeGroup],
      });
      mockUseVolumeGroup.mockReturnValue(mockRootVolumeGroup);
    });

    it("performs basic validations", async () => {
      const { user } = installerRender(<LvmPage />);
      const name = screen.getByRole("textbox", { name: "Name" });
      const disks = screen.getByRole("group", { name: "Disks" });
      const sdaCheckbox = within(disks).getByRole("checkbox", { name: "sda (20 GiB)" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      // Let's clean the default given name
      await user.clear(name);
      await user.click(sdaCheckbox);
      expect(name).toHaveValue("");
      expect(sdaCheckbox).not.toBeChecked();
      await user.click(acceptButton);
      screen.getByText("Warning alert:");
      screen.getByText(/Enter a name/);
      screen.getByText(/Select at least one disk/);
      // Enter a name already in use
      await user.type(name, "fakeHomeVg");
      await user.click(acceptButton);
      expect(screen.queryByText(/Enter a name/)).toBeNull();
      screen.getByText(/Enter a different name/);
    });

    it("pre-fills form with the current volume group configuration", async () => {
      installerRender(<LvmPage />);
      const name = screen.getByRole("textbox", { name: "Name" });
      const sdaCheckbox = screen.getByRole("checkbox", { name: "sda (20 GiB)" });
      expect(name).toHaveValue("fakeRootVg");
      expect(sdaCheckbox).toBeChecked();
    });

    it("does not offer option for moving mount points", () => {
      installerRender(<LvmPage />);
      expect(
        screen.queryByRole("checkbox", {
          name: /Move the mount points currently configured at the selected disks to logical volumes/,
        }),
      ).toBeNull();
    });

    it("triggers the hook for updating the volume group when user accepts changes", async () => {
      const { user } = installerRender(<LvmPage />);
      const name = screen.getByRole("textbox", { name: "Name" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.clear(name);
      await user.type(name, "updatedRootVg");
      await user.click(acceptButton);
      expect(mockEditVolumeGroup).toHaveBeenCalledWith("fakeRootVg", {
        vgName: "updatedRootVg",
        targetDevices: ["/dev/sda"],
      });
    });
  });
});
