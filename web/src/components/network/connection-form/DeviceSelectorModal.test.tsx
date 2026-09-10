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

type ModalProps = Partial<React.ComponentProps<typeof DeviceSelectorModal>>;

const renderModal = (props: ModalProps = {}) =>
  installerRender(
    <DeviceSelectorModal devices={devices} onConfirm={onConfirm} onCancel={onCancel} {...props} />,
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

  describe("when no device is bound yet", () => {
    it("starts with the first one picked", () => {
      renderModal();
      expect(screen.getByRole("button", { name: "Use enp1s0" })).toBeEnabled();
    });
  });

  describe("when a device is selected", () => {
    it("reports it on confirm", async () => {
      const { user } = renderModal({ selected: [ethernet] });
      await user.click(within(rowFor("wlan0")).getByRole("radio"));
      await user.click(screen.getByRole("button", { name: "Use wlan0" }));
      expect(onConfirm).toHaveBeenCalledWith([wireless]);
    });

    it("reports nothing on cancel", async () => {
      const { user } = renderModal({ selected: [ethernet] });
      await user.click(within(rowFor("wlan0")).getByRole("radio"));
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onCancel).toHaveBeenCalled();
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe("when several devices can be picked", () => {
    const renderMultiple = (props: ModalProps = {}) =>
      renderModal({ selectionMode: "multiple", ...props });

    it("starts with nothing picked", () => {
      renderMultiple();
      expect(screen.getByRole("button", { name: "Use no device" })).toBeEnabled();
    });

    it("reports an empty pick, for emptying the list", async () => {
      const { user } = renderMultiple({ selected: [ethernet] });
      await user.click(within(rowFor("enp1s0")).getByRole("checkbox"));
      await user.click(screen.getByRole("button", { name: "Use no device" }));
      expect(onConfirm).toHaveBeenCalledWith([]);
    });

    it("starts with the given devices picked, ready to be changed", async () => {
      const { user } = renderMultiple({ selected: [ethernet] });
      expect(within(rowFor("enp1s0")).getByRole("checkbox")).toBeChecked();
      await user.click(within(rowFor("wlan0")).getByRole("checkbox"));
      await user.click(screen.getByRole("button", { name: "Use 2 devices" }));
      expect(onConfirm).toHaveBeenCalledWith([ethernet, wireless]);
    });

    it("reports the devices left picked when one is unpicked", async () => {
      const { user } = renderMultiple({ selected: [ethernet, wireless] });
      await user.click(within(rowFor("enp1s0")).getByRole("checkbox"));
      await user.click(screen.getByRole("button", { name: "Use 1 device" }));
      expect(onConfirm).toHaveBeenCalledWith([wireless]);
    });

    it("reports every picked device on confirm", async () => {
      const { user } = renderMultiple();
      await user.click(within(rowFor("enp1s0")).getByRole("checkbox"));
      await user.click(within(rowFor("wlan0")).getByRole("checkbox"));
      await user.click(screen.getByRole("button", { name: "Use 2 devices" }));
      expect(onConfirm).toHaveBeenCalledWith([ethernet, wireless]);
    });

    it("tells which devices are already used, when asked to", () => {
      renderMultiple({ portOf: (device) => (device.name === "enp1s0" ? "bond0" : undefined) });
      within(rowFor("enp1s0")).getByText("bond0");
    });

    it("does not show the 'Used by' column when there is nothing to tell", () => {
      renderMultiple();
      expect(screen.queryByRole("columnheader", { name: "Used by" })).toBeNull();
    });
  });
});
