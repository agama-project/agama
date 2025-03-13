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
import { plainRender } from "~/test-utils";
import ConfigEditor from "~/components/storage/ConfigEditor";
import { StorageDevice } from "~/types/storage";
import * as apiModel from "~/api/storage/types/config-model";

const disk: StorageDevice = {
  sid: 60,
  type: "disk",
  isDrive: true,
  description: "",
  vendor: "Seagate",
  model: "Unknown",
  driver: ["ahci", "mmcblk"],
  bus: "IDE",
  name: "/dev/vda",
  size: 1e6,
};

const mockUseDevices = jest.fn();
jest.mock("~/queries/storage", () => ({
  ...jest.requireActual("~/queries/storage"),
  useDevices: () => mockUseDevices(),
}));

const mockUseConfigModel = jest.fn();
jest.mock("~/queries/storage/config-model", () => ({
  ...jest.requireActual("~/queries/storage/config-model"),
  useConfigModel: () => mockUseConfigModel(),
}));

jest.mock("./DriveEditor", () => () => <div>drive editor</div>);
jest.mock("./VolumeGroupEditor", () => () => <div>volume group editor</div>);

beforeEach(() => {
  mockUseDevices.mockReturnValue([disk]);
});

describe("if no drive is used for installation", () => {
  beforeEach(() => {
    const modelData: apiModel.Config = {};
    mockUseConfigModel.mockReturnValue(modelData);
  });

  it("does not render the drive editor", () => {
    plainRender(<ConfigEditor />);
    expect(screen.queryByText("drive editor")).not.toBeInTheDocument();
  });
});

describe("if a drive is used for installation", () => {
  beforeEach(() => {
    const modelData: apiModel.Config = {
      drives: [{ name: "/dev/vda" }],
    };
    mockUseConfigModel.mockReturnValue(modelData);
  });

  it("renders the drive editor", () => {
    plainRender(<ConfigEditor />);
    expect(screen.queryByText("drive editor")).toBeInTheDocument();
  });
});

describe("if no volume group is used for installation", () => {
  beforeEach(() => {
    const modelData: apiModel.Config = {};
    mockUseConfigModel.mockReturnValue(modelData);
  });

  it("does not render the volume group editor", () => {
    plainRender(<ConfigEditor />);
    expect(screen.queryByText("volume group editor")).not.toBeInTheDocument();
  });
});

describe("if a volume group is used for installation", () => {
  beforeEach(() => {
    const modelData: apiModel.Config = {
      volumeGroups: [{ vgName: "/dev/system" }],
    };
    mockUseConfigModel.mockReturnValue(modelData);
  });

  it("renders the drive editor", () => {
    plainRender(<ConfigEditor />);
    expect(screen.queryByText("volume group editor")).toBeInTheDocument();
  });
});
