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
import UnusedMenu from "./UnusedMenu";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";

// Mock useNavigate and generateEncodedPath
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigateFn,
}));

jest.mock("~/utils", () => ({
  ...jest.requireActual("~/utils"),
  generateEncodedPath: jest.fn((path, params) => {
    // Basic mock implementation for testing navigation
    if (path === PATHS.addPartition) {
      return `/add-partition/${params.collection}/${params.index}`;
    }
    if (path === PATHS.formatDevice) {
      return `/format-device/${params.collection}/${params.index}`;
    }
    return `${path}-${params.collection}-${params.index}`;
  }),
}));

describe("UnusedMenu", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should render the toggle button with description", () => {
    render(<UnusedMenu collection="drives" index={0} />);
    expect(screen.getByRole("button", { name: "Not configured yet" })).toBeInTheDocument();
  });

  it("should open the menu when the toggle is clicked", async () => {
    const { user } = render(<UnusedMenu collection="drives" index={0} />);
    const toggleButton = screen.getByRole("button", { name: "Not configured yet" });

    await user.click(toggleButton);

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("Add or use partition")).toBeInTheDocument();
    expect(
      screen.getByText("Format the whole device or mount an existing file system"),
    ).toBeInTheDocument();
  });

  it("should navigate to add partition path when 'Add or use partition' is clicked", async () => {
    const { user } = render(<UnusedMenu collection="drives" index={0} />);
    const toggleButton = screen.getByRole("button", { name: "Not configured yet" });

    await user.click(toggleButton);

    const addPartitionItem = screen.getByText("Add or use partition");
    await user.click(addPartitionItem);

    const expectedPath = generateEncodedPath(PATHS.addPartition, {
      collection: "drives",
      index: 0,
    });
    expect(mockNavigateFn).toHaveBeenCalledWith(expectedPath);
  });

  it("should navigate to format device path when 'Use the disk without partitions' is clicked for drives", async () => {
    const { user } = render(<UnusedMenu collection="drives" index={0} />);
    const toggleButton = screen.getByRole("button", { name: "Not configured yet" });

    await user.click(toggleButton);

    const formatDeviceItem = screen.getByText("Use the disk without partitions");
    await user.click(formatDeviceItem);

    const expectedPath = generateEncodedPath(PATHS.formatDevice, {
      collection: "drives",
      index: 0,
    });
    expect(mockNavigateFn).toHaveBeenCalledWith(expectedPath);
  });

  it("should navigate to format device path when 'Use the RAID without partitions' is clicked for mdRaids", async () => {
    const { user } = render(<UnusedMenu collection="mdRaids" index={1} />);
    const toggleButton = screen.getByRole("button", { name: "Not configured yet" });

    await user.click(toggleButton);

    const formatDeviceItem = screen.getByText("Use the RAID without partitions");
    await user.click(formatDeviceItem);

    const expectedPath = generateEncodedPath(PATHS.formatDevice, {
      collection: "mdRaids",
      index: 1,
    });
    expect(mockNavigateFn).toHaveBeenCalledWith(expectedPath);
  });
});
