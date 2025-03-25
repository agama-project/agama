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
import { apiModel } from "~/api/storage/types";

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

const hasDrives: apiModel.Config = {
  drives: [{ name: "/dev/vda" }],
};

const hasVolumeGroups: apiModel.Config = {
  volumeGroups: [{ vgName: "/dev/system" }],
};

const hasBoth: apiModel.Config = {
  drives: [{ name: "/dev/vda" }],
  volumeGroups: [{ vgName: "/dev/system" }],
};

const hasNothing: apiModel.Config = {};

beforeEach(() => {
  mockUseDevices.mockReturnValue([disk]);
});

describe("when no drive is used for installation", () => {
  beforeEach(() => {
    mockUseConfigModel.mockReturnValue(hasVolumeGroups);
  });

  it("does not render the drive editor", () => {
    plainRender(<ConfigEditor />);
    expect(screen.queryByText("drive editor")).not.toBeInTheDocument();
  });
});

describe("when a drive is used for installation", () => {
  beforeEach(() => {
    mockUseConfigModel.mockReturnValue(hasDrives);
  });

  it("renders the drive editor", () => {
    plainRender(<ConfigEditor />);
    expect(screen.queryByText("drive editor")).toBeInTheDocument();
  });
});

describe("when no volume group is used for installation", () => {
  beforeEach(() => {
    mockUseConfigModel.mockReturnValue(hasDrives);
  });

  it("does not render the volume group editor", () => {
    plainRender(<ConfigEditor />);
    expect(screen.queryByText("volume group editor")).not.toBeInTheDocument();
  });
});

describe("when a volume group is used for installation", () => {
  beforeEach(() => {
    mockUseConfigModel.mockReturnValue(hasVolumeGroups);
  });

  it("renders the volume group editor", () => {
    plainRender(<ConfigEditor />);
    expect(screen.queryByText("volume group editor")).toBeInTheDocument();
  });
});

describe("when both a drive and volume group are used for installation", () => {
  beforeEach(() => {
    mockUseConfigModel.mockReturnValue(hasBoth);
  });

  it("renders a volume group editor followed by drive editor", () => {
    plainRender(<ConfigEditor />);
    const volumeGroupEditor = screen.getByText("volume group editor");
    const driveEditor = screen.getByText("drive editor");

    expect(volumeGroupEditor.compareDocumentPosition(driveEditor)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});

describe("when neither a drive nor volume group are used for installation", () => {
  beforeEach(() => {
    mockUseConfigModel.mockReturnValue(hasNothing);
  });

  it("renders a no configuration alert with a button for resetting to default", () => {
    plainRender(<ConfigEditor />);
    screen.getByText("Custom alert:");
    screen.getByText("No devices configured yet");
    screen.getByRole("button", { name: "resets to default" });
  });
});
