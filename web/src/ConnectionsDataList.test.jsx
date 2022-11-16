/*
 * Copyright (c) [2022] SUSE LLC
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
import { screen, waitFor } from "@testing-library/react";
import { installerRender } from "./test-utils";
import ConnectionsDataList from "./ConnectionsDataList";
import { ConnectionTypes } from "./client/network";

jest.mock("./client");

const wiredConnection = {
  id: "wired-1",
  name: "Wired 1",
  type: ConnectionTypes.ETHERNET,
  addresses: [{ address: "192.168.122.20", prefix: 24 }]
};
const wiFiConnection = {
  id: "wifi-1",
  name: "WiFi 1",
  type: ConnectionTypes.WIFI,
  addresses: [{ address: "192.168.69.200", prefix: 24 }]
};

let conns = [];

describe("ConnectionsDataList", () => {
  describe("when no connections are given", () => {
    it("renders nothing", async () => {
      const { container } = installerRender(<ConnectionsDataList conns={conns} />, { usingLayout: false });
      await waitFor(() => expect(container).toBeEmptyDOMElement());
    });
  });

  describe("when a list of connections are given", () => {
    beforeEach(() => {
      conns = [wiredConnection, wiFiConnection];
    });

    it("renders a list with the name and the IPv4 addresses of each connection", async () => {
      installerRender(<ConnectionsDataList conns={conns} />, { usingLayout: false });

      await screen.findByText("Wired 1");
      await screen.findByText("WiFi 1");
      await screen.findByText("192.168.122.20/24");
      await screen.findByText("192.168.69.200/24");
    });
  });
});
