/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import { installerRender, mockParams } from "~/test-utils";
import { useProgress } from "~/hooks/model/progress";
import { BondMode, Connection, ConnectionState } from "~/types/network";
import ConnectionPage from "~/components/network/ConnectionPage";

jest.mock("~/hooks/model/progress", () => ({
  useProgress: jest.fn(),
}));

const mockConnection: Connection = new Connection("Network 1", {
  state: ConnectionState.ACTIVATED,
});

const mockPort: Connection = new Connection("Port 1", { iface: "eth1" });

const mockBond: Connection = new Connection("Bond 1", {
  iface: "bond0",
  bond: { mode: BondMode.ACTIVE_BACKUP, options: "", ports: [mockPort] },
});

jest.mock("~/components/network/ConnectionDetails", () => ({ controller }) => (
  <div>ConnectionDetails Mock{controller && ` (port of ${controller.id})`}</div>
));

jest.mock("~/components/network/NoPersistentConnectionsAlert", () => () => (
  <div>NoPersistentConnectionsAlert Mock</div>
));

jest.mock("~/hooks/model/proposal/network", () => ({
  useNetworkChanges: jest.fn(),
  // The hook includes the ports nested in bonds and bridges.
  useConnections: () => [mockConnection, mockBond, mockPort],
}));

describe("<ConnectionPage />", () => {
  it("mounts alert for all connections status", () => {
    installerRender(<ConnectionPage />);
    screen.getByText("NoPersistentConnectionsAlert Mock");
  });

  describe("when given connection exists", () => {
    beforeEach(() => {
      mockParams({ id: mockConnection.id });
    });

    it("mounts component for rendering connection details", () => {
      installerRender(<ConnectionPage />);
      screen.getByText("ConnectionDetails Mock");
    });
  });

  describe("when given connection is a port", () => {
    beforeEach(() => {
      mockParams({ id: mockPort.id });
    });

    it("gives its controller to the details", () => {
      installerRender(<ConnectionPage />);
      screen.getByText("ConnectionDetails Mock (port of Bond 1)");
    });
  });

  describe("when given connection does not exist", () => {
    beforeEach(() => {
      mockParams({ id: "fake" });
    });

    it("renders an informative message", () => {
      installerRender(<ConnectionPage />);
      screen.getByText("Connection not found or lost");
    });
  });

  describe("when there is an active progress", () => {
    it("shows the progress backdrop", () => {
      (useProgress as jest.Mock).mockImplementation((scope) =>
        scope === "network"
          ? {
              scope: "network",
              step: "Performing some network task",
              index: 1,
              size: 1,
            }
          : undefined,
      );

      installerRender(<ConnectionPage />);
      expect(screen.queryByText("Performing some network task")).toBeInTheDocument();
    });
  });
});
