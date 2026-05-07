/*
 * Copyright (c) [2024] SUSE LLC
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

import { isBoolean, isEmpty, isObject } from "radashi";
import {
  buildAddress,
  buildAddresses,
  buildRoutes,
  formatIp,
  securityFromFlags,
} from "~/utils/network";

/**
 * Union type of all connection type string values.
 */
export type ConnectionType =
  | "ethernet"
  | "wireless"
  | "loopback"
  | "bond"
  | "bridge"
  | "vlan"
  | "unknown";

/**
 * Enum for AccessPoint flags
 *
 * https://networkmanager.dev/docs/api/latest/nm-dbus-types.html#NM80211ApFlags
 */
enum ApFlags {
  NONE = 0x00000000,
  PRIVACY = 0x00000001,
  WPS = 0x00000002,
  WPS_PBC = 0x00000004,
  WPS_PIN = 0x00000008,
}
/**
 * Enum for AccessPoint security flags
 *
 * https://networkmanager.dev/docs/api/latest/nm-dbus-types.html#NM80211ApSecurityFlags
 */
enum ApSecurityFlags {
  NONE = 0x00000000,
  PAIR_WEP40 = 0x00000001,
  PAIR_WEP104 = 0x00000002,
  PAIR_TKIP = 0x00000004,
  PAIR_CCMP = 0x00000008,
  GROUP_WEP40 = 0x00000010,
  GROUP_WEP104 = 0x00000020,
  GROUP_TKIP = 0x00000040,
  GROUP_CCMP = 0x00000080,
  KEY_MGMT_PSK = 0x00000100,
  KEY_MGMT_8021_X = 0x00000200,
}

/**
 * The  binding mode for the connection
 *  - "none":  No specific interface binding.
 *  - "iface": Bind to a specific interface name.
 *  - "mac":   Bind to a specific MAC address.
 */
type ConnectionBindingMode = "none" | "iface" | "mac";

enum BondMode {
  BALANCE_ROUND_ROBIN = "balance-rr",
  ACTIVE_BACKUP = "active-backup",
  BALANCE_XOR = "balance-xor",
  BROADCAST = "broadcast",
  LACP = "802.3ad",
  BALANCE_TLB = "balance-tlb",
  BALANCE_ALB = "balance-alb",
}

enum DeviceState {
  UNKNOWN = "unknown",
  UNMANAGED = "unmanaged",
  UNAVAILABLE = "unavailable",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  DISCONNECTING = "disconnecting",
  DISCONNECTED = "disconnected",
  FAILED = "failed",
}

enum ConnectionStatus {
  UP = "up",
  DOWN = "down",
  DELETE = "removed",
}

// Current state of the connection.
enum ConnectionState {
  activating = "activating",
  activated = "activated",
  deactivating = "deactivating",
  deactivated = "deactivated",
}

enum ConnectionMethod {
  MANUAL = "manual",
  AUTO = "auto",
}

enum DeviceType {
  LOOPBACK = 0,
  ETHERNET = 1,
  WIRELESS = 2,
  DUMMY = 3,
  BOND = 4,
  VLAN = 5,
  BRIDGE = 6,
}

enum NetworkState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
}

enum SecurityProtocols {
  WEP = "WEP",
  WPA = "WPA1",
  RSN = "WPA2",
  _8021X = "802.1X",
}

type IPAddress = {
  address: string;
  prefix?: number | string;
};

type Route = {
  destination: IPAddress;
  nextHop: string;
  metric: number;
};

type APIAccessPoint = {
  device: string;
  ssid: string;
  strength: number;
  hwAddress: string;
  flags: number;
  wpaFlags: number;
  rsnFlags: number;
};

class AccessPoint {
  deviceName: string;
  ssid: string;
  strength: number;
  hwAddress: string;
  security: SecurityProtocols[];

  constructor(
    device: string,
    ssid: string,
    strength: number,
    hwAddress: string,
    security: SecurityProtocols[],
  ) {
    this.deviceName = device;
    this.ssid = ssid;
    this.strength = strength;
    this.hwAddress = hwAddress;
    this.security = security;
  }

  static fromApi(options: APIAccessPoint) {
    const { device, ssid, strength, hwAddress, flags, wpaFlags, rsnFlags } = options;

    return new AccessPoint(
      device,
      ssid,
      strength,
      hwAddress,
      securityFromFlags(flags, wpaFlags, rsnFlags),
    );
  }
}

class Device {
  name: string;
  type: ConnectionType;
  addresses: IPAddress[];
  nameservers: string[];
  dnsSearchList: string[];
  gateway4: string;
  gateway6: string;
  method4: ConnectionMethod;
  method6: ConnectionMethod;
  routes4?: Route[];
  routes6?: Route[];
  macAddress: string;
  state: DeviceState;
  connection?: string;

