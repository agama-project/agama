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
import { connectionFormOptions } from "~/components/network/ConnectionForm";
import { withForm } from "~/hooks/form";
import { useDevices } from "~/hooks/model/system/network";
import { _, formatList } from "~/i18n";
import Text from "../core/Text";
import { Flex } from "@patternfly/react-core";

type BridgeSettingsProps = {
  isEditing?: boolean;
};

/**
 * Bridge settings block for a connection form.
 *
 * Shows bridge options and ports when the connection type is BRIDGE.
 * Also shows the device name field for new bridge connections.
 *
 * Receives a typed form instance via `withForm`.
 */
const BridgeSettings = withForm({
  ...connectionFormOptions,
  props: {
    isEditing: false,
  } as BridgeSettingsProps,
  render: function Render({ form, isEditing }) {
    const devices = useDevices();

    return (
      <>
        <form.AppField name="virtualIface">
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
                sprintf(_("Available devices: %s"), formatList(devices.map((d) => d.name)))
              }
              skipDuplicates
            />
          )}
        </form.AppField>

        <form.AppField name="bridgeStp">
          {(field) => (
            <field.CheckboxField
              label={
                // TRANSLATORS: label for the bridge STP (Spanning Tree Protocol) field.
                _("Enable Spanning Tree Protocol (STP)")
              }
            />
          )}
        </form.AppField>
        <form.Subscribe selector={(s) => s.values.bridgeStp}>
          {(bridgeStp) =>
            bridgeStp && (
              <>
                <form.AppField name="bridgePriority">
                  {(field) => (
                    <field.NumberField
                      label={
                        // TRANSLATORS: label for the bridge priority field.
                        _("Priority")
                      }
                      helperText={
                        // TRANSLATORS: helper text for the bridge priority field.
                        _(
                          "Determines the root bridge. Lower values have higher priority. Range: 0 - 61440. E.g., 32768.",
                        )
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
                        // TRANSLATORS: label for the bridge forward delay field.
                        _("Forward delay")
                      }
                      helperText={
                        // TRANSLATORS: helper text for the bridge forward delay field.
                        _(
                          "Time spent in listening and learning states. Range: 4 - 30 seconds. E.g., 15.",
                        )
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
                        // TRANSLATORS: label for the bridge hello time field.
                        _("Hello time")
                      }
                      helperText={
                        // TRANSLATORS: helper text for the bridge hello time field.
                        _("Interval between sending BPDU packets. Range: 1 - 10 seconds. E.g., 2.")
                      }
                    />
                  )}
                </form.AppField>
                <form.AppField name="bridgeMaxMessageAge">
                  {(field) => (
                    <field.NumberField
                      label={
                        // TRANSLATORS: label for the bridge max message age field.
                        _("Max message age")
                      }
                      helperText={
                        // TRANSLATORS: helper text for the bridge max message age field.
                        _(
                          "Time to store BPDU info before discarding it. Range: 6 - 40 seconds. E.g., 20.",
                        )
                      }
                    />
                  )}
                </form.AppField>
              </>
            )
          }
        </form.Subscribe>
      </>
    );
  },
});

export default BridgeSettings;
