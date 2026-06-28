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
import { installerRender, mockParams } from "~/test-utils";
import PartitionForm from "./Form";

// Mock scrollTo which is not available in jsdom
Element.prototype.scrollTo = jest.fn();

const mockNavigate = jest.fn();
const mockAddPartition = jest.fn();
const mockEditPartition = jest.fn();

const mockSystemDevice = {
  name: "/dev/vdd",
  description: "Virtual disk",
  partitions: [
    {
      name: "vdd1",
      description: "10.00 GiB",
      filesystem: { type: "ext4", label: "Data" },
    },
    {
      name: "vdd2",
      description: "20.00 GiB",
      filesystem: { type: "xfs", label: "" },
    },
  ],
};

let mockConfigModel = {
  drives: [],
  volumeGroups: [],
};

let mockPartitionable = {
  name: "/dev/vdd",
  partitions: [],
};

jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
}));

jest.mock("~/hooks/model/storage/config-model", () => ({
  useConfigModel: () => mockConfigModel,
  useMissingMountPaths: () => ["/", "/home", "/var", "swap"],
  usePartitionable: () => mockPartitionable,
  useAddPartition: () => mockAddPartition,
  useEditPartition: () => mockEditPartition,
  useSolvedConfigModel: (config) => {
    // Return a solved model with partition sizes calculated
    if (!config) return mockConfigModel;

    // Find the partition in the config and add solved sizes
    const solvedConfig = JSON.parse(JSON.stringify(config));
    solvedConfig.drives?.forEach((drive) => {
      drive.partitions?.forEach((partition) => {
        if (partition.mountPath && !partition.size) {
          // Add default solved sizes based on mount point
          partition.size = {
            min: 20 * 1024 * 1024 * 1024, // 20 GiB
            max: partition.mountPath === "/" ? 100 * 1024 * 1024 * 1024 : undefined,
          };
        }
      });
    });

    return solvedConfig;
  },
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
      autoSize: mountPath === "/" || mountPath === "/home",
      outline: {
        fsTypes: ["xfs", "ext4", "btrfs"],
        sizeRelevantVolumes: [],
        snapshotsAffectSizes: false,
        adjustByRam: false,
      },
    };
  },
}));

