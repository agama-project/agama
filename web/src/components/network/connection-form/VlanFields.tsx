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
import { isEmpty } from "radashi";
import { defaultOptions, VlanProtocolMode } from "./fields";
import { withForm } from "~/hooks/form";
import { _, N_ } from "~/i18n";
import { CONNECTION_TYPE } from "~/utils/network";
import DeviceSelector from "./DeviceSelector";

/**
 * Protocol options for the selector.
 */
const protocolOptions = () => [
  {
    value: VlanProtocolMode.DEFAULT,
    // TRANSLATORS: option for the VLAN protocol selector when no specific protocol is chosen.
    label: N_("Default"),
    // TRANSLATORS: description for the 'Default' VLAN protocol option.
    description: N_("Use the system default (802.1Q)."),
  },
  {
    value: VlanProtocolMode.IEEE_802_1Q,
    // TRANSLATORS: label for the '802.1Q' VLAN protocol option.
    label: N_("802.1Q"),
    // TRANSLATORS: description for the '802.1Q' VLAN protocol option.
    description: N_("Use the 802.1Q protocol explicitly."),
  },
  {
    value: VlanProtocolMode.IEEE_802_1AD,
    // TRANSLATORS: label for the '802.1ad' VLAN protocol option.
    label: N_("802.1ad"),
    // TRANSLATORS: description for the '802.1ad' VLAN protocol option.
    description: N_("Use the 802.1ad protocol explicitly."),
  },
];

/**
 * VLAN fields for a connection form.
 *
 * Shows VLAN options when the connection type is VLAN.
 *
 * Receives a typed form instance via `withForm`.
 */
const VlanFields = withForm({
  ...defaultOptions,
  render: function Render({ form }) {
    // Suggests a device name based on the parent device and VLAN ID, as long as
    // the user has not manually edited it.
    const suggestIface = () => {
      if (form.getFieldMeta("vlanIface")?.isDirty) return;

      const vlanParent = form.getFieldValue("vlanParent");
      const vlanId = form.getFieldValue("vlanId");

      if (!isEmpty(vlanParent) && !isEmpty(vlanId)) {
        form.setFieldValue("vlanIface", `${vlanParent}.${vlanId}`, {
          dontUpdateMeta: true,
        });
      }
    };

    return (
      <>
        <DeviceSelector
          form={form}
          by="iface"
          name="vlanParent"
          label={
            // TRANSLATORS: label for the VLAN parent device field.
            _("Parent device")
          }
          exclude={{
            devices: [form.getFieldValue("vlanIface")],
            types: [CONNECTION_TYPE.VLAN, CONNECTION_TYPE.LOOPBACK],
          }}
          listeners={{
            onChange: () => suggestIface(),
          }}
        />

        <form.AppField
          name="vlanId"
          listeners={{
            onChange: () => suggestIface(),
          }}
        >
          {(field) => (
            <field.NumberField
              label={
                // TRANSLATORS: label for the VLAN ID field.
                _("VLAN ID")
              }
              helperText={
                // TRANSLATORS: helper text for the VLAN ID field.
                _("Numeric identifier (0–4094)")
              }
              min={0}
              max={4094}
            />
          )}
        </form.AppField>

        <form.AppField name="vlanIface">
          {(field) => (
            <field.TextField
              label={
                // TRANSLATORS: label for the network interface name field.
                _("Device name")
              }
              helperText={
                // TRANSLATORS: helper text for the VLAN device name field.
                _("E.g., eth0.100")
              }
            />
          )}
        </form.AppField>

        <form.AppField name="vlanProtocol">
          {(field) => (
            <field.DropdownField
              label={
                // TRANSLATORS: label for the VLAN encapsulation protocol field.
                _("Encapsulation protocol")
              }
              options={protocolOptions().map(({ value, label, description }) => ({
                value,
                // eslint-disable-next-line agama-i18n/string-literals
                label: _(label),
                // eslint-disable-next-line agama-i18n/string-literals
                description: _(description),
              }))}
            />
          )}
        </form.AppField>
      </>
    );
  },
});

export default VlanFields;
