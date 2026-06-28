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

import { formOptions } from "@tanstack/react-form";
import { toDevice } from "~/components/storage/device-utils";
import configModel from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";
import type { Device } from "~/model/storage/config-model/device";

/**
 * Space policy action for a device.
 * - "keep": Do not modify
 * - "resizeIfNeeded": Allow shrink
 * - "delete": Delete
 */
export type Action = "keep" | "resizeIfNeeded" | "delete";

/**
 * Form fields: dynamic object with device names as keys.
 * Each field value is the selected action for that device.
 *
 * Example:
 * {
 *   "/dev/vda1": "resizeIfNeeded",
 *   "/dev/vda2": "keep",
 *   "/dev/vda3": "delete"
 * }
 */
export type FormFields = Record<string, Action>;

export type SpacePolicyFormData = FormFields;

/**
 * Build initial form values from device children and existing config.
 *
 * For each device child:
 * - Look up existing volume config
 * - If delete flag set: "delete"
 * - If resizeIfNeeded flag set: "resizeIfNeeded"
 * - Otherwise: "keep"
 */
export function buildInitialValues(
  children: (System.Device | System.UnusedSlot)[],
  deviceConfig: Device,
): FormFields {
  const values: FormFields = {};

  children.forEach((child) => {
    const device = toDevice(child);
    if (!device) return;

    // Find existing volume config for this device
    const volumeConfig = configModel.device
      .volumes(deviceConfig)
      .find((v) => v.name === device.name);

    if (!volumeConfig) {
      values[device.name] = "keep";
      return;
    }

    // Map config flags to action
    if (volumeConfig.delete) {
      values[device.name] = "delete";
    } else if (volumeConfig.resizeIfNeeded) {
      values[device.name] = "resizeIfNeeded";
    } else {
      values[device.name] = "keep";
    }
  });

  return values;
}

/**
 * Build space policy actions payload from form values.
 *
 * Filters out "keep" actions (no action needed) and transforms to the format
 * expected by the setSpacePolicy API:
 *
 * { deviceName: string, value: "delete" | "resizeIfNeeded" }[]
 */
export function buildActionsPayload(
  values: FormFields,
): Array<{ deviceName: string; value: "delete" | "resizeIfNeeded" }> {
  return Object.entries(values)
    .filter(([, action]) => action !== "keep")
    .map(([deviceName, action]) => ({
      deviceName,
      value: action as "delete" | "resizeIfNeeded",
    }));
}

/**
 * Default form values (empty object - values built dynamically).
 */
const defaultValues: FormFields = {};

export const defaultOptions = formOptions({ defaultValues });
