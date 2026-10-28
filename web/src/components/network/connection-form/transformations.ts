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
 * Transformation functions for the connection form.
 *
 * This module handles conversion between {@link Connection} structures and form
 * field values. It provides:
 *
 * - **buildPayload**: Converts form values to a Connection for API mutations
 * - **toFormValues**: Converts a Connection to initial form values
 *
 * ## Data Flow
 *
 * ```
 * Initial load:
 *   Connection → toFormValues() → FormValues → TanStack Form state
 *
 * Form submission:
 *   TanStack Form state → FormValues → buildPayload() → Connection → API
 * ```
 */

import { unique } from "radashi";
import {
  buildAddress,
  connectionBindingMode,
  connectionType,
  CONNECTION_TYPE,
  ensureIPPrefix,
  formatIp,
  isVirtual,
  isValidIPv4Address,
} from "~/utils/network";
import {
  ADDRESS_REQUIRED_MODES,
  BridgeStpMode,
  FormIpMode,
  VlanProtocolMode,
  defaultOptions,
} from "./fields";

import type {
  FormIpMode as FormIpModeType,
  BridgeStpMode as BridgeStpModeType,
  VlanProtocolMode as VlanProtocolModeType,
} from "./fields";
import { BondMode, Bridge, Connection, ConnectionMethod, VlanProtocol } from "~/types/network";

type FormValues = typeof defaultOptions.defaultValues;

/**
 * Maps form mode values to their corresponding {@link ConnectionMethod}.
 *
 * Both AUTO and ADVANCED_AUTO map to ConnectionMethod.AUTO; they differ
 * only in UI behavior (whether address/gateway fields are shown).
 */
const MODE_TO_METHOD: Record<FormIpModeType, ConnectionMethod> = {
  [FormIpMode.AUTO]: ConnectionMethod.AUTO,
  [FormIpMode.ADVANCED_AUTO]: ConnectionMethod.AUTO,
  [FormIpMode.MANUAL]: ConnectionMethod.MANUAL,
};

/**
 * Infers the form IPvX mode from a stored {@link ConnectionMethod} and addresses.
 *
 * The presence of addresses affects the interpretation:
 * - `MANUAL` method → MANUAL
 * - `AUTO` method with addresses → ADVANCED_AUTO
 * - `AUTO` method without addresses → AUTO
 * - `undefined` method with addresses → ADVANCED_AUTO (from system)
 * - `undefined` method without addresses → AUTO
 */
function inferIpMode(method: ConnectionMethod | undefined, addresses: string[]): FormIpModeType {
  if (method === ConnectionMethod.MANUAL) return FormIpMode.MANUAL;

  return addresses.length > 0 ? FormIpMode.ADVANCED_AUTO : FormIpMode.AUTO;
}

/**
 * Infers the bridge STP mode from the stored {@link Bridge} configuration.
 *
 * If `stp` is explicitly defined, that value is used.
 * If `stp` is absent but other STP-related options are present, it's
 * inferred as ENABLED. Otherwise, it defaults to DEFAULT (system default).
 */
function inferBridgeStp(bridge: Bridge | undefined): BridgeStpModeType {
  if (!bridge) return BridgeStpMode.DEFAULT;

  if (bridge.stp !== undefined) {
    return bridge.stp ? BridgeStpMode.ENABLED : BridgeStpMode.DISABLED;
  }

  const hasStpOptions =
    bridge.priority !== undefined ||
    bridge.forwardDelay !== undefined ||
    bridge.helloTime !== undefined ||
    bridge.maxAge !== undefined;

  return hasStpOptions ? BridgeStpMode.ENABLED : BridgeStpMode.DEFAULT;
}

/**
 * Maps an existing {@link Connection} to initial form values for editing.
 *
 * Returns an empty object when creating a new connection (connection is null),
 * which allows the form defaults to take precedence.
 */
