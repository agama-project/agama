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
import LvmPage from "./LvmPage";
import type { system } from "~/api";

const gib = (n) => n * 1024 * 1024 * 1024;

// Mock devices from system storage API (using correct api-v2 types)
const sda: system.storage.Device = {
  sid: 59,
  name: "/dev/sda",
  description: "Micron 1100 SATA",
  class: "drive",
  block: {
    start: 0,
    size: gib(500),
    active: true,
    encrypted: false,
    systems: [],
    shrinking: { supported: false, reasons: [] },
  },
  drive: {
    type: "disk",
    vendor: "Micron",
    model: "Micron 1100 SATA",
    transport: "sata",
    bus: "IDE",
    driver: ["ahci"],
  },
};

const sdb: system.storage.Device = {
  sid: 60,
  name: "/dev/sdb",
  description: "Generic disk",
  class: "drive",
  block: {
    start: 0,
    size: gib(1000),
    active: true,
    encrypted: false,
    systems: [],
    shrinking: { supported: false, reasons: [] },
  },
  drive: {
    type: "disk",
    vendor: "Generic",
    model: "Generic",
  },
};

const md0: system.storage.Device = {
  sid: 70,
  name: "/dev/md0",
  description: "MD RAID",
  class: "mdRaid",
  block: {
    start: 0,
    size: gib(2000),
    active: true,
    encrypted: false,
    systems: [],
    shrinking: { supported: false, reasons: [] },
  },
  md: {
    level: "raid1",
    devices: [59, 60],
  },
};

// Mock model drive (using config model types)
const mockDrive = {
  name: "/dev/sda",
  spacePolicy: "delete" as const,
  partitions: [],
  isAddingPartitions: true,
  filesystem: undefined,
};

const mockMdRaid = {
  name: "/dev/md0",
  isAddingPartitions: false,
  filesystem: undefined,
};

// Mock volume groups
const mockVolumeGroup1 = {
  vgName: "system",
  logicalVolumes: [],
  getTargetDevices: jest.fn(() => [mockDrive]),
  getMountPaths: jest.fn(() => []),
};

const mockVolumeGroup2 = {
  vgName: "data",
  logicalVolumes: [],
  getTargetDevices: jest.fn(() => [mockDrive]),
  getMountPaths: jest.fn(() => []),
};

// Mocked hook functions
const mockAddVolumeGroup = jest.fn();
const mockEditVolumeGroup = jest.fn();
const mockUseVolumeGroup = jest.fn();
const mockUseModel = jest.fn();
const mockUseAvailableDevices = jest.fn();

// Setup mocks
jest.mock("~/hooks/api/system/storage", () => ({
  useAvailableDevices: () => mockUseAvailableDevices(),
}));

jest.mock("~/hooks/storage/model", () => ({
  useModel: () => mockUseModel(),
}));

jest.mock("~/hooks/storage/volume-group", () => ({
  useVolumeGroup: (id) => mockUseVolumeGroup(id),
  useAddVolumeGroup: () => mockAddVolumeGroup,
  useEditVolumeGroup: () => mockEditVolumeGroup,
}));

jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>registration alert</div>
));

