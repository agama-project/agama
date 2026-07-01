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
} from "~/types/network";
import { CONNECTION_TYPE } from "~/utils/network";
import { defaultOptions, FormIpMode, BridgeStpMode, VlanProtocolMode } from "./fields";
import { buildPayload, toFormValues } from "./transformations";
import type { FormFields } from "./fields";

const formValues = (overrides: Partial<FormFields> = {}): FormFields => ({
  ...defaultOptions.defaultValues,
  name: "My connection",
  ...overrides,
});

/** Builds a Connection instance from minimal API data, with sensible defaults. */
const apiConnection = (id: string, overrides = {}) =>
  Connection.fromApi({
    id,
    status: ConnectionStatus.UP,
    state: ConnectionState.ACTIVATED,
    persistent: true,
    addresses: [],
    nameservers: [],
    dnsSearchList: [],
    ...overrides,
  });

describe("buildPayload", () => {
  it("uses the name as the connection id", () => {
    expect(buildPayload(formValues({ name: "Work WiFi" })).id).toBe("Work WiFi");
  });

  describe("IPv4 addressing", () => {
    it("omits addresses and forces AUTO method in Automatic mode", () => {
      const result = buildPayload(
        formValues({ ipv4Mode: FormIpMode.AUTO, addresses4: ["192.168.1.10/24"] }),
      );
      expect(result.method4).toBe(ConnectionMethod.AUTO);
      expect(result.addresses).toEqual([]);
    });

    it("includes addresses and gateway in Manual mode", () => {
      const result = buildPayload(
        formValues({
          ipv4Mode: FormIpMode.MANUAL,
          addresses4: ["192.168.1.10/24"],
          gateway4: "192.168.1.1",
        }),
      );
      expect(result.method4).toBe(ConnectionMethod.MANUAL);
      expect(result.addresses).toEqual([{ address: "192.168.1.10", prefix: 24 }]);
      expect(result.gateway4).toBe("192.168.1.1");
    });

    it("keeps AUTO method but includes addresses in Automatic + manual mode", () => {
      const result = buildPayload(
        formValues({ ipv4Mode: FormIpMode.ADVANCED_AUTO, addresses4: ["192.168.1.10/24"] }),
      );
      expect(result.method4).toBe(ConnectionMethod.AUTO);
      expect(result.addresses).toEqual([{ address: "192.168.1.10", prefix: 24 }]);
    });

    it("drops the gateway when there are no addresses", () => {
      const result = buildPayload(
        formValues({ ipv4Mode: FormIpMode.MANUAL, addresses4: [], gateway4: "192.168.1.1" }),
      );
      expect(result.gateway4).toBe("");
    });
  });

  describe("DNS", () => {
    it("includes nameservers and search domains when custom DNS is enabled", () => {
      const result = buildPayload(
        formValues({
          customDns: true,
          nameservers: ["8.8.8.8"],
          customDnsSearch: true,
          dnsSearchList: ["example.com"],
        }),
      );
      expect(result.nameservers).toEqual(["8.8.8.8"]);
      expect(result.dnsSearchList).toEqual(["example.com"]);
    });

    it("omits nameservers and search domains when custom DNS is disabled", () => {
      const result = buildPayload(
        formValues({
          customDns: false,
          nameservers: ["8.8.8.8"],
          customDnsSearch: false,
          dnsSearchList: ["example.com"],
        }),
      );
      expect(result.nameservers).toEqual([]);
      expect(result.dnsSearchList).toEqual([]);
    });
  });

  describe("device binding", () => {
    it("sets the iface when binding by name", () => {
      const result = buildPayload(formValues({ bindingMode: "iface", iface: "enp1s0" }));
      expect(result.iface).toBe("enp1s0");
      expect(result.macAddress).toBeFalsy();
    });

    it("sets the MAC address when binding by MAC", () => {
      const result = buildPayload(
        formValues({ bindingMode: "mac", ifaceMac: "00:11:22:33:44:55", iface: "enp1s0" }),
      );
      expect(result.macAddress).toBe("00:11:22:33:44:55");
      expect(result.iface).toBeFalsy();
    });
  });

  describe("Bond", () => {
    it("builds the bond config from the bond fields", () => {
      const result = buildPayload(
        formValues({
          type: CONNECTION_TYPE.BOND,
          bondIface: "bond0",
          bondMode: BondMode.ACTIVE_BACKUP,
          bondOptions: ["primary=enp1s0", "miimon=100"],
          bondPorts: ["enp1s0", "enp2s0"],
        }),
      );
      expect(result.iface).toBe("bond0");
      expect(result.bond).toEqual({
        mode: BondMode.ACTIVE_BACKUP,
        options: "primary=enp1s0 miimon=100",
        ports: ["enp1s0", "enp2s0"],
      });
    });

    it("does not build a bond config for non-bond types", () => {
      expect(buildPayload(formValues()).bond).toBeUndefined();
    });
  });

  describe("Bridge", () => {
    it("leaves STP undefined in Default mode", () => {
      const result = buildPayload(
        formValues({
          type: CONNECTION_TYPE.BRIDGE,
          bridgeIface: "br0",
          bridgeStp: BridgeStpMode.DEFAULT,
          bridgePorts: ["enp1s0"],
        }),
      );
      expect(result.bridge?.stp).toBeUndefined();
      expect(result.bridge?.ports).toEqual(["enp1s0"]);
    });

    it("includes STP options when STP is enabled", () => {
      const result = buildPayload(
        formValues({
          type: CONNECTION_TYPE.BRIDGE,
          bridgeIface: "br0",
          bridgeStp: BridgeStpMode.ENABLED,
          bridgePriority: 16384,
          bridgeForwardDelay: 10,
          bridgePorts: ["enp1s0"],
        }),
      );
      expect(result.bridge?.stp).toBe(true);
      expect(result.bridge?.priority).toBe(16384);
      expect(result.bridge?.forwardDelay).toBe(10);
    });

    it("drops STP options when STP is disabled", () => {
      const result = buildPayload(
        formValues({
          type: CONNECTION_TYPE.BRIDGE,
          bridgeIface: "br0",
          bridgeStp: BridgeStpMode.DISABLED,
          bridgePriority: 16384,
          bridgePorts: ["enp1s0"],
        }),
      );
      expect(result.bridge?.stp).toBe(false);
      expect(result.bridge?.priority).toBeUndefined();
    });
  });

  describe("VLAN", () => {
    it("builds the VLAN config from the VLAN fields", () => {
      const result = buildPayload(
        formValues({
          type: CONNECTION_TYPE.VLAN,
          vlanIface: "eth0.100",
          vlanId: 100,
          vlanParent: "eth0",
          vlanProtocol: VlanProtocolMode.DEFAULT,
        }),
      );
      expect(result.iface).toBe("eth0.100");
      expect(result.vlan).toEqual({ id: 100, parent: "eth0", protocol: undefined });
    });
  });
});

