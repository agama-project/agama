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
import { screen } from "@testing-library/react";
import { generatePath } from "react-router";
import { installerRender, mockNavigateFn } from "~/test-utils";
import FilesystemMenu from "./FilesystemMenu";
import { STORAGE as PATHS } from "~/routes/paths";
import type { ConfigModel } from "~/model/storage/config-model";

jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigateFn,
}));

const mockPartitionable = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  usePartitionable: () => mockPartitionable(),
}));

describe("FilesystemMenu", () => {
  it("should render the toggle button and open the menu on click", async () => {
    const deviceModel: ConfigModel.Drive = {
      name: "/dev/vda",
      mountPath: "/home",
      filesystem: { type: "btrfs", default: false, snapshots: true },
    };
    mockPartitionable.mockReturnValue(deviceModel);

    const { user } = installerRender(<FilesystemMenu collection="drives" index={0} />);

    // Test that the toggle button renders with the correct description
    const toggleButton = screen.getByRole("button", {
      name: 'The device will be formatted as Btrfs with snapshots and mounted at "/home"',
    });
    expect(toggleButton).toBeInTheDocument();

    // Open the menu
    await user.click(toggleButton);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });

  it("should navigate to edit filesystem path when 'Edit' is clicked", async () => {
    const deviceModel: ConfigModel.Drive = {
      name: "/dev/vda",
      mountPath: "/home",
      filesystem: { type: "btrfs", default: false, snapshots: true },
    };
    mockPartitionable.mockReturnValue(deviceModel);

    const { user } = installerRender(<FilesystemMenu collection="drives" index={0} />);
    const toggleButton = screen.getByRole("button", {
      name: 'The device will be formatted as Btrfs with snapshots and mounted at "/home"',
    });
    await user.click(toggleButton);

    const editItem = screen.getByText("Edit");
    await user.click(editItem);

    const expectedPath = generatePath(PATHS.formatDevice, { collection: "drives", index: 0 });
    expect(mockNavigateFn).toHaveBeenCalledWith(expectedPath);
  });

  describe("deviceDescription function logic", () => {
    it("should return 'The device will be mounted' when no mount path and reuse = true", () => {
      const deviceModel: ConfigModel.Drive = {
        name: "/dev/vda",
        filesystem: { reuse: true, default: false },
      };
      mockPartitionable.mockReturnValue(deviceModel);

      installerRender(<FilesystemMenu collection="drives" index={0} />);
      expect(
        screen.getByRole("button", { name: "The device will be mounted" }),
      ).toBeInTheDocument();
    });

    it("should return 'The device will be formatted' when no mount path and reuse = false", () => {
      const deviceModel: ConfigModel.Drive = {
        name: "/dev/vda",
        filesystem: { reuse: false, default: false },
      };
      mockPartitionable.mockReturnValue(deviceModel);

      installerRender(<FilesystemMenu collection="drives" index={0} />);
      expect(
        screen.getByRole("button", { name: "The device will be formatted" }),
      ).toBeInTheDocument();
    });

    it("should return 'The current file system will be mounted at \"/home\"' when mount path and reuse = true", () => {
      const deviceModel: ConfigModel.Drive = {
        name: "/dev/vda",
        mountPath: "/home",
        filesystem: { reuse: true, default: false },
      };
      mockPartitionable.mockReturnValue(deviceModel);

      installerRender(<FilesystemMenu collection="drives" index={0} />);
      expect(
        screen.getByRole("button", { name: 'The current file system will be mounted at "/home"' }),
      ).toBeInTheDocument();
    });

    it("should return 'The device will be formatted as XFS and mounted at \"/var\"' when mount path and reuse = false", () => {
      const deviceModel: ConfigModel.Drive = {
        name: "/dev/vda",
        mountPath: "/var",
        filesystem: { reuse: false, default: false, type: "xfs" },
      };
      mockPartitionable.mockReturnValue(deviceModel);

      installerRender(<FilesystemMenu collection="drives" index={0} />);
      expect(
        screen.getByRole("button", {
          name: 'The device will be formatted as XFS and mounted at "/var"',
        }),
      ).toBeInTheDocument();
    });
  });
});
