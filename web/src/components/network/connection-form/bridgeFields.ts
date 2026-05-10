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

import { _ } from "~/i18n";
import { requiredString, optionalIntRange } from "~/components/form/validation-helpers";

type BridgeFields = {
  bridgeIface: string;
  bridgeStp: BridgeStpMode;
  bridgePriority: number | undefined;
  bridgeForwardDelay: number | undefined;
  bridgeHelloTime: number | undefined;
  bridgeMaxAge: number | undefined;
  bridgePorts: string[];
};

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
export const defaultValues = {
  bridgeIface: "",
  bridgeStp: BridgeStpMode.DEFAULT as BridgeStpMode,
  bridgePriority: undefined,
  bridgeForwardDelay: undefined,
  bridgeHelloTime: undefined,
  bridgeMaxAge: undefined,
  bridgePorts: [] as string[],
};

/**
 * Validation for bridge-specific fields.
 *
 * STP fields are conditionally validated based on the stpEnabled parameter.
 * When STP is disabled, those fields are not validated at all.
 *
 * optionalIntRange uses inclusive bounds on both ends — no +1 offset,
 * no comment required to explain it.
 *
 * Returns a record of field errors, where each key is a field name and each
 * value is an error message or undefined.
 */
export const validate = (fields: BridgeFields): Record<string, string | undefined> => {
  const stpEnabled = fields.bridgeStp === BridgeStpMode.ENABLED;

  return {
    // TRANSLATORS: validation error for the bridge device name field.
    bridgeIface: requiredString(fields.bridgeIface, _("Device name is required")),
    // TRANSLATORS: validation error for the bridge ports field.
    bridgePorts:
      fields.bridgePorts.length === 0 ? _("At least one bridge port is required") : undefined,
    // STP fields only validated when STP is enabled.
    ...(stpEnabled && {
      // TRANSLATORS: validation error for the bridge priority field.
      bridgePriority: optionalIntRange(
        fields.bridgePriority,
        0,
        61440,
        _("Priority must be between 0 and 61440"),
      ),
      // TRANSLATORS: validation error for the bridge forward delay field.
      bridgeForwardDelay: optionalIntRange(
        fields.bridgeForwardDelay,
        4,
        30,
        _("Forward delay must be between 4 and 30 seconds"),
      ),
      // TRANSLATORS: validation error for the bridge hello time field.
      bridgeHelloTime: optionalIntRange(
        fields.bridgeHelloTime,
        1,
        10,
        _("Hello time must be between 1 and 10 seconds"),
      ),
      // TRANSLATORS: validation error for the bridge max message age field.
      bridgeMaxAge: optionalIntRange(
        fields.bridgeMaxAge,
        6,
        40,
        _("Max message age must be between 6 and 40 seconds"),
      ),
    }),
  };
};
