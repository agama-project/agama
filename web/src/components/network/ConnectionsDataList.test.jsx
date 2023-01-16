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
import { screen } from "@testing-library/react";
import { plainRender } from "@/test-utils";

import { ConnectionTypes } from "@client/network";
import ConnectionsDataList from "@components/network/ConnectionsDataList";

jest.mock("@client");

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

const conns = [wiredConnection, wiFiConnection];

describe("ConnectionsDataList", () => {
  describe("when no connections are given", () => {
    it("renders nothing", () => {
      const { container } = plainRender(<ConnectionsDataList conns={[]} />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("when a list of connections are given", () => {
    it("renders a list with the name and the IPv4 addresses of each connection", () => {
      plainRender(<ConnectionsDataList conns={conns} />);

      screen.getByText("Wired 1");
      screen.getByText("WiFi 1");
      screen.getByText("192.168.122.20/24");
      screen.getByText("192.168.69.200/24");
    });
  });

  describe("when the user clicks on a connection", () => {
    it("calls the onSelect function", async () => {
      const onSelect = jest.fn();
      const { user } = plainRender(<ConnectionsDataList conns={conns} onSelect={onSelect} />);
      const connection = screen.getByRole("button", { name: "WiFi 1" });
      await user.click(connection);
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "wifi-1" }));
    });
  });
});
