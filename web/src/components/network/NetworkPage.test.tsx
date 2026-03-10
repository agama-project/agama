/*
 * Copyright (c) [2023-2026] SUSE LLC
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
import { installerRender } from "~/test-utils";
import NetworkPage from "~/components/network/NetworkPage";
import { useProgress } from "~/hooks/model/progress";

jest.mock("~/hooks/model/progress", () => ({
  useProgress: jest.fn(),
}));

jest.mock("~/components/network/ConnectionsTable", () => () => <div>ConnectionsTable Mock</div>);

jest.mock("~/components/network/NoPersistentConnectionsAlert", () => () => (
  <div>NoPersistentConnectionsAlert Mock</div>
));

const mockSystem = {
  connections: [],
  devices: [],
  state: {
    connectivity: true,
    copyNetwork: true,
    networkingEnabled: true,
    wirelessEnabled: false,
  },
};

jest.mock("~/hooks/model/system/network", () => ({
  useNetworkChanges: jest.fn(),
  useSystem: () => mockSystem,
}));

jest.mock("~/hooks/model/config/network", () => ({
  useConnections: () => [],
  useConnectionMutation: () => ({ mutateAsync: jest.fn() }),
}));

describe("NetworkPage", () => {
  it("mounts alert for all connections status", () => {
    (useProgress as jest.Mock).mockReturnValue(undefined);
    installerRender(<NetworkPage />);
    expect(screen.queryByText("NoPersistentConnectionsAlert Mock")).toBeInTheDocument();
  });

  it("renders a section for connections", () => {
    (useProgress as jest.Mock).mockReturnValue(undefined);
    installerRender(<NetworkPage />);
    expect(screen.queryByText("ConnectionsTable Mock")).toBeInTheDocument();
  });

  it("shows the progress backdrop when there is an active progress", () => {
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

    installerRender(<NetworkPage />);
    expect(screen.queryByText("Performing some network task")).toBeInTheDocument();
  });
});
