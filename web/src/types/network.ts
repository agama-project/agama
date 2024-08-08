/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

import { isObject } from "~/utils";

enum ApFlags {
  NONE = 0x00000000,
  PRIVACY = 0x00000001,
  WPS = 0x00000002,
  WPS_PBC = 0x00000004,
  WPS_PIN = 0x00000008,
}

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

enum ConnectionType {
  ETHERNET = "ethernet",
  WIFI = "wireless",
  LOOPBACK = "loopback",
  BOND = "bond",
  BRIDGE = "bridge",
  VLAN = "vlan",
  UNKNOWN = "unknown",
}

/**
 * Enum for the active connection state values
 *
 * @readonly
 * @enum { number }
 * https://networkmanager.dev/docs/api/latest/nm-dbus-types.html#NMActiveConnectionState
 */
enum ConnectionState {
  UNKNOWN = 0,
  ACTIVATING = 1,
  ACTIVATED = 2,
  DEACTIVATING = 3,
  DEACTIVATED = 4,
}

enum DeviceState {
  UNKNOWN = "unknown",
  UNMANAGED = "unmanaged",
  UNAVAILABLE = "unavailable",
  DISCONNECTED = "disconnected",
  CONFIG = "config",
  IPCHECK = "ipCheck",
  NEEDAUTH = "needAuth",
  ACTIVATED = "activated",
  DEACTIVATING = "deactivating",
  FAILED = "failed",
}

enum ConnectionStatus {
  UP = "up",
  DOWN = "down",
}

enum DeviceType {
  LOOPBACK = 0,
  ETHERNET = 1,
  WIRELESS = 2,
  DUMMY = 3,
  BOND = 4,
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

type AccessPoint = {
  ssid: string;
  strength: number;
  hwAddress: string;
  security: string[];
};

type Device = {
  name: string;
  type: ConnectionType;
  addresses: IPAddress[];
  nameservers: string[];
  gateway4: string;
  gateway6: string;
  method4: string;
  method6: string;
  routes4?: Route[];
  routes6?: Route[];
  macAddress: string;
  state: DeviceState;
  connection?: string;
};

type IPConfig = {
  addresses: string[];
  nameservers?: string[];
  gateway4?: string;
  gateway6?: string;
  method4: string;
  method6: string;
  routes4?: RouteApi[];
  routes6?: RouteApi[];
};

type DeviceApi = {
  name: string;
  type: ConnectionType;
  macAddress: string;
  state: DeviceState;
  connection?: string;
  ipConfig?: IPConfig;
  stateReason: string;
};

type RouteApi = {
  destination: string;
  nextHop: string;
  metric: number;
};

type ConnectionApi = {
  id: string;
  interface: string;
  addresses?: string[];
  nameservers?: string[];
  gateway4?: string;
  gateway6?: string;
  method4: string;
  method6: string;
  wireless?: Wireless;
  status: ConnectionStatus;
};

type WirelessOptions = {
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

  constructor(options: WirelessOptions) {
    if (!isObject(options)) return;

    for (const [key, value] of Object.entries(options)) {
      if (value) this[key] = value;
    }
  }
}

type ConnectionOptions = {
  iface?: string;
  addresses?: IPAddress[];
  nameservers?: string[];
  gateway4?: string;
  gateway6?: string;
  method4?: string;
  method6?: string;
  wireless?: Wireless;
};

class Connection {
  id: string;
  status: ConnectionStatus;
  iface: string;
  addresses: IPAddress[] = [];
  nameservers: string[] = [];
  gateway4?: string = "";
  gateway6?: string = "";
  // FIXME: Use enum for methods instead of string
  method4: string = "auto";
  method6: string = "auto";
  wireless?: Wireless;

  constructor(id: string, options?: ConnectionOptions) {
    this.id = id;

    if (!isObject(options)) return;

    for (const [key, value] of Object.entries(options)) {
      if (value) this[key] = value;
    }
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
};

type NetworkGeneralState = {
  connectivity: boolean;
  hostname: string;
  networking_enabled: boolean;
  wireless_enabled: boolean;
};

export {
  ApFlags,
  ApSecurityFlags,
  Connection,
  ConnectionType,
  ConnectionState,
  DeviceState,
  NetworkState,
  DeviceType,
  Wireless,
  WifiNetworkStatus,
  SecurityProtocols,
};
export type {
  AccessPoint,
  ConnectionApi,
  ConnectionOptions,
  Device,
  DeviceApi,
  IPAddress,
  NetworkGeneralState,
  Route,
  RouteApi,
  WifiNetwork,
};
