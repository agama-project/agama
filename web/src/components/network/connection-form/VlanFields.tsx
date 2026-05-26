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
import { sprintf } from "sprintf-js";
import { defaultOptions, VlanProtocolMode } from "./fields";
import { withForm } from "~/hooks/form";
import { useDevices } from "~/hooks/model/system/network";
import { _, formatList } from "~/i18n";

/**
 * Protocol options for the selector.
 */
const protocolOptions = () => [
  {
    value: VlanProtocolMode.DEFAULT,
    // TRANSLATORS: option for the VLAN protocol selector when no specific protocol is chosen.
    // It uses the '802.1Q' protocol by default.
    label: _("Default (802.1Q)"),
  },
  {
    value: VlanProtocolMode.IEEE_802_1Q,
    label: "802.1Q",
  },
  {
    value: VlanProtocolMode.IEEE_802_1AD,
    label: "802.1ad",
  },
];

type VlanFieldsProps = {
  isEditing?: boolean;
};

/**
 * VLAN fields for a connection form.
 *
 * Shows VLAN options when the connection type is VLAN.
 *
 * Receives a typed form instance via `withForm`.
 */
const VlanFields = withForm({
  ...defaultOptions,
  props: {
    isEditing: false,
  } as VlanFieldsProps,
  render: function Render({ form, isEditing }) {
    const devices = useDevices();

    return (
      <>
        <form.AppField name="vlanIface">
          {(field) =>
            isEditing ? (
              <field.ReadOnlyField label={_("Device name")} />
            ) : (
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
            )
          }
        </form.AppField>
        <form.AppField name="vlanId">
          {(field) => (
            <field.NumberField
              label={
                // TRANSLATORS: label for the VLAN ID field.
                _("VLAN ID")
              }
              helperText={
                // TRANSLATORS: helper text for the VLAN ID field.
                _("Numeric between 0 and 4094")
              }
              min={0}
              max={4094}
            />
          )}
        </form.AppField>
        <form.AppField name="vlanParent">
          {(field) => (
            <field.TextField
              label={
                // TRANSLATORS: label for the VLAN parent device field.
                _("Parent device")
              }
              helperText={
                // TRANSLATORS: helper text for the VLAN parent device field. %s is a list of available devices.
                sprintf(_("Available devices: %s"), formatList(devices.map((d) => d.name)))
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
              options={protocolOptions().map(({ value, label }) => ({
                value,
                // eslint-disable-next-line agama-i18n/string-literals
                label: _(label),
              }))}
            />
          )}
        </form.AppField>
      </>
    );
  },
});

export default VlanFields;
