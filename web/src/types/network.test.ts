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

import {
  BondMode,
  Connection,
  ConnectionMethod,
  ConnectionState,
  ConnectionStatus,
  NetworkConfig,
  NetworkProposal,
  flattenConnections,
  isPort,
  portsOf,
} from "./network";
import { CONNECTION_TYPE, isVirtual } from "~/utils/network";

describe("isVirtual", () => {
  it("returns true for BOND, BRIDGE, and VLAN types", () => {
    expect(isVirtual(CONNECTION_TYPE.BOND)).toBe(true);
    expect(isVirtual(CONNECTION_TYPE.BRIDGE)).toBe(true);
    expect(isVirtual(CONNECTION_TYPE.VLAN)).toBe(true);
  });

  it("returns false for ETHERNET, WIFI, and LOOPBACK types", () => {
    expect(isVirtual(CONNECTION_TYPE.ETHERNET)).toBe(false);
    expect(isVirtual(CONNECTION_TYPE.WIFI)).toBe(false);
    expect(isVirtual(CONNECTION_TYPE.LOOPBACK)).toBe(false);
  });
});

const bond = (id: string, ports: (string | Connection)[], options = {}) =>
  new Connection(id, {
    iface: id,
    bond: { mode: BondMode.ACTIVE_BACKUP, options: "", ports },
    ...options,
  });

const bridge = (id: string, ports: (string | Connection)[]) =>
  new Connection(id, { iface: id, bridge: { ports } });

const ethernet = (id: string, options = {}) => new Connection(id, { iface: id, ...options });

const portIds = (connection: Connection) =>
  portsOf(connection).map((p) => (typeof p === "string" ? p : p.id));

describe("Connection", () => {
  describe("fromApi", () => {
    it("builds the ports nested in a controller as connections", () => {
      const conn = Connection.fromApi({
        id: "br0",
        interface: "br0",
        status: ConnectionStatus.UP,
        persistent: true,
        bridge: {
          ports: [
            {
              id: "bond0",
              interface: "bond0",
              status: ConnectionStatus.UP,
              persistent: true,
              port: { priority: 32 },
              bond: {
                mode: BondMode.LACP,
                options: "",
                ports: [
                  { id: "eth0", interface: "eth0", status: ConnectionStatus.UP, persistent: true },
                  "eth1",
                ],
              },
            },
          ],
        },
      });

      const [bond0] = portsOf(conn) as Connection[];
      expect(bond0).toBeInstanceOf(Connection);
      expect(bond0.port).toEqual({ priority: 32 });
      expect(portsOf(bond0)[0]).toBeInstanceOf(Connection);
      expect(portsOf(bond0)[1]).toBe("eth1");
    });
  });

  describe("toApi", () => {
    it("writes the nested ports back, without their state", () => {
      const eth0 = ethernet("eth0", { state: ConnectionState.ACTIVATED });
      const api = bond("bond0", [eth0, "eth1"], { state: ConnectionState.ACTIVATED }).toApi();

      expect(api.state).toBeUndefined();
      expect(api.bond.ports).toEqual([expect.objectContaining({ id: "eth0" }), "eth1"]);
      expect(api.bond.ports[0]).toEqual(expect.objectContaining({ interface: "eth0" }));
      expect(api.bond.ports[0]).not.toHaveProperty("state");
    });
  });
});

describe("flattenConnections", () => {
  it("lists every connection, each controller before its ports", () => {
    const stack = bridge("br0", [bond("bond0", [ethernet("eth0"), "eth1"])]);
    const ids = flattenConnections([stack, ethernet("eth2")]).map((c) => c.id);

    expect(ids).toEqual(["br0", "bond0", "eth0", "eth2"]);
  });
});

