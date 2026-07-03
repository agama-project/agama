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
 * Default form values (empty object - values built dynamically).
 */
const defaultValues: FormFields = {};

export const defaultOptions = formOptions({ defaultValues });
