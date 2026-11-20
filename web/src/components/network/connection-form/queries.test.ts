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

import { BondMode, Connection, Device, DeviceState } from "~/types/network";
import { CONNECTION_TYPE } from "~/utils/network";
import { selfAndControllerDevices } from "./queries";

const device = (name: string, connection?: string): Device =>
  ({
    name,
    connection,
    type: CONNECTION_TYPE.ETHERNET,
    state: DeviceState.CONNECTED,
  }) as Device;

const ethernet = (id: string) => new Connection(id, { iface: id });

const bond = (id: string, ports: Connection[]) =>
  new Connection(id, { iface: id, bond: { mode: BondMode.ACTIVE_BACKUP, options: "", ports } });

const bridge = (id: string, ports: Connection[], iface = id) =>
  new Connection(id, { iface, bridge: { ports } });

describe("selfAndControllerDevices", () => {
  const eth0 = ethernet("eth0");
  const bond0 = bond("bond0", [eth0, ethernet("eth1")]);
  const connections = [bridge("br0", [bond0]), ethernet("eth2")];
  const devices = ["eth0", "eth1", "eth2", "bond0", "br0"].map((n) => device(n, n));

  it("returns the device of the connection and the ones of its controllers", () => {
    expect(selfAndControllerDevices(devices, connections, bond0)).toEqual(["bond0", "br0"]);
    expect(selfAndControllerDevices(devices, connections, eth0)).toEqual(["eth0", "bond0", "br0"]);
  });

  it("tells a device by the connection it runs when it is not bound to an interface", () => {
    const unbound = bridge("Bridge 1", [bond0], undefined);
    const others = [...devices.filter((d) => d.name !== "br0"), device("br0", "Bridge 1")];

    expect(selfAndControllerDevices(others, [unbound], bond0)).toEqual(["bond0", "br0"]);
  });

  it("returns only the device of a connection that is not a port", () => {
    expect(selfAndControllerDevices(devices, connections, ethernet("eth2"))).toEqual(["eth2"]);
  });

  it("returns nothing for a new connection", () => {
    expect(selfAndControllerDevices(devices, connections, null)).toEqual([]);
  });

  it("stops at a loop of controllers given by name", () => {
    const named = (id: string, port: string) =>
      new Connection(id, {
        iface: id,
        bond: { mode: BondMode.ACTIVE_BACKUP, options: "", ports: [port] },
      });
    const [a, b] = [named("a", "b"), named("b", "a")];

    expect(selfAndControllerDevices([device("a"), device("b")], [a, b], a)).toEqual(["a", "b"]);
  });
});
