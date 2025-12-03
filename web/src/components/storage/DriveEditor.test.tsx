/*
 * Copyright (c) [2024-2025] SUSE LLC
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
import { screen, fireEvent } from "@testing-library/react";

import { installerRender as render } from "~/test-utils";
import DriveEditor from "./DriveEditor";
import { model } from "~/storage";
import { storage as system } from "~/api/system";

// Mock dependencies
jest.mock("~/hooks/storage/model", () => ({
  useDrive: jest.fn(),
  useModel: jest.fn(),
}));

jest.mock("~/hooks/api/system/storage", () => ({
  useDevice: jest.fn(),
  useAvailableDevices: jest.fn(() => []),
}));

jest.mock("~/components/storage/DeviceEditorContent", () => () => (
  <div data-testid="device-editor-content" />
));

const deleteDriveFn = jest.fn();
jest.mock("~/hooks/storage/drive", () => ({
  useDeleteDrive: jest.fn(() => deleteDriveFn),
  useSwitchToDrive: jest.fn(() => jest.fn()),
}));

jest.mock("~/hooks/storage/md-raid", () => ({
  useSwitchToMdRaid: jest.fn(() => jest.fn()),
}));

jest.mock("~/hooks/storage/volume-group", () => ({
  useConvertToVolumeGroup: jest.fn(() => jest.fn()),
}));

const useDriveMock = jest.requireMock("~/hooks/storage/model").useDrive;
const useModelMock = jest.requireMock("~/hooks/storage/model").useModel;
const useDeviceMock = jest.requireMock("~/hooks/api/system/storage").useDevice;

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
  // apiModel.Drive properties
  spacePolicy: "custom",
};

const anotherDriveModelMock: model.Drive = {
  ...driveModelMock,
  name: "sdb",
};

const deviceMock: system.Device = {
  sid: 1,
  name: "sda",
  class: "drive",
  drive: {
    type: "disk",
  },
};

describe("DriveEditor", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should render null if device is not found", () => {
    useDriveMock.mockReturnValue(driveModelMock);
    useDeviceMock.mockReturnValue(undefined);

    const { container } = render(<DriveEditor index={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("should render the editor for the given drive", () => {
    useDriveMock.mockReturnValue(driveModelMock);
    useDeviceMock.mockReturnValue(deviceMock);
    useModelMock.mockReturnValue({
      drives: [driveModelMock, anotherDriveModelMock],
      mdRaids: [],
    });

    render(<DriveEditor index={0} />);

    expect(screen.getByText(/sda/)).toBeInTheDocument();
    expect(screen.getByTestId("device-editor-content")).toBeInTheDocument();
  });

  it("should call delete drive when 'Do not use' is clicked", () => {
    useDriveMock.mockReturnValue(driveModelMock);
    useDeviceMock.mockReturnValue(deviceMock);
    useModelMock.mockReturnValue({
      drives: [driveModelMock, anotherDriveModelMock],
      mdRaids: [],
    });

    render(<DriveEditor index={0} />);

    // The component uses a custom toggle, we need to get the button by its content
    const toggleButton = screen.getByText(/sda/).closest("button");
    expect(toggleButton).toBeInTheDocument();
    fireEvent.click(toggleButton!);

    const deleteButton = screen.getByText("Do not use");
    fireEvent.click(deleteButton);

    expect(deleteDriveFn).toHaveBeenCalledWith("sda");
  });
});
