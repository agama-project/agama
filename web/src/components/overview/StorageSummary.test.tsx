/*
 * Copyright (c) [2026] SUSE LLC
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
import { screen, within } from "@testing-library/react";
import { installerRender, mockProgresses } from "~/test-utils";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { useFlattenDevices, useAvailableDevices, useDevices } from "~/hooks/model/system/storage";
import {
  useFlattenDevices as useProposalFlattenDevices,
  useActions,
} from "~/hooks/model/proposal/storage";
import { useIssues } from "~/hooks/model/issue";
import { STORAGE } from "~/routes/paths";
import StorageSummary from "./StorageSummary";

const mockUseConfigModelFn: jest.Mock<ReturnType<typeof useConfigModel>> = jest.fn();
const mockUseFlattenDevicesFn: jest.Mock<ReturnType<typeof useFlattenDevices>> = jest.fn();
const mockUseAvailableDevicesFn: jest.Mock<ReturnType<typeof useAvailableDevices>> = jest.fn();
const mockUseDevicesFn: jest.Mock<ReturnType<typeof useDevices>> = jest.fn();
const mockUseProposalFlattenDevicesFn: jest.Mock<ReturnType<typeof useProposalFlattenDevices>> =
  jest.fn();
const mockUseActionsFn: jest.Mock<ReturnType<typeof useActions>> = jest.fn();
const mockUseIssuesFn: jest.Mock<ReturnType<typeof useIssues>> = jest.fn();

// Mock all the hooks
jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockUseConfigModelFn(),
}));

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useFlattenDevices: () => mockUseFlattenDevicesFn(),
  useAvailableDevices: () => mockUseAvailableDevicesFn(),
  useDevices: () => mockUseDevicesFn(),
}));

jest.mock("~/hooks/model/proposal/storage", () => ({
  ...jest.requireActual("~/hooks/model/proposal/storage"),
  useFlattenDevices: () => mockUseProposalFlattenDevicesFn(),
  useActions: () => mockUseActionsFn(),
}));

jest.mock("~/hooks/model/issue", () => ({
  ...jest.requireActual("~/hooks/model/issue"),
  useIssues: () => mockUseIssuesFn(),
}));

// Mock device for tests
const mockDevice = {
  sid: 1,
  name: "/dev/sda",
  size: 500000000000,
  description: "ATA WDC WD5000",
};

// Mock configuration model
const mockModel = {
  drives: [{ name: "/dev/sda" }],
  mdRaids: [],
};

const mockModelMultiDevice = {
  drives: [{ name: "/dev/sda" }, { name: "/dev/sdb" }],
  mdRaids: [],
};

const mockModelWithRaid = {
  drives: [],
  mdRaids: [{ name: "/dev/md0" }],
};

describe("StorageSummary", () => {
  beforeEach(() => {
    mockProgresses([]);
    mockUseConfigModelFn.mockReturnValue(mockModel);
    mockUseAvailableDevicesFn.mockReturnValue([mockDevice]);
    mockUseDevicesFn.mockReturnValue([mockDevice]);
    mockUseFlattenDevicesFn.mockReturnValue([]);
    mockUseProposalFlattenDevicesFn.mockReturnValue([]);
    mockUseActionsFn.mockReturnValue([]);
    mockUseIssuesFn.mockReturnValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders the clickable 'Storage' header", () => {
    installerRender(<StorageSummary />);
    const heading = screen.getByRole("heading");
    const link = within(heading).getByRole("link", { name: "Storage" });
    expect(link).toHaveAttribute("href", expect.stringContaining(STORAGE.root));
  });

  describe("loading state", () => {
    it("shows loading skeleton when there is an storage progress", () => {
      mockProgresses([
        {
          scope: "storage",
          size: 1,
          steps: ["Calculating the storage proposal"],
          step: "Calculating the storage proposal",
          index: 0,
        },
      ]);
      installerRender(<StorageSummary />);
      expect(screen.getByLabelText("Waiting for proposal")).toBeInTheDocument();
    });
  });

  describe("value content - device selection", () => {
    it("shows single device summary when one device is selected", () => {
      installerRender(<StorageSummary />);
      expect(screen.getByText(/Use device/)).toBeInTheDocument();
      expect(screen.getByText("sda")).toBeInTheDocument();
    });

    it("shows 'Use several devices' when multiple devices are selected", () => {
      mockUseConfigModelFn.mockReturnValue(mockModelMultiDevice);
      mockUseDevicesFn.mockReturnValue([mockDevice, { ...mockDevice, name: "/dev/sdb" }]);
      installerRender(<StorageSummary />);
      screen.getByText("Use several devices");
    });

    it("shows 'No device selected yet' when no devices are configured", () => {
      mockUseConfigModelFn.mockReturnValue({ drives: [], mdRaids: [] });
      installerRender(<StorageSummary />);
      screen.getByText("No device selected yet");
    });

    it("shows 'No device selected yet' when configured device does not exist", () => {
      mockUseDevicesFn.mockReturnValue([]);
      installerRender(<StorageSummary />);
      screen.getByText("No device selected yet");
    });

    it("shows RAID device when configured", () => {
      mockUseConfigModelFn.mockReturnValue(mockModelWithRaid);
      mockUseDevicesFn.mockReturnValue([{ sid: 1, name: "/dev/md0" }]);
      installerRender(<StorageSummary />);
      expect(screen.getByText(/Use device/)).toBeInTheDocument();
      expect(screen.getByText("md0")).toBeInTheDocument();
    });

    it("shows no disks available message when no devices exist", () => {
      mockUseAvailableDevicesFn.mockReturnValue([]);
      installerRender(<StorageSummary />);
      screen.getByText("There are no disks available for the installation");
    });

    it("shows invalid settings warning when config issues exist", () => {
      mockUseIssuesFn.mockReturnValue([
        {
          description: "Fake Issue",
          class: "generic",
          details: "Fake Issue details",
          scope: "storage",
        },
      ]);
      installerRender(<StorageSummary />);
      screen.getByText("Invalid settings");
    });

    it("shows advanced configuration message when model is unavailable", () => {
      mockUseConfigModelFn.mockReturnValue(null);
      installerRender(<StorageSummary />);
      screen.getByText("Using an advanced storage configuration");
    });

    it("ignores proposal class issues when checking config validity", () => {
      mockUseIssuesFn.mockReturnValue([
        {
          description: "Fake Issue",
          class: "proposal",
          details: "Fake Issue details",
          scope: "storage",
        },
      ]);
      installerRender(<StorageSummary />);
      // Should show normal device summary, not "Invalid settings"
      expect(screen.getByText(/Use device/)).toBeInTheDocument();
      expect(screen.queryByText("Invalid settings")).not.toBeInTheDocument();
    });
  });

  describe("description content - data loss warnings", () => {
    it("shows 'No data loss is expected' when no delete actions exist", () => {
      mockUseActionsFn.mockReturnValue([{ delete: false, device: 1, text: "Something" }]);
      installerRender(<StorageSummary />);
      screen.getByText("No data loss is expected");
    });

    it("shows 'Potential data loss' when delete actions exist", () => {
      mockUseActionsFn.mockReturnValue([
        { delete: true, device: 1, subvol: false, text: "Something" },
      ]);
      installerRender(<StorageSummary />);
      screen.getByText("Potential data loss");
    });

    it("shows affected systems when delete actions target existing systems", () => {
      const mockFlattenDevice = {
        sid: 1,
        name: "/dev/sda1",
        block: {
          start: 0,
          size: 1000000,
          shrinking: { supported: false },
          systems: ["Windows 11", "openSUSE Tumbleweed"],
        },
      };
      mockUseFlattenDevicesFn.mockReturnValue([mockFlattenDevice]);
      mockUseProposalFlattenDevicesFn.mockReturnValue([mockFlattenDevice]);
      mockUseActionsFn.mockReturnValue([
        { delete: true, device: 1, subvol: false, text: "Something" },
      ]);
      installerRender(<StorageSummary />);
      expect(screen.getByText(/Potential data loss affecting at least/)).toBeInTheDocument();
    });

    it("ignores subvolume delete actions for data loss warning", () => {
      mockUseActionsFn.mockReturnValue([
        { delete: true, device: 1, subvol: true, text: "Something" },
      ]);
      installerRender(<StorageSummary />);
      screen.getByText("No data loss is expected");
    });

    it("shows failure message when no actions are available", () => {
      mockUseActionsFn.mockReturnValue([]);
      installerRender(<StorageSummary />);
      screen.getByText("Failed to calculate a storage layout");
    });

    it("hides description when config issues exist", () => {
      mockUseIssuesFn.mockReturnValue([
        {
          description: "Fake Issue",
          class: "generic",
          details: "Fake Issue details",
          scope: "storage",
        },
      ]);
      mockUseActionsFn.mockReturnValue([
        { delete: true, device: 1, subvol: false, text: "Something" },
      ]);
      installerRender(<StorageSummary />);
      // Should show "Invalid settings" but not data loss warnings
      screen.getByText("Invalid settings");
      expect(screen.queryByText("Potential data loss")).not.toBeInTheDocument();
      expect(screen.queryByText("No data loss is expected")).not.toBeInTheDocument();
    });
  });
});
