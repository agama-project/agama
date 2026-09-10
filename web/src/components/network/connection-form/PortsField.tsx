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
import { mergePicked } from "~/components/form/ArrayField";
import Icon from "~/components/layout/Icon";
import VisualTooltip from "~/components/core/VisualTooltip";
import DeviceSelectorModal from "./DeviceSelectorModal";
import { defaultOptions } from "./fields";
import { withForm } from "~/hooks/form";
import { useConnections, useDevices } from "~/hooks/model/system/network";
import { controllerOf } from "~/utils/network";
import { _ } from "~/i18n";

import type { TranslatedString } from "~/i18n";
import type { FormFields } from "./fields";
import type { Device } from "~/types/network";

/** The loopback device is never a port of anything. */
const LOOPBACK = "lo";

type DevicePickerProps = {
  /** Devices offered for picking. */
  devices: Device[];
  /** Devices picked when the dialog opens. */
  selected: Device[];
  /** Returns the controller a device is already a port of, if any. */
  portOf: (device: Device) => string | undefined;
  /** Accessible name of the button, telling what the devices would be used for. */
  label: TranslatedString;
  /** Called with the devices the user picked. */
  onConfirm: (devices: Device[]) => void;
};

/**
 * Button opening the device dialog, for picking among the devices the system
 * reports.
 *
 * The dialog opens with `selected` picked, so it serves for dropping a device
 * as much as for adding one.
 */
function DevicePicker({
  devices,
  selected,
  portOf,
  label,
  onConfirm,
}: DevicePickerProps): React.ReactNode {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // Devices already used elsewhere are still offered, since moving a port from
  // one controller to another is legitimate. The dialog only grows a column
  // for it when there is something to tell.
  const hasPortsInUse = devices.some((d) => portOf(d));

  return (
    <>
      <VisualTooltip content={label}>
        <Button
          variant="plain"
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

/** Names of the given devices. */
const names = (devices: Device[]): string[] => devices.map((d) => d.name);

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
  /** Accessible name of the button opening the device dialog. */
  pickLabel: TranslatedString;
};

/**
 * Ports field of a controller device, with a button for picking them among the
 * devices the system reports.
 *
 * Names are still typed and pasted freely, since a port may well be a device
 * that is not plugged in yet, or one that only shows up once the installed
 * system boots. The dialog is there so that the common case, picking among
 * what is already there, does not go through copying a name by hand.
 *
 * What the field is about is left to the caller: which form fields it reads and
 * writes, how it is labelled, and what the button offering the devices says.
 *
 * Receives a typed form instance via `withForm`.
 */
const PortsField = withForm({
  ...defaultOptions,
  // Only carries the prop types: every caller passes them all.
  props: {} as PortsFieldProps,
  render: function Render({ form, name, controllerField, label, pickLabel }) {
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
                    // TRANSLATORS: helper text for the ports field of a bond or a bridge.
                    _("Pick the devices to use as ports, or type the name of one not listed yet.")
                  }
                  skipDuplicates
                  addOn={({ entries, setEntries }) => (
                    <DevicePicker
                      devices={available}
                      selected={available.filter((d) => entries.includes(d.name))}
                      portOf={portOf}
                      label={pickLabel}
                      // Only the devices found are offered, so a port naming
                      // none of them, typed by hand or waiting for a card to
                      // show up, is kept: the dialog never asked about it.
                      onConfirm={(picked) =>
                        setEntries(mergePicked(entries, names(available), names(picked)))
                      }
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

export default PortsField;
