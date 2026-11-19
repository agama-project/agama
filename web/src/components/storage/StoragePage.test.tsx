/*
 * Copyright (c) [2022-2026] SUSE LLC
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

/*
 * NOTE: this test is not useful. The StoragePage loads several queries but,
 * perhaps, each nested component should be responsible for loading the
 * information they need.
 */
import React from "react";
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import StoragePage from "~/components/storage/StoragePage";
import type { Storage } from "~/model/proposal";
import type { Issue } from "~/model/issue";

const disk: Storage.Device = {
  sid: 60,
  class: "drive",
  name: "/dev/vda",
  description: "Seagate disk",
  drive: { drivers: ["ahci", "mmcblk"], bus: "IDE" },
  block: { start: 1, size: 1e6, shrinking: { supported: false } },
};

const proposalIssue: Issue = {
  description: "No proposal",
  class: "proposal",
  scope: "storage",
};

const configFixableIssue: Issue = {
  description: "No root",
  class: "configNoRoot",
  scope: "storage",
};

const configUnfixableIssue: Issue = {
  description: "Config error",
  class: "something",
  scope: "storage",
};

const mockUseAvailableDevices = jest.fn();
const mockUseSystemDevice = jest.fn();
const mockUseReset = jest.fn();
const mockUseConfigModel = jest.fn();
const mockUseProposal = jest.fn();
const mockUseIssues = jest.fn();
const mockUseDASDSystem = jest.fn();
const mockUseZFCPSystem = jest.fn();

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useAvailableDevices: () => mockUseAvailableDevices(),
  useDevice: () => mockUseSystemDevice(),
}));

jest.mock("~/hooks/model/config/storage", () => ({
  ...jest.requireActual("~/hooks/model/config/storage"),
  useReset: () => mockUseReset(),
}));

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockUseConfigModel(),
}));

jest.mock("~/hooks/model/proposal/storage", () => ({
  ...jest.requireActual("~/hooks/model/proposal/storage"),
  useProposal: () => mockUseProposal(),
}));

jest.mock("~/hooks/model/issue", () => ({
  ...jest.requireActual("~/hooks/model/issue"),
  useIssues: () => mockUseIssues(),
}));

jest.mock("~/hooks/model/system/dasd", () => ({
  ...jest.requireActual("~/hooks/model/system/dasd"),
  useSystem: () => mockUseDASDSystem(),
}));

jest.mock("~/hooks/model/system/zfcp", () => ({
  ...jest.requireActual("~/hooks/model/system/zfcp"),
  useSystem: () => mockUseZFCPSystem(),
}));

jest.mock("./ProposalFailedInfo", () => ({
  __esModule: true,
  default: () => <div>proposal failed info</div>,
  proposalFailedTitle: () => "proposal failed",
}));
jest.mock("./UnsupportedModelInfo", () => () => <div>unsupported model info</div>);
jest.mock("./FixableConfigInfo", () => ({
  __esModule: true,
  default: () => <div>fixable config info</div>,
  fixableConfigTitle: () => "fixable config",
}));
jest.mock("./ConnectedDevicesMenu", () => () => <div>connected devices menu</div>);
/* The page's own parts, each tested on its own: here only whether they show. */
jest.mock("./storage-page/TopLine", () => ({
  __esModule: true,
  default: () => <p>the configuration</p>,
  TopResult: () => <p>the result line</p>,
}));
jest.mock("./entries-table/EntriesTable", () => () => null);
jest.mock("./storage-page/GlobalActions", () => () => null);

beforeEach(() => {
  mockUseReset.mockReturnValue(jest.fn());
  mockUseIssues.mockReturnValue([]);
  mockUseProposal.mockReturnValue(null);
  mockUseConfigModel.mockReturnValue({ drives: [] });
  mockUseSystemDevice.mockReturnValue(null);
});

const configuration = () => screen.queryByText("the configuration");
const resetButton = () =>
  screen.queryByRole("button", { name: "Reset to the default configuration" });

describe("if there are no devices", () => {
  beforeEach(() => {
    mockUseAvailableDevices.mockReturnValue([]);
  });

  it("says so, with a way to connect iSCSI targets", () => {
    installerRender(<StoragePage />);

    screen.getByText("No devices found");
    screen.getByRole("link", { name: "Connect to iSCSI targets" });
  });

  it("does not show the configuration", () => {
    installerRender(<StoragePage />);

    expect(configuration()).toBeNull();
  });

  it("offers activating zFCP disks only where zFCP is supported", () => {
    mockUseZFCPSystem.mockReturnValue(undefined);
    const { unmount } = installerRender(<StoragePage />);
    expect(screen.queryByRole("link", { name: "Activate zFCP disks" })).toBeNull();
    unmount();

    mockUseZFCPSystem.mockReturnValue({});
    installerRender(<StoragePage />);
    screen.getByRole("link", { name: "Activate zFCP disks" });
  });

  it("offers managing DASD only where DASD is supported", () => {
    mockUseDASDSystem.mockReturnValue(undefined);
    const { unmount } = installerRender(<StoragePage />);
    expect(screen.queryByRole("link", { name: /DASD/ })).toBeNull();
    unmount();

    mockUseDASDSystem.mockReturnValue({});
    installerRender(<StoragePage />);
    screen.getByRole("link", { name: /DASD/ });
  });
});

describe("if there are devices", () => {
  beforeEach(() => {
    mockUseAvailableDevices.mockReturnValue([disk]);
  });

  describe("and the configuration has issues that cannot be fixed here", () => {
    beforeEach(() => {
      mockUseIssues.mockReturnValue([configUnfixableIssue]);
    });

    it("says the settings are invalid, with a way to reset them, instead of the configuration", () => {
      installerRender(<StoragePage />);

      screen.getByText("Invalid storage settings");
      expect(resetButton()).not.toBeNull();
      expect(configuration()).toBeNull();
    });
  });

  describe("and the configuration cannot be read here, nor a layout calculated", () => {
    beforeEach(() => {
      mockUseConfigModel.mockReturnValue(null);
    });

    it("says the settings cannot be modified, with a way to reset them, instead of the configuration", () => {
      installerRender(<StoragePage />);

      screen.getByText("Unable to modify the settings");
      expect(resetButton()).not.toBeNull();
      expect(configuration()).toBeNull();
    });
  });

  describe.each([
    ["a layout was calculated", { actions: [] }, []],
    ["the configuration has issues to fix", null, [configFixableIssue, proposalIssue]],
    ["no layout could be calculated", null, [proposalIssue]],
  ])("and %s", (_, proposal, issues) => {
    beforeEach(() => {
      mockUseProposal.mockReturnValue(proposal);
      mockUseIssues.mockReturnValue(issues);
    });

    it("shows the configuration under the result line", () => {
      installerRender(<StoragePage />);

      expect(configuration()).not.toBeNull();
      screen.getByText("the result line");
      expect(resetButton()).toBeNull();
    });
  });
});
