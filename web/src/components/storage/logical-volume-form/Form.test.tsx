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

// Mock scrollTo which is not available in jsdom
Element.prototype.scrollTo = jest.fn();

const mockNavigate = jest.fn();
const mockAddLogicalVolume = jest.fn();
const mockEditLogicalVolume = jest.fn();

const volumeGroupConfig = {
  name: "/dev/system",
  vgName: "system",
  spacePolicy: "keep",
  logicalVolumes: [],
};

const existingLogicalVolume = {
  name: "/dev/system/data",
  description: "5.00 GiB",
  filesystem: { type: "ext4", label: "Data" },
};

const systemVolumeGroup = {
  name: "/dev/system",
  description: "Volume group",
  logicalVolumes: [existingLogicalVolume],
};

let mockVolumeGroup: object | undefined;
let mockAvailableLogicalVolumes: object[];
let mockInitialLogicalVolume: object | null;
let mockVolumeGroupConfig: object | null;

jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
}));

jest.mock("./queries", () => ({
  useVolumeGroupConfig: () => mockVolumeGroupConfig,
  useVolumeGroup: () => mockVolumeGroup,
  useUnusedLogicalVolumes: () => mockAvailableLogicalVolumes,
  useInitialLogicalVolumeConfig: () => mockInitialLogicalVolume,
  useUnusedMountPoints: () => ["/home", "/var", "swap"],
}));

jest.mock("./transformations", () => ({
  ...jest.requireActual("./transformations"),
  useSolvedSizes: () => null,
}));

jest.mock("~/hooks/model/storage/config-model", () => ({
  useConfigModel: () => ({ drives: [], volumeGroups: [] }),
  useAddLogicalVolume: () => mockAddLogicalVolume,
  useEditLogicalVolume: () => mockEditLogicalVolume,
}));

