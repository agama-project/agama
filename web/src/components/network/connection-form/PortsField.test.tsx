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
import { useAppForm } from "~/hooks/form";
import { defaultOptions } from "./fields";
import { BondMode, Connection, DeviceState } from "~/types/network";
import type { ConnectionType } from "~/types/network";
import { CONNECTION_TYPE } from "~/utils/network";
import { _ } from "~/i18n";
import PortsField from "./PortsField";

const mockLoopback = {
  name: "lo",
  macAddress: "00:00:00:00:00:00",
  type: CONNECTION_TYPE.LOOPBACK,
  state: DeviceState.CONNECTED,
};

const mockDevice1 = {
  name: "enp1s0",
  macAddress: "00:11:22:33:44:55",
  type: CONNECTION_TYPE.ETHERNET,
  state: DeviceState.CONNECTED,
};

const mockDevice2 = {
  name: "enp2s0",
  macAddress: "AA:BB:CC:DD:EE:FF",
  type: CONNECTION_TYPE.ETHERNET,
  state: DeviceState.DISCONNECTED,
};

const mockBondDevice = {
  name: "bond0",
  macAddress: "00:11:22:33:44:55",
  type: CONNECTION_TYPE.BOND,
  state: DeviceState.CONNECTED,
};

let mockConnections: Connection[];
let mockDevices: object[];

/** A bond using the given devices as its ports. */
const bond = (iface: string, ports: string[]) =>
  new Connection(iface, { iface, bond: { mode: BondMode.ACTIVE_BACKUP, options: "", ports } });

jest.mock("~/hooks/model/system/network", () => ({
  useDevices: () => mockDevices,
  useConnections: () => mockConnections,
}));

function TestForm({ defaultValues = {} }: { defaultValues?: object }) {
  const form = useAppForm({
    ...defaultOptions,
    defaultValues: {
      ...defaultOptions.defaultValues,
      name: "test-bond",
      type: CONNECTION_TYPE.BOND as ConnectionType,
      bondIface: "bond0",
      ...defaultValues,
    },
  });

  return (
    <form.AppForm>
      <PortsField
        form={form}
        name="bondPorts"
        controllerField="bondIface"
        label={_("Bond ports")}
        pickLabel={_("Select bond ports")}
      />
    </form.AppForm>
  );
}

type User = ReturnType<typeof installerRender>["user"];

/** Opens the dialog for picking the ports. */
const openDialog = async (user: User) =>
  user.click(screen.getByRole("button", { name: "Select bond ports" }));

/** The open dialog. */
const dialog = () => within(screen.getByRole("dialog"));

/** The row of a device in the open dialog. */
const deviceRow = (name: string) => dialog().getByRole("row", { name: new RegExp(name) });

/** Picks or unpicks a device in the open dialog. */
const toggleDevice = async (user: User, name: string) =>
  user.click(within(deviceRow(name)).getByRole("checkbox"));

/** The ports already listed, which the field renders as a list of its own. */
const entriesList = () => screen.queryByRole("listbox", { name: "Bond ports entries" });

/** The entry for a port already listed, if there is one. */
const entry = (name: string) => entriesList() && within(entriesList()).queryByText(name);

