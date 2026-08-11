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
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { DeviceState } from "~/types/network";
import { CONNECTION_TYPE } from "~/utils/network";
import DeviceSelectorModal from "./DeviceSelectorModal";

import type { Device } from "~/types/network";

const ethernet = {
  name: "enp1s0",
  macAddress: "00:11:22:33:44:55",
  type: CONNECTION_TYPE.ETHERNET,
  state: DeviceState.CONNECTED,
  addresses: [{ address: "192.168.1.10", prefix: 24 }],
} as Device;

const wireless = {
  name: "wlan0",
  macAddress: "AA:BB:CC:DD:EE:FF",
  type: CONNECTION_TYPE.WIFI,
  state: DeviceState.DISCONNECTED,
  addresses: [],
} as Device;

const devices = [ethernet, wireless];

let onConfirm: jest.Mock;
let onCancel: jest.Mock;

const renderModal = (selected?: Device) =>
  installerRender(
    <DeviceSelectorModal
      devices={devices}
      selected={selected}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );

const rowFor = (name: string) => screen.getByRole("row", { name: new RegExp(name) });

describe("DeviceSelectorModal", () => {
  beforeEach(() => {
    onConfirm = jest.fn();
    onCancel = jest.fn();
  });

  it("lists the devices in the order they were given", () => {
    renderModal();
    const [firstRow, secondRow] = screen.getAllByRole("row").slice(1);
    expect(firstRow).toHaveTextContent("enp1s0");
    expect(secondRow).toHaveTextContent("wlan0");
  });

  it("renders a row per device with its details", () => {
    renderModal();
    within(rowFor("enp1s0")).getByText("00:11:22:33:44:55");
    within(rowFor("enp1s0")).getByText("192.168.1.10/24");
    within(rowFor("enp1s0")).getByText("Connected");
    within(rowFor("wlan0")).getByText("Wi-Fi");
    within(rowFor("wlan0")).getByText("Disconnected");
  });

  it("keeps only the devices matching the filter", async () => {
    const { user } = renderModal();
    await user.type(screen.getByRole("textbox", { name: /Filter/ }), "wlan");
    rowFor("wlan0");
    expect(screen.queryByRole("row", { name: /enp1s0/ })).not.toBeInTheDocument();
  });

  it("filters by MAC address and by IP address too", async () => {
    const { user } = renderModal();
    const filter = screen.getByRole("textbox", { name: /Filter/ });
    await user.type(filter, "AA:BB");
    rowFor("wlan0");
    await user.clear(filter);
    await user.type(filter, "192.168.1.10");
    rowFor("enp1s0");
    expect(screen.queryByRole("row", { name: /wlan0/ })).not.toBeInTheDocument();
  });

  it("announces how many devices match the filter", async () => {
    const { user } = renderModal();
    await user.type(screen.getByRole("textbox", { name: /Filter/ }), "wlan");
    screen.getByText("1 device found");
  });

  describe("when no device matches the filter", () => {
    it("offers clearing the filter", async () => {
      const { user } = renderModal();
      await user.type(screen.getByRole("textbox", { name: /Filter/ }), "nothing");
      screen.getByText("No devices match the filter");
      await user.click(screen.getByRole("button", { name: "Clear filter" }));
      rowFor("enp1s0");
      rowFor("wlan0");
    });
  });

  describe("when no device is bound yet", () => {
    it("starts with the first one picked", () => {
      renderModal();
      expect(screen.getByRole("button", { name: "Use enp1s0" })).toBeEnabled();
    });
  });

  describe("when the filter hides the selected device", () => {
    it("does not allow confirming it", async () => {
      const { user } = renderModal(ethernet);
      expect(screen.getByRole("button", { name: "Use enp1s0" })).toBeEnabled();
      await user.type(screen.getByRole("textbox", { name: /Filter/ }), "nothing");
      expect(screen.getByRole("button", { name: "Select" })).toBeDisabled();
      screen.getByText("Select a device");
    });

    it("offers it again once the filter stops hiding it", async () => {
      const { user } = renderModal(ethernet);
      const filter = screen.getByRole("textbox", { name: /Filter/ });
      await user.type(filter, "nothing");
      await user.clear(filter);
      await user.click(screen.getByRole("button", { name: "Use enp1s0" }));
      expect(onConfirm).toHaveBeenCalledWith(ethernet);
    });
  });

  describe("when a device is selected", () => {
    it("reports it on confirm", async () => {
      const { user } = renderModal(ethernet);
      await user.click(within(rowFor("wlan0")).getByRole("radio"));
      await user.click(screen.getByRole("button", { name: "Use wlan0" }));
      expect(onConfirm).toHaveBeenCalledWith(wireless);
    });

    it("reports nothing on cancel", async () => {
      const { user } = renderModal(ethernet);
      await user.click(within(rowFor("wlan0")).getByRole("radio"));
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onCancel).toHaveBeenCalled();
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });
});
