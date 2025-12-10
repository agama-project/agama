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
import { installerRender as render } from "~/test-utils";
import DeviceEditorContent from "./DeviceEditorContent";
import { model } from "~/storage";

// Mock dependencies
jest.mock("~/hooks/storage/model", () => ({
  useDevice: jest.fn(),
}));

jest.mock("~/components/storage/UnusedMenu", () => () => <div data-testid="unused-menu" />);

jest.mock("~/components/storage/FilesystemMenu", () => () => <div data-testid="filesystem-menu" />);

jest.mock("~/components/storage/PartitionsSection", () => () => (
  <div data-testid="partitions-section" />
));

jest.mock("~/components/storage/SpacePolicyMenu", () => () => (
  <div data-testid="space-policy-menu" />
));

const useDeviceMock = jest.requireMock("~/hooks/storage/model").useDevice;

const driveModelMock: model.Drive = {
  name: "sda",
  isUsed: true,
  isExplicitBoot: false,
  isAddingPartitions: false,
  isReusingPartitions: false,
  isTargetDevice: false,
  isBoot: false,
  partitions: [],
  getMountPaths: () => [],
  getVolumeGroups: () => [],
  getPartition: () => undefined,
  getConfiguredExistingPartitions: () => [],
  spacePolicy: "custom",
};

describe("DeviceEditorContent", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should render UnusedMenu when device is not used", () => {
    useDeviceMock.mockReturnValue({ ...driveModelMock, isUsed: false });
    render(<DeviceEditorContent collection="drives" index={0} />);
    expect(screen.getByTestId("unused-menu")).toBeInTheDocument();
    expect(screen.queryByTestId("filesystem-menu")).not.toBeInTheDocument();
    expect(screen.queryByTestId("partitions-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("space-policy-menu")).not.toBeInTheDocument();
  });

  it("should render FilesystemMenu when device is used and has a filesystem", () => {
    useDeviceMock.mockReturnValue({
      ...driveModelMock,
      isUsed: true,
      filesystem: {},
    });
    render(<DeviceEditorContent collection="drives" index={0} />);
    expect(screen.queryByTestId("unused-menu")).not.toBeInTheDocument();
    expect(screen.getByTestId("filesystem-menu")).toBeInTheDocument();
    expect(screen.queryByTestId("partitions-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("space-policy-menu")).not.toBeInTheDocument();
  });

  it("should render PartitionsSection and SpacePolicyMenu when device is used and has no filesystem", () => {
    useDeviceMock.mockReturnValue({
      ...driveModelMock,
      isUsed: true,
      filesystem: undefined,
    });
    render(<DeviceEditorContent collection="drives" index={0} />);
    expect(screen.queryByTestId("unused-menu")).not.toBeInTheDocument();
    expect(screen.queryByTestId("filesystem-menu")).not.toBeInTheDocument();
    expect(screen.getByTestId("partitions-section")).toBeInTheDocument();
    expect(screen.getByTestId("space-policy-menu")).toBeInTheDocument();
  });
});
