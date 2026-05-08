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

import * as v from "valibot";
import { _ } from "~/i18n";

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

/**
 * Helper for validating integers within an inclusive range.
 */
const intRange = (min: number, max: number, message: string) =>
  v.pipe(v.number(), v.minValue(min, message), v.maxValue(max, message));

/**
 * Validation schema for bridge-specific fields.
 *
 * Returns a function to defer i18n initialization.
 */
export const bridgeSchema = () =>
  v.object({
    bridgeIface: v.pipe(v.string(), v.minLength(1, _("Device name is required"))),
    bridgePorts: v.pipe(
      v.array(v.string()),
      v.minLength(1, _("At least one bridge port is required")),
    ),
    bridgeStp: v.string(),
    // TRANSLATORS: validation error for the bridge priority field.
    bridgePriority: v.optional(intRange(0, 61440, _("Priority must be between 0 and 61440"))),
    // TRANSLATORS: validation error for the bridge forward delay field.
    bridgeForwardDelay: v.optional(
      intRange(4, 30, _("Forward delay must be between 4 and 30 seconds")),
    ),
    // TRANSLATORS: validation error for the bridge hello time field.
    bridgeHelloTime: v.optional(intRange(1, 10, _("Hello time must be between 1 and 10 seconds"))),
    // TRANSLATORS: validation error for the bridge max message age field.
    bridgeMaxAge: v.optional(
      intRange(6, 40, _("Max message age must be between 6 and 40 seconds")),
    ),
  });
