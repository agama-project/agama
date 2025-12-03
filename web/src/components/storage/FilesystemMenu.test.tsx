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
import { installerRender as render, mockNavigateFn } from "~/test-utils";
import FilesystemMenu from "./FilesystemMenu";
import { model } from "~/storage";
import { STORAGE as PATHS } from "~/routes/paths";
import { generatePath } from "react-router";

// Mock useNavigate
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigateFn,
  generatePath: jest.fn(
    (path, params) => `/generated-path/${path}-${params.collection}-${params.index}`,
  ),
}));

// Mock useDevice hook
const useDeviceMock = jest.fn();
jest.mock("~/hooks/storage/model", () => ({
  useDevice: () => useDeviceMock(),
}));

describe("FilesystemMenu", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should render the toggle button and open the menu on click", async () => {
    const mockDeviceModel: Partial<model.Drive> = {
      isUsed: true,
      filesystem: { type: "btrfs", default: false, snapshots: true },
      mountPath: "/home",
    };
    useDeviceMock.mockReturnValue(mockDeviceModel);

    const { user } = render(<FilesystemMenu collection="drives" index={0} />);

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
    const mockDeviceModel: Partial<model.Drive> = {
      isUsed: true,
      filesystem: { type: "btrfs", default: false, snapshots: true },
      mountPath: "/home",
    };
    useDeviceMock.mockReturnValue(mockDeviceModel);

    const { user } = render(<FilesystemMenu collection="drives" index={0} />);
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
      const mockDeviceModel: Partial<model.Drive> = {
        filesystem: { reuse: true, default: false },
        mountPath: undefined,
      };
      useDeviceMock.mockReturnValue(mockDeviceModel);

      render(<FilesystemMenu collection="drives" index={0} />);
      expect(
        screen.getByRole("button", { name: "The device will be mounted" }),
      ).toBeInTheDocument();
    });

    it("should return 'The device will be formatted' when no mount path and reuse = false", () => {
      const mockDeviceModel: Partial<model.Drive> = {
        filesystem: { reuse: false, default: false },
        mountPath: undefined,
      };
      useDeviceMock.mockReturnValue(mockDeviceModel);

      render(<FilesystemMenu collection="drives" index={0} />);
      expect(
        screen.getByRole("button", { name: "The device will be formatted" }),
      ).toBeInTheDocument();
    });

    it("should return 'The current file system will be mounted at \"/home\"' when mount path and reuse = true", () => {
      const mockDeviceModel: Partial<model.Drive> = {
        filesystem: { reuse: true, default: false },
        mountPath: "/home",
      };
      useDeviceMock.mockReturnValue(mockDeviceModel);

      render(<FilesystemMenu collection="drives" index={0} />);
      expect(
        screen.getByRole("button", { name: 'The current file system will be mounted at "/home"' }),
      ).toBeInTheDocument();
    });

    it("should return 'The device will be formatted as XFS and mounted at \"/var\"' when mount path and reuse = false", () => {
      const mockDeviceModel: Partial<model.Drive> = {
        filesystem: { reuse: false, default: false, type: "xfs" },
        mountPath: "/var",
      };
      useDeviceMock.mockReturnValue(mockDeviceModel);

      render(<FilesystemMenu collection="drives" index={0} />);
      expect(
        screen.getByRole("button", {
          name: 'The device will be formatted as XFS and mounted at "/var"',
        }),
      ).toBeInTheDocument();
    });
  });
});
