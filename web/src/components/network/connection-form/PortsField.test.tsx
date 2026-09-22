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
import { validate } from "./validations";
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
  speed: 1000,
  carrier: true,
  driver: "e1000e",
};

const mockDevice2 = {
  name: "enp2s0",
  macAddress: "AA:BB:CC:DD:EE:FF",
  type: CONNECTION_TYPE.ETHERNET,
  state: DeviceState.DISCONNECTED,
  carrier: false,
  driver: "r8169",
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
    // The real validator, so what marks a port here is what refuses the form.
    validators: { onSubmitAsync: async (ctx) => validate(ctx.value) },
  });

  return (
    <form.AppForm>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        {/* The name of the bond is part of the real form, and the ports field
            watches it, so the test form carries it too. */}
        <form.AppField name="bondIface">
          {(field) => <field.TextField label={_("Device name")} />}
        </form.AppField>
        <PortsField
          form={form}
          name="bondPorts"
          controllerField="bondIface"
          label={_("Bond ports")}
          dialogTitle={_("Select bond ports")}
        />
        <button type="submit">Submit</button>
      </form>
    </form.AppForm>
  );
}

type User = ReturnType<typeof installerRender>["user"];

/** Opens the list of devices the field offers. */
const openList = async (user: User) =>
  user.click(screen.getByRole("button", { name: "Show options" }));

/** The open list of devices. */
const list = () => within(screen.getByRole("listbox", { name: "Bond ports" }));

/** The option offering a device in the open list. */
const deviceOption = (name: string) => list().getByRole("option", { name: new RegExp(name) });