describe("toFormValues", () => {
  it("returns an empty object for a new connection (null)", () => {
    expect(toFormValues(null)).toEqual({});
  });

  it("maps the basic identity fields", () => {
    const result = toFormValues(new Connection("eth0", { iface: "enp1s0" }));
    expect(result).toMatchObject({
      name: "eth0",
      type: CONNECTION_TYPE.ETHERNET,
      iface: "enp1s0",
      bindingMode: "iface",
    });
  });

  describe("IP mode inference", () => {
    it("infers Manual when the method is manual", () => {
      const result = toFormValues(
        apiConnection("eth0", { method4: "manual", addresses: ["192.168.1.10/24"] }),
      );
      expect(result.ipv4Mode).toBe(FormIpMode.MANUAL);
      expect(result.addresses4).toEqual(["192.168.1.10/24"]);
    });

    it("infers Automatic + manual when method is auto but addresses exist", () => {
      const result = toFormValues(
        apiConnection("eth0", { method4: "auto", addresses: ["192.168.1.10/24"] }),
      );
      expect(result.ipv4Mode).toBe(FormIpMode.ADVANCED_AUTO);
    });

    it("infers Automatic when there is no method and no addresses", () => {
      const result = toFormValues(apiConnection("eth0"));
      expect(result.ipv4Mode).toBe(FormIpMode.AUTO);
      expect(result.addresses4).toEqual([]);
    });

    it("splits addresses by family", () => {
      const result = toFormValues(
        apiConnection("eth0", { addresses: ["192.168.1.10/24", "2001:db8::1/64"] }),
      );
      expect(result.addresses4).toEqual(["192.168.1.10/24"]);
      expect(result.addresses6).toEqual(["2001:db8::1/64"]);
    });
  });

  describe("DNS toggles", () => {
    it("enables custom DNS when nameservers are present", () => {
      const result = toFormValues(apiConnection("eth0", { nameservers: ["8.8.8.8"] }));
      expect(result.customDns).toBe(true);
      expect(result.nameservers).toEqual(["8.8.8.8"]);
    });

    it("enables custom DNS search when search domains are present", () => {
      const result = toFormValues(apiConnection("eth0", { dnsSearchList: ["example.com"] }));
      expect(result.customDnsSearch).toBe(true);
    });

    it("leaves custom DNS off when there are no nameservers", () => {
      const result = toFormValues(apiConnection("eth0"));
      expect(result.customDns).toBe(false);
    });
  });

  describe("bridge STP inference", () => {
    it("infers Enabled when stp is true", () => {
      const result = toFormValues(
        apiConnection("br0", { bridge: { ports: ["enp1s0"], stp: true } }),
      );
      expect(result.bridgeStp).toBe(BridgeStpMode.ENABLED);
    });

    it("infers Disabled when stp is false", () => {
      const result = toFormValues(
        apiConnection("br0", { bridge: { ports: ["enp1s0"], stp: false } }),
      );
      expect(result.bridgeStp).toBe(BridgeStpMode.DISABLED);
    });

    it("infers Enabled when stp is missing but other STP options are present", () => {
      const result = toFormValues(
        apiConnection("br0", { bridge: { ports: ["enp1s0"], priority: 32768 } }),
      );
      expect(result.bridgeStp).toBe(BridgeStpMode.ENABLED);
    });

    it("infers Default when no STP information is present", () => {
      const result = toFormValues(apiConnection("br0", { bridge: { ports: ["enp1s0"] } }));
      expect(result.bridgeStp).toBe(BridgeStpMode.DEFAULT);
    });
  });
});
