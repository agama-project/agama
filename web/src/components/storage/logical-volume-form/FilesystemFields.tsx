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
  /**
   * The volume group as it exists in the system, or undefined when it is new
   * (a new volume group has no logical volumes to reuse).
   */
  volumeGroup?: System.Device;
};

/**
 * Filesystem fields for the logical volume form.
 *
 * Thin wrapper around the shared FilesystemFields: it only resolves which
 * existing logical volume is being reused, from the `target` field (empty
 * string means a new logical volume) and the volume group's logical volumes.
 */
const FilesystemFields = withForm({
  ...defaultOptions,
  props: {
    volumeGroup: undefined,
  } as FilesystemFieldsProps,
  render: function Render({ form, volumeGroup }) {
    return (
      <form.Subscribe selector={(s) => s.values.target}>
        {(target) => (
          <SharedFilesystemFields
            form={form}
            reusedDevice={volumeGroup?.logicalVolumes?.find((lv) => lv.name === target)}
          />
        )}
      </form.Subscribe>
    );
  },
});

export default FilesystemFields;
