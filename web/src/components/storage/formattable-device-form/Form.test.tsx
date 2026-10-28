/*
 * Copyright (c) [2026] SUSE LLC
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
import { screen, waitFor } from "@testing-library/react";
import { installerRender, mockNavigateFn, mockParams } from "~/test-utils";
import FormattableDeviceForm from "./Form";

import type { Storage as System } from "~/model/system";
import type { ConfigModel } from "~/model/storage/config-model";

// Mock scrollTo which is not available in jsdom
Element.prototype.scrollTo = jest.fn();

const mockSetFilesystem = jest.fn();

let mockSystemDevice: System.Device | undefined;
let mockDeviceModel: ConfigModel.Drive;
let mockConfigModel: object;

jest.mock("~/hooks/model/storage/config-model", () => ({
  useConfigModel: () => mockConfigModel,
  useMissingMountPaths: () => ["/", "/home", "/var", "swap"],
  usePartitionable: () => mockDeviceModel,
  useSetFilesystem: () => mockSetFilesystem,
}));

jest.mock("~/hooks/model/system/storage", () => ({
  useDevice: () => mockSystemDevice,
  useVolumeTemplate: (mountPath: string) => {
    if (mountPath === "swap") {
      return {
        minSize: 2 * 1024 * 1024 * 1024,
        fsType: "swap",
        autoSize: false,
        outline: {
          fsTypes: ["swap"],
          sizeRelevantVolumes: [],
          snapshotsAffectSizes: false,
          adjustByRam: false,
        },
      };
    }
    return {
      minSize: 20 * 1024 * 1024 * 1024,
      fsType: "xfs",
      autoSize: false,
      mountPath: mountPath === "/home" ? "/home" : undefined,
      outline: {
        fsTypes: ["xfs", "ext4", "btrfs"],
        sizeRelevantVolumes: [],
        snapshotsAffectSizes: false,
        adjustByRam: false,
      },
    };
  },
}));

describe("FormattableDeviceForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams({ collection: "drives", index: "0" });
    mockSystemDevice = {
      sid: 59,
      name: "/dev/vdd",
      description: "Virtual disk",
    } as System.Device;
    mockDeviceModel = {
      name: "/dev/vdd",
      spacePolicy: "keep",
      partitions: [],
    };
    mockConfigModel = {
      drives: [mockDeviceModel, { name: "/dev/vdb", mountPath: "/data", partitions: [] }],
      volumeGroups: [],
    };
  });

  describe("when the device is not found", () => {
    it("shows a resource not found message if the route params are invalid", () => {
      mockParams({ collection: "wrong", index: "0" });
      installerRender(<FormattableDeviceForm />);
      screen.getByText("Go to storage page");
    });

    it("shows a resource not found message if the system device is missing", () => {
      mockSystemDevice = undefined;
      installerRender(<FormattableDeviceForm />);
      screen.getByText("Go to storage page");
    });
  });

  describe("when configuring a device", () => {
    it("renders the mount point and filesystem fields", () => {
      installerRender(<FormattableDeviceForm />);
      screen.getByLabelText("Mount point");
      screen.getByLabelText("File system");
      screen.getByLabelText(/Define more file system settings/);
    });

    it("shows Default as default filesystem", async () => {
      const { user } = installerRender(<FormattableDeviceForm />);
      await user.click(screen.getByLabelText("File system"));
      expect(screen.getByRole("option", { name: "Default" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    it("submits the filesystem config and navigates back", async () => {
      const { user } = installerRender(<FormattableDeviceForm />);
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() =>
        expect(mockSetFilesystem).toHaveBeenCalledWith(
          "drives",
          0,
          expect.objectContaining({ mountPath: "/home" }),
        ),
      );
      expect(mockNavigateFn).toHaveBeenCalledWith(-1);
    });

    it("submits the selected filesystem type and label", async () => {
      const { user } = installerRender(<FormattableDeviceForm />);
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.click(screen.getByLabelText("File system"));
      await user.click(screen.getByRole("option", { name: "Btrfs" }));
      await user.click(screen.getByLabelText(/Define more file system settings/));
      await user.type(screen.getByLabelText(/Label.*optional/i), "TEST");
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() =>
        expect(mockSetFilesystem).toHaveBeenCalledWith("drives", 0, {
          mountPath: "/home",
          filesystem: expect.objectContaining({
            type: "btrfs",
            label: "TEST",
          }),
        }),
      );
    });

    it("submits mount and format options when provided", async () => {
      const { user } = installerRender(<FormattableDeviceForm />);
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.click(screen.getByLabelText(/Define more file system settings/));
      await user.type(screen.getByLabelText(/Mount options.*optional/i), "rw,noatime");
      await user.type(screen.getByLabelText(/Additional format.*optional/i), "-O ^64bit");
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() =>
        expect(mockSetFilesystem).toHaveBeenCalledWith(
          "drives",
          0,
          expect.objectContaining({
            filesystem: expect.objectContaining({
              mountOptions: ["rw,noatime"],
              mkfsExtraArguments: "-O ^64bit",
            }),
          }),
        ),
      );
    });
  });

  describe("mount point field", () => {
    it("provides mount point suggestions via datalist", () => {
      installerRender(<FormattableDeviceForm />);
      const input = screen.getByLabelText("Mount point");
      const datalistId = input.getAttribute("list");
      expect(datalistId).toBeTruthy();
      const datalist = document.getElementById(datalistId);
      const values = Array.from(datalist.querySelectorAll("option")).map((opt) => opt.value);
      expect(values).toEqual(expect.arrayContaining(["/", "/home", "/var", "swap"]));
    });

    it("shows filesystem hint after committing mount point", async () => {
      const { user } = installerRender(<FormattableDeviceForm />);
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.tab();
      await screen.findByText(/XFS.*default file system for/);
    });

    it("shows filesystem as read-only when mount point requires specific filesystem", async () => {
      const { user } = installerRender(<FormattableDeviceForm />);
      await user.type(screen.getByLabelText("Mount point"), "swap");
      await user.tab();
      await screen.findByText("Swap");
      expect(screen.queryByRole("button", { name: "File system" })).not.toBeInTheDocument();
    });
  });

  describe("when the device has a filesystem", () => {
    beforeEach(() => {
      mockSystemDevice = {
        ...mockSystemDevice,
        filesystem: { sid: 100, type: "ext4" },
      } as System.Device;
    });

    it("offers keeping the current filesystem", async () => {
      const { user } = installerRender(<FormattableDeviceForm />);
      await user.click(screen.getByLabelText("File system"));
      screen.getByRole("option", { name: /Current/ });
    });

    it("preselects keeping the current filesystem when the device is not configured yet", async () => {
      installerRender(<FormattableDeviceForm />);
      await waitFor(() =>
        expect(screen.getByLabelText("File system")).toHaveTextContent("Current"),
      );
    });

    it("does not preselect keeping the current filesystem after a choice to format", async () => {
      mockDeviceModel = {
        ...mockDeviceModel,
        mountPath: "/home",
        filesystem: { default: false, type: "ext4" },
      };
      installerRender(<FormattableDeviceForm />);
      expect(screen.getByLabelText("File system")).toHaveTextContent("Ext4");
    });

    it("submits a filesystem reuse config when keeping the current filesystem", async () => {
      const { user } = installerRender(<FormattableDeviceForm />);
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.click(screen.getByLabelText("File system"));
      await user.click(screen.getByRole("option", { name: /Current/ }));
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() =>
        expect(mockSetFilesystem).toHaveBeenCalledWith(
          "drives",
          0,
          expect.objectContaining({
            filesystem: expect.objectContaining({ reuse: true }),
          }),
        ),
      );
    });

    it("does not allow to set the label when keeping the current filesystem", async () => {
      const { user } = installerRender(<FormattableDeviceForm />);
      await user.click(screen.getByLabelText("File system"));
      await user.click(screen.getByRole("option", { name: /Current/ }));
      await user.click(screen.getByLabelText(/Define more file system settings/));
      screen.getByLabelText(/Mount options.*optional/i);
      expect(screen.queryByLabelText(/Label.*optional/i)).not.toBeInTheDocument();
    });

    it("does not offer keeping a filesystem incompatible with the mount point", async () => {
      mockSystemDevice = {
        ...mockSystemDevice,
        filesystem: { sid: 100, type: "vfat" },
      } as System.Device;
      const { user } = installerRender(<FormattableDeviceForm />);
      await user.click(screen.getByLabelText("File system"));
      expect(screen.queryByRole("option", { name: /Current/ })).not.toBeInTheDocument();
    });
  });

  describe("when the device has already a filesystem config", () => {
    beforeEach(() => {
      mockDeviceModel = {
        ...mockDeviceModel,
        mountPath: "/home",
        filesystem: {
          default: false,
          type: "xfs",
          label: "HOME",
        },
      };
      mockConfigModel = {
        drives: [mockDeviceModel],
        volumeGroups: [],
      };
    });

    it("initializes the form with the current values", () => {
      installerRender(<FormattableDeviceForm />);
      expect(screen.getByLabelText("Mount point")).toHaveValue("/home");
      expect(screen.getByLabelText("File system")).toHaveTextContent("XFS");
      expect(screen.getByLabelText(/Define more file system settings/)).toBeChecked();
      expect(screen.getByLabelText(/Label.*optional/i)).toHaveValue("HOME");
    });

    it("submits the edited config keeping the unchanged mount point", async () => {
      const { user } = installerRender(<FormattableDeviceForm />);
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() =>
        expect(mockSetFilesystem).toHaveBeenCalledWith(
          "drives",
          0,
          expect.objectContaining({ mountPath: "/home" }),
        ),
      );
    });

    it("initializes the form for keeping the filesystem when the config reuses it", () => {
      mockSystemDevice = {
        ...mockSystemDevice,
        filesystem: { sid: 100, type: "ext4" },
      } as System.Device;
      mockDeviceModel = {
        ...mockDeviceModel,
        filesystem: { default: false, reuse: true },
      };
      installerRender(<FormattableDeviceForm />);
      expect(screen.getByLabelText("File system")).toHaveTextContent("Current");
    });
  });

  describe("validation", () => {
    it("shows error when mount point is empty", async () => {
      const { user } = installerRender(<FormattableDeviceForm />);
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await screen.findByText(/Mount point is required/);
      expect(mockSetFilesystem).not.toHaveBeenCalled();
    });

    it("shows error when the mount point is already assigned to another device", async () => {
      const { user } = installerRender(<FormattableDeviceForm />);
      await user.type(screen.getByLabelText("Mount point"), "/data");
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await screen.findByText(/already assigned to another device/);
      expect(mockSetFilesystem).not.toHaveBeenCalled();
    });

    it("shows error for an invalid filesystem label", async () => {
      const { user } = installerRender(<FormattableDeviceForm />);
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.click(screen.getByLabelText(/Define more file system settings/));
      await user.type(screen.getByLabelText(/Label.*optional/i), "bad label");
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await screen.findByText(/Invalid label format/);
      expect(mockSetFilesystem).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("shows server error when the mutation fails", async () => {
      mockSetFilesystem.mockImplementation(() => {
        throw new Error("Failed to set the filesystem");
      });
      const { user } = installerRender(<FormattableDeviceForm />);
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await screen.findByText("Failed to set the filesystem");
    });
  });
});
