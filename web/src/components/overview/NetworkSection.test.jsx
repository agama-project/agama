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
import { act, screen } from "@testing-library/react";
import { installerRender, createCallbackMock } from "~/test-utils";
import { NetworkSection } from "~/components/overview";
import { ConnectionTypes, NetworkEventTypes } from "~/client/network";
import { createClient } from "~/client";

jest.mock("~/client");

jest.mock('~/components/core/SectionSkeleton', () => () => <div>Section Skeleton</div>);

const wiredConnection = {
  id: "Wired 1",
  uuid: "d59200d4-838d-4051-99a0-fde8121a242c",
  type: ConnectionTypes.ETHERNET,
  addresses: [{ address: "192.168.122.20", prefix: 24 }]
};
const wifiConnection = {
  id: "WiFi 1",
  uuid: "0c00dccb-a6ae-40b2-8495-0de721006bc0",
  type: ConnectionTypes.WIFI,
  addresses: [{ address: "192.168.69.200", prefix: 24 }]
};

const setUpFn = jest.fn();
const activeConnectionsFn = jest.fn();
let onNetworkEventFn = jest.fn();

beforeEach(() => {
  setUpFn.mockResolvedValue(true);
  activeConnectionsFn.mockReturnValue([wiredConnection, wifiConnection]);

  // if defined outside, the mock is cleared automatically
  createClient.mockImplementation(() => {
    return {
      network: {
        setUp: setUpFn,
        activeConnections: activeConnectionsFn,
        onNetworkEvent: onNetworkEventFn,
      }
    };
  });
});

describe("when is not ready", () => {
  it("renders an Skeleton", async () => {
    installerRender(<NetworkSection />);
    await screen.findByText("Section Skeleton");
  });
});

describe("when is ready", () => {
  it("renders the number of connections found", async () => {
    installerRender(<NetworkSection />);

    await screen.findByText(/2 connection/i);
  });

  it("renders connections names", async () => {
    installerRender(<NetworkSection />);

    await screen.findByText(/Wired 1/i);
    await screen.findByText(/WiFi 1/i);
  });

  it("renders connections addresses", async () => {
    installerRender(<NetworkSection />);

    await screen.findByText(/192.168.122.20/i);
    await screen.findByText(/192.168.69.200/i);
  });

  describe("but none active connection was found", () => {
    beforeEach(() => activeConnectionsFn.mockReturnValue([]));

    it("renders info about it", async () => {
      installerRender(<NetworkSection />);

      await screen.findByText("No network connections detected");
    });
  });
});

describe("when connection is added", () => {
  it("renders the added connection", async () => {
    const [mockFunction, callbacks] = createCallbackMock();
    onNetworkEventFn = mockFunction;
    installerRender(<NetworkSection />);
    await screen.findByText(/Wired 1/);
    await screen.findByText(/WiFi 1/);

    // add a new connection
    const addedConnection = {
      id: "New Wired Network",
      uuid: "b143c0a6-ee61-49dc-94aa-e62230afc199",
      type: ConnectionTypes.ETHERNET,
      addresses: [{ address: "192.168.168.192", prefix: 24 }]
    };
    activeConnectionsFn.mockReturnValue([wiredConnection, wifiConnection, addedConnection]);

    const [cb] = callbacks;
    act(() => {
      cb({
        type: NetworkEventTypes.ACTIVE_CONNECTION_ADDED,
        payload: addedConnection
      });
    });

    await screen.findByText(/Wired 1/);
    await screen.findByText(/WiFi 1/);
    await screen.findByText(/New Wired Network/);
    await screen.findByText(/192.168.168.192/);
  });
});

describe("when connection is removed", () => {
  it("stops rendering its details", async () => {
    const [mockFunction, callbacks] = createCallbackMock();
    onNetworkEventFn = mockFunction;
    installerRender(<NetworkSection />);
    await screen.findByText(/Wired 1/);
    await screen.findByText(/WiFi 1/);

    // remove a connection
    activeConnectionsFn.mockReturnValue([wifiConnection]);
    const [cb] = callbacks;
    act(() => {
      cb({
        type: NetworkEventTypes.ACTIVE_CONNECTION_REMOVED,
        payload: { ...wiredConnection }
      });
    });

    await screen.findByText(/WiFi 1/);
    const removedNetwork = screen.queryByText(/Wired 1/);
    expect(removedNetwork).toBeNull();
  });
});

describe("when connection is updated", () => {
  it("re-renders the updated connection", async () => {
    const [mockFunction, callbacks] = createCallbackMock();
    onNetworkEventFn = mockFunction;
    installerRender(<NetworkSection />);
    await screen.findByText(/Wired 1/);
    await screen.findByText(/WiFi 1/);

    // update a connection
    const updatedConnection = { ...wiredConnection, id: "My Wired Connection" };
    activeConnectionsFn.mockReturnValue([updatedConnection, wifiConnection]);
    const [cb] = callbacks;
    act(() => {
      cb({
        type: NetworkEventTypes.ACTIVE_CONNECTION_UPDATED,
        payload: { ...wiredConnection, id: "My Wired Connection" }
      });
    });

    await screen.findByText(/My Wired Connection/);
    await screen.findByText(/WiFi 1/);

    const formerWiredName = screen.queryByText(/Wired 1/);
    expect(formerWiredName).toBeNull();
  });
});
