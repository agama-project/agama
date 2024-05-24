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
import { plainRender } from "~/test-utils";

import * as utils from "~/utils";
import { WebSocketError } from "~/components/core";

jest.mock("~/components/core/Sidebar", () => () => <div>Agama sidebar</div>);

describe("WebSocketError", () => {
  it("includes a generic websocket connection problem message", () => {
    plainRender(<WebSocketError />);
    screen.getByText(/Could not connect to the HTTP server/i);
  });

  it("calls location.reload when user clicks on 'Reload'", async () => {
    jest.spyOn(utils, "locationReload").mockImplementation(utils.noop);
    const { user } = plainRender(<WebSocketError />);
    const reloadButton = await screen.findByRole("button", { name: /Reload/i });
    await user.click(reloadButton);
    expect(utils.locationReload).toHaveBeenCalled();
  });
});
