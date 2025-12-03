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
import { screen, waitFor } from "@testing-library/react";
import { installerRender, mockNavigateFn } from "~/test-utils";
import SpacePolicyMenu from "./SpacePolicyMenu";
import * as driveUtils from "~/components/storage/utils/drive";
import { generateEncodedPath } from "~/utils";

// Mock hooks
const mockUseSetSpacePolicy = jest.fn();
const mockUseDeviceModel = jest.fn();
const mockUseDevice = jest.fn();
const mockUseNavigate = jest.fn();

jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockUseNavigate(),
}));

jest.mock("~/hooks/storage/space-policy", () => ({
  useSetSpacePolicy: () => mockUseSetSpacePolicy(),
}));

jest.mock("~/hooks/storage/model", () => ({
  useDevice: (collection, index) => mockUseDeviceModel(collection, index),
}));

jest.mock("~/hooks/api/system/storage", () => ({
  useDevice: (name) => mockUseDevice(name),
}));

// Mock utilities
jest.mock("~/components/storage/utils/drive", () => ({
  ...jest.requireActual("~/components/storage/utils/drive"),
  contentActionsSummary: jest.fn(),
  contentActionsDescription: jest.fn(),
  spacePolicyEntry: jest.fn(),
}));

jest.mock("~/utils", () => ({
  ...jest.requireActual("~/utils"),
  generateEncodedPath: jest.fn(),
}));

jest.mock("~/components/storage/utils", () => ({
  SPACE_POLICIES: [
    { id: "do_not_format", label: "Delete current content" },
    { id: "keep_data", label: "Keep existing data" },
    { id: "shrink", label: "Shrink existing partitions" },
    { id: "use_available", label: "Use available space" },
    { id: "custom", label: "Custom" },
    { id: "format", label: "Format" },
  ],
}));

const mockDeviceModel = {
  name: "/dev/sda",
  spacePolicy: { type: "do_not_format" },
};

const mockDevice = {
  name: "/dev/sda",
  partitions: [{ name: "/dev/sda1" }],
};

describe("SpacePolicyMenu", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // jest.useFakeTimers();
    mockUseNavigate.mockReturnValue(mockNavigateFn);
    mockUseSetSpacePolicy.mockReturnValue(jest.fn());
    mockUseDeviceModel.mockReturnValue(mockDeviceModel);
    mockUseDevice.mockReturnValue(mockDevice);
    (driveUtils.contentActionsSummary as jest.Mock).mockReturnValue("Summary text");
    (driveUtils.contentActionsDescription as jest.Mock).mockReturnValue("Description text");
    (driveUtils.spacePolicyEntry as jest.Mock).mockReturnValue({
      id: "do_not_format",
      label: "Do not format",
    });
    (generateEncodedPath as jest.Mock).mockReturnValue("/path/to/edit");
  });

  it("should render the SpacePolicyMenu with correct initial state", async () => {
    const { user } = installerRender(<SpacePolicyMenu collection="drives" index={0} />);

    const toggleButton = screen.getByRole("button", { name: "Summary text" }); // Get the toggle button
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveAttribute("aria-expanded", "false"); // Initially closed

    await user.click(toggleButton); // Click the toggle button

    // Now, wait for the menu to expand. The "Do not format" item should be visible inside the expanded menu.
    await waitFor(() => {
      expect(toggleButton).toHaveAttribute("aria-expanded", "true"); // Check if expanded
      expect(screen.getByText("Delete current content")).toBeInTheDocument(); // Now assert the item visibility
    });
  });

  it("should not render the SpacePolicyMenu if existingPartitions is empty", () => {
    mockUseDevice.mockReturnValue({ ...mockDevice, partitions: [] });
    const { container } = installerRender(<SpacePolicyMenu collection="drives" index={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("should call setSpacePolicy when a non-custom policy is selected", async () => {
    const setSpacePolicyMock = jest.fn();
    mockUseSetSpacePolicy.mockReturnValue(setSpacePolicyMock);

    const { user } = installerRender(<SpacePolicyMenu collection="drives" index={0} />);

    const toggleButton = screen.getByRole("button", { name: "Summary text" });
    await user.click(toggleButton); // Open the menu

    await waitFor(() => {
      expect(toggleButton).toHaveAttribute("aria-expanded", "true"); // Wait for menu to be expanded
    });

    const keepPolicyItem = screen.getByRole("menuitem", { name: /Keep existing data/ });
    await user.click(keepPolicyItem);

    expect(setSpacePolicyMock).toHaveBeenCalledWith("drives", 0, { type: "keep_data" });
    expect(mockNavigateFn).not.toHaveBeenCalled();
  });

  it("should navigate to editSpacePolicy when 'Custom' policy is selected", async () => {
    const { user } = installerRender(<SpacePolicyMenu collection="drives" index={0} />);

    const toggleButton = screen.getByRole("button", { name: "Summary text" }); // ADDED THIS LINE
    expect(toggleButton).toBeInTheDocument(); // ADDED THIS LINE
    expect(toggleButton).toHaveAttribute("aria-expanded", "false"); // ADDED THIS LINE

    await user.click(toggleButton); // Click the toggle button

    // Now, wait for the menu to expand.
    await waitFor(() => {
      expect(toggleButton).toHaveAttribute("aria-expanded", "true"); // Check if expanded
    });

    const customPolicyItem = screen.getByRole("menuitem", { name: /Custom/ });
    await user.click(customPolicyItem);

    expect(mockNavigateFn).toHaveBeenCalledWith("/path/to/edit");
    expect(mockUseSetSpacePolicy()).not.toHaveBeenCalled();
  });

  it("should mark the current policy as selected", async () => {
    (driveUtils.spacePolicyEntry as jest.Mock).mockReturnValue({ id: "format", label: "Format" });

    const { user } = installerRender(<SpacePolicyMenu collection="drives" index={0} />);

    const toggleButton = screen.getByRole("button", { name: "Summary text" });
    await user.click(toggleButton); // Open the menu

    await waitFor(() => {
      expect(toggleButton).toHaveAttribute("aria-expanded", "true"); // Wait for menu to be expanded
    });

    const formatPolicyItem = screen.getByText("Format");
    expect(formatPolicyItem).toHaveClass("pf-v6-u-font-weight-bold");
  });
});
