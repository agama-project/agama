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
import { installerRender } from "~/test-utils";
import DeviceEditorContent from "~/components/storage/DeviceEditorContent";
import type { ConfigModel } from "~/model/storage/config-model";

jest.mock("~/components/storage/UnusedMenu", () => () => <div data-testid="unused-menu" />);

jest.mock("~/components/storage/FilesystemMenu", () => () => <div data-testid="filesystem-menu" />);

jest.mock("~/components/storage/PartitionsSection", () => () => (
  <div data-testid="partitions-section" />
));

jest.mock("~/components/storage/SpacePolicyMenu", () => () => (
  <div data-testid="space-policy-menu" />
));

const mockConfigModel = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  useConfigModel: () => mockConfigModel(),
}));

const driveWithPartitions: ConfigModel.Drive = {
  name: "sda",
  partitions: [{ mountPath: "/" }],
};

const driveWithFilesystem: ConfigModel.Drive = {
  name: "sdb",
  filesystem: { default: true },
  mountPath: "/boot",
};

const driveUnused: ConfigModel.Drive = {
  name: "sdc",
  partitions: [],
};

const baseConfig: ConfigModel.Config = {
  drives: [driveWithPartitions, driveWithFilesystem, driveUnused],
  mdRaids: [],
};

describe("DeviceEditorContent", () => {
  it("renders UnusedMenu when device is not used", () => {
    mockConfigModel.mockReturnValue(baseConfig);
    installerRender(<DeviceEditorContent collection="drives" index={2} />);
    expect(screen.getByTestId("unused-menu")).toBeInTheDocument();
  });

  it("renders FilesystemMenu when device is used and has a filesystem", () => {
    mockConfigModel.mockReturnValue(baseConfig);
    installerRender(<DeviceEditorContent collection="drives" index={1} />);
    expect(screen.getByTestId("filesystem-menu")).toBeInTheDocument();
    expect(screen.queryByTestId("partitions-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("space-policy-menu")).not.toBeInTheDocument();
  });

  it("renders PartitionsSection and SpacePolicyMenu when device is used and has partitions", () => {
    mockConfigModel.mockReturnValue(baseConfig);
    installerRender(<DeviceEditorContent collection="drives" index={0} />);
    expect(screen.getByTestId("partitions-section")).toBeInTheDocument();
    expect(screen.getByTestId("space-policy-menu")).toBeInTheDocument();
    expect(screen.queryByTestId("filesystem-menu")).not.toBeInTheDocument();
  });
});