describe("isPort", () => {
  it("tells whether a connection is nested in, or listed by name by, a controller", () => {
    const connections = [bridge("br0", [bond("bond0", [ethernet("eth0"), "eth1"])])];

    expect(isPort(connections, ethernet("bond0"))).toBe(true);
    expect(isPort(connections, ethernet("eth0"))).toBe(true);
    expect(isPort(connections, ethernet("eth1"))).toBe(true);
    expect(isPort(connections, ethernet("eth2"))).toBe(false);
    expect(isPort(connections, ethernet("br0"))).toBe(false);
  });
});

describe("NetworkConfig", () => {
  describe("addOrUpdateConnection", () => {
    it("replaces a nested port where it is", () => {
      const config = new NetworkConfig([bond("bond0", [ethernet("eth0"), ethernet("eth1")])]);
      config.addOrUpdateConnection(ethernet("eth1", { status: ConnectionStatus.DOWN }));

      expect(config.connections).toHaveLength(1);
      const [, eth1] = portsOf(config.connections[0]) as Connection[];
      expect(eth1.status).toBe(ConnectionStatus.DOWN);
    });

    it("adds an unknown connection at the top level", () => {
      const config = new NetworkConfig([bond("bond0", [ethernet("eth0")])]);
      config.addOrUpdateConnection(ethernet("eth1"));

      expect(config.connections.map((c) => c.id)).toEqual(["bond0", "eth1"]);
    });

    it("moves a port given by name from another controller, keeping its port settings", () => {
      const eth1 = ethernet("eth1", { port: { priority: 10 }, method4: ConnectionMethod.MANUAL });
      const config = new NetworkConfig([bridge("br0", [ethernet("eth0")]), bridge("br1", [eth1])]);
      config.addOrUpdateConnection(bridge("br0", [ethernet("eth0"), "eth1"]));

      const [br0, br1] = config.connections;
      expect(portIds(br0)).toEqual(["eth0", "eth1"]);
      expect(portIds(br1)).toEqual([]);
      const moved = portsOf(br0)[1] as Connection;
      expect(moved.port).toEqual({ priority: 10 });
      expect(moved.method4).toBeUndefined();
    });

    it("nests a top-level connection given by name, without its IP settings", () => {
      const eth1 = ethernet("eth1", {
        method4: ConnectionMethod.MANUAL,
        method6: ConnectionMethod.AUTO,
        addresses: [{ address: "192.168.1.10", prefix: 24 }],
        gateway4: "192.168.1.1",
        nameservers: ["8.8.8.8"],
        dnsSearchList: ["example.com"],
      });
      const config = new NetworkConfig([bond("bond0", []), eth1]);
      config.addOrUpdateConnection(bond("bond0", ["eth1"]));

      expect(config.connections.map((c) => c.id)).toEqual(["bond0"]);
      const nested = portsOf(config.connections[0])[0] as Connection;
      expect(nested.id).toBe("eth1");
      const api = nested.toApi();
      expect(api).not.toHaveProperty("method4");
      expect(api).not.toHaveProperty("method6");
      expect(api).not.toHaveProperty("gateway4");
      expect(api.addresses).toEqual([]);
      expect(api.nameservers).toEqual([]);
      expect(api.dnsSearchList).toEqual([]);
    });

    it("drops the IP settings of a port replaced where it is", () => {
      const config = new NetworkConfig([bond("bond0", [ethernet("eth0")])]);
      config.addOrUpdateConnection(
        ethernet("eth0", { method4: ConnectionMethod.MANUAL, nameservers: ["8.8.8.8"] }),
      );

      const [eth0] = portsOf(config.connections[0]) as Connection[];
      expect(eth0.toApi()).not.toHaveProperty("method4");
      expect(eth0.nameservers).toEqual([]);
    });

    it("brings back a removed connection given by name as a port with the port defaults", () => {
      const eth1 = ethernet("eth1", {
        status: ConnectionStatus.DELETE,
        method4: ConnectionMethod.AUTO,
        method6: ConnectionMethod.AUTO,
      });
      const config = new NetworkConfig([bond("bond0", []), eth1]);
      config.addOrUpdateConnection(bond("bond0", ["eth1"]));

      expect(config.connections.map((c) => c.id)).toEqual(["bond0"]);
      expect(portIds(config.connections[0])).toEqual(["eth1"]);
      const nested = portsOf(config.connections[0])[0] as Connection;
      expect(nested.status).toBe(ConnectionStatus.UP);
      expect(nested.toApi()).not.toHaveProperty("method4");
      expect(nested.toApi()).not.toHaveProperty("method6");
    });

    it("brings back a removed port given by name with the port defaults", () => {
      const eth1 = ethernet("eth1", {
        status: ConnectionStatus.DELETE,
        method4: ConnectionMethod.MANUAL,
      });
      const config = new NetworkConfig([bond("bond0", []), bond("bond1", [eth1])]);
      config.addOrUpdateConnection(bond("bond0", ["eth1"]));

      const [bond0, bond1] = config.connections;
      expect(portIds(bond0)).toEqual(["eth1"]);
      expect(portIds(bond1)).toEqual([]);
      const nested = portsOf(bond0)[0] as Connection;
      expect(nested.status).toBe(ConnectionStatus.UP);
      expect(nested.toApi()).not.toHaveProperty("method4");
    });

    it("drops the bridge port settings of a port moved to a bond", () => {
      const eth0 = ethernet("eth0", { port: { priority: 32 } });
      const config = new NetworkConfig([bridge("br0", [eth0]), bond("bond0", [])]);
      config.addOrUpdateConnection(bond("bond0", ["eth0"]));

      const nested = portsOf(config.connections[1])[0] as Connection;
      expect(nested.id).toBe("eth0");
      expect(nested.port).toBeUndefined();
    });

    it("finds a port given by the id of a connection not bound to an interface", () => {
      const unbound = new Connection("Wired 1");
      const config = new NetworkConfig([bond("bond0", []), unbound]);
      config.addOrUpdateConnection(bond("bond0", ["Wired 1"]));

      expect(portIds(config.connections[0])).toEqual(["Wired 1"]);
    });

    it("leaves a name matching no connection for the backend to resolve", () => {
      const config = new NetworkConfig([bond("bond0", [])]);
      config.addOrUpdateConnection(bond("bond0", ["eth9"]));

      expect(portsOf(config.connections[0])).toEqual(["eth9"]);
    });

    it("drops a removed port from its controller, with whatever is nested in it", () => {
      const config = new NetworkConfig([
        bond("bond0", [ethernet("eth0"), bond("bond1", [ethernet("eth1")])]),
      ]);
      config.addOrUpdateConnection(ethernet("bond1", { status: ConnectionStatus.DELETE }));

      expect(config.connections.map((c) => c.id)).toEqual(["bond0"]);
      expect(portIds(config.connections[0])).toEqual(["eth0"]);
    });

    it("keeps connections with DELETE status in the array", () => {
      const config = new NetworkConfig([new Connection("eth0", { status: ConnectionStatus.UP })]);

      const toDelete = new Connection("eth0", { status: ConnectionStatus.DELETE });
      config.addOrUpdateConnection(toDelete);

      expect(config.connections).toHaveLength(1);
      expect(config.connections[0].status).toBe(ConnectionStatus.DELETE);
    });
  });
});

describe("NetworkProposal", () => {
  describe("addOrUpdateConnection", () => {
    it("keeps connections with DELETE status in the array", () => {
      const proposal = new NetworkProposal([
        new Connection("eth0", { status: ConnectionStatus.UP }),
      ]);

      const toDelete = new Connection("eth0", { status: ConnectionStatus.DELETE });
      proposal.addOrUpdateConnection(toDelete);

      expect(proposal.connections).toHaveLength(1);
      expect(proposal.connections[0].status).toBe(ConnectionStatus.DELETE);
    });
  });
});
