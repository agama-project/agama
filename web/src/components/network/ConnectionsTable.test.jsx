/*
 * Copyright (c) [2023] SUSE LLC
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
import { screen, waitFor, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";

import { ConnectionTypes } from "~/client/network";
import ConnectionsTable from "~/components/network/ConnectionsTable";

jest.mock("~/client");

const firstConnection = {
  id: "wifi-1",
  name: "WiFi 1",
  type: ConnectionTypes.WIFI,
  addresses: [{ address: "192.168.69.200", prefix: 24 }]
};

const secondConnection = {
  id: "wifi-2",
  name: "WiFi 2",
  type: ConnectionTypes.WIFI,
  addresses: [{ address: "192.168.69.201", prefix: 24 }]
};

const conns = [firstConnection, secondConnection];

describe("ConnectionsTable", () => {
  describe("when there are no connections", () => {
    it("renders nothing", async () => {
      const { container } = plainRender(<ConnectionsTable connections={[]} />);

      await waitFor(() => expect(container).toBeEmptyDOMElement());
    });
  });

  describe("when there are connections", () => {
    it("renders them in a table", () => {
      plainRender(<ConnectionsTable connections={conns} />);

      const table = screen.getByRole("grid");
      within(table).getByText("Name");
      within(table).getByText("IP addresses");
      within(table).getByText("WiFi 1");
      within(table).getByText("192.168.69.200/24");
      within(table).getByText("WiFi 2");
      within(table).getByText("192.168.69.201/24");
    });

    describe("and the user clicks on the actions toggler", () => {
      it("renders a list of available actions", async () => {
        const { user } = plainRender(<ConnectionsTable connections={conns} />);
        const connectionActions = screen.getByRole("button", { name: "Actions for connection WiFi 1" });
        const actionsColumn = connectionActions.parentNode;
        const menu = await within(actionsColumn).queryByRole("menu");
        expect(menu).toBeNull();
        await user.click(connectionActions);
        await screen.findByRole("menu");
      });

      describe("and then in the Edit action", () => {
        it("triggers the onEdit callback", async () => {
          const onEditFn = jest.fn();
          const { user } = plainRender(<ConnectionsTable connections={conns} onEdit={onEditFn} />);
          const connectionActions = screen.getByRole("button", { name: "Actions for connection WiFi 1" });
          const actionsColumn = connectionActions.parentNode;
          await user.click(connectionActions);
          const menu = await within(actionsColumn).findByRole("menu");
          const editAction = within(menu).getByRole("menuitem", { name: "Edit connection WiFi 1" });
          await user.click(editAction);

          expect(onEditFn).toHaveBeenCalled();
        });
      });
    });
  });
});
