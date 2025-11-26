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
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import WiredConnectionDetails from "./WiredConnectionDetails";
import {
  Connection,
  ConnectionMethod,
  ConnectionState,
  ConnectionType,
  Device,
  DeviceState,
} from "~/types/network";

jest.mock("~/components/network/InstallationOnlySwitch", () => () => (
  <div>InstallationOnlySwitch mock</div>
));

const mockDevice: Device = {
  name: "enp1s0",
  connection: "Network #1",
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
const mockAnotherDevice: Device = {
  name: "enp1s1",
  connection: "Network #1",
  type: ConnectionType.ETHERNET,
  state: DeviceState.CONNECTED,
  addresses: [{ address: "192.168.69.101", prefix: 24 }],
  nameservers: ["192.168.69.50"],
  gateway4: "192.168.69.70",
  gateway6: "192.168.69.80",
  method4: ConnectionMethod.AUTO,
  method6: ConnectionMethod.AUTO,
  macAddress: "47:3F:0C:DB:D9:71",
  // FIXME: provice a valid route for testing purpose
  // routes4: ["108.109.107.106"],
  routes4: [],
  routes6: [],
};

const mockConnection: Connection = new Connection("Network #1", {
  state: ConnectionState.activated,
  iface: "enp1s0",
});

let mockNetworkDevices = [mockDevice];
const networkDevices = () => mockNetworkDevices;

jest.mock("~/hooks/network/system", () => ({
  ...jest.requireActual("~/hooks/network/system"),
  useDevices: () => networkDevices(),
}));

describe("WiredConnectionDetails", () => {
  describe("Settings", () => {
    it("renders the connection settings (DCHP)", () => {
      installerRender(<WiredConnectionDetails connection={mockConnection} />);
      const section = screen.getByRole("region", { name: "Settings" });

      within(section).getByText("IPv4 auto");
      within(section).getByText("IPv6 auto");
      // None other settings set
      within(section).queryAllByText("None set");
    });

    it("renders the connection settings (static)", () => {
      installerRender(
        <WiredConnectionDetails
          connection={
            new Connection("Network #1", {
              state: ConnectionState.activated,
              iface: "enp1s0",
              addresses: [{ address: "192.168.0.0", prefix: "24" }, { address: "192.168.20.20" }],
              gateway4: "100.100.100.4",
              gateway6: "200.200.200.6",
              nameservers: ["4.4.4.4"],
            })
          }
        />,
      );

      const section = screen.getByRole("region", { name: "Settings" });
      // IPs
      within(section).getByText("192.168.0.0/24");
      within(section).getByText("192.168.20.20");
      // Gateway 4
      within(section).getByText("100.100.100.4");
      // Gateway 6
      within(section).getByText("200.200.200.6");
      // DNS
      within(section).getByText("4.4.4.4");
    });

    it("renders the switch for making connection available only during installation", () => {
      installerRender(<WiredConnectionDetails connection={mockConnection} />);
      const section = screen.getByRole("region", { name: "Settings" });
      within(section).getByText("InstallationOnlySwitch mock");
    });

    it("renders link for editing connection", () => {
      installerRender(<WiredConnectionDetails connection={mockConnection} />);
      const section = screen.getByRole("region", { name: "Settings" });
      const editLink = within(section).getByRole("link", { name: "Edit connection settings" });
      expect(editLink).toHaveAttribute("href", "/network/connections/Network%20%231/edit");
    });
  });

  describe("Binding settings section", () => {
    it("renders information aobut the binding mode (all)", () => {
      installerRender(<WiredConnectionDetails connection={new Connection("Network #1")} />);
      const section = screen.getByRole("region", { name: "Binding" });
      within(section).getByText("Connection is available to all devices.");
    });

    it("renders information aobut the binding mode (to MAC)", () => {
      installerRender(
        <WiredConnectionDetails
          connection={new Connection("Network #1", { macAddress: "AA:11:22:33:44:FF" })}
        />,
      );
      const section = screen.getByRole("region", { name: "Binding" });
      within(section).getByText("Connection is bound to MAC address AA:11:22:33:44:FF.");
    });

    it("renders information aobut the binding mode (to device)", () => {
      installerRender(
        <WiredConnectionDetails connection={new Connection("Network #1", { iface: "enp1s0" })} />,
      );
      const section = screen.getByRole("region", { name: "Binding" });
      within(section).getByText("Connection is bound to device enp1s0.");
    });

    it("renders a link to for editing binding settings", () => {
      installerRender(<WiredConnectionDetails connection={mockConnection} />);
      const section = screen.getByRole("region", { name: "Binding" });
      const editLink = within(section).getByRole("link", { name: "Edit binding settings" });
      expect(editLink).toHaveAttribute("href", "/network/connections/Network%20%231/binding/edit");
    });
  });

  describe("Connected devices", () => {
    describe("when there is none device connected", () => {
      beforeEach(() => {
        mockNetworkDevices = [];
      });

      it("renders information about no devices using the connection", () => {
        installerRender(<WiredConnectionDetails connection={mockConnection} />);
        const section = screen.getByRole("region", { name: "Connected devices" });
        within(section).getByText("No device is currently using this connection.");
      });
    });

    describe("when there is only one device connected", () => {
      beforeEach(() => {
        mockNetworkDevices = [mockDevice];
      });

      it("renders title in singluar along with device data", () => {
        installerRender(<WiredConnectionDetails connection={mockConnection} />);
        const section = screen.getByRole("region", { name: "Connected device" });
        within(section).getByText("enp1s0");
        within(section).getByText("AA:11:22:33:44::FF");
        within(section).getByText("192.168.69.100");
        within(section).getByText("192.168.69.4");
        within(section).getByText("192.168.69.6");
        within(section).getByText("AA:11:22:33:44::FF");
      });
    });

    describe("when there are multiple devices connected", () => {
      beforeEach(() => {
        mockNetworkDevices = [mockDevice, mockAnotherDevice];
      });

      it("renders title in plurarl and devices data in tabs", async () => {
        const { user } = installerRender(<WiredConnectionDetails connection={mockConnection} />);
        const section = screen.getByRole("region", { name: "Connected devices" });
        const enp1s0DeviceTab = within(section).getByRole("tab", { name: "enp1s0" });
        const enp1s1DeviceTab = within(section).getByRole("tab", { name: "enp1s1" });

        const enp1s0panel = within(section).getByRole("tabpanel", { name: "enp1s0" });
        within(enp1s0panel).getByText("enp1s0");
        within(enp1s0panel).getByText("192.168.69.201/24");
        within(enp1s0panel).getByText("192.168.69.100");
        within(enp1s0panel).getByText("192.168.69.4");
        within(enp1s0panel).getByText("192.168.69.6");
        within(enp1s0panel).getByText("AA:11:22:33:44::FF");

        await user.click(enp1s1DeviceTab);
        const enp1s1panel = within(section).getByRole("tabpanel", { name: "enp1s1" });

        within(enp1s1panel).getByText("enp1s1");
        within(enp1s1panel).getByText("192.168.69.101/24");
        within(enp1s1panel).getByText("192.168.69.70");
        within(enp1s1panel).getByText("192.168.69.80");
        within(enp1s1panel).getByText("47:3F:0C:DB:D9:71");

        await user.click(enp1s0DeviceTab);

        within(enp1s0panel).getByText("enp1s0");
        within(enp1s0panel).getByText("192.168.69.201/24");
        within(enp1s0panel).getByText("192.168.69.100");
        within(enp1s0panel).getByText("192.168.69.4");
        within(enp1s0panel).getByText("192.168.69.6");
        within(enp1s0panel).getByText("AA:11:22:33:44::FF");
      });
    });
  });
});
