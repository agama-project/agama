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

import { BondMode } from "~/types/network";
import { CONNECTION_TYPE } from "~/utils/network";
import { defaultOptions, FormIpMode, BridgeStpMode, VlanProtocolMode } from "./fields";
import { validate } from "./validations";
import type { FormFields } from "./fields";

/** A valid Ethernet connection, used as the starting point for most cases. */
const ethernetFields = (overrides: Partial<FormFields> = {}): FormFields => ({
  ...defaultOptions.defaultValues,
  name: "My connection",
  ...overrides,
});

const bondFields = (overrides: Partial<FormFields> = {}): FormFields =>
  ethernetFields({
    type: CONNECTION_TYPE.BOND,
    bondIface: "bond0",
    bondPorts: ["enp1s0"],
    ...overrides,
  });

const bridgeFields = (overrides: Partial<FormFields> = {}): FormFields =>
  ethernetFields({
    type: CONNECTION_TYPE.BRIDGE,
    bridgeIface: "br0",
    bridgePorts: ["enp1s0"],
    ...overrides,
  });

const vlanFields = (overrides: Partial<FormFields> = {}): FormFields =>
  ethernetFields({
    type: CONNECTION_TYPE.VLAN,
    vlanIface: "eth0.100",
    vlanId: 100,
    vlanProtocol: VlanProtocolMode.DEFAULT,
    ...overrides,
  });

