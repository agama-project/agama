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

/**
 * Field definitions for the connection form: types, constants, and defaults.
 *
 * validations.ts and transformations.ts build on these definitions, importing
 * the types and constants they need. The imports go one way only: this module
 * never imports from them, so every field stays defined in a single place.
 */

import { formOptions } from "@tanstack/react-form";

import { BondMode, ConnectionType, ConnectionBindingMode, VlanProtocol } from "~/types/network";
import { CONNECTION_TYPE } from "~/utils/network";

/** Types */

export type CommonFormFields = {
  name: string;
  type: ConnectionType;
  iface: string;
  ifaceMac: string;
  bindingMode: ConnectionBindingMode;
};

export type IpFormFields = {
  ipv4Mode: FormIpMode;
  addresses4: string[];
  gateway4: string;
  ipv6Mode: FormIpMode;
  addresses6: string[];
  gateway6: string;
  nameservers: string[];
  dnsSearchList: string[];
  customDns: boolean;
  customDnsSearch: boolean;
};

export type BondFormFields = {
  bondIface: string;
  bondMode: BondMode;
  bondOptions: string[];
  bondPorts: string[];
};

export type BridgeFormFields = {
  bridgeIface: string;
  bridgeStp: BridgeStpMode;
  bridgePriority: number | undefined;
  bridgeForwardDelay: number | undefined;
  bridgeHelloTime: number | undefined;
  bridgeMaxAge: number | undefined;
  bridgePorts: string[];
};

export type VlanFormFields = {
  vlanIface: string;
  vlanId: number | undefined;
  vlanParent: string;
  vlanProtocol: VlanProtocolMode;
};

export type FormFields = CommonFormFields &
  IpFormFields &
  BondFormFields &
  BridgeFormFields &
  VlanFormFields;

/** Exported domain constants */

/**
 * Connection types supported by this form.
 */
export const SUPPORTED_CONNECTION_TYPES = [
  CONNECTION_TYPE.ETHERNET,
  CONNECTION_TYPE.BOND,
  CONNECTION_TYPE.BRIDGE,
  CONNECTION_TYPE.VLAN,
] as const;

/**
 * Form IP mode values.
 *
 * These control UI behavior (which fields are shown) and map to ConnectionMethod:
 * - AUTO: no address/gateway fields shown → ConnectionMethod.AUTO
 * - ADVANCED_AUTO: addresses required, gateway optional → ConnectionMethod.AUTO
 * - MANUAL: addresses and gateway required → ConnectionMethod.MANUAL
 */
export const FormIpMode = {
  AUTO: "auto",
  ADVANCED_AUTO: "advanced-auto",
  MANUAL: "manual",
} as const;

export type FormIpMode = (typeof FormIpMode)[keyof typeof FormIpMode];

/**
 * Modes that require at least one address to be provided.
 */
export const ADDRESS_REQUIRED_MODES: readonly FormIpMode[] = [
  FormIpMode.MANUAL,
  FormIpMode.ADVANCED_AUTO,
];

/**
 * Bridge STP (Spanning Tree Protocol) mode values.
 */
export const BridgeStpMode = {
  DEFAULT: "default",
  ENABLED: "enabled",
  DISABLED: "disabled",
} as const;

export type BridgeStpMode = (typeof BridgeStpMode)[keyof typeof BridgeStpMode];

/**
 * VLAN encapsulation protocol mode values.
 */
export const VlanProtocolMode = {
  DEFAULT: "default",
  IEEE_802_1Q: VlanProtocol.IEEE_802_1Q,
  IEEE_802_1AD: VlanProtocol.IEEE_802_1AD,
} as const;

export type VlanProtocolMode = (typeof VlanProtocolMode)[keyof typeof VlanProtocolMode];

/** Default values */

/**
 * Default values for all ConnectionForm fields.
 *
 * Composed from field groups: common, IP, bond, bridge, and VLAN.
 */
const defaultValues = {
  // Common fields
  name: "",
  type: CONNECTION_TYPE.ETHERNET as ConnectionType,
  iface: "",
  ifaceMac: "",
  bindingMode: "none" as ConnectionBindingMode,

  // IP fields
  ipv4Mode: FormIpMode.AUTO as FormIpMode,
  addresses4: [] as string[],
  gateway4: "",
  ipv6Mode: FormIpMode.AUTO as FormIpMode,
  addresses6: [] as string[],
  gateway6: "",
  nameservers: [] as string[],
  dnsSearchList: [] as string[],
  customDns: false,
  customDnsSearch: false,

  // Bond fields
  bondIface: "",
  bondMode: BondMode.BALANCE_ROUND_ROBIN as BondMode,
  bondOptions: [] as string[],
  bondPorts: [] as string[],

  // Bridge fields
  bridgeIface: "",
  bridgeStp: BridgeStpMode.DEFAULT as BridgeStpMode,
  bridgePriority: undefined,
  bridgeForwardDelay: undefined,
  bridgeHelloTime: undefined,
  bridgeMaxAge: undefined,
  bridgePorts: [] as string[],

  // VLAN fields
  vlanIface: "",
  vlanId: undefined,
  vlanParent: "",
  vlanProtocol: VlanProtocolMode.DEFAULT as VlanProtocolMode,
};

/**
 * Shared form options for ConnectionForm and its sub-components.
 * Sub-components spread these options in their withForm definition.
 */
export const defaultOptions = formOptions({
  defaultValues,
});
