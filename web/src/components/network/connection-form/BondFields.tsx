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
import PortsField from "./PortsField";
import { defaultOptions } from "./fields";
import { withForm } from "~/hooks/form";
import { BondMode } from "~/types/network";
import { _ } from "~/i18n";

/**
 * Bond mode options.
 */
const bondModeOptions = () =>
  Object.values(BondMode).map((m) => ({
    value: m,
    label: m,
  }));

type BondFieldsProps = {
  isEditing?: boolean;
};

/**
 * Bond fields for a connection form.
 *
 * Shows bond mode, options, and ports when the connection type is BOND.
 * Also shows the device name field for new bond connections.
 *
 * Receives a typed form instance via `withForm`.
 */
const BondFields = withForm({
  ...defaultOptions,
  props: {
    isEditing: false,
  } as BondFieldsProps,
  render: function Render({ form, isEditing }) {
    return (
      <>
        <form.AppField name="bondIface">
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
                  // TRANSLATORS: helper text for the bond device name field.
                  _("E.g., bond0")
                }
              />
            )
          }
        </form.AppField>
        <form.AppField name="bondMode">
          {(field) => (
            <field.DropdownField
              label={
                // TRANSLATORS: label for the bond mode field.
                _("Bond mode")
              }
              options={bondModeOptions()}
            />
          )}
        </form.AppField>
        <form.AppField name="bondOptions">
          {(field) => (
            <field.ArrayField
              label={
                // TRANSLATORS: label for the bond options field.
                _("Bond options")
              }
              helperText={
                // TRANSLATORS: helper text for the bond options field.
                _("E.g., downdelay=0, primary=eth1, miimon=100, lacp_rate=fast")
              }
            />
          )}
        </form.AppField>
        <PortsField
          form={form}
          name="bondPorts"
          controllerField="bondIface"
          label={
            // TRANSLATORS: label for the bond ports field.
            _("Bond ports")
          }
          pickLabel={
            // TRANSLATORS: accessible name of the button opening the dialog for
            // picking the ports of a bond among the devices found in the system.
            _("Select bond ports")
          }
        />
      </>
    );
  },
});

export default BondFields;
