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
import { omit } from "radashi";

const mockUseSystemFn = jest.fn();
const mockUseConfigFn = jest.fn();
const mockRemoveTargetFn = jest.fn();

const connectedTarget = {
  name: "iqn.2023-01.com.example:connected",
  address: "192.168.100.102",
  port: 3262,
  interface: "default",
  startup: "onboot",
  connected: true,
  locked: false,
};

const disconnectedTarget = {
  name: "iqn.2023-01.com.example:disconnected",
  address: "192.168.100.103",
  port: 3263,
  interface: "default",
  startup: "onboot",
  connected: false,
  locked: false,
};

const failedToConnectTarget = {
  name: "iqn.2023-01.com.example:connection_failed",
  address: "192.168.100.106",
  port: 3264,
  interface: "default",
  startup: "manual",
  connected: false,
  locked: false,
};

const lockedTarget = {
  name: "iqn.2023-01.com.example:locked",
  address: "192.168.100.108",
  port: 3260,
  interface: "default",
  startup: "onboot",
  connected: true,
  locked: true,
};

const missingTarget = {
  name: "iqn.2023-01.com.example:missing",
  address: "192.168.100.118",
  port: 3260,
  interface: "default",
  startup: "onboot",
};

const testingSystemTargets = [
  connectedTarget,
  disconnectedTarget,
  failedToConnectTarget,
  lockedTarget,
];
const testingConfigTargets = [
  omit(connectedTarget, ["connected", "locked"]),
  omit(failedToConnectTarget, ["connected", "locked"]),
  missingTarget,
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
      mockUseSystemFn.mockReturnValue({
        initiator: { ibft: false },
        targets: testingSystemTargets,
      });
      mockUseConfigFn.mockReturnValue({ targets: testingConfigTargets });
    });

    it("renders the targets table with all targets", () => {
      installerRender(<TargetsTable />);

      screen.getByText("iqn.2023-01.com.example:connected");
      screen.getByText("iqn.2023-01.com.example:connection_failed");
      screen.getByText("iqn.2023-01.com.example:disconnected");
      screen.getByText("iqn.2023-01.com.example:locked");
    });

    it("displays all column headers", () => {
      // Without iBFT
      const { rerender } = installerRender(<TargetsTable />);

      const table = screen.getByRole("grid");
      const headerRow = within(table).getAllByRole("row")[0];
      within(headerRow).getByRole("columnheader", { name: "Name" });
      within(headerRow).getByRole("columnheader", { name: "Portal" });
      within(headerRow).getByRole("columnheader", { name: "Interface" });
      within(headerRow).getByRole("columnheader", { name: "Startup" });
      within(headerRow).getByRole("columnheader", { name: "Status" });
      expect(within(headerRow).queryByRole("columnheader", { name: "iBFT" })).toBeNull();

      // With iBFT
      mockUseSystemFn.mockReturnValue({ initiator: { ibft: true }, targets: testingSystemTargets });
      rerender(<TargetsTable />);
      within(headerRow).getByRole("columnheader", { name: "iBFT" });
    });

    it("displays correct status for connected target", () => {
      installerRender(<TargetsTable />);

      const rows = screen.getAllByRole("row");
      const connectedRow = rows.find((row) =>
        within(row).queryByText("iqn.2023-01.com.example:connected"),
      );

      within(connectedRow).getByText("Connected");
    });

    it("displays correct status for disconnected target", () => {
      installerRender(<TargetsTable />);

      const rows = screen.getAllByRole("row");
      const disconnectedRow = rows.find((row) =>
        within(row).queryByText("iqn.2023-01.com.example:disconnected"),
      );

      within(disconnectedRow).getByText("Disconnected");
    });

    it("displays correct status for target with connection failures", () => {
      installerRender(<TargetsTable />);

      const rows = screen.getAllByRole("row");
      const disconnectedRow = rows.find((row) =>
        within(row).queryByText("iqn.2023-01.com.example:connection_failed"),
      );

      within(disconnectedRow).getByText("Connection failed");
    });

    it("displays correct status for missing target", () => {
      installerRender(<TargetsTable />);

      const rows = screen.getAllByRole("row");
      const missingRow = rows.find((row) =>
        within(row).queryByText("iqn.2023-01.com.example:missing"),
      );

      expect(within(missingRow).getByText("Missing")).toBeInTheDocument();
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
      mockUseSystemFn.mockReturnValue({ targets: testingSystemTargets });
      mockUseConfigFn.mockReturnValue({ targets: testingConfigTargets });
    });

    it("filters targets by name", async () => {
      const { user } = installerRender(<TargetsTable />);

      const nameFilter = screen.getByLabelText("Name");
      await user.type(nameFilter, "connected");

      screen.getByText("iqn.2023-01.com.example:connected");
      expect(screen.queryByText("iqn.2023-01.com.example:connection_failed")).toBeNull();
      expect(screen.queryByText("iqn.2023-01.com.example:locked")).toBeNull();
    });

    it("filters targets by portal", async () => {
      const { user } = installerRender(<TargetsTable />);

      const portalFilter = screen.getByLabelText("Portal");
      await user.type(portalFilter, "192.168.100.106");

      screen.getByText("iqn.2023-01.com.example:connection_failed");
      expect(screen.queryByText("iqn.2023-01.com.example:connected")).toBeNull();
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

      screen.getByText("iqn.2023-01.com.example:connected");
      screen.getByText("iqn.2023-01.com.example:connection_failed");
      expect(screen.queryByText("No targets matches filters")).toBeNull();
    });
  });

  describe("status filtering", () => {
    beforeEach(() => {
      mockUseSystemFn.mockReturnValue({ targets: testingSystemTargets });
      mockUseConfigFn.mockReturnValue({ targets: testingConfigTargets });
    });

    it("filters connected targets", async () => {
      const { user } = installerRender(<TargetsTable />);

      const statusFilterToggle = screen.getByRole("button", { name: "Status filter toggle" });
      await user.click(statusFilterToggle);
      const statusOptions = screen.getByRole("listbox");
      const connectedOption = within(statusOptions).getByRole("option", { name: "Connected" });
      await user.click(connectedOption);

      screen.getByText("iqn.2023-01.com.example:connected");
      screen.getByText("iqn.2023-01.com.example:locked");
      expect(screen.queryByText("iqn.2023-01.com.example:connection_failed")).toBeNull();
    });

    it("filters connection failed targets", async () => {
      const { user } = installerRender(<TargetsTable />);

      const statusFilterToggle = screen.getByRole("button", { name: "Status filter toggle" });
      await user.click(statusFilterToggle);
      const statusOptions = screen.getByRole("listbox");
      const connectionFailedOption = within(statusOptions).getByRole("option", {
        name: "Connection failed",
      });
      await user.click(connectionFailedOption);

      screen.getByText("iqn.2023-01.com.example:connection_failed");
      expect(screen.queryByText("iqn.2023-01.com.example:locked")).toBeNull();
      expect(screen.queryByText("iqn.2023-01.com.example:connected")).toBeNull();
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

      screen.getByText("iqn.2023-01.com.example:connection_failed");
      expect(screen.queryByText("iqn.2023-01.com.example:connected")).toBeNull();
      expect(screen.queryByText("iqn.2023-01.com.example:locked")).toBeNull();
    });

    it("filters missing targets", async () => {
      const { user } = installerRender(<TargetsTable />);

      const statusFilterToggle = screen.getByRole("button", { name: "Status filter toggle" });
      await user.click(statusFilterToggle);
      const statusOptions = screen.getByRole("listbox");
      const missingOption = within(statusOptions).getByRole("option", {
        name: "Missing",
      });
      await user.click(missingOption);

      screen.getByText("iqn.2023-01.com.example:missing");
      expect(screen.queryByText("iqn.2023-01.com.example:connected")).toBeNull();
      expect(screen.queryByText("iqn.2023-01.com.example:locked")).toBeNull();
      expect(screen.queryByText("iqn.2023-01.com.example:disconnected")).toBeNull();
      expect(screen.queryByText("iqn.2023-01.com.example:connection_failed")).toBeNull();
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
      expect(screen.queryByText("iqn.2023-01.com.example:connected")).toBeNull();
      expect(screen.queryByText("iqn.2023-01.com.example:connection_failed")).toBeNull();
    });
  });

  describe("sorting", () => {
    beforeEach(() => {
      mockUseSystemFn.mockReturnValue({ targets: testingSystemTargets });
      mockUseConfigFn.mockReturnValue({ targets: testingConfigTargets });
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
          ...testingSystemTargets[1],
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
          ...testingSystemTargets[0],
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
        mockUseSystemFn.mockReturnValue({ targets: [failedToConnectTarget] });
        mockUseConfigFn.mockReturnValue({ targets: [failedToConnectTarget] });
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
          "iqn.2023-01.com.example:connection_failed",
          "192.168.100.106",
          3264,
        );
      });
    });

    describe("for locked targets", () => {
      beforeEach(() => {
        const lockedTarget = {
          ...testingSystemTargets[2],
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

  describe("for missing targets", () => {
    beforeEach(() => {
      mockUseSystemFn.mockReturnValue({ targets: [] });
      mockUseConfigFn.mockReturnValue({ targets: [missingTarget] });
    });

    it("does not show Connect action", async () => {
      const { user } = installerRender(<TargetsTable />);
      const actionsButton = screen.getByRole("button", { name: /Actions for/i });
      await user.click(actionsButton);

      expect(screen.queryByText("Connect")).toBeNull();
    });

    it("shows Delete action", async () => {
      const { user } = installerRender(<TargetsTable />);
      const actionsButton = screen.getByRole("button", { name: /Actions for/i });
      await user.click(actionsButton);

      screen.getByText("Delete");
    });
  });

  describe("action label", () => {
    beforeEach(() => {
      mockUseSystemFn.mockReturnValue({ targets: testingSystemTargets });
      mockUseConfigFn.mockReturnValue({ targets: testingConfigTargets });
    });

    it("displays target name and portal in action label", () => {
      installerRender(<TargetsTable />);

      screen.getByRole("button", {
        name: "Actions for iqn.2023-01.com.example:connection_failed at portal 192.168.100.106:3264",
      });
    });
  });
});