describe("PortsField", () => {
  beforeEach(() => {
    mockConnections = [];
    mockDevices = [mockLoopback, mockDevice1, mockDevice2, mockBondDevice];
  });

  it("renders the ports field", () => {
    installerRender(<TestForm />);
    screen.getByRole("textbox", { name: "Bond ports" });
  });

  it("offers the devices that can be used as ports", async () => {
    const { user } = installerRender(<TestForm />);
    await openDialog(user);
    deviceRow("enp1s0");
    deviceRow("enp2s0");
  });

  it("does not offer the loopback device", async () => {
    const { user } = installerRender(<TestForm />);
    await openDialog(user);
    expect(dialog().queryByRole("row", { name: /^lo/ })).not.toBeInTheDocument();
  });

  it("does not offer the device of the bond being configured", async () => {
    const { user } = installerRender(<TestForm />);
    await openDialog(user);
    expect(dialog().queryByRole("row", { name: /bond0/ })).not.toBeInTheDocument();
  });

  it("adds the picked devices to the list", async () => {
    const { user } = installerRender(<TestForm />);
    await openDialog(user);
    await toggleDevice(user, "enp1s0");
    await toggleDevice(user, "enp2s0");
    await user.click(dialog().getByRole("button", { name: "Use 2 devices" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(entry("enp1s0")).toBeInTheDocument();
    expect(entry("enp2s0")).toBeInTheDocument();
  });

  it("changes nothing when the dialog is dismissed", async () => {
    const { user } = installerRender(<TestForm />);
    await openDialog(user);
    await toggleDevice(user, "enp1s0");
    await user.click(dialog().getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(entriesList()).not.toBeInTheDocument();
  });

  it("is disabled when there is no device to offer", () => {
    mockDevices = [mockLoopback, mockBondDevice];
    installerRender(<TestForm />);
    expect(screen.getByRole("button", { name: "Select bond ports" })).toBeDisabled();
  });

  describe("when some devices are already listed as ports", () => {
    it("opens the dialog with them picked", async () => {
      const { user } = installerRender(<TestForm defaultValues={{ bondPorts: ["enp1s0"] }} />);
      await openDialog(user);
      expect(within(deviceRow("enp1s0")).getByRole("checkbox")).toBeChecked();
      expect(within(deviceRow("enp2s0")).getByRole("checkbox")).not.toBeChecked();
    });

    it("drops the ones the user unpicks", async () => {
      const { user } = installerRender(
        <TestForm defaultValues={{ bondPorts: ["enp1s0", "enp2s0"] }} />,
      );
      await openDialog(user);
      await toggleDevice(user, "enp1s0");
      await user.click(dialog().getByRole("button", { name: "Use 1 device" }));

      expect(entry("enp1s0")).not.toBeInTheDocument();
      expect(entry("enp2s0")).toBeInTheDocument();
    });

    // The loopback is never offered, so nothing done in the dialog can reach a
    // port naming it.
    it("keeps the ports the dialog does not offer untouched", async () => {
      const { user } = installerRender(
        <TestForm defaultValues={{ bondPorts: ["lo", "enp1s0"] }} />,
      );
      await openDialog(user);
      await toggleDevice(user, "enp1s0");
      await user.click(dialog().getByRole("button", { name: "Use no device" }));

      expect(entry("lo")).toBeInTheDocument();
      expect(entry("enp1s0")).not.toBeInTheDocument();
    });

    it("drops them all when the user unpicks every one", async () => {
      const { user } = installerRender(
        <TestForm defaultValues={{ bondPorts: ["enp1s0", "enp2s0"] }} />,
      );
      await openDialog(user);
      await toggleDevice(user, "enp1s0");
      await toggleDevice(user, "enp2s0");
      await user.click(dialog().getByRole("button", { name: "Use no device" }));

      expect(entriesList()).not.toBeInTheDocument();
    });
  });

  describe("when a port matches no device found in the system", () => {
    it("offers it all the same, saying it is not there yet", async () => {
      const { user } = installerRender(<TestForm defaultValues={{ bondPorts: ["enp9s0"] }} />);
      await openDialog(user);

      const row = within(deviceRow("enp9s0"));
      row.getByText("Not present yet");
      expect(row.getByRole("checkbox")).toBeChecked();
    });

    it("tells nothing about its hardware", async () => {
      const { user } = installerRender(<TestForm defaultValues={{ bondPorts: ["enp9s0"] }} />);
      await openDialog(user);

      // Type, addresses and state have nothing to say about it.
      const cells = within(deviceRow("enp9s0")).getAllByRole("cell");
      expect(cells.filter((c) => c.textContent === "-")).toHaveLength(3);
    });

    it("drops it when the user unpicks it", async () => {
      const { user } = installerRender(
        <TestForm defaultValues={{ bondPorts: ["enp9s0", "enp1s0"] }} />,
      );
      await openDialog(user);
      await toggleDevice(user, "enp9s0");
      await user.click(dialog().getByRole("button", { name: "Use 1 device" }));

      expect(entry("enp9s0")).not.toBeInTheDocument();
      expect(entry("enp1s0")).toBeInTheDocument();
    });

    it("says which controller uses it, when another one does", async () => {
      mockConnections = [bond("bond1", ["enp9s0"])];
      const { user } = installerRender(<TestForm defaultValues={{ bondPorts: ["enp9s0"] }} />);
      await openDialog(user);

      within(deviceRow("enp9s0")).getByText("bond1");
    });
  });

  describe("when another controller already uses a device", () => {
    it("tells which one", async () => {
      mockConnections = [bond("bond1", ["enp2s0"])];
      const { user } = installerRender(<TestForm />);
      await openDialog(user);
      dialog().getByRole("columnheader", { name: "Used by" });
      within(deviceRow("enp2s0")).getByText("bond1");
    });

    it("offers it all the same", async () => {
      mockConnections = [bond("bond1", ["enp2s0"])];
      const { user } = installerRender(<TestForm />);
      await openDialog(user);
      await toggleDevice(user, "enp2s0");
      await user.click(dialog().getByRole("button", { name: "Use 1 device" }));
      expect(entry("enp2s0")).toBeInTheDocument();
    });

    it("says nothing about the bond being configured", async () => {
      mockConnections = [bond("bond0", ["enp2s0"])];
      const { user } = installerRender(<TestForm />);
      await openDialog(user);
      expect(dialog().queryByRole("columnheader", { name: "Used by" })).not.toBeInTheDocument();
    });
  });
});
