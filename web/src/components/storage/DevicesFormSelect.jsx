/*
 * Copyright (c) [2024] SUSE LLC
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

// @ts-check

import React from "react";
import { FormSelect, FormSelectOption } from "@patternfly/react-core";
import { deviceSize } from "~/components/storage/utils";

/**
 * @typedef {import ("@patternfly/react-core").FormSelectProps} PFFormSelectProps
 * @typedef {import ("~/types/storage").StorageDevice} StorageDevice
 */

/**
 * A PF/Select for simple device selection
 * @component
 *
 * @example <caption>Simple usage</caption>
 *   import { devices, selected } from "somewhere";
 *
 *   <DevicesFormSelect devices={devices} selected={selected} />
 *
 * @typedef {object} DevicesFormSelectBaseProps
 * @property {StorageDevice[]} props.devices - Devices to show in the selector.
 * @property {StorageDevice} [props.selectedDevice] - Currently selected device. In case of
 * @property {(StorageDevice) => void} props.onChange - Callback to be called when the selection changes
 *
 * @param {DevicesFormSelectBaseProps & Omit<PFFormSelectProps, "value" | "onChange" | "children">} props
 */
export default function DevicesFormSelect({ devices, selectedDevice, onChange, ...otherProps }) {
  return (
    /** @ts-expect-error: for some reason using otherProps makes TS complain */
    <FormSelect
      {...otherProps}
      value={selectedDevice?.sid}
      onChange={(_, value) => onChange(devices.find((d) => d.sid === Number(value)))}
    >
      {devices.map((device) => (
        <FormSelectOption
          key={device.sid}
          value={device.sid}
          label={`${device.name}, ${deviceSize(device.size)}`}
        />
      ))}
    </FormSelect>
  );
}
