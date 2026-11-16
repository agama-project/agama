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
 * The state the network indicator tells, from the devices and connections the
 * installer reports.
 *
 * It only says whether the machine is connected, and how. It says nothing about
 * internet access: telling it apart reliably needs NetworkManager's
 * connectivity check, which the installer does not rely on.
 */

import { unique } from "radashi";
import { DeviceState } from "~/types/network";

import type { IconProps } from "~/components/layout/Icon";
import type { IPAddress, NetworkSystem } from "~/types/network";

type NetworkIndicatorState =
  | { kind: "wifi"; ssid: string; strength: number; connection?: string; addresses: IPAddress[] }
  | { kind: "cable"; device: string; connection?: string; addresses: IPAddress[] }
  | { kind: "offline" }
  | { kind: "disabled" };

type NetworkIndicatorInfo = {
  state: NetworkIndicatorState;
  /**
   * Wi-Fi networks in range besides the one in use, if any. Undefined when
   * there is no Wi-Fi device or wireless is off, so nothing is told about them.
   */
  wifiNetworks?: number;
};

/**
 * Builds what the indicator tells. A cable connection wins over a Wi-Fi one,
 * as desktop panels show.
 */
function networkIndicatorInfo({
  devices = [],
  connections = [],
  accessPoints = [],
  state: generalState,
}: NetworkSystem): NetworkIndicatorInfo {
  if (!generalState?.networkingEnabled) return { state: { kind: "disabled" } };

  const connected = devices.filter((d) => d.state === DeviceState.CONNECTED);
  const cable = connected.find((d) => d.type === "ethernet");
  const wifi = connected.find((d) => d.type === "wireless");
  const wifiConnection = wifi && connections.find((c) => c.id === wifi.connection);
  const ssid = wifiConnection?.wireless?.ssid;

  const hasWifiDevice = devices.some((d) => d.type === "wireless");
  const ssids = unique(accessPoints.map((ap) => ap.ssid?.trim()).filter(Boolean));
  const wifiNetworks =
    hasWifiDevice && generalState.wirelessEnabled
      ? ssids.filter((name) => name !== ssid).length
      : undefined;

  if (cable) {
    return {
      state: {
        kind: "cable",
        device: cable.name,
        connection: cable.connection,
        addresses: cable.addresses,
      },
      wifiNetworks,
    };
  }

  if (wifi) {
    // Access points come sorted by strength, so the first match is the best one.
    const accessPoint = accessPoints.find((ap) => ap.ssid === ssid);
    return {
      state: {
        kind: "wifi",
        ssid: ssid ?? wifi.name,
        strength: accessPoint?.strength ?? 0,
        connection: wifi.connection,
        addresses: wifi.addresses,
      },
      wifiNetworks,
    };
  }

  return { state: { kind: "offline" }, wifiNetworks };
}

/** Whether the state is a connection, for telling when it is lost or back. */
const isConnected = (state: NetworkIndicatorState) =>
  state.kind === "wifi" || state.kind === "cable";

/**
 * The icon for the state: Wi-Fi bars by signal strength, a cable, the cable
 * crossed out when networking is off and, when not connected, a search for
 * Wi-Fi networks if there are some in range, or a lost signal otherwise.
 */
function networkIndicatorIcon({ state, wifiNetworks }: NetworkIndicatorInfo): IconProps["name"] {
  if (state.kind === "cable") return "lan";
  if (state.kind === "disabled") return "lan_off";
  if (state.kind === "offline") return wifiNetworks ? "wifi_find" : "signal_disconnected";
  if (state.strength > 75) return "signal_wifi_4_bar";
  if (state.strength > 50) return "network_wifi_3_bar";
  if (state.strength > 25) return "network_wifi_2_bar";
  return "network_wifi_1_bar";
}

export { networkIndicatorInfo, networkIndicatorIcon, isConnected };
export type { NetworkIndicatorInfo, NetworkIndicatorState };
