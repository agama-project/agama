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
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import DevicesSelector from "./DevicesSelector";
import { ConnectionMethod, ConnectionType, Device, DeviceState } from "~/types/network";

const mockDevice1: Device = {
  name: "enp1s0",
  connection: "Network 1",
  type: ConnectionType.ETHERNET,
  state: DeviceState.CONNECTED,
  addresses: [{ address: "192.168.69.201", prefix: 24 }],
  nameservers: ["192.168.69.100"],
  dnsSearchList: [],
  gateway4: "192.168.69.4",
  gateway6: "192.168.69.6",
  method4: ConnectionMethod.AUTO,
  method6: ConnectionMethod.AUTO,
  macAddress: "AA:11:22:33:44:FF",
  routes4: [],
  routes6: [],
};

const mockDevice2: Device = {
  name: "wlan0",
  connection: "Network 2",
  type: ConnectionType.WIFI,
  state: DeviceState.DISCONNECTED,
  addresses: [{ address: "192.168.1.50", prefix: 24 }],
  nameservers: [],
  dnsSearchList: [],
  gateway4: "192.168.1.1",
  gateway6: "",
  method4: ConnectionMethod.AUTO,
  method6: ConnectionMethod.AUTO,
  macAddress: "52:54:00:46:2A:F9",
  routes4: [],
  routes6: [],
};

const mockUseDevicesFn = jest.fn();

jest.mock("~/hooks/model/system/network", () => ({
  ...jest.requireActual("~/hooks/model/system/network"),
  useDevices: () => mockUseDevicesFn(),
}));

describe("DevicesSelector", () => {
  beforeEach(() => {
    mockUseDevicesFn.mockReturnValue([mockDevice1, mockDevice2]);
  });
  describe("when valueKey is 'name'", () => {
    it("renders options with 'name - macAddress' label form and name as value", () => {
      installerRender(
        <DevicesSelector valueKey="name" aria-label="Choose device to bind by name" />,
      );

      const option1 = screen.getByRole("option", {
        name: `${mockDevice1.name} - ${mockDevice1.macAddress}`,
      });
      const option2 = screen.getByRole("option", {
        name: `${mockDevice2.name} - ${mockDevice2.macAddress}`,
      });

      expect(option1).toHaveValue(mockDevice1.name);
      expect(option2).toHaveValue(mockDevice2.name);
    });

    it("reflects the selected value", () => {
      installerRender(
        <DevicesSelector
          valueKey="name"
          value={mockDevice1.name}
          aria-label="Choose device to bind by name"
        />,
      );

      const select = screen.getByRole("combobox", { name: "Choose device to bind by name" });
      expect(select).toHaveValue(mockDevice1.name);
    });
  });

  describe("when valueKey is 'macAddress'", () => {
    it("renders options with 'macAddress - name' label form and MAC address as value", () => {
      installerRender(
        <DevicesSelector valueKey="macAddress" aria-label="Choose device to bind by MAC" />,
      );

      const option1 = screen.getByRole("option", {
        name: `${mockDevice1.macAddress} - ${mockDevice1.name}`,
      });
      const option2 = screen.getByRole("option", {
        name: `${mockDevice2.macAddress} - ${mockDevice2.name}`,
      });

      expect(option1).toHaveValue(mockDevice1.macAddress);
      expect(option2).toHaveValue(mockDevice2.macAddress);
    });

    it("reflects the selected value", () => {
      installerRender(
        <DevicesSelector
          valueKey="macAddress"
          value={mockDevice1.macAddress}
          aria-label="Choose device to bind by MAC"
        />,
      );

      const select = screen.getByRole("combobox", { name: "Choose device to bind by MAC" });
      expect(select).toHaveValue(mockDevice1.macAddress);
    });
  });

  describe("when disabled", () => {
    it("renders the select as disabled", () => {
      installerRender(
        <DevicesSelector valueKey="name" isDisabled aria-label="Choose device to bind by name" />,
      );

      const select = screen.getByRole("combobox", { name: "Choose device to bind by name" });
      expect(select).toBeDisabled();
    });
  });

  describe("when there are no devices", () => {
    beforeEach(() => {
      mockUseDevicesFn.mockReturnValue([]);
    });

    it("renders an empty select", () => {
      installerRender(
        <DevicesSelector valueKey="name" aria-label="Choose device to bind by name" />,
      );

      const select = screen.getByRole("combobox", { name: "Choose device to bind by name" });
      expect(within(select).queryAllByRole("option")).toHaveLength(0);
    });
  });
});
