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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import DriveEditor from "~/components/storage/DriveEditor";
import type { Storage as System } from "~/model/system";
import type { ConfigModel } from "~/model/storage/config-model";

jest.mock("~/components/storage/DeviceEditorContent", () => () => (
  <div data-testid="device-editor-content" />
));

const mockDriveModel = jest.fn();
const mockConfigModel = jest.fn();
const mockDeleteDrive = jest.fn();
const mockAddVolumeGroupFromPartitionable = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useDrive: () => mockDriveModel(),
  useConfigModel: () => mockConfigModel(),
  useAddDriveFromMdRaid: jest.fn(),
  useAddMdRaidFromDrive: jest.fn(),
  useDeleteDrive: () => mockDeleteDrive,
  useAddVolumeGroupFromPartitionable: () => mockAddVolumeGroupFromPartitionable,
}));

const mockSystemDevice = jest.fn();
const mockAvailableDevices = jest.fn();

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useDevice: () => mockSystemDevice(),
  useAvailableDevices: () => mockAvailableDevices(),
}));

const drive1Model: ConfigModel.Drive = {
  name: "sda",
  spacePolicy: "custom",
  partitions: [],
};

const drive2Model: ConfigModel.Drive = {
  name: "sdb",
  spacePolicy: "keep",
};

const sda: System.Device = {
  sid: 1,
  name: "sda",
  class: "drive",
  drive: {
    type: "disk",
  },
};

describe("DriveEditor", () => {
  beforeEach(() => {
    mockAvailableDevices.mockReturnValue([sda]);
    mockConfigModel.mockReturnValue({
      drives: [drive1Model, drive2Model],
      mdRaids: [],
    });
  });

  it("should render null if device is not found", () => {
    mockDriveModel.mockReturnValue(drive1Model);
    mockSystemDevice.mockReturnValue(undefined);

    const { container } = installerRender(<DriveEditor index={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("should render the editor for the given drive", () => {
    mockDriveModel.mockReturnValue(drive1Model);
    mockSystemDevice.mockReturnValue(sda);

    installerRender(<DriveEditor index={0} />);

    expect(screen.getByText(/sda/)).toBeInTheDocument();
    expect(screen.getByTestId("device-editor-content")).toBeInTheDocument();
  });

  it("should call delete drive when 'Do not use' is clicked", async () => {
    mockDriveModel.mockReturnValue(drive1Model);
    mockSystemDevice.mockReturnValue(sda);

    const { user } = installerRender(<DriveEditor index={0} />);

    // The component uses a custom toggle, we need to get the button by its content
    const toggleButton = screen.getByText(/sda/).closest("button");
    expect(toggleButton).toBeInTheDocument();
    await user.click(toggleButton!);

    const deleteButton = screen.getByText("Do not use");
    await user.click(deleteButton);

    expect(mockDeleteDrive).toHaveBeenCalledWith(0);
  });
});
