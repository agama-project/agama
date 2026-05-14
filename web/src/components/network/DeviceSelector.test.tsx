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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { useAppForm } from "~/hooks/form";
import { DeviceState } from "~/types/network";
import { CONNECTION_TYPE } from "~/utils/network";
import { connectionFormOptions } from "~/components/network/ConnectionForm";
import DeviceSelector from "./DeviceSelector";

const mockDevices = [
  {
    name: "enp1s0",
    macAddress: "00:11:22:33:44:55",
    type: CONNECTION_TYPE.ETHERNET,
    state: DeviceState.CONNECTED,
  },
  {
    name: "enp2s0",
    macAddress: "AA:BB:CC:DD:EE:FF",
    type: CONNECTION_TYPE.ETHERNET,
    state: DeviceState.DISCONNECTED,
  },
];

jest.mock("~/hooks/model/system/network", () => ({
  useDevices: () => mockDevices,
}));

type SyncProp = React.ComponentProps<typeof DeviceSelector>["sync"];

let sync: SyncProp;

function TestSelectors() {
  const form = useAppForm({ ...connectionFormOptions });
  return (
    <>
      <DeviceSelector form={form} by="iface" sync={sync} />
      <DeviceSelector form={form} by="mac" />
    </>
  );
}

describe("DeviceSelector", () => {
  beforeEach(() => {
    sync = undefined;
  });

  describe("when mounting with no device selected", () => {
    it("pre-selects the first available device", async () => {
      const { user } = installerRender(<TestSelectors />);
      await user.click(screen.getByLabelText("Device name"));
      expect(screen.getByRole("option", { name: /^enp1s0/ })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });
  });

  describe("when by is iface", () => {
    it("shows device names as options", async () => {
      const { user } = installerRender(<TestSelectors />);
      await user.click(screen.getByLabelText("Device name"));
      screen.getByRole("option", { name: /^enp1s0/ });
      screen.getByRole("option", { name: /^enp2s0/ });
    });

    it("shows MAC addresses as option descriptions", async () => {
      const { user } = installerRender(<TestSelectors />);
      await user.click(screen.getByLabelText("Device name"));
      screen.getByRole("option", { name: /00:11:22:33:44:55/ });
      screen.getByRole("option", { name: /AA:BB:CC:DD:EE:FF/ });
    });
  });

  describe("when by is mac", () => {
    it("shows MAC addresses as options", async () => {
      const { user } = installerRender(<TestSelectors />);
      await user.click(screen.getByLabelText("MAC address"));
      screen.getByRole("option", { name: /^00:11:22:33:44:55/ });
      screen.getByRole("option", { name: /^AA:BB:CC:DD:EE:FF/ });
    });

    it("shows device names as option descriptions", async () => {
      const { user } = installerRender(<TestSelectors />);
      await user.click(screen.getByLabelText("MAC address"));
      screen.getByRole("option", { name: /enp1s0/ });
      screen.getByRole("option", { name: /enp2s0/ });
    });
  });

  describe("when sync is not provided", () => {
    it("does not update the synced selector when a device is selected", async () => {
      const { user } = installerRender(<TestSelectors />);
      await user.click(screen.getByLabelText("Device name"));
      await user.click(screen.getByRole("option", { name: /^enp2s0/ }));
      await user.click(screen.getByLabelText("MAC address"));
      expect(screen.getByRole("option", { name: /^AA:BB:CC:DD:EE:FF/ })).not.toHaveAttribute(
        "aria-selected",
        "true",
      );
    });
  });

  describe("when sync is provided", () => {
    beforeEach(() => {
      sync = { field: "ifaceMac", with: (d) => d.macAddress };
    });

    it("updates the synced selector when a device is selected", async () => {
      const { user } = installerRender(<TestSelectors />);
      await user.click(screen.getByLabelText("Device name"));
      await user.click(screen.getByRole("option", { name: /^enp2s0/ }));
      await user.click(screen.getByLabelText("MAC address"));
      expect(screen.getByRole("option", { name: /^AA:BB:CC:DD:EE:FF/ })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });
  });
});
