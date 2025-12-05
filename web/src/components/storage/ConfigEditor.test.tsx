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

const mockUseModel = jest.fn();
jest.mock("~/hooks/storage/model", () => ({
  ...jest.requireActual("~/hooks/storage/model"),
  useModel: () => mockUseModel(),
}));

const mockReset = jest.fn();
jest.mock("~/hooks/api/config/storage", () => ({
  ...jest.requireActual("~/hooks/api/config/storage"),
  useReset: () => mockReset,
}));

jest.mock("./DriveEditor", () => () => <div>drive editor</div>);
jest.mock("./MdRaidEditor", () => () => <div>raid editor</div>);
jest.mock("./VolumeGroupEditor", () => () => <div>volume group editor</div>);
jest.mock("./ConfigureDeviceMenu", () => () => <div>add device</div>);

const modelWithDrives = {
  drives: [{ name: "/dev/vda" }],
  mdRaids: [],
  volumeGroups: [],
};

const modelWithVolumeGroups = {
  drives: [],
  mdRaids: [],
  volumeGroups: [{ vgName: "/dev/system" }],
};

const modelWithBoth = {
  drives: [{ name: "/dev/vda" }],
  mdRaids: [],
  volumeGroups: [{ vgName: "/dev/system" }],
};

const modelWithNothing = {
  drives: [],
  mdRaids: [],
  volumeGroups: [],
};

const modelWithMdRaids = {
  drives: [],
  mdRaids: [{ name: "/dev/md0" }],
  volumeGroups: [],
};

beforeEach(() => {
  mockReset.mockClear();
});

describe("when no drive is used for installation", () => {
  beforeEach(() => {
    mockUseModel.mockReturnValue(modelWithVolumeGroups);
  });

  it("does not render the drive editor", () => {
    plainRender(<ConfigEditor />);
    expect(screen.queryByText("drive editor")).not.toBeInTheDocument();
  });
});

describe("when a drive is used for installation", () => {
  beforeEach(() => {
    mockUseModel.mockReturnValue(modelWithDrives);
  });

  it("renders the drive editor", () => {
    plainRender(<ConfigEditor />);
    expect(screen.queryByText("drive editor")).toBeInTheDocument();
  });
});

describe("when no volume group is used for installation", () => {
  beforeEach(() => {
    mockUseModel.mockReturnValue(modelWithDrives);
  });

  it("does not render the volume group editor", () => {
    plainRender(<ConfigEditor />);
    expect(screen.queryByText("volume group editor")).not.toBeInTheDocument();
  });
});

describe("when a volume group is used for installation", () => {
  beforeEach(() => {
    mockUseModel.mockReturnValue(modelWithVolumeGroups);
  });

  it("renders the volume group editor", () => {
    plainRender(<ConfigEditor />);
    expect(screen.queryByText("volume group editor")).toBeInTheDocument();
  });
});

describe("when an MD RAID is used for installation", () => {
  beforeEach(() => {
    mockUseModel.mockReturnValue(modelWithMdRaids);
  });

  it("renders the MD RAID editor", () => {
    plainRender(<ConfigEditor />);
    expect(screen.queryByText("raid editor")).toBeInTheDocument();
  });
});

describe("when both a drive and volume group are used for installation", () => {
  beforeEach(() => {
    mockUseModel.mockReturnValue(modelWithBoth);
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
    mockUseModel.mockReturnValue(modelWithNothing);
  });

  it("renders a no configuration alert with a button for resetting to default", () => {
    plainRender(<ConfigEditor />);
    screen.getByText("Custom alert:");
    screen.getByText("No devices configured yet");
    screen.getByRole("button", { name: "reset to defaults" });
  });

  it("calls reset when the reset button is clicked", () => {
    plainRender(<ConfigEditor />);
    const resetButton = screen.getByRole("button", { name: "reset to defaults" });
    resetButton.click();
    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});
