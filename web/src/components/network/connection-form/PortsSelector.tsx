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
import { Button } from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import VisualTooltip from "~/components/core/VisualTooltip";
import DeviceSelectorModal from "./DeviceSelectorModal";
import { defaultOptions } from "./fields";
import { withForm } from "~/hooks/form";
import { useConnections, useDevices } from "~/hooks/model/system/network";
import { controllerOf } from "~/utils/network";
import { _ } from "~/i18n";

import type { Device } from "~/types/network";

/** The loopback device is never a port of anything. */
const LOOPBACK = "lo";

type PortsPickerProps = {
  /** Devices that can be used as ports. */
  devices: Device[];
  /** Devices already listed as ports, shown as picked when the dialog opens. */
  selected: Device[];
  /** Returns the controller a device is already a port of, if any. */
  portOf: (device: Device) => string | undefined;
  /** Accessible name of the button, telling what the devices would be used for. */
  label: string;
  /** Called with the devices the user picked. */
  onConfirm: (devices: Device[]) => void;
};

/**
 * Button opening the device dialog, for picking the ports out of the devices
 * the system reports.
 *
 * The dialog opens with the devices already listed as ports picked, so it
 * serves for dropping a port as much as for adding one.
 */
function PortsPicker({
  devices,
  selected,
  portOf,
  label,
  onConfirm,
}: PortsPickerProps): React.ReactNode {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // Devices already used elsewhere are still offered, since moving a port from
  // one controller to another is legitimate. The dialog only grows a column
  // for it when there is something to tell.
  const hasPortsInUse = devices.some((d) => portOf(d));

  return (
    <>
      <VisualTooltip content={label}>
        <Button
          variant="control"
          aria-label={label}
          isDisabled={devices.length === 0}
          onClick={() => setIsDialogOpen(true)}
        >
          <Icon name="format_list_bulleted_add" />
        </Button>
      </VisualTooltip>
      {isDialogOpen && (
        <DeviceSelectorModal
          devices={devices}
          selected={selected}
          selectionMode="multiple"
          portOf={hasPortsInUse ? portOf : undefined}
          onConfirm={(picked) => {
            onConfirm(picked);
            setIsDialogOpen(false);
          }}
          onCancel={() => setIsDialogOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Ports left after the user picked in the dialog.
 *
 * The dialog answers with devices alone, so the names it knew nothing about
 * are kept as they were: a port may be typed by hand, and dropping such a name
 * because the dialog did not offer it would lose what the user wrote. The ones
 * it did offer follow what the user picked, keeping the order they were listed
 * in and appending the rest.
 */
function nextPorts(ports: string[], offered: Device[], picked: Device[]): string[] {
  const offeredNames = offered.map((d) => d.name);
  const pickedNames = picked.map((d) => d.name);
  const kept = ports.filter((p) => !offeredNames.includes(p) || pickedNames.includes(p));

  return [...kept, ...pickedNames.filter((n) => !kept.includes(n))];
}

type PortsSelectorProps = {
  /** Whether the ports being listed are those of a bond or those of a bridge. */
  kind: "bond" | "bridge";
};

/**
 * Ports field of a bond or a bridge, with a button for picking them among the
 * devices the system reports.
 *
 * Names are still typed and pasted freely, since a port may well be a device
 * that is not plugged in yet, or one that only shows up once the installed
 * system boots. The dialog is there so that the common case, picking among
 * what is already there, does not go through copying a name by hand.
 *
 * Receives a typed form instance via `withForm`.
 */
const PortsSelector = withForm({
  ...defaultOptions,
  props: {
    kind: "bond",
  } as PortsSelectorProps,
  render: function Render({ form, kind }) {
    const isBond = kind === "bond";
    const name = isBond ? "bondPorts" : "bridgePorts";
    const controllerField = isBond ? "bondIface" : "bridgeIface";
    // TRANSLATORS: label for the bond or bridge ports field.
    const label = isBond ? _("Bond ports") : _("Bridge ports");
    // TRANSLATORS: accessible name of the button opening the dialog for picking
    // the ports of a bond or a bridge among the devices found in the system.
    const pickLabel = isBond ? _("Select bond ports") : _("Select bridge ports");

    const devices = useDevices();
    const connections = useConnections();

    return (
      <form.Subscribe selector={(s) => s.values[controllerField]}>
        {(controllerIface) => (
          <form.AppField name={name}>
            {(field) => {
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

              return (
                <field.ArrayField
                  label={label}
                  helperText={
                    // TRANSLATORS: helper text for the bond or bridge ports field.
                    _("Pick the devices to use as ports, or type the name of one not listed yet.")
                  }
                  skipDuplicates
                  addOn={({ entries, setEntries }) => (
                    <PortsPicker
                      devices={available}
                      selected={available.filter((d) => entries.includes(d.name))}
                      portOf={portOf}
                      label={pickLabel}
                      onConfirm={(picked) => setEntries(nextPorts(entries, available, picked))}
                    />
                  )}
                />
              );
            }}
          </form.AppField>
        )}
      </form.Subscribe>
    );
  },
});

export default PortsSelector;