describe("validate", () => {
  it("returns undefined for a valid connection", () => {
    expect(validate(ethernetFields())).toBeUndefined();
  });

  describe("common fields", () => {
    it("returns an error when the name is empty", () => {
      const result = validate(ethernetFields({ name: "" }));
      expect(result?.fields?.name).toBe("Name is required");
    });

    it("accepts a non-empty name", () => {
      const result = validate(ethernetFields({ name: "Work WiFi" }));
      expect(result?.fields?.name).toBeUndefined();
    });
  });

  describe("IPv4 fields", () => {
    describe("Manual mode", () => {
      it("requires at least one address", () => {
        const result = validate(ethernetFields({ ipv4Mode: FormIpMode.MANUAL, addresses4: [] }));
        expect(result?.fields?.addresses4).toBe("At least one IPv4 address is required");
      });

      it("rejects invalid addresses", () => {
        const result = validate(
          ethernetFields({ ipv4Mode: FormIpMode.MANUAL, addresses4: ["not-an-ip"] }),
        );
        expect(result?.fields?.addresses4).toBe("Some IPv4 addresses are invalid");
      });

      it("requires the gateway", () => {
        const result = validate(
          ethernetFields({
            ipv4Mode: FormIpMode.MANUAL,
            addresses4: ["192.168.1.10/24"],
            gateway4: "",
          }),
        );
        expect(result?.fields?.gateway4).toBe("IPv4 gateway is required");
      });

      it("rejects an invalid gateway", () => {
        const result = validate(
          ethernetFields({
            ipv4Mode: FormIpMode.MANUAL,
            addresses4: ["192.168.1.10/24"],
            gateway4: "nope",
          }),
        );
        expect(result?.fields?.gateway4).toBe("Invalid IPv4 gateway");
      });

      it("accepts valid addresses and gateway", () => {
        const result = validate(
          ethernetFields({
            ipv4Mode: FormIpMode.MANUAL,
            addresses4: ["192.168.1.10/24"],
            gateway4: "192.168.1.1",
          }),
        );
        expect(result?.fields?.addresses4).toBeUndefined();
        expect(result?.fields?.gateway4).toBeUndefined();
      });
    });

    describe("Automatic + manual mode", () => {
      it("requires at least one address", () => {
        const result = validate(
          ethernetFields({ ipv4Mode: FormIpMode.ADVANCED_AUTO, addresses4: [] }),
        );
        expect(result?.fields?.addresses4).toBe("At least one IPv4 address is required");
      });

      it("treats the gateway as optional", () => {
        const result = validate(
          ethernetFields({
            ipv4Mode: FormIpMode.ADVANCED_AUTO,
            addresses4: ["192.168.1.10/24"],
            gateway4: "",
          }),
        );
        expect(result?.fields?.gateway4).toBeUndefined();
      });
    });

    describe("Automatic mode", () => {
      it("does not require addresses", () => {
        const result = validate(ethernetFields({ ipv4Mode: FormIpMode.AUTO, addresses4: [] }));
        expect(result?.fields?.addresses4).toBeUndefined();
      });

      it("still rejects invalid addresses when provided", () => {
        const result = validate(ethernetFields({ ipv4Mode: FormIpMode.AUTO, addresses4: ["bad"] }));
        expect(result?.fields?.addresses4).toBe("Some IPv4 addresses are invalid");
      });

      it("does not validate the gateway", () => {
        const result = validate(ethernetFields({ ipv4Mode: FormIpMode.AUTO, gateway4: "nope" }));
        expect(result?.fields?.gateway4).toBeUndefined();
      });
    });
  });

  describe("IPv6 fields", () => {
    it("requires at least one address in Manual mode", () => {
      const result = validate(ethernetFields({ ipv6Mode: FormIpMode.MANUAL, addresses6: [] }));
      expect(result?.fields?.addresses6).toBe("At least one IPv6 address is required");
    });

    it("rejects an invalid gateway in Manual mode", () => {
      const result = validate(
        ethernetFields({
          ipv6Mode: FormIpMode.MANUAL,
          addresses6: ["2001:db8::1/64"],
          gateway6: "nope",
        }),
      );
      expect(result?.fields?.gateway6).toBe("Invalid IPv6 gateway");
    });

    it("accepts valid addresses and gateway", () => {
      const result = validate(
        ethernetFields({
          ipv6Mode: FormIpMode.MANUAL,
          addresses6: ["2001:db8::1/64"],
          gateway6: "2001:db8::ffff",
        }),
      );
      expect(result?.fields?.addresses6).toBeUndefined();
      expect(result?.fields?.gateway6).toBeUndefined();
    });
  });

  describe("DNS fields", () => {
    it("requires a server when custom DNS is enabled", () => {
      const result = validate(ethernetFields({ customDns: true, nameservers: [] }));
      expect(result?.fields?.nameservers).toBe("At least one DNS server is required");
    });

    it("rejects invalid servers when custom DNS is enabled", () => {
      const result = validate(ethernetFields({ customDns: true, nameservers: ["bad"] }));
      expect(result?.fields?.nameservers).toBe("Some DNS server addresses are invalid");
    });

    it("does not validate servers when custom DNS is disabled", () => {
      const result = validate(ethernetFields({ customDns: false, nameservers: ["bad"] }));
      expect(result?.fields?.nameservers).toBeUndefined();
    });

    it("requires a domain when custom DNS search is enabled", () => {
      const result = validate(ethernetFields({ customDnsSearch: true, dnsSearchList: [] }));
      expect(result?.fields?.dnsSearchList).toBe("At least one DNS search domain is required");
    });

    it("does not validate domains when custom DNS search is disabled", () => {
      const result = validate(
        ethernetFields({ customDnsSearch: false, dnsSearchList: ["bad domain"] }),
      );
      expect(result?.fields?.dnsSearchList).toBeUndefined();
    });
  });

  describe("Bond fields", () => {
    it("returns undefined for a valid bond", () => {
      expect(validate(bondFields())).toBeUndefined();
    });

    it("requires the device name", () => {
      const result = validate(bondFields({ bondIface: "" }));
      expect(result?.fields?.bondIface).toBe("Device name is required");
    });

    it("requires at least one port", () => {
      const result = validate(bondFields({ bondPorts: [] }));
      expect(result?.fields?.bondPorts).toBe("At least one bond port is required");
    });

    it("rejects the 'primary' option in a mode that does not support it", () => {
      const result = validate(
        bondFields({ bondMode: BondMode.BALANCE_ROUND_ROBIN, bondOptions: ["primary=enp1s0"] }),
      );
      expect(result?.fields?.bondOptions).toBe(
        "The 'primary' option is only valid for 'active-backup', 'balance-tlb', and 'balance-alb' modes",
      );
    });

    it("accepts the 'primary' option in a supported mode", () => {
      const result = validate(
        bondFields({ bondMode: BondMode.ACTIVE_BACKUP, bondOptions: ["primary=enp1s0"] }),
      );
      expect(result?.fields?.bondOptions).toBeUndefined();
    });
  });

  describe("Bridge fields", () => {
    it("returns undefined for a valid bridge", () => {
      expect(validate(bridgeFields())).toBeUndefined();
    });

    it("requires the device name", () => {
      const result = validate(bridgeFields({ bridgeIface: "" }));
      expect(result?.fields?.bridgeIface).toBe("Device name is required");
    });

    it("requires at least one port", () => {
      const result = validate(bridgeFields({ bridgePorts: [] }));
      expect(result?.fields?.bridgePorts).toBe("At least one bridge port is required");
    });

    describe("STP settings", () => {
      it("validates ranges only when STP is enabled", () => {
        const result = validate(
          bridgeFields({
            bridgeStp: BridgeStpMode.ENABLED,
            bridgePriority: 70000,
            bridgeForwardDelay: 2,
            bridgeHelloTime: 11,
            bridgeMaxAge: 5,
          }),
        );
        expect(result?.fields?.bridgePriority).toBe("Priority must be between 0 and 61440");
        expect(result?.fields?.bridgeForwardDelay).toBe(
          "Forward delay must be between 4 and 30 seconds",
        );
        expect(result?.fields?.bridgeHelloTime).toBe("Hello time must be between 1 and 10 seconds");
        expect(result?.fields?.bridgeMaxAge).toBe(
          "Max message age must be between 6 and 40 seconds",
        );
      });

      it("ignores out-of-range values when STP is not enabled", () => {
        const result = validate(
          bridgeFields({ bridgeStp: BridgeStpMode.DEFAULT, bridgePriority: 70000 }),
        );
        expect(result?.fields?.bridgePriority).toBeUndefined();
      });

      it("accepts in-range values and empty (optional) values when STP is enabled", () => {
        const result = validate(
          bridgeFields({
            bridgeStp: BridgeStpMode.ENABLED,
            bridgePriority: 16384,
            bridgeForwardDelay: undefined,
            bridgeHelloTime: undefined,
            bridgeMaxAge: undefined,
          }),
        );
        expect(result?.fields?.bridgePriority).toBeUndefined();
        expect(result?.fields?.bridgeForwardDelay).toBeUndefined();
      });
    });
  });

  describe("VLAN fields", () => {
    it("returns undefined for a valid VLAN", () => {
      expect(validate(vlanFields())).toBeUndefined();
    });

    it("requires the device name", () => {
      const result = validate(vlanFields({ vlanIface: "" }));
      expect(result?.fields?.vlanIface).toBe("Device name is required");
    });

    it("requires the VLAN ID", () => {
      const result = validate(vlanFields({ vlanId: undefined }));
      expect(result?.fields?.vlanId).toBe("VLAN ID is required");
    });

    it("rejects an out-of-range VLAN ID", () => {
      const result = validate(vlanFields({ vlanId: 5000 }));
      expect(result?.fields?.vlanId).toBe("VLAN ID must be between 0 and 4094");
    });
  });

  describe("composition", () => {
    it("does not run type-specific validators for the wrong type", () => {
      // Empty bondIface must not appear as an error while the type is Ethernet.
      const result = validate(ethernetFields({ bondIface: "" }));
      expect(result?.fields?.bondIface).toBeUndefined();
    });

    it("collects errors from several field groups at once", () => {
      const result = validate(bridgeFields({ name: "", bridgeIface: "", bridgePorts: [] }));
      expect(result?.fields?.name).toBeDefined();
      expect(result?.fields?.bridgeIface).toBeDefined();
      expect(result?.fields?.bridgePorts).toBeDefined();
    });
  });
});