describe("LvmPage", () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Default mock values
    mockUseAvailableDevices.mockReturnValue([sda, sdb]);
    mockUseModel.mockReturnValue({
      drives: [mockDrive],
      mdRaids: [],
      volumeGroups: [],
    });
    mockUseVolumeGroup.mockReturnValue(undefined);
    mockParams({});
  });

  describe("when creating a new volume group", () => {
    describe("and there are no volume groups yet", () => {
      beforeEach(() => {
        mockUseModel.mockReturnValue({
          drives: [mockDrive],
          mdRaids: [],
          volumeGroups: [],
        });
      });

      it("pre-fills the name with 'system'", () => {
        installerRender(<LvmPage />);
        const nameInput = screen.getByRole("textbox", { name: "Name" });
        expect(nameInput).toHaveValue("system");
      });

      it("pre-selects devices that are adding partitions", () => {
        installerRender(<LvmPage />);
        const sdaCheckbox = screen.getByRole("checkbox", { name: /sda/ });
        expect(sdaCheckbox).toBeChecked();
      });
    });

    describe("and there are already volume groups", () => {
      beforeEach(() => {
        mockUseModel.mockReturnValue({
          drives: [mockDrive],
          mdRaids: [],
          volumeGroups: [mockVolumeGroup1],
        });
      });

      it("does not pre-fill the name", () => {
        installerRender(<LvmPage />);
        const nameInput = screen.getByRole("textbox", { name: "Name" });
        expect(nameInput).toHaveValue("");
      });
    });

    it("displays all available devices as checkboxes", () => {
      installerRender(<LvmPage />);
      expect(screen.getByRole("checkbox", { name: /sda/ })).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: /sdb/ })).toBeInTheDocument();
    });

    it("allows selecting multiple devices", async () => {
      const { user } = installerRender(<LvmPage />);
      const sdaCheckbox = screen.getByRole("checkbox", { name: /sda/ });
      const sdbCheckbox = screen.getByRole("checkbox", { name: /sdb/ });

      await user.click(sdbCheckbox);
      
      expect(sdaCheckbox).toBeChecked();
      expect(sdbCheckbox).toBeChecked();
    });

    it("shows the move mount points option", () => {
      installerRender(<LvmPage />);
      expect(
        screen.getByRole("checkbox", { name: /Move the mount points/ })
      ).toBeInTheDocument();
    });

    it("has move mount points checked by default", () => {
      installerRender(<LvmPage />);
      const moveMountPointsCheckbox = screen.getByRole("checkbox", {
        name: /Move the mount points/,
      });
      expect(moveMountPointsCheckbox).toBeChecked();
    });

    it("creates a volume group with the specified configuration", async () => {
      const { user } = installerRender(<LvmPage />);
      
      const nameInput = screen.getByRole("textbox", { name: "Name" });
      const sdbCheckbox = screen.getByRole("checkbox", { name: /sdb/ });
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      await user.clear(nameInput);
      await user.type(nameInput, "my-vg");
      await user.click(sdbCheckbox);
      await user.click(acceptButton);

      expect(mockAddVolumeGroup).toHaveBeenCalledWith(
        { vgName: "my-vg", targetDevices: ["/dev/sda", "/dev/sdb"] },
        true
      );
    });

    it("creates a volume group without moving mount points when unchecked", async () => {
      const { user } = installerRender(<LvmPage />);
      
      const nameInput = screen.getByRole("textbox", { name: "Name" });
      const moveMountPointsCheckbox = screen.getByRole("checkbox", {
        name: /Move the mount points/,
      });
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      await user.clear(nameInput);
      await user.type(nameInput, "test-vg");
      await user.click(moveMountPointsCheckbox);
      await user.click(acceptButton);

      expect(mockAddVolumeGroup).toHaveBeenCalledWith(
        { vgName: "test-vg", targetDevices: ["/dev/sda"] },
        false
      );
    });

    it("shows error when name is empty", async () => {
      const { user } = installerRender(<LvmPage />);
      
      const nameInput = screen.getByRole("textbox", { name: "Name" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      await user.clear(nameInput);
      await user.click(acceptButton);

      expect(screen.getByText(/Enter a name for the volume group/)).toBeInTheDocument();
      expect(mockAddVolumeGroup).not.toHaveBeenCalled();
    });

    it("shows error when no devices are selected", async () => {
      const { user } = installerRender(<LvmPage />);
      
      const sdaCheckbox = screen.getByRole("checkbox", { name: /sda/ });
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      await user.click(sdaCheckbox);
      await user.click(acceptButton);

      expect(screen.getByText(/Select at least one disk/)).toBeInTheDocument();
      expect(mockAddVolumeGroup).not.toHaveBeenCalled();
    });

    it("shows error when volume group name already exists", async () => {
      mockUseModel.mockReturnValue({
        drives: [mockDrive],
        mdRaids: [],
        volumeGroups: [mockVolumeGroup1],
      });

      const { user } = installerRender(<LvmPage />);
      
      const nameInput = screen.getByRole("textbox", { name: "Name" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      await user.type(nameInput, "system");
      await user.click(acceptButton);

      expect(screen.getByText(/already exists.*different name/)).toBeInTheDocument();
      expect(mockAddVolumeGroup).not.toHaveBeenCalled();
    });

    it("filters out devices that are being formatted", () => {
      const driveWithFilesystem = {
        ...mockDrive,
        filesystem: { type: "ext4" },
      };

      mockUseModel.mockReturnValue({
        drives: [driveWithFilesystem],
        mdRaids: [],
        volumeGroups: [],
      });

      installerRender(<LvmPage />);
      
      // sda should not appear because it has a filesystem
      expect(screen.queryByRole("checkbox", { name: /sda/ })).not.toBeInTheDocument();
      // but sdb should still be available
      expect(screen.getByRole("checkbox", { name: /sdb/ })).toBeInTheDocument();
    });

    it("includes MD RAIDs in available devices", () => {
      mockUseAvailableDevices.mockReturnValue([sda, sdb, md0]);
      mockUseModel.mockReturnValue({
        drives: [mockDrive],
        mdRaids: [mockMdRaid],
        volumeGroups: [],
      });

      installerRender(<LvmPage />);
      
      expect(screen.getByRole("checkbox", { name: /md0/ })).toBeInTheDocument();
    });
  });

  describe("when editing an existing volume group", () => {
    beforeEach(() => {
      mockParams({ id: "system" });
      mockUseVolumeGroup.mockReturnValue(mockVolumeGroup1);
      mockUseModel.mockReturnValue({
        drives: [mockDrive],
        mdRaids: [],
        volumeGroups: [mockVolumeGroup1, mockVolumeGroup2],
      });
    });

    it("pre-fills the form with the volume group data", () => {
      installerRender(<LvmPage />);
      
      const nameInput = screen.getByRole("textbox", { name: "Name" });
      expect(nameInput).toHaveValue("system");
      
      const sdaCheckbox = screen.getByRole("checkbox", { name: /sda/ });
      expect(sdaCheckbox).toBeChecked();
    });

    it("does not show the move mount points option", () => {
      installerRender(<LvmPage />);
      
      expect(
        screen.queryByRole("checkbox", { name: /Move the mount points/ })
      ).not.toBeInTheDocument();
    });

    it("updates the volume group with the new configuration", async () => {
      const { user } = installerRender(<LvmPage />);
      
      const nameInput = screen.getByRole("textbox", { name: "Name" });
      const sdbCheckbox = screen.getByRole("checkbox", { name: /sdb/ });
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      await user.clear(nameInput);
      await user.type(nameInput, "system-updated");
      await user.click(sdbCheckbox);
      await user.click(acceptButton);

      expect(mockEditVolumeGroup).toHaveBeenCalledWith("system", {
        vgName: "system-updated",
        targetDevices: ["/dev/sda", "/dev/sdb"],
      });
    });

    it("allows changing the name to the same name", async () => {
      const { user } = installerRender(<LvmPage />);
      
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(mockEditVolumeGroup).toHaveBeenCalledWith("system", {
        vgName: "system",
        targetDevices: ["/dev/sda"],
      });
    });

    it("shows error when trying to use another existing volume group name", async () => {
      const { user } = installerRender(<LvmPage />);
      
      const nameInput = screen.getByRole("textbox", { name: "Name" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      await user.clear(nameInput);
      await user.type(nameInput, "data");
      await user.click(acceptButton);

      expect(screen.getByText(/already exists.*different name/)).toBeInTheDocument();
      expect(mockEditVolumeGroup).not.toHaveBeenCalled();
    });

    it("shows error when name is empty", async () => {
      const { user } = installerRender(<LvmPage />);
      
      const nameInput = screen.getByRole("textbox", { name: "Name" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      await user.clear(nameInput);
      await user.click(acceptButton);

      expect(screen.getByText(/Enter a name for the volume group/)).toBeInTheDocument();
      expect(mockEditVolumeGroup).not.toHaveBeenCalled();
    });

    it("shows error when no devices are selected", async () => {
      const { user } = installerRender(<LvmPage />);
      
      const sdaCheckbox = screen.getByRole("checkbox", { name: /sda/ });
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      await user.click(sdaCheckbox);
      await user.click(acceptButton);

      expect(screen.getByText(/Select at least one disk/)).toBeInTheDocument();
      expect(mockEditVolumeGroup).not.toHaveBeenCalled();
    });
  });
});