  static fromApi(device: APIDevice) {
    const { ipConfig, stateReason, ...newDevice } = device;
    // FIXME: Actually, would be better to have a Device class too in types and
    // move all of this logic to it.
    return {
      ...newDevice,
      nameservers: ipConfig?.nameservers || [],
      dnsSearchList: ipConfig?.dnsSearchList || [],
      addresses: buildAddresses(ipConfig?.addresses),
      routes4: buildRoutes(ipConfig?.routes4),
      routes6: buildRoutes(ipConfig?.routes6),
      method4: ipConfig?.method4,
      method6: ipConfig?.method6,
      gateway4: ipConfig?.gateway4,
      gateway6: ipConfig?.gateway6,
    };
  }
}

type IPConfig = {
  addresses: string[];
  nameservers?: string[];
  dnsSearchList?: string[];
  gateway4?: string;
  gateway6?: string;
  method4: ConnectionMethod;
  method6: ConnectionMethod;
  routes4?: APIRoute[];
  routes6?: APIRoute[];
};

type APIDevice = {
  name: string;
  type: ConnectionType;
  macAddress: string;
  state: DeviceState;
  connection?: string;
  ipConfig?: IPConfig;
  stateReason: string;
};

type APIRoute = {
  destination: string;
  nextHop: string;
  metric: number;
};

type APIConnection = {
  id: string;
  bond?: Bond;
  interface?: string;
  macAddress?: string;
  addresses?: string[];
  nameservers?: string[];
  dnsSearchList?: string[];
  gateway4?: string;
  gateway6?: string;
  method4?: string;
  method6?: string;
  wireless?: Wireless;
  status: ConnectionStatus;
  state: ConnectionState;
  persistent: boolean;
};

type WirelessOptions = {
  ssid?: string;
  password?: string;
  security?: string;
  hidden?: boolean;
  mode?: string;
};

class Wireless {
  ssid: string;
  password?: string;
  security?: string;
  hidden?: boolean = false;
  mode: string = "infrastructure";

  constructor(options?: WirelessOptions) {
    if (!isObject(options)) return;

    for (const [key, value] of Object.entries(options)) {
      if (value) this[key] = value;
    }
  }
}

type Bond = {
  mode: BondMode;
  options: string;
  ports: string[];
};

type ConnectionOptions = {
  iface?: string;
  macAddress?: string;
  addresses?: IPAddress[];
  nameservers?: string[];
  dnsSearchList?: string[];
  gateway4?: string;
  gateway6?: string;
  method4?: ConnectionMethod;
  method6?: ConnectionMethod;
  wireless?: Wireless;
  bond?: Bond;
  status?: ConnectionStatus;
  state?: ConnectionState;
  persistent?: boolean;
};

// FIXME: Connection is modeled after an earlier API iteration that has not
// yet been fully aligned with APIv2. Few inconsistencies
// make the translation to/from form values and the API error-prone:
// - Fields like gateway4/gateway6 default to "" rather than being absent,
//   forcing toApi() to delete them explicitly and the form to mirror the
//   empty-string default.
// - Concepts like binding mode and IP method mode (e.g. "unset") have no
//   direct field here; the form derives them from other fields or omits
//   them entirely.
// Hence, this class is worth revisiting or even dropping in favor of plain
// types when moving closer to APIv2.
class Connection {
  id: string;
  status: ConnectionStatus = ConnectionStatus.UP;
  state: ConnectionState;
  iface: string;
  macAddress?: string;
  addresses: IPAddress[] = [];
  nameservers: string[] = [];
  dnsSearchList: string[] = [];
  gateway4?: string = "";
  gateway6?: string = "";
  method4?: ConnectionMethod;
  method6?: ConnectionMethod;
  bond?: Bond;
  wireless?: Wireless;
  persistent: boolean;

  constructor(id: string, options?: ConnectionOptions) {
    this.id = id;

    if (!isObject(options)) return;

    for (const [key, value] of Object.entries(options)) {
      if (isBoolean(value) || !isEmpty(value)) this[key] = value;
    }
  }

  static fromApi(connection: APIConnection) {
    const { id, status, interface: iface, ...options } = connection;
    const nameservers = connection.nameservers || [];
    const dnsSearchList = connection.dnsSearchList || [];
    const addresses = connection.addresses?.map(buildAddress) || [];
    const conn = new Connection(id, {
      ...options,
      status,
      // FIXME: try a better approach for methods/gateway and/or typecasting
      method4: options.method4 as ConnectionMethod,
      method6: options.method6 as ConnectionMethod,
      iface,
      addresses,
      nameservers,
      dnsSearchList,
    });
    // The constructor skips undefined values, meaning fields
    // absent from the API response are never assigned as own properties.
    // This matters when merging config and system connections via spread:
    //   { ...systemConn, ...configConn }
    // If configConn has no method4 own property, system's "auto" silently
    // wins. That is not the expected behavior: choosing "Automatic" in the
    // UI stores no method in config (undefined), which should override
    // system's "auto" since config represents the user's explicit preferences.
    // Assigning undefined explicitly ensures method4/method6 are always own
    // properties, so the user's choice is honored when editing.
    conn.method4 = options.method4 as ConnectionMethod | undefined;
    conn.method6 = options.method6 as ConnectionMethod | undefined;
    return conn;
  }

