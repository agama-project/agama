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
import Text from "~/components/core/Text";
import { defaultOptions, FormFields } from "./fields";
import { withForm } from "~/hooks/form";
import { useDevices } from "~/hooks/model/system/network";
import { Device } from "~/types/network";
import { _ } from "~/i18n";

type SyncConfig = {
  /** The form field to keep in sync with the selected device. */
  field: "iface" | "ifaceMac";
  /** Returns the value to write into the synced field for a given device. */
  with: (device: Device) => string;
};

type ExcludeFilter = {
  /** Device names to exclude from the options list. */
  devices?: string[];
  /** Device types to exclude from the options list. */
  types?: string[];
};

type DeviceSelectorProps = {
  /** Whether to show device names or MAC addresses as the primary value. */
  by: "iface" | "mac";
  /** Form field name to bind to. Defaults to "iface" or "ifaceMac" based on `by`. */
  name?: keyof FormFields;
  /** Label for the dropdown. Defaults to "Device name" or "MAC address" based on `by`. */
  label?: React.ReactNode;
  /** Sync configuration to update another field when a device is selected. */
  sync?: SyncConfig;
  /** Filter to exclude devices and types from the options list. */
  exclude?: ExcludeFilter;
  /** Additional TanStack Form field listeners. */
  listeners?: {
    onMount?: (context: { value: string }) => void;
    onChange?: (context: { value: string }) => void;
  };
};

/**
 * A `DropdownField` based selector for picking a network device, either by
 * interface name or by MAC address.
 *
 * Receives a typed form instance via `withForm`. When `sync` is provided,
 * a TanStack Form listener updates the specified field whenever a device is
 * selected, using the `with` function to derive the value to write.
 *
 * @see https://tanstack.com/form/latest/docs/framework/react/guides/listeners
 */
const DeviceSelector = withForm({
  ...defaultOptions,
  props: {
    by: "iface",
    name: undefined,
    label: undefined,
    sync: undefined,
    exclude: {},
    listeners: undefined,
  } as DeviceSelectorProps,
  render: function Render({
    form,
    by,
    name: nameProp,
    label: labelProp,
    sync,
    exclude = {},
    listeners: listenersProp,
  }) {
    const excludeDevices = exclude.devices || [];
    const excludeTypes = exclude.types || [];

    const devices = useDevices().filter((d) => {
      if (excludeDevices.includes(d.name)) return false;
      if (excludeTypes.includes(d.type)) return false;
      return true;
    });

    const valueKey = by === "iface" ? "name" : "macAddress";

    const name = nameProp ?? (by === "iface" ? "iface" : "ifaceMac");
    // TRANSLATORS: accessible label for the device selector. MAC address refers
    // to the hardware identifier of the network interface.
    const defaultLabel = by === "iface" ? _("Device name") : _("Device MAC address");
    const label = labelProp ?? defaultLabel;
    const options = devices.map((d) => {
      const value = d[valueKey];
      return {
        value,
        label: value,
        description: (
          <Text textStyle={["textColorSubtle", "fontSizeXs"]}>
            {by === "iface" ? d.macAddress : d.name}
          </Text>
        ),
      };
    });

    const listeners = {
      // Pre-select the first available device when the selector mounts with no
      // value, e.g. when the user switches from "Any device" binding mode.
      onMount: ({ value }: { value: string }) => {
        if (!value && devices.length > 0)
          form.setFieldValue(name, devices[0][valueKey], { dontUpdateMeta: true });
      },
      ...(sync && {
        onChange: ({ value }: { value: string }) => {
          const device =
            by === "iface"
              ? devices.find((d) => d.name === value)
              : devices.find((d) => d.macAddress === value);
          if (device)
            form.setFieldValue(sync.field, sync.with(device), {
              // Prevents the counterpart field's listener from firing in
              // response, which would otherwise cause an infinite loop.
              dontRunListeners: true,
            });
        },
      }),
      ...listenersProp,
    };

    return (
      <form.AppField name={name} listeners={listeners}>
        {(field) => <field.DropdownField label={label} options={options} />}
      </form.AppField>
    );
  },
});

export default DeviceSelector;