jest.mock("~/hooks/model/system/storage", () => ({
  useVolumeTemplate: (mountPath: string) => {
    if (mountPath === "swap") {
      return {
        minSize: 2 * 1024 * 1024 * 1024,
        fsType: "swap",
        autoSize: false,
        mountPath: "swap",
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
      mountPath: "/home",
      outline: {
        fsTypes: ["xfs", "ext4", "btrfs"],
        sizeRelevantVolumes: [],
        snapshotsAffectSizes: false,
        adjustByRam: false,
      },
    };
  },
}));

// Import the tested component last.
import LogicalVolumeForm from "./Form";

describe("LogicalVolumeForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams({ id: "0" });
    mockVolumeGroupConfig = volumeGroupConfig;
    mockVolumeGroup = systemVolumeGroup;
    mockAvailableLogicalVolumes = [existingLogicalVolume];
    mockInitialLogicalVolume = null;
  });

  describe("when the volume group config is missing", () => {
    it("shows a resource not found message", () => {
      mockVolumeGroupConfig = null;
      installerRender(<LogicalVolumeForm />);
      screen.getByText("Go to storage page");
    });
  });

  describe("when creating a new logical volume on an existing volume group", () => {
    it("renders the mount point, source selector, name and filesystem fields", () => {
      installerRender(<LogicalVolumeForm />);
      screen.getByLabelText("Mount point");
      screen.getByLabelText("Logical volume");
      screen.getByLabelText("Name");
      screen.getByLabelText("File system");
    });
  });

  describe("logical volume name auto-fill", () => {
    it("suggests the name the installer would pick for the mount point", async () => {
      const { user } = installerRender(<LogicalVolumeForm />);
      await user.type(screen.getByLabelText("Mount point"), "/");
      await user.tab();
      expect(screen.getByLabelText("Name")).toHaveValue("root");
    });

    it("derives the name from non-root mount points", async () => {
      const { user } = installerRender(<LogicalVolumeForm />);
      await user.type(screen.getByLabelText("Mount point"), "/var/lib");
      await user.tab();
      expect(screen.getByLabelText("Name")).toHaveValue("var_lib");
    });

    it("stops suggesting once the user edits the name", async () => {
      const { user } = installerRender(<LogicalVolumeForm />);
      const nameInput = screen.getByLabelText("Name");
      await user.type(nameInput, "mydata");
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.tab();
      expect(nameInput).toHaveValue("mydata");
    });
  });

  describe("logical volume selection", () => {
    it("switches filesystem to Current when selecting a logical volume with data", async () => {
      const { user } = installerRender(<LogicalVolumeForm />);
      await user.click(screen.getByLabelText("Logical volume"));
      await user.click(screen.getByRole("option", { name: /data/ }));
      expect(screen.getByLabelText("File system")).toHaveTextContent(/Current/);
    });

    it("switches filesystem back to Default when selecting 'New logical volume'", async () => {
      const { user } = installerRender(<LogicalVolumeForm />);
      await user.click(screen.getByLabelText("Logical volume"));
      await user.click(screen.getByRole("option", { name: /data/ }));
      await user.click(screen.getByLabelText("Logical volume"));
      await user.click(screen.getByRole("option", { name: /New logical volume/ }));
      expect(screen.getByLabelText("File system")).toHaveTextContent(/Default/);
    });

    it("shows data loss notice when the logical volume data cannot be kept", async () => {
      const { user } = installerRender(<LogicalVolumeForm />);
      await user.click(screen.getByLabelText("Logical volume"));
      await user.click(screen.getByRole("option", { name: /data/ }));
      // The reused logical volume holds an Ext4 filesystem, which cannot be
      // kept for swap: the file system is fixed (no dropdown) and the logical
      // volume will be formatted.
      await user.type(screen.getByLabelText("Mount point"), "swap");
      await user.tab();
      await screen.findByText(/will be destroyed when installation begins/);
    });

    it("restores Current when the mount point allows keeping the filesystem again", async () => {
      const { user } = installerRender(<LogicalVolumeForm />);
      await user.click(screen.getByLabelText("Logical volume"));
      await user.click(screen.getByRole("option", { name: /data/ }));
      // The Ext4 filesystem cannot be kept for swap.
      await user.type(screen.getByLabelText("Mount point"), "swap");
      await user.tab();
      await screen.findByText(/will be destroyed/);
      await user.clear(screen.getByLabelText("Mount point"));
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.tab();
      // Ext4 is allowed for /home, so keeping the data becomes possible again.
      expect(screen.getByLabelText("File system")).toHaveTextContent(/Current/);
      expect(screen.queryByText(/will be destroyed/)).not.toBeInTheDocument();
    });

    it("does not show data loss notice while the current filesystem is kept", async () => {
      const { user } = installerRender(<LogicalVolumeForm />);
      await user.click(screen.getByLabelText("Logical volume"));
      await user.click(screen.getByRole("option", { name: /data/ }));
      await user.type(screen.getByLabelText("Mount point"), "/home");
      await user.tab();
      expect(screen.queryByText(/will be destroyed/)).not.toBeInTheDocument();
    });
  });

  describe("when the volume group is new", () => {
    it("does not render the logical volume source field", () => {
      mockVolumeGroup = undefined;
      mockAvailableLogicalVolumes = [];
      installerRender(<LogicalVolumeForm />);
      // Every logical volume is necessarily new, so there is nothing to choose.
      expect(screen.queryByText("Logical volume")).not.toBeInTheDocument();
      expect(screen.queryByText(/New logical volume/)).not.toBeInTheDocument();
    });
  });

  describe("when editing an existing logical volume", () => {
    beforeEach(() => {
      mockInitialLogicalVolume = {
        mountPath: "/home",
        lvName: "home",
        name: undefined,
        filesystem: { type: "xfs", label: "" },
        size: undefined,
      };
    });

    it("submits the edited logical volume", async () => {
      const { user } = installerRender(<LogicalVolumeForm />);
      await user.click(screen.getByRole("button", { name: "Accept" }));

      await waitFor(() => expect(mockEditLogicalVolume).toHaveBeenCalled());
      expect(mockEditLogicalVolume).toHaveBeenCalledWith(0, "/home", expect.any(Object));
    });
  });
});
