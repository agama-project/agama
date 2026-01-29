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
import WiredConnectionPage from "~/components/network/WiredConnectionPage";
import { Connection, ConnectionState } from "~/types/network";

const mockConnection: Connection = new Connection("Network 1", {
  state: ConnectionState.activated,
});

jest.mock("~/components/network/WiredConnectionDetails", () => () => (
  <div>WiredConnectionDetails Mock</div>
));

jest.mock("~/components/network/NoPersistentConnectionsAlert", () => () => (
  <div>NoPersistentConnectionsAlert Mock</div>
));

jest.mock("~/hooks/model/proposal/network", () => ({
  useNetworkChanges: jest.fn(),
  useConnections: () => [mockConnection],
}));

describe("<WiredConnectionPage />", () => {
  it("mounts alert for all connections status", () => {
    installerRender(<WiredConnectionPage />);
    screen.getByText("NoPersistentConnectionsAlert Mock");
  });

  describe("when given connection exists", () => {
    beforeEach(() => {
      mockParams({ id: mockConnection.id });
    });

    it("mounts component for rendering connection details", () => {
      installerRender(<WiredConnectionPage />);
      screen.getByText("WiredConnectionDetails Mock");
    });
  });

  describe("when given connection does not exist", () => {
    beforeEach(() => {
      mockParams({ id: "fake" });
    });

    it("renders an informative message", () => {
      installerRender(<WiredConnectionPage />);
      screen.getByText("Connection not found or lost");
    });
  });
});
