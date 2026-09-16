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

import React, { useState } from "react";
import { sift } from "radashi";
import { sprintf } from "sprintf-js";
import Text from "~/components/core/Text";
import DeviceSelectorModal from "./DeviceSelectorModal";
import { defaultOptions } from "./fields";
import { withForm } from "~/hooks/form";
import { useConnections, useDevices } from "~/hooks/model/system/network";
import { connectionTypeLabel, controllerOf, deviceLinkLabel } from "~/utils/network";
import { _ } from "~/i18n";

import type { TranslatedString } from "~/i18n";
import type { FormFields } from "./fields";
import type { Device } from "~/types/network";

/** The loopback device is never a port of anything. */
const LOOPBACK = "lo";

/** Names of the given devices. */
const names = (devices: Device[]): string[] => devices.map((d) => d.name);

/**
 * Ports left after a dialog offering `offered` answered with `picked`.
 *
 * The dialog only knows about the devices the system reports, so the ports it
 * was never offered are kept as they were: dropping them because the dialog
 * did not list them would lose what the user wrote. The offered ones follow
 * the pick, keeping the order they were listed in and appending the rest.
 */
function mergePicked(ports: string[], offered: string[], picked: string[]): string[] {
  const kept = ports.filter((p) => !offered.includes(p) || picked.includes(p));

  return [...kept, ...picked.filter((p) => !kept.includes(p))];
}

type PortsFieldProps = {
  /** Form field holding the names of the ports. */
  name: Extract<keyof FormFields, `${string}Ports`>;
  /**
   * Form field holding the name of the controller the ports belong to.
   *
   * Watched rather than read once: the field is filled while the form is being
   * used, and a controller cannot be a port of itself.
   */
  controllerField: Extract<keyof FormFields, `${string}Iface`>;
  /** Label of the field. */
  label: TranslatedString;
  /**
   * Title of the dialog listing the devices with their details, e.g. "Select
   * bond ports".
   *
   * The field label that said what the devices are for is no longer in sight
   * once the dialog covers the form, and the entry that opened it reads the
   * same on every field, so the dialog cannot name itself.
   */
  title: TranslatedString;
};

/**
 * Ports field of a controller device, offering the devices the system reports
 * and taking names written out as well.
 *
 * A port may name a device that is not plugged in yet, or one that only shows
 * up once the installed system boots, hence `allowCustomEntries`: the list is
 * for the common case, not a fence around it.
 *
 * The details that tell two cards apart, the link, the driver, where the card
 * sits, do not fit in a list, so the foot of it leads to `DeviceSelectorModal`,
 * which shows them in a table and picks several ports in one pass.
 *
 * What the field is about is left to the caller: which form fields it reads and
 * writes, how it is labelled, and what the dialog offering the devices is
 * titled.
 *
 * Receives a typed form instance via `withForm`.
 */
const PortsField = withForm({
  ...defaultOptions,
  // Only carries the prop types: every caller passes them all.
  props: {} as PortsFieldProps,
  render: function Render({ form, name, controllerField, label, title }) {
    const devices = useDevices();
    const connections = useConnections();
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    return (
      <form.Subscribe selector={(s) => s.values[controllerField]}>
        {(controllerIface) => (
          <form.AppField name={name}>
            {(field) => {
              const ports = field.state.value;
              // A controller cannot be a port of itself.
              const available = devices.filter(
                (d) => d.name !== LOOPBACK && d.name !== controllerIface,
              );
              // The controller being edited is not worth mentioning: the user
              // is looking at its own list of ports.
              const portOf = (device: Device) => {
                const controller = controllerOf(device.name, connections);
                return controller === controllerIface ? undefined : controller;
              };
              // Devices already used elsewhere are still offered, since moving
              // a port from one controller to another is legitimate. The dialog
              // only grows a column for it when there is something to tell.
              const hasPortsInUse = available.some((d) => portOf(d));

              const options = available.map((device) => {
                const controller = portOf(device);
                // What is worth knowing at a glance, and no more: the table
                // behind the footer entry is where the rest lives.
                const detail = sift([
                  connectionTypeLabel(device.type),
                  deviceLinkLabel(device),
                  device.macAddress,
                  controller &&
                    // TRANSLATORS: shown next to a network device that another
                    // bond or bridge already uses. %s is its name, e.g. "bond0".
                    sprintf(_("used by %s"), controller),
                ]).join(" · ");

                return {
                  value: device.name,
                  label: device.name,
                  description: <Text textStyle={["fontSizeXs", "textColorSubtle"]}>{detail}</Text>,
                  // The driver is searchable although the option does not show
                  // it: the dialog does, and a user who knows which driver
                  // their card runs on should not have to open it to find out
                  // which device that is.
                  filterText: sift([
                    device.name,
                    device.macAddress,
                    connectionTypeLabel(device.type),
                    device.driver,
                  ]).join(" "),
                };
              });

              return (
                <>
                  <field.MultiSelectField
                    label={label}
                    options={options}
                    allowCustomEntries
                    helperText={
                      // TRANSLATORS: helper text for the ports field of a bond
                      // or a bridge, naming the two ways of filling it in.
                      _("Choose the devices found in the system, or enter other names.")
                    }
                    // The list leaves the controller out, but a name written by
                    // hand does not go through it. The form says so on submit
                    // (see `validatePorts` in validations.ts); this points at
                    // which of the ports it was talking about, and stays quiet
                    // until then, as validation does everywhere else.
                    validateOnSubmit={(value) =>
                      value === controllerIface
                        ? // TRANSLATORS: error shown on a port naming the bond
                          // or bridge being configured. %s is the name of that
                          // device, e.g. "bond0".
                          sprintf(_("%s cannot be a port of itself"), value)
                        : undefined
                    }
                    // Nothing to browse, nothing to lead to: a dialog opening
                    // on an empty table is worse than no way in at all.
                    footerEntry={
                      available.length > 0
                        ? {
                            // TRANSLATORS: entry at the end of the device list,
                            // leading to a dialog listing the same devices with
                            // more information about each of them. The trailing
                            // ellipsis hints that more follows instead of a
                            // device being picked right away.
                            label: _("Browse with details..."),
                            onSelect: () => setIsDialogOpen(true),
                            opensDialog: true,
                          }
                        : undefined
                    }
                  />
                  {isDialogOpen && (
                    <DeviceSelectorModal
                      title={title}
                      devices={available}
                      selected={available.filter((d) => ports.includes(d.name))}
                      selectionMode="multiple"
                      portOf={hasPortsInUse ? portOf : undefined}
                      // Only the devices found are offered, so a port naming
                      // none of them, written out by hand or waiting for a card
                      // to show up, is kept: the dialog never asked about it.
                      onConfirm={(picked) => {
                        field.handleChange(mergePicked(ports, names(available), names(picked)));
                        setIsDialogOpen(false);
                      }}
                      onCancel={() => setIsDialogOpen(false)}
                    />
                  )}
                </>
              );
            }}
          </form.AppField>
        )}
      </form.Subscribe>
    );
  },
});

export default PortsField;
