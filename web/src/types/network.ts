enum ApFlags {
  NONE = 0x00000000,
  PRIVACY = 0x00000001,
  WPS = 0x00000002,
  WPS_PBC = 0x00000004,
  WPS_PIN = 0x00000008,
};

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
};

enum ConnectionType {
  ETHERNET = "ethernet",
  WIFI = "wireless",
  LOOPBACK = "loopback",
  BOND = "bond",
  BRIDGE = "bridge",
  VLAN = "vlan",
  UNKNOWN = "unknown",
};

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
};

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
};

enum DeviceType {
  LOOPBACK = 0,
  ETHERNET = 1,
  WIRELESS = 2,
  DUMMY = 3,
  BOND = 4,
};

enum NetworkState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected"
};

enum SecurityProtocols {
  WEP = "WEP",
  WPA = "WPA1",
  RSN = "WPA2",
  _8021X = "802.1X",
};

type IPAddress = {
  address: string;
  prefix: number | string;
};

type Route = {
  destination: IPAddress;
  nextHop: string;
  metric: number;
};

type AccessPoint = {
  ssid: string,
  strength: number,
  hwAddress: string,
  security: string[]
}

type Device = {
  name: string;
  type: ConnectionType;
  addresses: IPAddress[];
  nameservers: string;
  gateway4: string;
  gateway6: string;
  method4: string;
  method6: string;
  routes4: Route[];
  routes6: Route[];
  macAddress: string;
  state: DeviceState;
  connection?: string;
};

type ConnectionApi = {
  id: string;
  iface: string;
  addresses: IPAddress[];
  nameservers: string[];
  gateway4: string;
  gateway6: string;
  method4: string;
  method6: string;
  wireless?: Wireless;
}

class Wireless {
  password?: string;
  security?: string;
  hidden?: boolean = false;
  mode: string = "infrastructure";

  constructor(password?: string, security?: string, hidden?: boolean, mode?: string) {
    if (security) this.security = security;
    if (password) this.password = password;
    if (hidden !== undefined) this.hidden = hidden;
    if (mode) this.mode = mode;
  }
}

class Connection {
  id: string;
  iface: string;
  addresses: IPAddress[] = [];
  nameservers: string[] = [];
  gateway4: string = "";
  gateway6: string = "";
  method4: string = "auto";
  method6: string = "auto";
  wireless?: Wireless;

  constructor(id: string, iface?: string, options?: Connection) {
    this.id = id;
    if (iface !== undefined) {
      this.iface = iface;
    }

    if (options !== undefined) {
      if (options.addresses) this.addresses = options.addresses;
      if (options.nameservers) this.nameservers = options.nameservers;
      if (options.gateway4) this.gateway4 = options.gateway4;
      if (options.gateway6) this.gateway6 = options.gateway6;
      if (options.method4) this.method4 = options.method4;
      if (options.method6) this.method6 = options.method6;
      if (options.wireless) this.wireless = options.wireless;
    }
  }
}


type NetworkGeneralState = {
  connectivity: boolean,
  hostname: string,
  networking_enabled: boolean,
  wireless_enabled: boolean,
}

export { ApFlags, ApSecurityFlags, Connection, ConnectionType, ConnectionState, DeviceState, NetworkState, DeviceType, Wireless, SecurityProtocols };
export type { AccessPoint, Device, IPAddress, NetworkGeneralState };
