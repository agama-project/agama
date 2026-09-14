/*
 * Copyright (c) [2022-2026] SUSE LLC
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

import { BondMode, Connection, SecurityProtocols } from "~/types/network";
import {
  addDefaultIPPrefix,
  isValidIp,
  isValidIpPrefix,
  intToIPString,
  stringToIPInt,
  formatIp,
  connectionForName,
  controllerOf,
  generateConnectionName,
  ipPrefixFor,
  securityFromFlags,
  connectionBindingMode,
} from "./network";

describe("#isValidIp", () => {
  it("returns true when the IP is valid", () => {
    expect(isValidIp("192.168.122.1")).toEqual(true);
    expect(isValidIp("10.0.0.1")).toEqual(true);
  });

  it("returns false when the IP is not valid", () => {
    expect(isValidIp("192.168.122.1/24")).toEqual(false);
    expect(isValidIp("not-an-ip")).toEqual(false);
  });
});

describe("#isValidIpPrefix", () => {
  it("returns true when it is a valid netmask or prefix", () => {
    expect(isValidIpPrefix("255.255.255.0")).toEqual(true);
    expect(isValidIpPrefix("24")).toEqual(true);
    // FIXME: this one is not a valid netmask
    expect(isValidIpPrefix("10.0.0.1")).toEqual(true);
  });

  it("returns false when it is not neither a valid netmask nor a network prefix", () => {
    expect(isValidIpPrefix("88")).toEqual(false);
    expect(isValidIpPrefix("not-an-netmask")).toEqual(false);
  });
});

describe("#ipPrefixFor", () => {
  it("returns the prefix as an integer for the given netmask or prefix", () => {
    expect(ipPrefixFor("255.255.0.0")).toEqual(16);
    expect(ipPrefixFor("24")).toEqual(24);
  });
});

describe("#intToIPString", () => {
  it("returns the IP as string", () => {
    expect(intToIPString(67305985)).toEqual("1.2.3.4");
  });
});

describe("#ip4_from_text", () => {
  it("returns the IP as network byte-order", () => {
    expect(stringToIPInt("1.2.3.4")).toEqual(67305985);
  });
});

describe("formatIp", () => {
  it("returns the given IPv4 address in the X.X.X.X/YY format", () => {
    expect(formatIp({ address: "1.2.3.4", prefix: 24 })).toEqual("1.2.3.4/24");
    expect(formatIp({ address: "1.2.3.4", prefix: "255.255.255.0" })).toEqual("1.2.3.4/24");
  });

  it("returns the given IPv4 address in the X.X.X.X format when removePrefix option is true", () => {
    expect(formatIp({ address: "1.2.3.4", prefix: 24 }, { removePrefix: true })).toEqual("1.2.3.4");
    expect(
      formatIp({ address: "1.2.3.4", prefix: "255.255.255.0" }, { removePrefix: true }),
    ).toEqual("1.2.3.4");
  });
});

describe("connectionForName", () => {
  const byIface = new Connection("Ethernet 1", { iface: "enp1s0" });
  const byId = new Connection("enp1s0", { iface: "enp2s0" });

  it("prefers the connection bound to the interface of that name", () => {
    expect(connectionForName("enp1s0", [byId, byIface])).toBe(byIface);
  });

  it("falls back to the connection with that id", () => {
    expect(connectionForName("enp1s0", [byId])).toBe(byId);
  });

  it("returns undefined when no connection matches", () => {
    expect(connectionForName("enp9s0", [byId, byIface])).toBeUndefined();
  });
});

describe("controllerOf", () => {
  const bondWithPorts = (ports: string[], options = {}) =>
    new Connection("Bond 1", {
      iface: "bond0",
      bond: { mode: BondMode.ACTIVE_BACKUP, options: "", ports },
      ...options,
    });

  it("returns the bond listing the device among its ports", () => {
    expect(controllerOf("enp1s0", [bondWithPorts(["enp1s0"])])).toBe("bond0");
  });

  it("returns the bridge listing the device among its ports", () => {
    const bridge = new Connection("Bridge 1", { iface: "br0", bridge: { ports: ["enp1s0"] } });
    expect(controllerOf("enp1s0", [bridge])).toBe("br0");
  });

  it("names the controller after its connection id when it has no interface", () => {
    const bond = new Connection("Bond 1", {
      bond: { mode: BondMode.ACTIVE_BACKUP, options: "", ports: ["enp1s0"] },
    });
    expect(controllerOf("enp1s0", [bond])).toBe("Bond 1");
  });

  it("finds the device listed by the id of the connection bound to it", () => {
    const port = new Connection("Ethernet 1", { iface: "enp1s0" });
    expect(controllerOf("enp1s0", [bondWithPorts(["Ethernet 1"]), port])).toBe("bond0");
  });

  it("returns undefined when no controller lists the device", () => {
    expect(controllerOf("enp9s0", [bondWithPorts(["enp1s0"])])).toBeUndefined();
  });

  it("returns undefined when there is no controller at all", () => {
    expect(controllerOf("enp1s0", [])).toBeUndefined();
  });
});

describe("securityFromFlags", () => {
  it("returns an array with the supported security protocols", () => {
    expect(securityFromFlags(0, 0, 0)).toEqual([]);
    expect(securityFromFlags(3, 392, 0)).toEqual([SecurityProtocols.WPA]);
  });
});

describe("connectionBindingMode", () => {
  describe("when the connection has a MAC address defined", () => {
    it("returns 'mac'", () => {
      expect(
        connectionBindingMode(
          new Connection("C#1", { macAddress: "AA:11:22:33:44::FF", iface: "enps10" }),
        ),
      ).toBe("mac");
    });
  });

  describe("when the connection has an iface defined but no MAC address", () => {
    it("returns 'iface'", () => {
      expect(connectionBindingMode(new Connection("C#1", { iface: "enps10" }))).toBe("iface");
    });
  });

  describe("when the connection has neither a MAC address nor an iface defined", () => {
    it("returns 'none'", () => {
      expect(connectionBindingMode(new Connection("C#1"))).toBe("none");
    });
  });
});

describe("generateConnectionName", () => {
  it("returns the connection type as the name", () => {
    expect(generateConnectionName("ethernet", new Set())).toBe("Ethernet");
  });

  it("capitalizes the type", () => {
    expect(generateConnectionName("wifi", new Set())).toBe("Wifi");
  });

  it("appends 2 as suffix when the base name is already taken", () => {
    expect(generateConnectionName("ethernet", new Set(["Ethernet"]))).toBe("Ethernet 2");
  });

  it("increments the suffix until a unique name is found", () => {
    expect(
      generateConnectionName("ethernet", new Set(["Ethernet", "Ethernet 2", "Ethernet 3"])),
    ).toBe("Ethernet 4");
  });
});

describe("addDefaultIPPrefix", () => {
  describe("IPv4 addresses", () => {
    describe("Class A (first octet 1-127)", () => {
      it("adds /8 prefix to valid addresses", () => {
        expect(addDefaultIPPrefix("10.0.0.1")).toBe("10.0.0.1/8");
        expect(addDefaultIPPrefix("1.2.3.4")).toBe("1.2.3.4/8");
        expect(addDefaultIPPrefix("127.0.0.1")).toBe("127.0.0.1/8");
      });
    });

    describe("Class B (first octet 128-191)", () => {
      it("adds /16 prefix to valid addresses", () => {
        expect(addDefaultIPPrefix("172.16.0.1")).toBe("172.16.0.1/16");
        expect(addDefaultIPPrefix("128.0.0.1")).toBe("128.0.0.1/16");
        expect(addDefaultIPPrefix("191.255.255.254")).toBe("191.255.255.254/16");
      });
    });

    describe("Class C (first octet 192-255)", () => {
      it("adds /24 prefix to valid addresses", () => {
        expect(addDefaultIPPrefix("192.168.1.1")).toBe("192.168.1.1/24");
        expect(addDefaultIPPrefix("192.0.2.1")).toBe("192.0.2.1/24");
        expect(addDefaultIPPrefix("255.255.255.255")).toBe("255.255.255.255/24");
      });
    });
  });

  describe("IPv6 addresses", () => {
    it("adds /64 prefix to valid addresses", () => {
      expect(addDefaultIPPrefix("2001:db8::1")).toBe("2001:db8::1/64");
      expect(addDefaultIPPrefix("fe80::1")).toBe("fe80::1/64");
      expect(addDefaultIPPrefix("::1")).toBe("::1/64");
    });
  });
});
