/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
import WiredConnectionsList from "~/components/network/WiredConnectionsList";
import {
  Connection,
  ConnectionMethod,
  ConnectionState,
  ConnectionType,
  Device,
  DeviceState,
} from "~/types/network";

const mockDevice: Device = {
  name: "enp1s0",
  connection: "Network 1",
  type: ConnectionType.ETHERNET,
  state: DeviceState.CONNECTED,
  addresses: [{ address: "192.168.69.201", prefix: 24 }],
  nameservers: ["192.168.69.100"],
  gateway4: "192.168.69.4",
  gateway6: "192.168.69.6",
  method4: ConnectionMethod.AUTO,
  method6: ConnectionMethod.AUTO,
  macAddress: "AA:11:22:33:44::FF",
  routes4: [],
  routes6: [],
};

let mockConnections: Connection[];

jest.mock("~/hooks/model/proposal/network", () => ({
  ...jest.requireActual("~/hooks/model/proposal/network"),
  useConnections: () => mockConnections,
}));

jest.mock("~/hooks/model/system/network", () => ({
  ...jest.requireActual("~/hooks/model/system/network"),
  useDevices: () => [mockDevice],
}));

describe("WiredConnectionsList", () => {
  describe("and the connection is persistent", () => {
    beforeEach(() => {
      mockConnections = [
        new Connection("Newtwork 1", {
          method4: ConnectionMethod.AUTO,
          method6: ConnectionMethod.AUTO,
          state: ConnectionState.activating,
          persistent: true,
        }),
      ];
    });

    it("does not render any hint", () => {
      // @ts-expect-error: you need to specify the aria-label
      installerRender(<WiredConnectionsList />);
      expect(screen.queryByText("Configured for installation only")).toBeNull;
    });
  });

  describe("and the connection is not persistent", () => {
    beforeEach(() => {
      mockConnections = [
        new Connection("Newtwork 1", {
          method4: ConnectionMethod.AUTO,
          method6: ConnectionMethod.AUTO,
          state: ConnectionState.activating,
          persistent: false,
        }),
      ];
    });

    it("renders an installation only hint", () => {
      // @ts-expect-error: you need to specify the aria-label
      installerRender(<WiredConnectionsList />);
      screen.getByText("Configured for installation only");
    });
  });
});
