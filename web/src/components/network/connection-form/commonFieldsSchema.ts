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

import { ConnectionType, ConnectionBindingMode } from "~/types/network";
import { CONNECTION_TYPE } from "~/utils/network";
import { _ } from "~/i18n";
import { requiredString, string } from "~/components/form/validation-helpers";

/**
 * Default values for common connection fields.
 */
export const commonDefaults = {
  name: "",
  type: CONNECTION_TYPE.ETHERNET as ConnectionType,
  iface: "",
  ifaceMac: "",
  bindingMode: "none" as ConnectionBindingMode,
};

/**
 * Validation schema entries for common connection fields.
 *
 * Returns entry objects (not a wrapped schema) so callers can spread them
 * into a merged object alongside type-specific entries. Merging at construction
 * time via spread is preferred over v.intersect, which runs each sub-schema
 * as a separate validation pass at runtime.
 *
 * Factory function defers i18n string resolution until after initialization.
 */
export const CommonSchema = () => ({
  // TRANSLATORS: validation error for the connection name field.
  name: requiredString(_("Name is required")),
  type: string(),
  iface: string(),
  ifaceMac: string(),
  bindingMode: string(),
});
