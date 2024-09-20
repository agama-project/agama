/*
 * Copyright (c) [2023-2024] SUSE LLC
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
import { screen, waitFor, within } from "@testing-library/react";
import { mockNavigateFn, plainRender } from "~/test-utils";
import { Connection, ConnectionMethod, ConnectionType, Device, DeviceState } from "~/types/network";
import ConnectionsTable from "~/components/network/ConnectionsTable";

const mockOnForgetFn = jest.fn();

const enp1s0: Device = {
  name: "enp1s0",
  connection: "enp1s0",
  type: ConnectionType.ETHERNET,
  state: DeviceState.ACTIVATED,
  addresses: [{ address: "192.168.69.200", prefix: 24 }],
  nameservers: ["192.168.69.1"],
  method4: ConnectionMethod.MANUAL,
  method6: ConnectionMethod.AUTO,
  gateway4: "192.168.69.1",
  gateway6: "",
  macAddress: "AA:11:22:33:44::FF",
};

const wlan0: Device = {
  name: "wlan0",
  connection: "WiFi",
  type: ConnectionType.WIFI,
  state: DeviceState.ACTIVATED,
  addresses: [{ address: "192.168.69.201", prefix: 24 }],
  nameservers: ["192.168.69.1"],
  method4: ConnectionMethod.MANUAL,
  method6: ConnectionMethod.AUTO,
  gateway4: "192.168.69.1",
  gateway6: "",
  macAddress: "AA:11:22:33:55::FF",
};

const wiredConnection: Connection = new Connection("enp1s0", {
  iface: "enp1s0",
  addresses: [{ address: "192.168.69.200", prefix: 24 }],
});

const wirelessConnection: Connection = new Connection("WiFi", {
  iface: "wlan0",
  addresses: [{ address: "192.168.69.201", prefix: 24 }],
});

const connections = [wiredConnection, wirelessConnection];
const devices = [enp1s0, wlan0];

describe("ConnectionsTable", () => {
  describe("when there are no connections", () => {
    it("renders nothing", async () => {
      const { container } = plainRender(<ConnectionsTable connections={[]} devices={[]} />);
      await waitFor(() => expect(container).toBeEmptyDOMElement());
    });
  });

  describe("when there are connections", () => {
    it("renders them in a table", () => {
      plainRender(<ConnectionsTable connections={connections} devices={devices} />);
      const table = screen.getByRole("grid");
      within(table).getByText("Name");
      within(table).getByText("IP addresses");
      within(table).getByText("enp1s0");
      within(table).getByText("192.168.69.200/24");
      within(table).getByText("WiFi");
      within(table).getByText("192.168.69.201/24");
    });

    it("renders an actions toggler per connection", async () => {
      plainRender(<ConnectionsTable connections={connections} devices={devices} />);
      screen.getByRole("button", { name: "Actions for connection enp1s0" });
      screen.getByRole("button", { name: "Actions for connection WiFi" });
    });

    it("allows to edit a connection", async () => {
      const { user } = plainRender(
        <ConnectionsTable connections={connections} devices={devices} />,
      );
      const connectionActions = screen.getByRole("button", {
        name: "Actions for connection enp1s0",
      });
      const actionsColumn = connectionActions.parentNode as HTMLElement;
      await user.click(connectionActions);
      const menu = await within(actionsColumn).findByRole("menu");
      const editAction = within(menu).getByRole("menuitem", { name: "Edit connection enp1s0" });
      await user.click(editAction);
      expect(mockNavigateFn).toHaveBeenCalled();
    });

    describe("and onForget callback is given", () => {
      it("allows to forget a connectionn", async () => {
        const { user } = plainRender(
          <ConnectionsTable
            connections={connections}
            devices={devices}
            onForget={mockOnForgetFn}
          />,
        );
        const connectionActions = screen.getByRole("button", {
          name: "Actions for connection enp1s0",
        });
        const actionsColumn = connectionActions.parentNode as HTMLElement;
        await user.click(connectionActions);
        const menu = await within(actionsColumn).findByRole("menu");
        const forgetAction = within(menu).getByRole("menuitem", {
          name: "Forget connection enp1s0",
        });
        await user.click(forgetAction);
        expect(mockOnForgetFn).toHaveBeenCalledWith(wiredConnection);
      });
    });
  });
});
