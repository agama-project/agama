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

import { act, screen, waitFor, within } from "@testing-library/react";
import { installerRender } from "./test-utils";
import { createClient } from "./client";

import TargetIpsPopup from "./TargetIpsPopup";

jest.mock("./client");

const conn0 = {
  id: "7a9470b5-aa0e-4e20-b48e-3eee105543e9",
  addresses: [
    { address: "1.2.3.4", prefix: 24 },
    { address: "5.6.7.8", prefix: 16 },
  ],
};

describe("TargetIpsPopup", () => {
  let callbacks;
  const hostname = "example.net";

  beforeEach(() => {
    callbacks = {};
    const listenFn = (event, cb) => { callbacks[event] = cb };
    createClient.mockImplementation(() => {
      return {
        network: {
          listen: listenFn,
          config: () => Promise.resolve({
            connections: [conn0],
            hostname
          }),
        }
      };
    });
  });

  it("lists target IPs in hostname labeled popup", async () => {
    const { user } = installerRender(<TargetIpsPopup />);

    const button = await screen.findByRole("button", { name: /1.2.3.4\/24 \(example.net\)/i });
    await user.click(button);

    const dialog = await screen.findByRole("dialog");

    within(dialog).getByText(/Ip Addresses/);
    within(dialog).getByText("5.6.7.8/16");

    const closeButton = within(dialog).getByRole("button", { name: /Close/i });
    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("updates the IP if the connection changes", async () => {
    installerRender(<TargetIpsPopup />);
    await screen.findByRole("button", { name: /1.2.3.4\/24 \(example.net\)/i });
    const updatedConn = {
      ...conn0,
      addresses: [{ address: "5.6.7.8", prefix: 24 }]
    };

    act(() => {
      callbacks.connectionUpdated(updatedConn);
    });
    await screen.findByRole("button", { name: /5.6.7.8\/24 \(example.net\)/i });
  });

  it("updates the IP if the connection is replaced", async () => {
    installerRender(<TargetIpsPopup />);
    await screen.findByRole("button", { name: /1.2.3.4\/24 \(example.net\)/i });
    const conn1 = {
      ...conn0,
      id: "2f1b1c0d-c835-479d-ae7d-e828bb4a75fa",
      addresses: [{ address: "5.6.7.8", prefix: 24 }]
    };

    act(() => {
      callbacks.connectionAdded(conn1);
      callbacks.connectionRemoved(conn0.id);
    });
    await screen.findByRole("button", { name: /5.6.7.8\/24 \(example.net\)/i });
  });
});