export function toFormValues(connection: Connection | null): Partial<FormValues> {
  if (!connection) return {};

  // Deduplicate addresses (config + system merge can create duplicates)
  const uniqueAddresses = unique(connection.addresses, (addr) => `${addr.address}/${addr.prefix}`);

  // Partition and format addresses in a single pass using proper IP validation
  const addresses4: string[] = [];
  const addresses6: string[] = [];

  for (const addr of uniqueAddresses) {
    const formatted = ensureIPPrefix(formatIp(addr));
    if (isValidIPv4Address(addr.address)) {
      addresses4.push(formatted);
    } else {
      addresses6.push(formatted);
    }
  }

  return {
    name: connection.id,
    type: connectionType(connection),
    iface: connection.iface ?? "",
    ifaceMac: connection.macAddress ?? "",
    bindingMode: connectionBindingMode(connection),
    ipv4Mode: inferIpMode(connection.method4, addresses4),
    addresses4,
    gateway4: connection.gateway4 ?? "",
    ipv6Mode: inferIpMode(connection.method6, addresses6),
    addresses6,
    gateway6: connection.gateway6 ?? "",
    nameservers: unique(connection.nameservers),
    dnsSearchList: unique(connection.dnsSearchList),
    customDns: connection.nameservers.length > 0,
    customDnsSearch: connection.dnsSearchList.length > 0,
    bondIface: connection.iface,
    bondMode: connection.bond?.mode ?? BondMode.BALANCE_ROUND_ROBIN,
    bondOptions: connection.bond?.options ? connection.bond.options.split(" ") : [],
    bondPorts: connection.bond?.ports ?? [],
    bridgeIface: connection.iface,
    bridgeStp: inferBridgeStp(connection.bridge),
    bridgePriority: connection.bridge?.priority,
    bridgeForwardDelay: connection.bridge?.forwardDelay,
    bridgeHelloTime: connection.bridge?.helloTime,
    bridgeMaxAge: connection.bridge?.maxAge,
    bridgePorts: connection.bridge?.ports ?? [],
    vlanIface: connection.iface,
    vlanId: connection.vlan?.id,
    vlanParent: connection.vlan?.parent ?? "",
    vlanProtocol: (connection.vlan?.protocol ?? VlanProtocolMode.DEFAULT) as VlanProtocolModeType,
  };
}

/**
 * Builds a {@link Connection} from the validated form values.
 *
 * Addresses in formValues already have prefixes (added by ArrayField's
 * normalize or when loading from backend), so no prefix addition is needed.
 */
export function buildPayload(formValues: FormValues): Connection {
  const ipv4Addresses = ADDRESS_REQUIRED_MODES.includes(formValues.ipv4Mode)
    ? formValues.addresses4.map(buildAddress)
    : [];
  const ipv6Addresses = ADDRESS_REQUIRED_MODES.includes(formValues.ipv6Mode)
    ? formValues.addresses6.map(buildAddress)
    : [];

  let iface = "";
  if (isVirtual(formValues.type)) {
    iface = formValues[`${formValues.type}Iface`];
  } else if (formValues.bindingMode === "iface") {
    iface = formValues.iface;
  }
  return new Connection(formValues.name, {
    iface,
    macAddress: formValues.bindingMode === "mac" ? formValues.ifaceMac : "",
    method4: MODE_TO_METHOD[formValues.ipv4Mode],
    gateway4: ipv4Addresses.length > 0 ? formValues.gateway4 : "",
    method6: MODE_TO_METHOD[formValues.ipv6Mode],
    gateway6: ipv6Addresses.length > 0 ? formValues.gateway6 : "",
    addresses: [...ipv4Addresses, ...ipv6Addresses],
    nameservers: formValues.customDns ? formValues.nameservers : [],
    dnsSearchList: formValues.customDnsSearch ? formValues.dnsSearchList : [],
    bond:
      formValues.type === CONNECTION_TYPE.BOND
        ? {
            mode: formValues.bondMode,
            options: formValues.bondOptions.join(" "),
            ports: formValues.bondPorts,
          }
        : undefined,
    bridge:
      formValues.type === CONNECTION_TYPE.BRIDGE
        ? {
            stp: (() => {
              if (formValues.bridgeStp === BridgeStpMode.DEFAULT) return undefined;
              return formValues.bridgeStp === BridgeStpMode.ENABLED;
            })(),
            priority:
              formValues.bridgeStp === BridgeStpMode.ENABLED
                ? formValues.bridgePriority
                : undefined,
            forwardDelay:
              formValues.bridgeStp === BridgeStpMode.ENABLED
                ? formValues.bridgeForwardDelay
                : undefined,
            helloTime:
              formValues.bridgeStp === BridgeStpMode.ENABLED
                ? formValues.bridgeHelloTime
                : undefined,
            maxAge:
              formValues.bridgeStp === BridgeStpMode.ENABLED ? formValues.bridgeMaxAge : undefined,
            ports: formValues.bridgePorts,
          }
        : undefined,
    vlan:
      formValues.type === CONNECTION_TYPE.VLAN
        ? {
            id: formValues.vlanId!,
            parent: formValues.vlanParent,
            protocol:
              formValues.vlanProtocol !== VlanProtocolMode.DEFAULT
                ? (formValues.vlanProtocol as VlanProtocol)
                : undefined,
          }
        : undefined,
  });
}
