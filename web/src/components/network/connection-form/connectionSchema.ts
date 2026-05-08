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
import * as v from "valibot";
import { CONNECTION_TYPE } from "~/utils/network";
import { commonDefaults, commonSchema } from "./commonFieldsSchema";
import { ipDefaults, ipSchema } from "./ipFieldsSchema";
import { bondDefaults, bondSchema } from "./bondFieldsSchema";
import { bridgeDefaults, bridgeSchema } from "./bridgeFieldsSchema";

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
 * Valibot schemas composed by connection type.
 * Each type combines common and IP schemas with any type-specific schemas.
 *
 * Returns a function to defer i18n initialization.
 */
export const schemaByType = () => ({
  [CONNECTION_TYPE.ETHERNET]: v.intersect([commonSchema(), ipSchema()]),
  [CONNECTION_TYPE.BOND]: v.intersect([commonSchema(), ipSchema(), bondSchema()]),
  [CONNECTION_TYPE.BRIDGE]: v.intersect([commonSchema(), ipSchema(), bridgeSchema()]),
});

/**
 * Shared form options for ConnectionForm and its sub-components.
 * Sub-components spread these options in their withForm definition.
 */
export const connectionFormOptions = formOptions({
  defaultValues: connectionDefaults,
});
