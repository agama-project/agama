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
import { installerRender, mockNavigateFn } from "~/test-utils";
import TargetsTable from "./TargetsTable";

const mockUseSystemFn = jest.fn();
const mockUseConfigFn = jest.fn();
const mockRemoveTargetFn = jest.fn();

const testingTargets = [
  {
    name: "iqn.2023-01.com.example:12ac588",
    address: "192.168.100.102",
    port: 3262,
    interface: "default",
    startup: "onboot",
    connected: true,
    locked: false,
  },
  {
    name: "iqn.2023-01.com.example:12ac788",
    address: "192.168.100.106",
    port: 3264,
    interface: "default",
    startup: "manual",
    connected: false,
    locked: false,
  },
  {
    name: "iqn.2023-01.com.example:locked",
    address: "192.168.100.108",
    port: 3260,
    interface: "default",
    startup: "onboot",
    connected: true,
    locked: true,
  },
];

jest.mock("~/hooks/model/system/iscsi", () => ({
  ...jest.requireActual("~/hooks/model/system/iscsi"),
  useSystem: () => mockUseSystemFn(),
}));

jest.mock("~/hooks/model/config/iscsi", () => ({
  ...jest.requireActual("~/hooks/model/config/iscsi"),
  useConfig: () => mockUseConfigFn(),
  useRemoveTarget: () => mockRemoveTargetFn,
}));

// Needed by withL10n
jest.mock("~/hooks/model/system", () => ({
  useSystem: () => ({
    l10n: {
      keymap: "us",
      timezone: "Europe/Berlin",
      locale: "en_US",
    },
  }),
}));

