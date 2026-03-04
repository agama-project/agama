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
import type { ConfigModel } from "~/model/storage/config-model";

const mockUseModel = jest.fn();
const mockUseReset = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockUseModel(),
}));

jest.mock("~/hooks/model/config/storage", () => ({
  ...jest.requireActual("~/hooks/model/config/storage"),
  useReset: () => mockUseReset(),
}));

jest.mock("./DriveEditor", () => () => <div>drive editor</div>);
jest.mock("./MdRaidEditor", () => () => <div>raid editor</div>);
jest.mock("./VolumeGroupEditor", () => () => <div>volume group editor</div>);
jest.mock("./ConfigureDeviceMenu", () => () => <div>add device</div>);

const hasDrives: ConfigModel.Config = {
  drives: [{ name: "/dev/vda" }],
  mdRaids: [],
  volumeGroups: [],
};

const hasVolumeGroups: ConfigModel.Config = {
  drives: [],
  mdRaids: [],
  volumeGroups: [{ vgName: "/dev/system" }],
};

const hasBoth: ConfigModel.Config = {
  drives: [{ name: "/dev/vda" }],
  mdRaids: [],
  volumeGroups: [{ vgName: "/dev/system" }],
};

const hasNothing: ConfigModel.Config = {
  drives: [],
  mdRaids: [],
  volumeGroups: [],
};

describe("when no drive is used for installation", () => {
  beforeEach(() => {
    mockUseModel.mockReturnValue(hasVolumeGroups);
  });

  it("does not render the drive editor", () => {
    plainRender(<ConfigEditor />);
    expect(screen.queryByText("drive editor")).not.toBeInTheDocument();
  });
});

describe("when a drive is used for installation", () => {
  beforeEach(() => {
    mockUseModel.mockReturnValue(hasDrives);
  });

  it("renders the drive editor", () => {
    plainRender(<ConfigEditor />);
    expect(screen.queryByText("drive editor")).toBeInTheDocument();
  });
});

describe("when no volume group is used for installation", () => {
  beforeEach(() => {
    mockUseModel.mockReturnValue(hasDrives);
  });

  it("does not render the volume group editor", () => {
    plainRender(<ConfigEditor />);
    expect(screen.queryByText("volume group editor")).not.toBeInTheDocument();
  });
});

describe("when a volume group is used for installation", () => {
  beforeEach(() => {
    mockUseModel.mockReturnValue(hasVolumeGroups);
  });

  it("renders the volume group editor", () => {
    plainRender(<ConfigEditor />);
    expect(screen.queryByText("volume group editor")).toBeInTheDocument();
  });
});

describe("when both a drive and volume group are used for installation", () => {
  beforeEach(() => {
    mockUseModel.mockReturnValue(hasBoth);
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
    mockUseModel.mockReturnValue(hasNothing);
  });

  it("renders a no configuration alert with a button for resetting to default", () => {
    plainRender(<ConfigEditor />);
    screen.getByText("Custom alert:");
    screen.getByText("No devices configured yet");
    screen.getByRole("button", { name: "reset to defaults" });
  });
});
