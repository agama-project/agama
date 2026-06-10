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
import Interpolate from "~/components/core/Interpolate";
import NestedContent from "~/components/core/NestedContent";
import LabelText from "~/components/form/LabelText";
import { defaultOptions, BridgeStpMode } from "./fields";
import { withForm } from "~/hooks/form";
import { useDevices } from "~/hooks/model/system/network";
import { _, N_, formatList } from "~/i18n";

/**
 * STP mode options for the selector.
 */
const stpOptions = () => [
  {
    value: BridgeStpMode.DEFAULT,
    // TRANSLATORS: option label for the bridge STP configuration to use the system default.
    label: N_("Default"),
    // TRANSLATORS: description for the default bridge STP configuration.
    description: N_("Enabled with the system default settings"),
  },
  {
    value: BridgeStpMode.ENABLED,
    // TRANSLATORS: option label for enabling bridge STP.
    label: N_("Custom"),
    // TRANSLATORS: description for enabling bridge STP with manual settings.
    description: N_("Explicitly enabled with manual settings"),
  },
  {
    value: BridgeStpMode.DISABLED,
    // TRANSLATORS: option label for disabling bridge STP.
    label: N_("Disabled"),
    // TRANSLATORS: description for disabling bridge STP.
    description: N_("Not used by this bridge"),
  },
];

type BridgeFieldsProps = {
  isEditing?: boolean;
};

/**
 * Bridge fields for a connection form.
 *
 * Shows bridge options and ports when the connection type is BRIDGE.
 * Also shows the device name field for new bridge connections.
 *
 * Receives a typed form instance via `withForm`.
 */
const BridgeFields = withForm({
  ...defaultOptions,
  props: {
    isEditing: false,
  } as BridgeFieldsProps,
  render: function Render({ form, isEditing }) {
    const devices = useDevices();
    const availableDevices = devices.filter((d) => d.name !== "lo");

    return (
      <>
        <form.AppField name="bridgeIface">
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
                  _("E.g., br0")
                }
              />
            )
          }
        </form.AppField>
        <form.AppField name="bridgePorts">
          {(field) => (
            <field.ArrayField
              label={
                // TRANSLATORS: label for the bridge ports field.
                _("Bridge ports")
              }
              helperText={
                // TRANSLATORS: helper text for the bridge ports field. %s is a list of available devices.
                sprintf(_("Available devices: %s"), formatList(availableDevices.map((d) => d.name)))
              }
              skipDuplicates
            />
          )}
        </form.AppField>

        <form.AppField name="bridgeStp">
          {(field) => (
            <field.DropdownField
              label={
                // TRANSLATORS: label for the bridge STP (Spanning Tree Protocol) field.
                _("Spanning Tree Protocol (STP)")
              }
              options={stpOptions().map(({ value, label, description }) => ({
                value,
                // eslint-disable-next-line agama-i18n/string-literals
                label: _(label),
                // eslint-disable-next-line agama-i18n/string-literals
                description: _(description),
              }))}
            />
          )}
        </form.AppField>
        <form.Subscribe selector={(s) => s.values.bridgeStp}>
          {(bridgeStp) =>
            bridgeStp === BridgeStpMode.ENABLED && (
              <NestedContent margin="mxLg">
                <form.AppField name="bridgePriority">
                  {(field) => (
                    <field.NumberField
                      label={
                        <LabelText suffix={_("(optional)")}>
                          {
                            // TRANSLATORS: label for the bridge priority field.
                            _("Priority")
                          }
                        </LabelText>
                      }
                      helperText={
                        <Interpolate
                          sentence={
                            // TRANSLATORS: Helper text for the bridge priority
                            // field. Text inside square brackets [] is
                            // semantically and visually emphasized. Keep the
                            // brackets.
                            _("Root bridge selection (0-61440). [Lower is higher priority].")
                          }
                        >
                          {(text) => <strong>{text}</strong>}
                        </Interpolate>
                      }
                      min={0}
                      max={61440}
                    />
                  )}
                </form.AppField>
                <form.AppField name="bridgeForwardDelay">
                  {(field) => (
                    <field.NumberField
                      label={
                        <LabelText suffix={_("(optional)")}>
                          {
                            // TRANSLATORS: label for the bridge forward delay field.
                            _("Forward delay")
                          }
                        </LabelText>
                      }
                      helperText={
                        // TRANSLATORS: helper text for the bridge forward delay field.
                        _("Listening and learning time (4-30 seconds).")
                      }
                      min={4}
                      max={30}
                    />
                  )}
                </form.AppField>
                <form.AppField name="bridgeHelloTime">
                  {(field) => (
                    <field.NumberField
                      label={
                        <LabelText suffix={_("(optional)")}>
                          {
                            // TRANSLATORS: label for the bridge hello time field.
                            _("Hello time")
                          }
                        </LabelText>
                      }
                      helperText={
                        // TRANSLATORS: helper text for the bridge hello time field.
                        _("Protocol message interval (1-10 seconds).")
                      }
                      min={1}
                      max={10}
                    />
                  )}
                </form.AppField>
                <form.AppField name="bridgeMaxAge">
                  {(field) => (
                    <field.NumberField
                      label={
                        <LabelText suffix={_("(optional)")}>
                          {
                            // TRANSLATORS: label for the bridge max message age field.
                            _("Max message age")
                          }
                        </LabelText>
                      }
                      helperText={
                        // TRANSLATORS: helper text for the bridge max message age field.
                        _("Protocol message retention time (6-40 seconds).")
                      }
                      min={6}
                      max={40}
                    />
                  )}
                </form.AppField>
              </NestedContent>
            )
          }
        </form.Subscribe>
      </>
    );
  },
});

export default BridgeFields;
