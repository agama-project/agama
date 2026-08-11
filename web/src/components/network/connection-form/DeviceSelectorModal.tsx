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

import React, { useEffect, useId, useState } from "react";
import {
  Button,
  Divider,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  Flex,
  HelperText,
  HelperTextItem,
  SearchInput,
  Stack,
} from "@patternfly/react-core";
import { first } from "radashi";
import { sprintf } from "sprintf-js";
import formStyles from "@patternfly/react-styles/css/components/Form/form";
import sizingStyles from "@patternfly/react-styles/css/utilities/Sizing/sizing";
import Popup from "~/components/core/Popup";
import SelectableDataTable from "~/components/core/SelectableDataTable";
import Text from "~/components/core/Text";
import { useAnnounce } from "~/context/announcer";
import { connectionTypeLabel, deviceStateLabel, formatIp } from "~/utils/network";
import { sortCollection } from "~/utils";
import { _, n_ } from "~/i18n";

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

/**
 * Id of the filter input, tying it to its label.
 *
 * A fixed id is enough because only one of these dialogs is open at a time.
 */
const FILTER_INPUT_ID = "network-device-filter";

/** Addresses of a device, formatted for display. */
const deviceAddresses = (device: Device): string =>
  (device.addresses || []).map((address) => formatIp(address)).join(", ");

/** Text used to match a device against what the user typed in the filter. */
const searchableText = (device: Device): string =>
  [device.name, device.macAddress, connectionTypeLabel(device.type), deviceAddresses(device)]
    .join(" ")
    .toLowerCase();

const filterDevices = (devices: Device[], search: string): Device[] => {
  const term = search.trim().toLowerCase();
  if (term === "") return devices;

  return devices.filter((device) => searchableText(device).includes(term));
};

/**
 * Dialog for picking a network device from a table showing more details than a
 * dropdown can hold: name, MAC address, type, addresses, and state.
 *
 * The table can be filtered and sorted, and the pick is only reported to the
 * caller when the user confirms.
 */
export default function DeviceSelectorModal({
  devices,
  selected,
  onConfirm,
  onCancel,
}: DeviceSelectorModalProps): React.ReactNode {
  const confirmHintId = useId();
  const [search, setSearch] = useState("");
  // No column sorts the table at first, so the rows arrive in the same order as
  // the dropdown the user came from. Sorting starts when a header is clicked.
  const [sortedBy, setSortedBy] = useState<SortedBy>({});
  // Opening with nothing picked would make the dialog useless until the user
  // clicks a row, and would leave the initial focus with nowhere to land.
  const initialDevice = selected ?? first(devices);
  const [selection, setSelection] = useState<Device[]>(initialDevice ? [initialDevice] : []);
  const announce = useAnnounce();

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

  const isFiltering = search.trim() !== "";
  const visibleDevices = filterDevices(devices, search);
  const sortingKey = sortedBy.index === undefined ? undefined : columns[sortedBy.index].sortingKey;
  const sortedDevices = sortingKey
    ? sortCollection(visibleDevices, sortedBy.direction, sortingKey)
    : visibleDevices;

  // Only a device the user can see counts as picked. Confirming one hidden by
  // the filter would apply a device with nothing on screen to show for it. The
  // pick is derived rather than cleared, so widening the filter again brings it
  // back instead of making the user find it a second time.
  const pick = selection.find((device) => visibleDevices.some((d) => d.name === device.name));

  // TRANSLATORS: screen reader announcement when filter results change.
  // %d is the number of devices matching the current filter.
  const filterAnnouncement = isFiltering
    ? sprintf(
        n_("%d device found", "%d devices found", visibleDevices.length),
        visibleDevices.length,
      )
    : "";

  useEffect(() => {
    if (filterAnnouncement) announce(filterAnnouncement);
  }, [filterAnnouncement, announce]);

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

  const noDevicesFound = (
    <EmptyState
      headingLevel="h4"
      // TRANSLATORS: shown instead of the device table when the filter matches nothing
      titleText={_("No devices match the filter")}
      variant="sm"
    >
      <EmptyStateBody>{_("Try a different name, MAC address, type, or address.")}</EmptyStateBody>
      <EmptyStateFooter>
        <EmptyStateActions>
          <Button variant="link" onClick={() => setSearch("")}>
            {_("Clear filter")}
          </Button>
        </EmptyStateActions>
      </EmptyStateFooter>
    </EmptyState>
  );

  return (
    <Popup
      isOpen
      variant="medium"
      // TRANSLATORS: title of the dialog for picking a network device
      title={_("Select a network device")}
      // Focus starts on the picked device, so its row is what the user hears
      // and sees first, and the arrow keys move from there. Filtering is a step
      // back for the rare case of a long list.
      elementToFocus={initialDevice ? "input[type=radio]:checked" : undefined}
      onClose={onCancel}
    >
      <Stack hasGutter>
        <Stack>
          <label htmlFor={FILTER_INPUT_ID} className={formStyles.formLabel}>
            {
              // TRANSLATORS: label of the field filtering the list of network
              // devices. It names what can be typed there.
              _("Filter by name, MAC address, type or address")
            }
          </label>
          <SearchInput
            searchInputId={FILTER_INPUT_ID}
            // Fills the dialog width instead of sitting at its intrinsic size,
            // which leaves the field far narrower than the table below it.
            className={sizingStyles.w_100}
            // SearchInput labels its input "Search input" unless told otherwise,
            // and that default would win over the label above. An empty value is
            // ignored when the accessible name is computed, leaving the label to
            // name the field.
            aria-label=""
            value={search}
            onChange={(_event, value) => setSearch(value)}
            onClear={() => setSearch("")}
          />
        </Stack>
        <Divider />
        <SelectableDataTable
          columns={columns}
          items={sortedDevices}
          itemIdKey="name"
          itemsSelected={selection}
          onSelectionChange={setSelection}
          selectionMode="single"
          sortedBy={sortedBy}
          updateSorting={setSortedBy}
          emptyState={noDevicesFound}
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
