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

import { formOptions } from "@tanstack/react-form";
import { CONNECTION_TYPE } from "~/utils/network";
import * as common from "./commonFields";
import * as ip from "./ipFields";
import * as bond from "./bondFields";
import * as bridge from "./bridgeFields";

/**
 * Complete default values for ConnectionForm.
 * Composed from individual field groups.
 */
export const connectionDefaults = {
  ...common.defaultValues,
  ...ip.defaultValues,
  ...bond.defaultValues,
  ...bridge.defaultValues,
};

/**
 * Shared form options for ConnectionForm and its sub-components.
 * Sub-components spread these options in their withForm definition.
 */
export const connectionFormOptions = formOptions({
  defaultValues: connectionDefaults,
});

type FormValues = typeof connectionDefaults;

/**
 * Validates the form values for the active connection type.
 *
 * Designed for TanStack Form's validators. Returns undefined when valid
 * (TanStack Form convention), or a field-error map on failure.
 *
 * Composition:
 * - Common and IP validators run for all connection types
 * - Bond/Bridge validators run only for their respective types
 * - Cross-field validation (e.g., bond primary option) is handled within
 *   the type-specific validators and returned as field errors
 *
 * Field errors are collected by merging all validator outputs and filtering
 * out undefined values.
 */
export const validateConnectionForm = ({ value }: { value: FormValues }) => {
  const commonErrors = common.validate(value);
  const ipErrors = ip.validate(value);

  let typeErrors: Record<string, string | undefined> = {};

  if (value.type === CONNECTION_TYPE.BOND) {
    typeErrors = bond.validate(value);
  } else if (value.type === CONNECTION_TYPE.BRIDGE) {
    typeErrors = bridge.validate(value);
  }

  // Merge all field errors and filter out undefined values
  const allFieldErrors = { ...commonErrors, ...ipErrors, ...typeErrors };
  const fields: Record<string, string> = {};

  for (const [key, error] of Object.entries(allFieldErrors)) {
    if (error !== undefined) {
      fields[key] = error;
    }
  }

  // Return field errors if any exist
  return Object.keys(fields).length > 0 ? { fields } : undefined;
};
