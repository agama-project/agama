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
import { screen } from "@testing-library/react";
import { installerRender, mockParams } from "~/test-utils";
import BindingSettingsForm from "./BindingSettingsForm";
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

let mockConnection: Connection = new Connection("Network 1", {
  state: ConnectionState.activated,
});

const mockMutation = jest.fn(() => Promise.resolve());

jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>ProductRegistrationAlert Mock</div>
));

jest.mock("~/hooks/network/system", () => ({
  ...jest.requireActual("~/hooks/network/system"),
  useDevices: () => [mockDevice],
}));

jest.mock("~/hooks/network/proposal", () => ({
  ...jest.requireActual("~/hooks/network/proposal"),
  useConnection: () => mockConnection,
}));

jest.mock("~/hooks/network/config", () => ({
  ...jest.requireActual("~/hooks/network/config"),
  useConnectionMutation: () => ({ mutateAsync: mockMutation }),
}));

const getOptions = () => {
  const unbound = screen.getByRole("radio", { name: "Unbound" });
  const byName = screen.getByRole("radio", { name: "Bind to device name" });
  const byMac = screen.getByRole("radio", { name: "Bind to MAC address" });

  return { unbound, byName, byMac };
};

describe("BindingSettingsForm", () => {
  beforeEach(() => {
    mockParams(mockConnection.id);
  });

  it("offers multiple binding options and disables unselected device selectors", async () => {
    const { user } = installerRender(<BindingSettingsForm />);
    const { unbound, byName, byMac } = getOptions();
    const devicesByName = screen.getByRole("combobox", { name: "Choose device to bind by name" });
    const devicesByMac = screen.getByRole("combobox", { name: "Choose device to bind by MAC" });

    await user.click(unbound);
    expect(devicesByName).toBeDisabled();
    expect(devicesByMac).toBeDisabled();

    await user.click(byName);
    expect(devicesByName).toBeEnabled();
    expect(devicesByMac).toBeDisabled();

    await user.click(byMac);
    expect(devicesByName).toBeDisabled();
    expect(devicesByMac).toBeEnabled();
  });

  it("allows configuring the connection as unbound", async () => {
    const { user } = installerRender(<BindingSettingsForm />);
    const { unbound } = getOptions();
    const acceptButton = screen.getByRole("button", { name: "Accept" });

    await user.click(unbound);
    await user.click(acceptButton);

    // Sadly, expect.objectContaining does not match properties set to
    // undefined
    // expect.objectContaining({ iface: undefined, macAddress: undefined }),
    const expected = { ...mockConnection, iface: undefined, macAddress: undefined };
    expect(mockMutation).toHaveBeenCalledWith(expected);
  });

  it("supports binding the connection to a specific device name", async () => {
    const { user } = installerRender(<BindingSettingsForm />);
    const { byName } = getOptions();
    const acceptButton = screen.getByRole("button", { name: "Accept" });

    await user.click(byName);
    await user.click(acceptButton);

    const expected = { ...mockConnection, iface: mockDevice.name, macAddress: undefined };
    expect(mockMutation).toHaveBeenCalledWith(expected);
  });

  it("supports binding the connection to a specific MAC address", async () => {
    const { user } = installerRender(<BindingSettingsForm />);
    const { byMac } = getOptions();
    const acceptButton = screen.getByRole("button", { name: "Accept" });

    await user.click(byMac);
    await user.click(acceptButton);

    const expected = { ...mockConnection, iface: undefined, macAddress: mockDevice.macAddress };
    expect(mockMutation).toHaveBeenCalledWith(expected);
  });

  describe("when the connection is unbound", () => {
    it("sets 'none' (unbound) mode by default", () => {
      installerRender(<BindingSettingsForm />);
      const { unbound, byName, byMac } = getOptions();

      expect(unbound).toBeChecked();
      expect(byName).not.toBeChecked();
      expect(byMac).not.toBeChecked();
    });
  });

  describe("when the connection is bound by device name", () => {
    beforeEach(() => {
      mockConnection = new Connection("Network 1", {
        state: ConnectionState.activated,
        iface: "enp1s0",
      });
    });

    it("sets 'iface' mode by default", () => {
      installerRender(<BindingSettingsForm />);
      const { unbound, byName, byMac } = getOptions();

      expect(unbound).not.toBeChecked();
      expect(byName).toBeChecked();
      expect(byMac).not.toBeChecked();
    });
  });

  describe("when connection is bound MAC address", () => {
    beforeEach(() => {
      mockConnection = new Connection("Network 1", {
        state: ConnectionState.activated,
        macAddress: "52:54:00:46:2A:F9",
      });
    });

    it("sets 'mac' mode  default", () => {
      installerRender(<BindingSettingsForm />);
      const { unbound, byName, byMac } = getOptions();

      expect(unbound).not.toBeChecked();
      expect(byName).not.toBeChecked();
      expect(byMac).toBeChecked();
    });
  });
});
