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
import { withForm } from "~/hooks/form";
import SharedFilesystemFields from "~/components/storage/shared/FilesystemFields";
import { defaultOptions } from "./fields";

import type { Storage as System } from "~/model/system";

type FilesystemFieldsProps = {
  device: System.Device;
};

/**
 * Filesystem fields for the partition form.
 *
 * Thin wrapper around the shared FilesystemFields: it only resolves which
 * existing partition is being reused, from the `name` field (empty string
 * means a new partition) and the device's partitions.
 */
const FilesystemFields = withForm({
  ...defaultOptions,
  props: {
    device: {} as System.Device,
  } as FilesystemFieldsProps,
  render: function Render({ form, device }) {
    return (
      <form.Subscribe selector={(s) => s.values.name}>
        {(name) => (
          <SharedFilesystemFields
            form={form}
            reusedDevice={device.partitions?.find((p) => p.name === name)}
          />
        )}
      </form.Subscribe>
    );
  },
});

export default FilesystemFields;
