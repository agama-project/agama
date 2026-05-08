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
import { commonDefaults } from "./commonFieldsSchema";
import { ipDefaults } from "./ipFieldsSchema";
import { bondDefaults } from "./bondFieldsSchema";
import { bridgeDefaults } from "./bridgeFieldsSchema";

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