  toApi() {
    const { iface, addresses, ...newConnection } = this;
    const result: APIConnection = {
      ...newConnection,
      interface: iface,
      addresses: addresses?.map(formatIp) || [],
    };

    if (result.gateway4 === "") delete result.gateway4;
    if (result.gateway6 === "") delete result.gateway6;
    if (result.method4 === undefined) delete result.method4;
    if (result.method6 === undefined) delete result.method6;

    return result;
  }
}

enum WifiNetworkStatus {
  NOT_CONFIGURED = "not_configured",
  CONFIGURED = "configured",
  CONNECTED = "connected",
}

type WifiNetwork = AccessPoint & {
  settings?: Connection;
  device?: Device;
  // FIXME: maybe would be better to have a class and a method, to avoid having a connected status without a device, for example
  /** Whether the network is connected (configured and connected), configured (configured but
  not connected), or none  */
  status: WifiNetworkStatus;
  hidden?: boolean;
};

type GeneralState = {
  copyNetwork: boolean;
  connectivity: boolean;
  networkingEnabled: boolean;
  wirelessEnabled: boolean;
};

class NetworkSystem {
  connections: Connection[];
  accessPoints: AccessPoint[];
  devices: Device[];
  state: GeneralState;

  constructor(
    connections?: Connection[],
    accessPoints?: AccessPoint[],
    devices?: Device[],
    state?: GeneralState,
  ) {
    if (connections !== undefined) this.connections = connections;
    if (accessPoints !== undefined) this.accessPoints = accessPoints;
    if (devices !== undefined) this.devices = devices;
    if (state !== undefined) this.state = state;
  }

  static fromApi(options: APISystem) {
    const { connections: conns, accessPoints: aps, devices: devs, state } = options;
    const connections = conns.map(Connection.fromApi);
    const accessPoints = aps.map(AccessPoint.fromApi).sort((a, b) => b.strength - a.strength);
    const devices = devs.map(Device.fromApi);

    return new NetworkSystem(connections, accessPoints, devices, state);
  }
}

class NetworkConfig {
  connections?: Connection[];
  state?: GeneralStateConfig;

  constructor(
    connections?: Connection[],
    //accessPoints?: AccessPoint[],
    //devices?: Device[],
    state?: GeneralStateConfig,
  ) {
    if (connections !== undefined) this.connections = connections;
    if (state !== undefined) this.state = state;
  }

  static fromApi(options: APIConfig) {
    const { connections, state } = options;
    const conns = (connections || []).map((c) => Connection.fromApi(c));

    return new NetworkConfig(conns, state);
  }

  addOrUpdateConnection(connection: Connection) {
    const index = (this.connections || []).findIndex((c) => c.id === connection.id);

    if (index !== -1) {
      this.connections![index] = connection;
    } else {
      this.connections = [...(this.connections || []), connection];
    }
  }

  toApi(): APIConfig {
    const connections = this.connections?.map((c) => c.toApi()) || [];

    return { connections, state: this.state };
  }
}

class NetworkProposal {
  connections: Connection[];
  state: GeneralState;

  constructor(
    connections?: Connection[],
    //accessPoints?: AccessPoint[],
    //devices?: Device[],
    state?: GeneralState,
  ) {
    if (connections !== undefined) this.connections = connections;
    if (state !== undefined) this.state = state;
  }

  static fromApi(options: APIProposal) {
    const { connections, state } = options;
    const conns = (connections || []).map((c) => Connection.fromApi(c));

    return new NetworkProposal(conns, state);
  }

  addOrUpdateConnection(connection: Connection) {
    const index = (this.connections || []).findIndex((c) => c.id === connection.id);

    if (index !== -1) {
      this.connections[index] = connection;
    } else {
      this.connections = [...(this.connections || []), connection];
    }
  }

  toApi(): APIProposal {
    const connections = this.connections.map((c) => c.toApi());

    return { connections, state: this.state };
  }
}

type APISystem = {
  connections: APIConnection[];
  accessPoints: APIAccessPoint[];
  devices: APIDevice[];
  state: GeneralState;
};

type APIProposal = {
  connections: APIConnection[];
  state: GeneralState;
};

type GeneralStateConfig = {
  copyNetwork?: boolean;
  networkingEnabled?: boolean;
  wirelessEnabled?: boolean;
};

type APIConfig = {
  connections?: APIConnection[];
  state?: GeneralStateConfig;
};

export {
  AccessPoint,
  ApFlags,
  ApSecurityFlags,
  BondMode,
  Connection,
  ConnectionState,
  ConnectionStatus,
  ConnectionMethod,
  Device,
  DeviceState,
  DeviceType,
  NetworkConfig,
  NetworkProposal,
  NetworkState,
  NetworkSystem,
  SecurityProtocols,
  WifiNetworkStatus,
  Wireless,
};

export type {
  APIAccessPoint,
  APIConnection,
  ConnectionBindingMode,
  ConnectionOptions,
  APIDevice,
  IPAddress,
  APIConfig,
  APIProposal,
  APISystem,
  GeneralState,
  Route,
  APIRoute,
  WifiNetwork,
};