describe("PartitionForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams({ collection: "drives", index: "0" });
    mockPartitionable = {
      name: "/dev/vdd",
      partitions: [],
    };
    mockConfigModel = {
      drives: [mockPartitionable],
      volumeGroups: [],
    };
  });

  describe("when creating a new partition", () => {
    it("renders partition configuration fields", () => {
      installerRender(<PartitionForm />);
      screen.getByLabelText("Mount point");
      screen.getByLabelText("Partition");
      screen.getByLabelText("File system");
      screen.getByLabelText("Size");
    });

    it("shows 'New partition' as default partition option", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.click(screen.getByLabelText("Partition"));
      expect(screen.getByRole("option", { name: /New partition/ })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    it("shows Automatic as default size mode", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.click(screen.getByLabelText("Size"));
      expect(screen.getByRole("option", { name: /^Automatic/ })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    it("shows Default as default filesystem", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.click(screen.getByLabelText("File system"));
      expect(screen.getByRole("option", { name: "Default" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    it("submits with the entered mount point", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() =>
        expect(mockAddPartition).toHaveBeenCalledWith(
          "drives",
          0,
          expect.objectContaining({ mountPath: "/home" }),
        ),
      );
    });

    it("calls addPartition on successful submission", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() => {
        expect(mockAddPartition).toHaveBeenCalledWith(
          "drives",
          0,
          expect.objectContaining({ mountPath: "/home" }),
        );
      });
    });
  });

  describe("mount point field", () => {
    it("accepts mount point input", async () => {
      const { user } = installerRender(<PartitionForm />);
      const input = screen.getByLabelText("Mount point");
      await user.type(input, "/custom");
      expect(input).toHaveValue("/custom");
    });

    it("provides mount point suggestions via datalist", () => {
      installerRender(<PartitionForm />);
      const input = screen.getByLabelText("Mount point");
      const datalistId = input.getAttribute("list");
      expect(datalistId).toBeTruthy();
      const datalist = document.getElementById(datalistId);
      expect(datalist).toBeInTheDocument();
      const options = datalist.querySelectorAll("option");
      const values = Array.from(options).map((opt) => opt.value);
      expect(values).toContain("/");
      expect(values).toContain("/home");
      expect(values).toContain("/var");
      expect(values).toContain("swap");
    });

    it("shows filesystem hint after committing mount point", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.tab();
      await screen.findByText(/XFS.*default file system for/);
    });

    it("updates filesystem hint when mount point changes", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.tab();
      await screen.findByText(/XFS.*default file system for/);
      await user.clear(screen.getByLabelText("Mount point"));
      await user.type(screen.getByLabelText("Mount point"), "/var");
      await user.tab();
      expect(screen.queryByText(/XFS.*default file system for/)).toBeInTheDocument();
    });

    it("shows filesystem as read-only when mount point requires specific filesystem", async () => {
      const { user } = installerRender(<PartitionForm />);
      const input = screen.getByLabelText("Mount point");
      await user.type(input, "swap");
      await user.tab();
      await screen.findByText("Swap");
      expect(screen.queryByRole("button", { name: "File system" })).not.toBeInTheDocument();
    });
  });

  describe("partition selection", () => {
    it("lists available partitions for reuse", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.click(screen.getByLabelText("Partition"));
      screen.getByRole("option", { name: /vdd1/ });
      screen.getByRole("option", { name: /vdd2/ });
    });

    it("switches filesystem to reuse when selecting existing partition with filesystem", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.click(screen.getByLabelText("Partition"));
      await user.click(screen.getByRole("option", { name: /vdd1/ }));
      expect(screen.getByLabelText("File system")).toHaveTextContent(/Current/);
    });

    it("allows setting mount options when reusing partition", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.click(screen.getByLabelText("Partition"));
      await user.click(screen.getByRole("option", { name: /vdd1/ }));
      await user.type(screen.getByLabelText("Mount point"), "/data");
      await user.click(screen.getByLabelText(/Define more file system settings/));
      const mountOptionsInput = screen.getByLabelText(/Mount options.*optional/i);
      await user.type(mountOptionsInput, "rw,noatime");
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() =>
        expect(mockAddPartition).toHaveBeenCalledWith(
          "drives",
          0,
          expect.objectContaining({
            filesystem: expect.objectContaining({
              reuse: true,
              mountOptions: ["rw,noatime"],
            }),
          }),
        ),
      );
    });

    it("restores Current when the mount point allows keeping the filesystem again", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.type(screen.getByLabelText("Mount point"), "swap");
      await user.tab();
      await user.click(screen.getByLabelText("Partition"));
      await user.click(screen.getByRole("option", { name: /vdd1/ }));
      // vdd1 holds an Ext4 filesystem that cannot be kept for swap.
      await screen.findByText(/will be destroyed/);
      await user.clear(screen.getByLabelText("Mount point"));
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.tab();
      // Ext4 is allowed for /home, so keeping the data becomes possible again.
      expect(screen.getByLabelText("File system")).toHaveTextContent(/Current/);
      expect(screen.queryByText(/will be destroyed/)).not.toBeInTheDocument();
    });

    it("does not restore Current when the user deliberately chose to format", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.tab();
      await user.click(screen.getByLabelText("Partition"));
      await user.click(screen.getByRole("option", { name: /vdd1/ }));
      expect(screen.getByLabelText("File system")).toHaveTextContent(/Current/);
      // The user explicitly chooses to format with the default filesystem.
      await user.click(screen.getByLabelText("File system"));
      await user.click(screen.getByRole("option", { name: "Default" }));
      await user.clear(screen.getByLabelText("Mount point"));
      await user.type(screen.getByLabelText("Mount point"), "/var");
      await user.tab();
      expect(screen.getByLabelText("File system")).toHaveTextContent(/Default/);
    });

    it("does not allow to set the label when reusing partition", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.click(screen.getByLabelText("Partition"));
      await user.click(screen.getByRole("option", { name: /vdd1/ }));
      await user.type(screen.getByLabelText("Mount point"), "/data");
      await user.click(screen.getByLabelText(/Define more file system settings/));
      expect(screen.queryByLabelText(/Label.*optional/i)).not.toBeInTheDocument();
    });
  });

  describe("filesystem selection", () => {
    it("shows hint when Default is selected", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.tab();
      screen.getByText(/XFS.*default file system for/);
    });

    it("allows selecting specific filesystem type", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.click(screen.getByLabelText("File system"));
      await user.click(screen.getByRole("option", { name: "Btrfs" }));
      expect(screen.getByLabelText("File system")).toHaveTextContent("Btrfs");
    });

    it("shows filesystem label field when additional settings are enabled", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.click(screen.getByLabelText(/Define more file system settings/));
      screen.getByLabelText(/Label.*optional/i);
    });

    it("shows mount options field when additional settings are enabled", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.click(screen.getByLabelText(/Define more file system settings/));
      screen.getByLabelText(/Mount options.*optional/i);
    });

    it("shows format options field when additional settings are enabled", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.click(screen.getByLabelText(/Define more file system settings/));
      screen.getByLabelText(/Additional format.*optional/i);
    });

    it("submits mkfsOptions when provided", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.type(screen.getByLabelText("Mount point"), "/data");
      await user.click(screen.getByLabelText(/Define more file system settings/));
      const mkfsOptionsInput = screen.getByLabelText(/Additional format.*optional/i);
      await user.type(mkfsOptionsInput, "-O ^64bit");
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() =>
        expect(mockAddPartition).toHaveBeenCalledWith(
          "drives",
          0,
          expect.objectContaining({
            filesystem: expect.objectContaining({
              mkfsExtraArguments: "-O ^64bit",
            }),
          }),
        ),
      );
    });

    it("submits mountOptions when provided", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.type(screen.getByLabelText("Mount point"), "/data");
      await user.click(screen.getByLabelText(/Define more file system settings/));
      const mountOptionsInput = screen.getByLabelText(/Mount options.*optional/i);
      await user.type(mountOptionsInput, "rw,noatime");
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() =>
        expect(mockAddPartition).toHaveBeenCalledWith(
          "drives",
          0,
          expect.objectContaining({
            filesystem: expect.objectContaining({
              mountOptions: ["rw,noatime"],
            }),
          }),
        ),
      );
    });
  });

  describe("size configuration", () => {
    it("shows automatic size hint when mount point is set", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.tab();
      await screen.findByText(/Minimum.*GiB/);
    });

    it("allows setting fixed size", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.click(screen.getByLabelText("Size"));
      await user.click(screen.getByRole("option", { name: /^Fixed/ }));
      await user.type(screen.getByLabelText("Value"), "50 GiB");
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() =>
        expect(mockAddPartition).toHaveBeenCalledWith(
          "drives",
          0,
          expect.objectContaining({
            size: expect.objectContaining({
              min: 50 * 1024 * 1024 * 1024,
              max: 50 * 1024 * 1024 * 1024,
            }),
          }),
        ),
      );
    });

    it("allows setting size range", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.click(screen.getByLabelText("Size"));
      await user.click(screen.getByRole("option", { name: /^Range/ }));
      await user.type(screen.getByLabelText("Minimum"), "20 GiB");
      await user.type(screen.getByLabelText("Maximum"), "100 GiB");
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() =>
        expect(mockAddPartition).toHaveBeenCalledWith(
          "drives",
          0,
          expect.objectContaining({
            size: expect.objectContaining({
              min: 20 * 1024 * 1024 * 1024,
              max: 100 * 1024 * 1024 * 1024,
            }),
          }),
        ),
      );
    });
  });

  describe("validation", () => {
    it("shows error when mount point is empty", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await screen.findByText(/Mount point is required/);
      expect(mockAddPartition).not.toHaveBeenCalled();
    });

    it("shows error for invalid size format", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.click(screen.getByLabelText("Size"));
      await user.click(screen.getByRole("option", { name: /^Fixed/ }));
      await user.type(screen.getByLabelText("Value"), "invalid");
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await screen.findByText(/Invalid format/);
      expect(mockAddPartition).not.toHaveBeenCalled();
    });

    it("shows error when minimum size exceeds maximum in range mode", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.click(screen.getByLabelText("Size"));
      await user.click(screen.getByRole("option", { name: /^Range/ }));
      await user.type(screen.getByLabelText("Minimum"), "100 GiB");
      await user.type(screen.getByLabelText("Maximum"), "50 GiB");
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await screen.findByText(/Must be smaller than maximum size/);
      expect(mockAddPartition).not.toHaveBeenCalled();
    });
  });

  describe("when editing an existing partition", () => {
    beforeEach(() => {
      mockParams({ collection: "drives", index: "0", partitionId: "/home" });
      mockPartitionable = {
        name: "/dev/vdd",
        partitions: [
          {
            mountPath: "/home",
            filesystem: {
              type: "xfs",
              label: "HomeData",
              mkfsExtraArguments: "",
              mountOptions: [],
            },
            size: { min: 50 * 1024 * 1024 * 1024, max: 50 * 1024 * 1024 * 1024, default: false },
          },
        ],
      };
    });

    it("pre-fills form with existing partition values", () => {
      installerRender(<PartitionForm />);
      expect(screen.getByLabelText("Mount point")).toHaveValue("/home");
    });

    it("calls editPartition instead of addPartition on submit", async () => {
      const { user } = installerRender(<PartitionForm />);
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await waitFor(() => {
        expect(mockEditPartition).toHaveBeenCalled();
        expect(mockAddPartition).not.toHaveBeenCalled();
      });
    });
  });

  describe("error handling", () => {
    it("shows server error when mutation fails", async () => {
      mockAddPartition.mockImplementation(() => {
        throw new Error("Failed to add partition");
      });
      const { user } = installerRender(<PartitionForm />);
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.click(screen.getByRole("button", { name: "Accept" }));
      await screen.findByText("Failed to add partition");
    });
  });
});
