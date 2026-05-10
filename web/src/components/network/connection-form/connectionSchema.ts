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
import { BondMode } from "~/types/network";
import { object, pipe, check, safeParse, flatten } from "~/components/form/validation-helpers";
import { commonDefaults, CommonSchema } from "./commonFieldsSchema";
import { ipDefaults, IpSchema } from "./ipFieldsSchema";
import {
  bondDefaults,
  BondSchema,
  isBondConfigValid,
  bondCrossFieldErrorMessage,
} from "./bondFieldsSchema";
import { bridgeDefaults, BridgeSchema } from "./bridgeFieldsSchema";
import { BridgeStpMode } from "./bridgeFieldsSchema";

/**
 * Complete default values for ConnectionForm.
 * Composed from individual field groups.
 */
export const connectionDefaults = {
  ...commonDefaults,
  ...ipDefaults,
  ...bondDefaults,
  ...bridgeDefaults,
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
 * Derives the Valibot schema for the current form state.
 *
 * Called at validation time with the current form value, so the correct
 * schema for the active connection type, IP modes, DNS toggles, and STP
 * state is always derived fresh — no stale state, no manual subscriptions.
 *
 * Composition rules:
 * - Entries merged via object spread at construction time. Preferred over
 *   v.intersect, which re-runs each sub-schema as a separate pass at runtime.
 * - Bond is the only type wrapped in v.pipe because it has a genuine
 *   cross-field rule that must run at validation time, not construction time.
 * - All other conditionality is resolved at construction time by closing
 *   over the current form values in the entry factories.
 */
const schemaForValues = (values: FormValues) => {
  const common = CommonSchema();
  const ip = IpSchema(values);

  const byType = {
    [CONNECTION_TYPE.ETHERNET]: object({
      ...common,
      ...ip,
    }),

    [CONNECTION_TYPE.BOND]: pipe(
      object({
        ...common,
        ...ip,
        ...BondSchema(),
      }),
      check(
        ({ bondOptions, bondMode }) => isBondConfigValid(bondOptions, bondMode as BondMode),
        bondCrossFieldErrorMessage(),
      ),
    ),

    [CONNECTION_TYPE.BRIDGE]: object({
      ...common,
      ...ip,
      ...BridgeSchema(values.bridgeStp === BridgeStpMode.ENABLED),
    }),
  };

  return byType[values.type];
};

/**
 * Validates the form values against the schema for the active connection type.
 *
 * Designed for TanStack Form's validators. Returns undefined when valid
 * (TanStack Form convention), or a field-error map on failure.
 *
 * v.flatten converts Valibot's issue list into dot-joined field paths
 * without any manual path reconstruction. Root-level errors (from v.check
 * without v.forward) are returned in the `form` property, while field-level
 * errors are in the `fields` property.
 */
export const validateConnectionForm = ({ value }: { value: FormValues }) => {
  const result = safeParse(schemaForValues(value), value);
  if (result.success) return undefined;

  const flattened = flatten(result.issues);
  const errors: { form?: string; fields?: Record<string, string> } = {};

  if (flattened.root) {
    // Root-level errors go to form property (e.g., cross-field validation)
    errors.form = flattened.root.join(", ");
  }

  if (flattened.nested) {
    // Field-level errors go to fields property
    errors.fields = flattened.nested;
  }

  return Object.keys(errors).length > 0 ? errors : undefined;
};
