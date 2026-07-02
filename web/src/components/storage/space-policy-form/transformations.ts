/*
 * Copyright (c) [2024-2026] SUSE LLC
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

import { toDevice } from "~/components/storage/device-utils";
import configModel from "~/model/storage/config-model";
import type { FormFields } from "./fields";
import type { Storage as System } from "~/model/system";
import type { Device } from "~/model/storage/config-model/device";

/**
 * Builds the form values from the device children and the existing config.
 *
 * For each child, maps the existing volume config to an action:
 * - delete flag set: "delete"
 * - resizeIfNeeded flag set: "resizeIfNeeded"
 * - otherwise (or no config): "keep"
 */
export function toFormValues(
  children: (System.Device | System.UnusedSlot)[],
  deviceConfig: Device,
): FormFields {
  const values: FormFields = {};

  children.forEach((child) => {
    const device = toDevice(child);
    if (!device) return;

    const volumeConfig = configModel.device
      .volumes(deviceConfig)
      .find((v) => v.name === device.name);

    if (volumeConfig?.delete) {
      values[device.name] = "delete";
    } else if (volumeConfig?.resizeIfNeeded) {
      values[device.name] = "resizeIfNeeded";
    } else {
      values[device.name] = "keep";
    }
  });

  return values;
}

/**
 * Builds the space policy actions payload from the form values.
 *
 * Drops "keep" actions (nothing to do) and maps the rest to the shape the
 * setSpacePolicy API expects.
 */
export function buildPayload(
  values: FormFields,
): Array<{ deviceName: string; value: "delete" | "resizeIfNeeded" }> {
  return Object.entries(values)
    .filter(([, action]) => action !== "keep")
    .map(([deviceName, action]) => ({
      deviceName,
      value: action as "delete" | "resizeIfNeeded",
    }));
}
