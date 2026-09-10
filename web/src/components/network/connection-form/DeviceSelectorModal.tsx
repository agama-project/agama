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

import React, { useId, useState } from "react";
import { Flex, HelperText, HelperTextItem, Stack } from "@patternfly/react-core";
import { first } from "radashi";
import { sprintf } from "sprintf-js";
import Popup from "~/components/core/Popup";
import SelectableDataTable from "~/components/core/SelectableDataTable";
import Text from "~/components/core/Text";
import { connectionTypeLabel, deviceLinkLabel, deviceStateLabel, formatIp } from "~/utils/network";
import { sortCollection } from "~/utils";
import { _, n_ } from "~/i18n";

import type { SortedBy } from "~/components/core/SelectableDataTable";
import type { Device } from "~/types/network";

/** Props for {@link DeviceSelectorModal}. */
export type DeviceSelectorModalProps = {
  /** Devices offered for selection. */
  devices: Device[];
  /** Devices selected when the dialog opens. */
  selected?: Device[];
  /**
   * Whether the user picks one device or several.
   *
   * In `"single"` mode a device is always picked, defaulting to the first one
   * offered. In `"multiple"` mode the answer is the whole set of picked
   * devices, so the dialog opens with whatever `selected` says and nothing
   * otherwise, and confirming an empty set is legitimate.
   */
  selectionMode?: "single" | "multiple";
  /**
   * Returns the controller a device is already a port of, if any.
   *
   * When given, a "Used by" column is added. Devices already in use are still
   * offered: moving a port from one controller to another is legitimate.
   */
  portOf?: (device: Device) => string | undefined;
  /** Called with the picked devices when the user confirms. */
  onConfirm: (devices: Device[]) => void;
  /** Called when the user dismisses the dialog. */
  onCancel: () => void;
};

/** Addresses of a device, formatted for display. */
const deviceAddresses = (device: Device): string =>
  (device.addresses || []).map((address) => formatIp(address)).join(", ");

/**
 * Dialog for picking network devices from a table showing more details than a
 * dropdown can hold: name, MAC address, type, addresses, state and link.
 *
 * The table can be sorted, and the pick is only reported to the caller when the
 * user confirms.
 *
 * Only devices the system reports are listed. A caller whose values are names
 * rather than devices, such as the ports of a bond, may well hold a name no
 * device answers to; the dialog says nothing about it and the caller keeps it
 * (see `mergePicked`).
 */
export default function DeviceSelectorModal({
  devices,
  selected,
  selectionMode = "single",
  portOf,
  onConfirm,
  onCancel,
}: DeviceSelectorModalProps): React.ReactNode {
  const confirmHintId = useId();
  const isMultiple = selectionMode === "multiple";
  // No column sorts the table at first, so the rows arrive in the same order as
  // the dropdown the user came from. Sorting starts when a header is clicked.
  const [sortedBy, setSortedBy] = useState<SortedBy>({});
  // Opening a single-device dialog with nothing picked would make it useless
  // until the user clicks a row, and would leave the initial focus with nowhere
  // to land. Picking several is different: what the caller already has is the
  // starting point, and preselecting a device it did not ask for would be
  // added behind the user's back on confirm.
  const defaultSelection = (): Device[] => {
    if (isMultiple) return [];
    const firstDevice = first(devices);
    return firstDevice ? [firstDevice] : [];
  };
  const [selection, setSelection] = useState<Device[]>(selected ?? defaultSelection());

  const columns = [
    {
      // TRANSLATORS: table column with the name of a network device and, below
      // it, the hardware identifier of its interface.
      name: _("Device"),
      value: (device: Device) => (
        <Stack>
          <span>{device.name}</span>
          <Text textStyle={["textColorSubtle", "fontSizeXs"]}>{device.macAddress}</Text>
        </Stack>
      ),
      sortingKey: "name",
    },
    {
      name: _("Type"),
      value: (device: Device) => connectionTypeLabel(device.type),
      sortingKey: "type",
    },
    {
      name: _("IP Addresses"),
      value: (device: Device) => deviceAddresses(device) || "-",
    },
    {
      name: _("State"),
      value: (device: Device) => deviceStateLabel(device.state),
      sortingKey: "state",
    },
    {
      // TRANSLATORS: table column with the physical link of a network device:
      // whether a cable is plugged in and, if so, at which speed.
      name: _("Link"),
      value: (device: Device) => deviceLinkLabel(device),
    },
    ...(portOf
      ? [
          {
            // TRANSLATORS: table column telling which bond or bridge already
            // uses a network device as one of its ports.
            name: _("Used by"),
            value: (device: Device) => portOf(device) || "-",
          },
        ]
      : []),
  ];

  const sortingKey = sortedBy.index === undefined ? undefined : columns[sortedBy.index].sortingKey;
  const sortedDevices = sortingKey
    ? sortCollection(devices, sortedBy.direction, sortingKey)
    : devices;

  const pick = selection[0];

  // Names what confirming will do, so the button reads as the action itself
  // rather than a bare "Confirm" whose effect has to be inferred.
  const confirmLabel = (): string => {
    if (isMultiple) {
      // TRANSLATORS: confirmation button of the network device dialog when
      // several devices can be picked and the user picked none.
      if (selection.length === 0) return _("Use no device");

      // TRANSLATORS: confirmation button of the network device dialog when
      // several devices can be picked. %d is replaced by how many are picked.
      return sprintf(n_("Use %d device", "Use %d devices", selection.length), selection.length);
    }

    // TRANSLATORS: confirmation button of the network device dialog while no
    // device is picked.
    if (!pick) return _("Select");
    // TRANSLATORS: confirmation button of the network device dialog. %s is
    // replaced by a device name, e.g. "enp1s0".
    return sprintf(_("Use %s"), pick.name);
  };

  // Picking nothing is an answer of its own when several devices can be picked:
  // the caller ends up with an empty list, exactly as it would by unlisting
  // them one by one. Picking a single device is another matter, there is no
  // "no device" to hand back.
  const canConfirm = isMultiple || pick !== undefined;

  const actions = (
    <Stack hasGutter>
      {!canConfirm && (
        <HelperText id={confirmHintId} isLiveRegion>
          <HelperTextItem>
            {
              // TRANSLATORS: shown next to the disabled confirmation button
              // of the network device dialog, when no device is picked.
              _("Select a device")
            }
          </HelperTextItem>
        </HelperText>
      )}
      <Flex>
        <Popup.Confirm
          onClick={() => onConfirm(selection)}
          isDisabled={!canConfirm}
          aria-describedby={canConfirm ? undefined : confirmHintId}
        >
          {confirmLabel()}
        </Popup.Confirm>
        <Popup.Cancel onClick={onCancel} asLink />
      </Flex>
    </Stack>
  );

  return (
    <Popup
      isOpen
      variant="medium"
      title={
        isMultiple
          ? // TRANSLATORS: title of the dialog for picking several network devices
            _("Select network devices")
          : // TRANSLATORS: title of the dialog for picking a network device
            _("Select a network device")
      }
      // Focus starts on the picked device, so its row is what the user hears
      // and sees first, and the arrow keys move from there.
      elementToFocus={pick ? "input:checked" : undefined}
      onClose={onCancel}
      actions={actions}
    >
      <Stack hasGutter>
        <SelectableDataTable
          columns={columns}
          items={sortedDevices}
          itemIdKey="name"
          itemsSelected={selection}
          onSelectionChange={setSelection}
          selectionMode={selectionMode}
          allowSelectAll={isMultiple}
          sortedBy={sortedBy}
          updateSorting={setSortedBy}
        />
      </Stack>
    </Popup>
  );
}
