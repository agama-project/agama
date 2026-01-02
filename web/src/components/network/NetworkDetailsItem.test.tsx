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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { NetworkStatus } from "~/hooks/model/system/network";
import NetworkDetailsItem from "./NetworkDetailsItem";

const mockUseNetworkStatusFn = jest.fn();

jest.mock("~/hooks/model/system/network", () => ({
  ...jest.requireActual("~/hooks/model/system/network"),
  useNetworkStatus: () => mockUseNetworkStatusFn(),
}));

describe("NetworkDetailsItem", () => {
  describe("when network status is NOT_CONFIGURED", () => {
    it("renders 'Not configured'", () => {
      mockUseNetworkStatusFn.mockReturnValue({
        status: NetworkStatus.NOT_CONFIGURED,
        persistentConnections: [],
      });
      installerRender(<NetworkDetailsItem />);
      screen.getByText("Not configured");
    });
  });

  describe("when network status is NO_PERSISTENT", () => {
    it("renders 'Installation only' and a short explanation", () => {
      mockUseNetworkStatusFn.mockReturnValue({
        status: NetworkStatus.NO_PERSISTENT,
        persistentConnections: [],
      });
      installerRender(<NetworkDetailsItem />);
      screen.getByText("Installation only");
      screen.getByText("System will have no network connections");
    });
  });

  describe("when network status is AUTO", () => {
    it("renders mode and singular form summary when there is one connection", () => {
      mockUseNetworkStatusFn.mockReturnValue({
        status: NetworkStatus.AUTO,
        persistentConnections: [{ addresses: [] }],
      });
      installerRender(<NetworkDetailsItem />);
      screen.getByText("Auto");
      screen.getByText("Configured with 1 connection");
    });

    it("renders mode and plural form summary when multiple connections", () => {
      mockUseNetworkStatusFn.mockReturnValue({
        status: NetworkStatus.AUTO,
        persistentConnections: [{ addresses: [] }, { addresses: [] }],
      });
      installerRender(<NetworkDetailsItem />);
      screen.getByText("Auto");
      screen.getByText("Configured with 2 connections");
    });
  });

  describe("when network status is MANUAL", () => {
    it("renders mode and single IP for single connection with one address", () => {
      mockUseNetworkStatusFn.mockReturnValue({
        status: NetworkStatus.MANUAL,
        persistentConnections: [{ addresses: [{ address: "192.168.1.100", prefix: 24 }] }],
      });
      installerRender(<NetworkDetailsItem />);
      screen.getByText("Manual");
      screen.getByText("192.168.1.100");
    });

    it("renders mode and all IPs for single connection with two addresses", () => {
      mockUseNetworkStatusFn.mockReturnValue({
        status: NetworkStatus.MANUAL,
        persistentConnections: [
          {
            addresses: [
              { address: "192.168.1.100", prefix: 24 },
              { address: "192.168.1.101", prefix: 24 },
            ],
          },
        ],
      });
      installerRender(<NetworkDetailsItem />);
      screen.getByText("Manual");
      screen.getByText("192.168.1.100 and 192.168.1.101");
    });

    it("renders mode and the first IP and count for single connection with multiple addresses", () => {
      mockUseNetworkStatusFn.mockReturnValue({
        status: NetworkStatus.MANUAL,
        persistentConnections: [
          {
            addresses: [
              { address: "192.168.1.100", prefix: 24 },
              { address: "192.168.1.101", prefix: 24 },
              { address: "192.168.1.102", prefix: 24 },
            ],
          },
        ],
      });
      installerRender(<NetworkDetailsItem />);
      screen.getByText("Manual");
      screen.getByText("192.168.1.100 and 2 others");
    });

    it("renders mode and connection count and IP summary for multiple connections", () => {
      mockUseNetworkStatusFn.mockReturnValue({
        status: NetworkStatus.MANUAL,
        persistentConnections: [
          { addresses: [{ address: "192.168.1.100", prefix: 24 }] },
          { addresses: [{ address: "10.0.0.5", prefix: 8 }] },
        ],
      });
      installerRender(<NetworkDetailsItem />);
      screen.getByText("Manual");
      screen.getByText("Using 2 connections with 192.168.1.100 and 10.0.0.5");
    });

    it("renders mode and connection count with IP summary when multiple connections have more than two IPs", () => {
      mockUseNetworkStatusFn.mockReturnValue({
        status: NetworkStatus.MANUAL,
        persistentConnections: [
          {
            addresses: [
              { address: "192.168.1.100", prefix: 24 },
              { address: "192.168.1.101", prefix: 24 },
            ],
          },
          { addresses: [{ address: "10.0.0.5", prefix: 8 }] },
        ],
      });
      installerRender(<NetworkDetailsItem />);
      screen.getByText("Manual");
      screen.getByText("Using 2 connections with 192.168.1.100 and 2 others");
    });
  });

  describe("when network status is MIXED", () => {
    it("renders mode and 'DHCP' and single IP when there is only one static IP", () => {
      mockUseNetworkStatusFn.mockReturnValue({
        status: NetworkStatus.MIXED,
        persistentConnections: [{ addresses: [{ address: "192.168.1.100", prefix: 24 }] }],
      });
      installerRender(<NetworkDetailsItem />);
      screen.getByText("Auto and manual");
      screen.getByText("DHCP and 192.168.1.100");
    });

    it("renders mode and 'DHCP' with two IPs when there are up to two static IPs", () => {
      mockUseNetworkStatusFn.mockReturnValue({
        status: NetworkStatus.MIXED,
        persistentConnections: [
          {
            addresses: [
              { address: "192.168.1.100", prefix: 24 },
              { address: "192.168.1.101", prefix: 24 },
            ],
          },
        ],
      });
      installerRender(<NetworkDetailsItem />);
      screen.getByText("Auto and manual");
      screen.getByText("DHCP, 192.168.1.100 and 192.168.1.101");
    });

    it("renders mode and 'DHCP' with IP summary  when there are more than two static IPs", () => {
      mockUseNetworkStatusFn.mockReturnValue({
        status: NetworkStatus.MIXED,
        persistentConnections: [
          {
            addresses: [
              { address: "192.168.1.100", prefix: 24 },
              { address: "192.168.1.101", prefix: 24 },
              { address: "192.168.1.102", prefix: 24 },
            ],
          },
        ],
      });
      installerRender(<NetworkDetailsItem />);
      screen.getByText("Auto and manual");
      screen.getByText("DHCP, 192.168.1.100 and 2 others");
    });

    it("renders mode and connection count with 'DHCP' and IP for multiple connections", () => {
      mockUseNetworkStatusFn.mockReturnValue({
        status: NetworkStatus.MIXED,
        persistentConnections: [
          { addresses: [{ address: "192.168.1.100", prefix: 24 }] },
          { addresses: [] },
        ],
      });
      installerRender(<NetworkDetailsItem />);
      screen.getByText("Auto and manual");
      screen.getByText("Using 2 connections with DHCP and 192.168.1.100");
    });

    it("renders mode and connection count with 'DHCP' and IP summary when there are many static IPs", () => {
      mockUseNetworkStatusFn.mockReturnValue({
        status: NetworkStatus.MIXED,
        persistentConnections: [
          {
            addresses: [
              { address: "192.168.1.100", prefix: 24 },
              { address: "192.168.1.101", prefix: 24 },
            ],
          },
          { addresses: [{ address: "10.0.0.5", prefix: 8 }] },
        ],
      });
      installerRender(<NetworkDetailsItem />);
      screen.getByText("Auto and manual");
      screen.getByText("Using 2 connections with DHCP, 192.168.1.100 and 2 others");
    });
  });
});
