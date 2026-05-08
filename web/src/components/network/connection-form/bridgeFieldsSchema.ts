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
 * Bridge STP (Spanning Tree Protocol) mode values.
 */
export const BridgeStpMode = {
  DEFAULT: "default",
  ENABLED: "enabled",
  DISABLED: "disabled",
} as const;

export type BridgeStpMode = (typeof BridgeStpMode)[keyof typeof BridgeStpMode];

/**
 * Default values for bridge-specific fields.
 */
export const bridgeDefaults = {
  bridgeIface: "",
  bridgeStp: BridgeStpMode.DEFAULT as BridgeStpMode,
  bridgePriority: undefined,
  bridgeForwardDelay: undefined,
  bridgeHelloTime: undefined,
  bridgeMaxAge: undefined,
  bridgePorts: [] as string[],
};
