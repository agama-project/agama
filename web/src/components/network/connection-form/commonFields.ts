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
import { requiredString } from "~/components/form/validation-helpers";

type CommonFields = {
  name: string;
  type: ConnectionType;
  iface: string;
  ifaceMac: string;
  bindingMode: ConnectionBindingMode;
};

/**
 * Default values for common connection fields.
 */
export const defaultValues = {
  name: "",
  type: CONNECTION_TYPE.ETHERNET as ConnectionType,
  iface: "",
  ifaceMac: "",
  bindingMode: "none" as ConnectionBindingMode,
};

/**
 * Validation for common connection fields.
 *
 * Only the name field requires validation. The other common fields (type,
 * iface, ifaceMac, bindingMode) are either guaranteed valid by the UI
 * (type is a dropdown) or validated elsewhere (iface/ifaceMac are device
 * properties, bindingMode is a controlled enum).
 *
 * Returns a record of field errors, where each key is a field name and each
 * value is an error message or undefined.
 */
export const validate = (fields: CommonFields): Record<string, string | undefined> => ({
  // TRANSLATORS: validation error for the connection name field.
  name: requiredString(fields.name, _("Name is required")),
});