/** Opens the dialog listing the devices with their details. */
const openDialog = async (user: User) => {
  await openList(user);
  await user.click(list().getByRole("option", { name: /Browse with details/ }));
};

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
    screen.getByRole("combobox", { name: "Bond ports" });
  });

  it("offers the devices that can be used as ports", async () => {
    const { user } = installerRender(<TestForm />);
    await openList(user);
    deviceOption("enp1s0");
    deviceOption("enp2s0");
  });

  it("tells the devices apart by their hardware identifier", async () => {
    const { user } = installerRender(<TestForm />);
    await openList(user);
    expect(deviceOption("enp1s0")).toHaveTextContent("00:11:22:33:44:55");
    expect(deviceOption("enp2s0")).toHaveTextContent("AA:BB:CC:DD:EE:FF");
  });

  // Every word in an option is read out with it, so the list says the least it
  // can get away with and the dialog says the rest.
  it("says no more than that in an option", async () => {
    mockConnections = [bond("bond1", ["enp1s0"])];
    const { user } = installerRender(<TestForm />);
    await openList(user);

    const option = deviceOption("enp1s0");
    expect(option).not.toHaveTextContent("Ethernet");
    expect(option).not.toHaveTextContent("1 Gb/s");
    expect(option).not.toHaveTextContent("bond1");
  });

  it("finds a device by its hardware identifier", async () => {
    const { user } = installerRender(<TestForm />);
    await user.type(screen.getByRole("combobox", { name: "Bond ports" }), "AA:BB");

    deviceOption("enp2s0");
    expect(list().queryByRole("option", { name: /enp1s0/ })).not.toBeInTheDocument();
  });

  it("takes the name of a device the system does not report", async () => {
    const { user } = installerRender(<TestForm />);
    await user.type(screen.getByRole("combobox", { name: "Bond ports" }), "enp9s0{Enter}");

    expect(entry("enp9s0")).toBeInTheDocument();
  });

  it("adds the devices chosen from the list", async () => {
    const { user } = installerRender(<TestForm />);
    await openList(user);
    await user.click(deviceOption("enp1s0"));

    expect(entry("enp1s0")).toBeInTheDocument();
  });

  describe("when a port names the bond being configured", () => {
    const addSelfAsPort = async (user: User) =>
      user.type(screen.getByRole("combobox", { name: "Bond ports" }), "bond0{Enter}");

    const submit = async (user: User) => user.click(screen.getByRole("button", { name: "Submit" }));

    it("says nothing while the form is being filled in", async () => {
      const { user } = installerRender(<TestForm />);
      await addSelfAsPort(user);

      expect(screen.queryByText(/cannot be a port of itself/)).toBeNull();
    });

    it("refuses it once the form is submitted", async () => {
      const { user } = installerRender(<TestForm />);
      await addSelfAsPort(user);
      await submit(user);

      await screen.findByText("bond0 cannot be a port of itself");
    });

    it("marks the port the message is about", async () => {
      const { user } = installerRender(<TestForm defaultValues={{ bondPorts: ["enp1s0"] }} />);
      await addSelfAsPort(user);
      await submit(user);

      await within(entriesList()).findByRole("option", {
        name: "bond0 is invalid: bond0 cannot be a port of itself",
      });
      expect(
        within(entriesList()).queryByRole("option", { name: /enp1s0 is invalid/ }),
      ).not.toBeInTheDocument();
    });

    // The form rule and the mark come from the same `portError`, so the two
    // must not turn into the same sentence read twice under the field.
    it("says so only once", async () => {
      const { user } = installerRender(<TestForm />);
      await addSelfAsPort(user);
      await submit(user);

      await screen.findByText("bond0 cannot be a port of itself");
      expect(screen.getAllByText("bond0 cannot be a port of itself")).toHaveLength(1);
    });
  });

  it("does not offer the loopback device", async () => {
    const { user } = installerRender(<TestForm />);
    await openDialog(user);
    expect(dialog().queryByRole("row", { name: /^lo/ })).not.toBeInTheDocument();
  });

  // Nothing offers it, but a name written by hand goes through no list at all.
  it("refuses the loopback device once the form is submitted", async () => {
    const { user } = installerRender(<TestForm />);
    await user.type(screen.getByRole("combobox", { name: "Bond ports" }), "lo{Enter}");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await screen.findByText("The loopback device cannot be a port");
    within(entriesList()).getByRole("option", {
      name: "lo is invalid: The loopback device cannot be a port",
    });
  });

  it("does not offer the device of the bond being configured", async () => {
    const { user } = installerRender(<TestForm />);
    await openDialog(user);
    expect(dialog().queryByRole("row", { name: /bond0/ })).not.toBeInTheDocument();
  });

  it("shows in the dialog the details the list cannot hold", async () => {
    const { user } = installerRender(<TestForm />);
    await openDialog(user);
    dialog().getByRole("columnheader", { name: "Link" });
    within(deviceRow("enp1s0")).getByText("e1000e");
    within(deviceRow("enp1s0")).getByText("1 Gb/s");
    within(deviceRow("enp2s0")).getByText("No link");
  });

  // A column that comes and goes with the data leaves the user wondering what
  // they did to lose it, so it stays and the cells are the empty ones.
  it("keeps the columns whose details no device reports", async () => {
    mockDevices = [
      mockLoopback,
      mockBondDevice,
      { ...mockDevice1, speed: undefined, carrier: undefined },
    ];
    const { user } = installerRender(<TestForm />);
    await openDialog(user);

    dialog().getByRole("columnheader", { name: "Link" });
    expect(within(deviceRow("enp1s0")).queryByText(/Gb\/s|Mb\/s|No link/)).not.toBeInTheDocument();
  });

  it("adds the picked devices to the list", async () => {
    const { user } = installerRender(<TestForm />);
    await openDialog(user);
    await toggleDevice(user, "enp1s0");
    await toggleDevice(user, "enp2s0");
    await user.click(dialog().getByRole("button", { name: "Accept" }));

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

  it("offers no way into the dialog when there is no device to browse", async () => {
    mockDevices = [mockLoopback, mockBondDevice];
    const { user } = installerRender(<TestForm />);
    await openList(user);

    expect(screen.queryByRole("option", { name: /Browse with details/ })).not.toBeInTheDocument();
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
      await user.click(dialog().getByRole("button", { name: "Accept" }));

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
      await user.click(dialog().getByRole("button", { name: "Accept" }));

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
      await user.click(dialog().getByRole("button", { name: "Accept" }));

      expect(entriesList()).not.toBeInTheDocument();
    });
  });

  describe("when a port matches no device found in the system", () => {
    it("does not offer it", async () => {
      const { user } = installerRender(<TestForm defaultValues={{ bondPorts: ["enp9s0"] }} />);
      await openDialog(user);

      expect(dialog().queryByRole("row", { name: /enp9s0/ })).not.toBeInTheDocument();
    });

    it("keeps it whatever the user does in the dialog", async () => {
      const { user } = installerRender(<TestForm defaultValues={{ bondPorts: ["enp9s0"] }} />);
      await openDialog(user);
      await toggleDevice(user, "enp1s0");
      await user.click(dialog().getByRole("button", { name: "Accept" }));

      expect(entry("enp9s0")).toBeInTheDocument();
      expect(entry("enp1s0")).toBeInTheDocument();
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
      await user.click(dialog().getByRole("button", { name: "Accept" }));
      expect(entry("enp2s0")).toBeInTheDocument();
    });

    it("says nothing about the bond being configured", async () => {
      mockConnections = [bond("bond0", ["enp2s0"])];
      const { user } = installerRender(<TestForm />);
      await openDialog(user);
      expect(within(deviceRow("enp2s0")).queryByText("bond0")).not.toBeInTheDocument();
    });
  });

  // A column that comes and goes with the data leaves the user wondering what
  // they did to lose it, so it is there whenever ports are being picked.
  it("keeps the 'Used by' column even when no device is used by anything", async () => {
    const { user } = installerRender(<TestForm />);
    await openDialog(user);
    dialog().getByRole("columnheader", { name: "Used by" });
  });
});
