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
import { connectionTypeLabel, deviceStateLabel, formatIp } from "~/utils/network";
import { sortCollection } from "~/utils";
import { _ } from "~/i18n";

import type { SortedBy } from "~/components/core/SelectableDataTable";
import type { Device } from "~/types/network";

/** Props for {@link DeviceSelectorModal}. */
export type DeviceSelectorModalProps = {
  /** Devices offered for selection. */
  devices: Device[];
  /** Device selected when the dialog opens. */
  selected?: Device;
  /** Called with the picked device when the user confirms. */
  onConfirm: (device: Device) => void;
  /** Called when the user dismisses the dialog. */
  onCancel: () => void;
};

/** Addresses of a device, formatted for display. */
const deviceAddresses = (device: Device): string =>
  (device.addresses || []).map((address) => formatIp(address)).join(", ");

/**
 * Dialog for picking a network device from a table showing more details than a
 * dropdown can hold: name, MAC address, type, addresses, and state.
 *
 * The table can be sorted, and the pick is only reported to the caller when the
 * user confirms.
 */
export default function DeviceSelectorModal({
  devices,
  selected,
  onConfirm,
  onCancel,
}: DeviceSelectorModalProps): React.ReactNode {
  const confirmHintId = useId();
  // No column sorts the table at first, so the rows arrive in the same order as
  // the dropdown the user came from. Sorting starts when a header is clicked.
  const [sortedBy, setSortedBy] = useState<SortedBy>({});
  // Opening with nothing picked would make the dialog useless until the user
  // clicks a row, and would leave the initial focus with nowhere to land.
  const initialDevice = selected ?? first(devices);
  const [selection, setSelection] = useState<Device[]>(initialDevice ? [initialDevice] : []);

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
  ];

  const sortingKey = sortedBy.index === undefined ? undefined : columns[sortedBy.index].sortingKey;
  const sortedDevices = sortingKey
    ? sortCollection(devices, sortedBy.direction, sortingKey)
    : devices;

  const pick = selection[0];

  // Names what confirming will do, so the button reads as the action itself
  // rather than a bare "Confirm" whose effect has to be inferred.
  const confirmLabel = (): string => {
    // TRANSLATORS: confirmation button of the network device dialog while no
    // device is picked.
    if (!pick) return _("Select");
    // TRANSLATORS: confirmation button of the network device dialog. %s is
    // replaced by a device name, e.g. "enp1s0".
    return sprintf(_("Use %s"), pick.name);
  };

  return (
    <Popup
      isOpen
      variant="medium"
      // TRANSLATORS: title of the dialog for picking a network device
      title={_("Select a network device")}
      // Focus starts on the picked device, so its row is what the user hears
      // and sees first, and the arrow keys move from there.
      elementToFocus={initialDevice ? "input[type=radio]:checked" : undefined}
      onClose={onCancel}
    >
      <Stack hasGutter>
        <SelectableDataTable
          columns={columns}
          items={sortedDevices}
          itemIdKey="name"
          itemsSelected={selection}
          onSelectionChange={setSelection}
          selectionMode="single"
          sortedBy={sortedBy}
          updateSorting={setSortedBy}
        />
      </Stack>
      <Popup.Actions>
        <Stack hasGutter>
          {!pick && (
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
              onClick={() => onConfirm(pick)}
              isDisabled={!pick}
              aria-describedby={confirmHintId}
            >
              {confirmLabel()}
            </Popup.Confirm>
            <Popup.Cancel onClick={onCancel} asLink />
          </Flex>
        </Stack>
      </Popup.Actions>
    </Popup>
  );
}