describe("TargetsTable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("when no targets are available", () => {
    beforeEach(() => {
      mockUseSystemFn.mockReturnValue({ targets: [] });
      mockUseConfigFn.mockReturnValue({ targets: [] });
    });

    it("displays empty state with 'No targets available' message", () => {
      installerRender(<TargetsTable />);

      screen.getByText("No targets available");
      screen.getByText("No targets have been discovered or configured.");
      screen.getByText("Perform a discovery to find available iSCSI targets.");
    });

    it("does not display the clear filters button", () => {
      installerRender(<TargetsTable />);

      expect(screen.queryByRole("button", { name: "Clear all filters" })).toBeNull();
    });
  });

  describe("when targets are available", () => {
    beforeEach(() => {
      mockUseSystemFn.mockReturnValue({ targets: testingTargets });
      mockUseConfigFn.mockReturnValue({ targets: testingTargets });
    });

    it("renders the targets table with all targets", () => {
      installerRender(<TargetsTable />);

      screen.getByText("iqn.2023-01.com.example:12ac588");
      screen.getByText("iqn.2023-01.com.example:12ac788");
      screen.getByText("iqn.2023-01.com.example:locked");
    });

    it("displays all column headers", () => {
      installerRender(<TargetsTable />);

      const table = screen.getByRole("grid");
      const headerRow = within(table).getAllByRole("row")[0];
      within(headerRow).getByRole("columnheader", { name: "Name" });
      within(headerRow).getByRole("columnheader", { name: "Portal" });
      within(headerRow).getByRole("columnheader", { name: "Interface" });
      within(headerRow).getByRole("columnheader", { name: "Startup" });
      within(headerRow).getByRole("columnheader", { name: "Status" });
    });

    it("displays portal information correctly", () => {
      installerRender(<TargetsTable />);

      screen.getByText("192.168.100.102:");
      screen.getByText("3262");
      screen.getByText("192.168.100.106:");
      screen.getByText("3264");
    });

    it("displays correct status for connected target", () => {
      installerRender(<TargetsTable />);

      const rows = screen.getAllByRole("row");
      const connectedRow = rows.find((row) =>
        within(row).queryByText("iqn.2023-01.com.example:12ac588"),
      );

      within(connectedRow).getByText("Connected");
    });

    it("displays correct status for disconnected target", () => {
      installerRender(<TargetsTable />);

      const rows = screen.getAllByRole("row");
      const disconnectedRow = rows.find((row) =>
        within(row).queryByText("iqn.2023-01.com.example:12ac788"),
      );

      within(disconnectedRow).getByText("Disconnected");
    });

    it("displays correct status for locked target", () => {
      installerRender(<TargetsTable />);

      const rows = screen.getAllByRole("row");
      const lockedRow = rows.find((row) =>
        within(row).queryByText("iqn.2023-01.com.example:locked"),
      );

      within(lockedRow).getByText("Connected and locked");
    });

    it("displays helper text for locked targets", () => {
      installerRender(<TargetsTable />);

      screen.getByText("Locked targets cannot be managed from here and do not offer any actions.");
    });
  });

  describe("filtering", () => {
    beforeEach(() => {
      mockUseSystemFn.mockReturnValue({ targets: testingTargets });
      mockUseConfigFn.mockReturnValue({ targets: testingTargets });
    });

    it("filters targets by name", async () => {
      const { user } = installerRender(<TargetsTable />);

      const nameFilter = screen.getByLabelText("Name");
      await user.type(nameFilter, "12ac588");

      screen.getByText("iqn.2023-01.com.example:12ac588");
      expect(screen.queryByText("iqn.2023-01.com.example:12ac788")).toBeNull();
      expect(screen.queryByText("iqn.2023-01.com.example:locked")).toBeNull();
    });

    it("filters targets by portal", async () => {
      const { user } = installerRender(<TargetsTable />);

      const portalFilter = screen.getByLabelText("Portal");
      await user.type(portalFilter, "192.168.100.106");

      screen.getByText("iqn.2023-01.com.example:12ac788");
      expect(screen.queryByText("iqn.2023-01.com.example:12ac588")).toBeNull();
      expect(screen.queryByText("iqn.2023-01.com.example:locked")).toBeNull();
    });

    it("displays empty state when filters match no results", async () => {
      const { user } = installerRender(<TargetsTable />);

      const nameFilter = screen.getByLabelText("Name");
      await user.type(nameFilter, "nonexistent");

      screen.getByText("No targets matches filters");
      screen.getByText("Change filters and try again.");
      screen.getByRole("button", { name: "Clear all filters" });
    });

    it("clears filters when 'Clear all filters' button is clicked", async () => {
      const { user } = installerRender(<TargetsTable />);

      const nameFilter = screen.getByLabelText("Name");
      await user.type(nameFilter, "nonexistent");

      screen.getByText("No targets matches filters");

      const clearButton = screen.getByRole("button", { name: "Clear all filters" });
      await user.click(clearButton);

      screen.getByText("iqn.2023-01.com.example:12ac588");
      screen.getByText("iqn.2023-01.com.example:12ac788");
      expect(screen.queryByText("No targets matches filters")).toBeNull();
    });
  });

  describe("status filtering", () => {
    beforeEach(() => {
      mockUseSystemFn.mockReturnValue({ targets: testingTargets });
      mockUseConfigFn.mockReturnValue({ targets: testingTargets });
    });

    it("filters connected targets", async () => {
      const { user } = installerRender(<TargetsTable />);

      const statusFilterToggle = screen.getByRole("button", { name: "Status filter toggle" });
      await user.click(statusFilterToggle);
      const statusOptions = screen.getByRole("listbox");
      const connectedOption = within(statusOptions).getByRole("option", { name: "Connected" });
      await user.click(connectedOption);

      screen.getByText("iqn.2023-01.com.example:12ac588");
      screen.getByText("iqn.2023-01.com.example:locked");
      expect(screen.queryByText("iqn.2023-01.com.example:12ac788")).toBeNull();
    });

    it("filters disconnected targets", async () => {
      const { user } = installerRender(<TargetsTable />);

      const statusFilterToggle = screen.getByRole("button", { name: "Status filter toggle" });
      await user.click(statusFilterToggle);
      const statusOptions = screen.getByRole("listbox");
      const discconectedOption = within(statusOptions).getByRole("option", {
        name: "Disconnected",
      });
      await user.click(discconectedOption);

      screen.getByText("iqn.2023-01.com.example:12ac788");
      expect(screen.queryByText("iqn.2023-01.com.example:12ac588")).toBeNull();
      expect(screen.queryByText("iqn.2023-01.com.example:locked")).toBeNull();
    });

    it("filters connected and locked targets", async () => {
      const { user } = installerRender(<TargetsTable />);

      const statusFilterToggle = screen.getByRole("button", { name: "Status filter toggle" });
      await user.click(statusFilterToggle);
      const statusOptions = screen.getByRole("listbox");
      const connectedAndLockedOption = within(statusOptions).getByRole("option", {
        name: "Connected and locked",
      });
      await user.click(connectedAndLockedOption);

      screen.getByText("iqn.2023-01.com.example:locked");
      expect(screen.queryByText("iqn.2023-01.com.example:12ac588")).toBeNull();
      expect(screen.queryByText("iqn.2023-01.com.example:12ac788")).toBeNull();
    });
  });

  describe("sorting", () => {
    beforeEach(() => {
      mockUseSystemFn.mockReturnValue({ targets: testingTargets });
      mockUseConfigFn.mockReturnValue({ targets: testingTargets });
    });

    it("sorts targets by name when clicking the Name column header", async () => {
      const { user } = installerRender(<TargetsTable />);

      const table = screen.getByRole("grid");
      const headerRow = within(table).getAllByRole("row")[0];
      const nameHeader = within(headerRow).getByText("Name");
      await user.click(nameHeader);

      const rows = screen.getAllByRole("row");
      const targetNames = rows
        .slice(1) // Skip header row
        .map((row) => within(row).getAllByRole("cell")[0].textContent);

      // Check if sorted (ascending or descending)
      const sorted = [...targetNames].sort();
      const reverseSorted = [...targetNames].sort().reverse();
      const isSorted =
        JSON.stringify(targetNames) === JSON.stringify(sorted) ||
        JSON.stringify(targetNames) === JSON.stringify(reverseSorted);

      expect(isSorted).toBe(true);
    });
  });

  describe("target actions", () => {
    describe("for disconnected targets", () => {
      beforeEach(() => {
        const disconnectedTarget = {
          ...testingTargets[1],
          connected: false,
        };
        mockUseSystemFn.mockReturnValue({ targets: [disconnectedTarget] });
        mockUseConfigFn.mockReturnValue({ targets: [disconnectedTarget] });
      });

      it("shows Connect action", async () => {
        const { user } = installerRender(<TargetsTable />);

        const actionsButton = screen.getByRole("button", { name: /Actions for/i });
        await user.click(actionsButton);

        screen.getByText("Connect");
      });

      it("navigates to login page when Connect is clicked", async () => {
        const { user } = installerRender(<TargetsTable />);

        const actionsButton = screen.getByRole("button", { name: /Actions for/i });
        await user.click(actionsButton);

        const connectAction = screen.getByText("Connect");
        await user.click(connectAction);

        expect(mockNavigateFn).toHaveBeenCalled();
      });
    });

    describe("for connected targets in config", () => {
      beforeEach(() => {
        const connectedTarget = {
          ...testingTargets[0],
          connected: true,
          sources: ["system", "config"],
        };
        mockUseSystemFn.mockReturnValue({ targets: [connectedTarget] });
        mockUseConfigFn.mockReturnValue({ targets: [connectedTarget] });
      });

      it("shows Disconnect action", async () => {
        const { user } = installerRender(<TargetsTable />);

        const actionsButton = screen.getByRole("button", { name: /Actions for/i });
        await user.click(actionsButton);

        screen.getByText("Disconnect");
      });
    });

    describe("for targets that failed to connect", () => {
      beforeEach(() => {
        const failedTarget = {
          ...testingTargets[1],
          connected: false,
          sources: ["system", "config"],
        };
        mockUseSystemFn.mockReturnValue({ targets: [failedTarget] });
        mockUseConfigFn.mockReturnValue({ targets: [failedTarget] });
      });

      it("shows Delete action", async () => {
        const { user } = installerRender(<TargetsTable />);

        const actionsButton = screen.getByRole("button", { name: /Actions for/i });
        await user.click(actionsButton);

        screen.getByText("Delete");
      });

      it("calls removeTarget when Delete is clicked", async () => {
        const { user } = installerRender(<TargetsTable />);

        const actionsButton = screen.getByRole("button", { name: /Actions for/i });
        await user.click(actionsButton);

        const deleteAction = screen.getByText("Delete");
        await user.click(deleteAction);

        expect(mockRemoveTargetFn).toHaveBeenCalledWith(
          "iqn.2023-01.com.example:12ac788",
          "192.168.100.106",
          3264,
        );
      });
    });

    describe("for locked targets", () => {
      beforeEach(() => {
        const lockedTarget = {
          ...testingTargets[2],
          locked: true,
        };
        mockUseSystemFn.mockReturnValue({ targets: [lockedTarget] });
        mockUseConfigFn.mockReturnValue({ targets: [lockedTarget] });
      });

      it("does not show any actions", () => {
        installerRender(<TargetsTable />);

        expect(screen.queryByRole("button", { name: /Actions for/i })).toBeNull();
      });
    });
  });

  describe("action label", () => {
    beforeEach(() => {
      mockUseSystemFn.mockReturnValue({ targets: [testingTargets[0]] });
      mockUseConfigFn.mockReturnValue({ targets: [testingTargets[0]] });
    });

    it("displays target name and portal in action label", () => {
      installerRender(<TargetsTable />);

      screen.getByRole("button", {
        name: /Actions for iqn\.2023-01\.com\.example:12ac588 at portal 192\.168\.100\.102:3262/i,
      });
    });
  });

  describe("target merging", () => {
    it("merges system and config targets correctly", () => {
      const systemTarget = {
        name: "iqn.2023-01.com.example:system",
        address: "192.168.100.100",
        port: 3260,
        interface: "default",
        startup: "onboot",
        connected: true,
        locked: false,
      };

      const configTarget = {
        name: "iqn.2023-01.com.example:config",
        address: "192.168.100.101",
        port: 3261,
        interface: "default",
        startup: "manual",
      };

      mockUseSystemFn.mockReturnValue({ targets: [systemTarget] });
      mockUseConfigFn.mockReturnValue({ targets: [configTarget] });

      installerRender(<TargetsTable />);

      screen.getByText("iqn.2023-01.com.example:system");
      screen.getByText("iqn.2023-01.com.example:config");
    });

    it("prioritizes system data over config data for same target", () => {
      const target = {
        name: "iqn.2023-01.com.example:merged",
        address: "192.168.100.100",
        port: 3260,
        interface: "default",
        startup: "onboot",
      };

      const systemTarget = { ...target, connected: true };
      const configTarget = { ...target, connected: false };

      mockUseSystemFn.mockReturnValue({ targets: [systemTarget] });
      mockUseConfigFn.mockReturnValue({ targets: [configTarget] });

      installerRender(<TargetsTable />);

      const rows = screen.getAllByRole("row");
      const mergedRow = rows.find((row) =>
        within(row).queryByText("iqn.2023-01.com.example:merged"),
      );

      within(mergedRow).getByText("Connected");
    });
  });
});
