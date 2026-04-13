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

import React from "react";
import { connectionFormOptions } from "~/components/network/ConnectionForm";
import { withForm } from "~/hooks/form";
import { _, N_ } from "~/i18n";

const BINDING_MODE_OPTIONS = [
  {
    value: "none",
    // TRANSLATORS: option label meaning the connection works with any network device.
    label: N_("Any"),
    // TRANSLATORS: description for the "Any" binding mode. The connection is
    // not limited to a specific device.
    description: N_("The connection is available for all devices"),
  },
  {
    value: "iface",
    // TRANSLATORS: option label for binding by device interface name (e.g. eth0).
    label: N_("Chosen by name"),
    // TRANSLATORS: description for the "Chosen by name" binding mode. The
    // "device name" refers to the interface name (e.g. eth0).
    description: N_("Identify the connection device by its name in the system"),
  },
  {
    value: "mac",
    // TRANSLATORS: option label for binding by MAC address
    label: N_("Chosen by MAC"),
    // TRANSLATORS: description for the "Chosen by MAC" binding mode. MAC is the
    // hardware address, persisting across interface renames.
    description: N_("Identify the connection device by its physical address"),
  },
];

/**
 * A `DropdownField` based selector for the connection binding mode.
 *
 * Receives a typed form instance via `withForm`.
 */
const BindingModeSelector = withForm({
  ...connectionFormOptions,
  render: function Render({ form }) {
    return (
      <form.AppField name="bindingMode">
        {(field) => (
          <field.DropdownField
            // TRANSLATORS: label for the device binding dropdown.
            label={_("Device")}
            options={BINDING_MODE_OPTIONS.map(({ value, label, description }) => ({
              value,
              // eslint-disable-next-line agama-i18n/string-literals
              label: _(label),
              // eslint-disable-next-line agama-i18n/string-literals
              description: _(description),
            }))}
          />
        )}
      </form.AppField>
    );
  },
});

export default BindingModeSelector;
