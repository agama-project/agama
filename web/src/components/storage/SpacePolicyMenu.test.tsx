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
import type { Storage as System } from "~/model/system";
import type { ConfigModel } from "~/model/storage/config-model";

const mockUseNavigate = jest.fn();

jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockUseNavigate(),
}));

const mockSystemDevice = jest.fn();

jest.mock("~/hooks/model/system/storage", () => ({
  useDevice: () => mockSystemDevice(),
}));

const mockConfigModel = jest.fn();
const mockPartitionable = jest.fn();
const mockSetSpacePolicy = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  useConfigModel: () => mockConfigModel(),
  usePartitionable: () => mockPartitionable(),
  useSetSpacePolicy: () => mockSetSpacePolicy,
}));

const vda: System.Device = {
  sid: 1,
  class: "drive",
  name: "/dev/vda",
  partitions: [{ sid: 10, name: "/dev/vda1" }],
};

const deviceModel: ConfigModel.Drive = {
  name: "/dev/vda",
  spacePolicy: "delete",
};

describe("SpacePolicyMenu", () => {
  beforeEach(() => {
    mockSystemDevice.mockReturnValue(vda);
    mockConfigModel.mockReturnValue({ drives: [deviceModel] });
    mockPartitionable.mockReturnValue(deviceModel);
  });

  it("should render the SpacePolicyMenu with correct initial state", async () => {
    const { user } = installerRender(<SpacePolicyMenu collection="drives" index={0} />);

    const toggleButton = screen.getByRole("button", { name: "All content will be deleted" });
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveAttribute("aria-expanded", "false"); // Initially closed

    await user.click(toggleButton);

    await waitFor(() => {
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByText("Delete current content")).toBeInTheDocument();
    });
  });

  it("should not render the SpacePolicyMenu if existingPartitions is empty", () => {
    mockSystemDevice.mockReturnValue({ ...vda, partitions: [] });
    const { container } = installerRender(<SpacePolicyMenu collection="drives" index={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("should call setSpacePolicy when a non-custom policy is selected", async () => {
    const { user } = installerRender(<SpacePolicyMenu collection="drives" index={0} />);

    const toggleButton = screen.getByRole("button", { name: "All content will be deleted" });
    await user.click(toggleButton);

    await waitFor(() => {
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    });

    const keepPolicyItem = screen.getByRole("menuitem", { name: /Use available space/ });
    await user.click(keepPolicyItem);

    expect(mockSetSpacePolicy).toHaveBeenCalledWith("drives", 0, { type: "keep" });
    expect(mockNavigateFn).not.toHaveBeenCalled();
  });

  it("should navigate to editSpacePolicy when 'Custom' policy is selected", async () => {
    const { user } = installerRender(<SpacePolicyMenu collection="drives" index={0} />);

    const toggleButton = screen.getByRole("button", { name: "All content will be deleted" });
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");

    await user.click(toggleButton);

    await waitFor(() => {
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    });

    const customPolicyItem = screen.getByRole("menuitem", { name: /Custom/ });
    await user.click(customPolicyItem);

    expect(mockNavigateFn).toHaveBeenCalledWith("/storage/drives/0/space-policy/edit");
    expect(mockSetSpacePolicy).not.toHaveBeenCalled();
  });

  it("should mark the current policy as selected", async () => {
    const { user } = installerRender(<SpacePolicyMenu collection="drives" index={0} />);

    const toggleButton = screen.getByRole("button", { name: "All content will be deleted" });
    await user.click(toggleButton);

    await waitFor(() => {
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    });

    const deletePolicyItem = screen.getByRole("menuitem", { name: /Delete/ });
    expect(deletePolicyItem).toHaveClass("pf-m-selected");
  });
});
