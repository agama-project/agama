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
import { screen, waitFor } from "@testing-library/react";
import { installerRender, mockParams } from "~/test-utils";
import IpSettingsForm from "~/components/network/IpSettingsForm";
import {
  Connection,
  ConnectionMethod,
  ConnectionType,
  Device,
  DeviceState,
  Wireless,
} from "~/types/network";

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

const mockConnection = new Connection("Network 1", {
  wireless: new Wireless({ ssid: "Network 1" }),
});

const mockMutateAsync = jest.fn().mockResolvedValue({});

jest.mock("~/hooks/model/config/network", () => ({
  useConnectionMutation: () => ({ mutateAsync: mockMutateAsync }),
}));

const mockUseConnection = jest.fn();

jest.mock("~/hooks/model/proposal/network", () => ({
  useConnection: (id: string) => mockUseConnection(id),
}));

jest.mock("~/hooks/model/system/network", () => ({
  useDevices: () => [mockDevice1],
}));

describe("IpSettingsForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("when adding a new connection", () => {
    beforeEach(() => {
      mockParams({ id: "Connection #1" });
      mockUseConnection.mockReturnValue(undefined);
    });

    it("renders with the ID from params", async () => {
      installerRender(<IpSettingsForm />);
      const nameInput = screen.getByLabelText("Name");
      expect(nameInput).toHaveValue("Connection #1");
    });

    it("shows 'New connection' in breadcrumbs", () => {
      installerRender(<IpSettingsForm />);
      screen.getByText("New connection");
    });

    it("allows editing the connection ID", async () => {
      const { user } = installerRender(<IpSettingsForm />);
      const nameInput = screen.getByLabelText("Name");
      await user.clear(nameInput);
      await user.type(nameInput, "My New Connection");
      expect(nameInput).toHaveValue("My New Connection");
      const saveButton = screen.getByRole("button", { name: /save|accept|ok/i });
      await user.click(saveButton);
      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ id: "My New Connection" }),
        );
      });
    });

    it("does not send iface when 'None (unbound)' is selected", async () => {
      const { user } = installerRender(<IpSettingsForm />);
      const select = screen.getByRole("combobox", { name: "Interface" });
      await user.selectOptions(select, "None (unbound)");
      const saveButton = screen.getByRole("button", { name: /save|accept|ok/i });
      await user.click(saveButton);
      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ iface: undefined }));
      });
    });
  });

  describe("when editing an existing wired connection", () => {
    const existingConnection = new Connection("Network 1");

    beforeEach(() => {
      mockParams({ id: "Network 1" });
      mockUseConnection.mockReturnValue(existingConnection);
    });

    it("renders with the existing connection ID", () => {
      installerRender(<IpSettingsForm />);
      const nameInput = screen.getByLabelText("Name");
      expect(nameInput).toHaveValue("Network 1");
    });

    it("shows 'Edit' in breadcrumbs", () => {
      installerRender(<IpSettingsForm />);
      screen.getByText("Edit");
    });

    it("links to the wired connection page in breadcrumbs", () => {
      installerRender(<IpSettingsForm />);
      const breadcrumbLink = screen.getByRole("link", { name: "Network 1" });
      expect(breadcrumbLink).toHaveAttribute("href", "/network/wired_connection/Network%201");
    });
  });

  describe("when editing an existing wireless connection", () => {
    beforeEach(() => {
      mockParams({ id: "Network 1" });
      mockUseConnection.mockReturnValue(mockConnection);
    });

    it("shows 'Edit' in breadcrumbs", () => {
      installerRender(<IpSettingsForm />);
      screen.getByText("Edit");
    });

    it("links to the wifi connection page in breadcrumbs", () => {
      installerRender(<IpSettingsForm />);
      const breadcrumbLink = screen.getByRole("link", { name: "Network 1" });
      expect(breadcrumbLink).toHaveAttribute("href", "/network/wifi_networks/Network%201");
    });
  });
});
