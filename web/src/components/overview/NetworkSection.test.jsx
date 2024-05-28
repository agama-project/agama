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

const ethernetDevice = {
  name: "eth0",
  connection: "Wired 1",
  type: ConnectionTypes.ETHERNET,
  addresses: [{ address: "192.168.122.20", prefix: 24 }],
  macAddress: "00:11:22:33:44::55"
};
const wifiDevice = {
  name: "wlan0",
  connection: "WiFi 1",
  type: ConnectionTypes.WIFI,
  addresses: [{ address: "192.168.69.200", prefix: 24 }],
  macAddress: "AA:11:22:33:44::FF"
};

const devicesFn = jest.fn();
let onNetworkChangeEventFn = jest.fn();
const fromApiDeviceFn = (data) => data;

beforeEach(() => {
  devicesFn.mockResolvedValue([ethernetDevice, wifiDevice]);

  // if defined outside, the mock is cleared automatically
  createClient.mockImplementation(() => {
    return {
      network: {
        devices: devicesFn,
        onNetworkChange: onNetworkChangeEventFn,
        fromApiDevice: fromApiDeviceFn
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
  it("renders the number of devices found", async () => {
    installerRender(<NetworkSection />);

    await screen.findByText(/2 devices/i);
  });

  it("renders devices names", async () => {
    installerRender(<NetworkSection />);

    await screen.findByText(/Wired 1/i);
    await screen.findByText(/WiFi 1/i);
  });

  it("renders devices addresses", async () => {
    installerRender(<NetworkSection />);

    await screen.findByText(/192.168.122.20/i);
    await screen.findByText(/192.168.69.200/i);
  });

  describe("but none active connection was found", () => {
    beforeEach(() => devicesFn.mockResolvedValue([]));

    it("renders info about it", async () => {
      installerRender(<NetworkSection />);

      await screen.findByText("No network devices detected");
    });
  });
});

describe("when a device is added", () => {
  it("renders the added device", async () => {
    const [mockFunction, callbacks] = createCallbackMock();
    onNetworkChangeEventFn = mockFunction;
    installerRender(<NetworkSection />);
    await screen.findByText(/Wired 1/);
    await screen.findByText(/WiFi 1/);

    // add a new connection
    const addedDevice = {
      name: "eth1",
      connection: "New Wired Network",
      type: ConnectionTypes.ETHERNET,
      addresses: [{ address: "192.168.168.192", prefix: 24 }],
      macAddress: "AA:BB:CC:DD:EE:00"
    };

    devicesFn.mockResolvedValue([ethernetDevice, wifiDevice, addedDevice]);

    const [cb] = callbacks;
    act(() => {
      cb({
        type: NetworkEventTypes.DEVICE_ADDED,
        payload: addedDevice
      });
    });

    await screen.findByText(/Wired 1/);
    await screen.findByText(/New Wired Network/);
    await screen.findByText(/WiFi 1/);
    await screen.findByText(/192.168.168.192/);
  });
});

describe("when connection is removed", () => {
  it("stops rendering its details", async () => {
    const [mockFunction, callbacks] = createCallbackMock();
    onNetworkChangeEventFn = mockFunction;
    installerRender(<NetworkSection />);
    await screen.findByText(/Wired 1/);
    await screen.findByText(/WiFi 1/);

    // remove a connection
    devicesFn.mockResolvedValue([wifiDevice]);
    const [cb] = callbacks;
    act(() => {
      cb({
        type: NetworkEventTypes.DEVICE_REMOVED,
        payload: ethernetDevice.name
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
    onNetworkChangeEventFn = mockFunction;
    installerRender(<NetworkSection />);
    await screen.findByText(/Wired 1/);
    await screen.findByText(/WiFi 1/);

    // update a connection
    const updatedDevice = { ...ethernetDevice, name: "enp2s0f0", connection: "Wired renamed" };
    devicesFn.mockResolvedValue([updatedDevice, wifiDevice]);
    const [cb] = callbacks;
    act(() => {
      cb({
        type: NetworkEventTypes.DEVICE_UPDATED,
        payload: ["eth0", updatedDevice]
      });
    });

    await screen.findByText(/WiFi 1/);
    await screen.findByText(/Wired renamed/);

    const formerWiredName = screen.queryByText(/Wired 1/);
    expect(formerWiredName).toBeNull();
  });
});
