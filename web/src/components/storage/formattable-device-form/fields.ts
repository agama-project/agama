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

import { formOptions } from "@tanstack/react-form";
import { FILESYSTEM_TYPE, FILESYSTEM_ACTION } from "~/components/storage/shared/fields";
import type { MountPointFields, FilesystemFields } from "~/components/storage/shared/fields";

/**
 * Re-exported so form-local code (components, validations, transformations,
 * tests) can get everything describing the form fields from this module,
 * without needing to know which parts happen to be shared across storage
 * forms.
 *
 * This also leaves room for divergence: if this form ever needs different
 * values, this module can stop re-exporting and define its own version
 * (possibly derived from the shared one) without touching any consumer.
 */
export { FILESYSTEM_TYPE, FILESYSTEM_ACTION };
export type { MountPointFields, FilesystemFields };

/** Form field types */

export type FormFields = MountPointFields & FilesystemFields;

export type FormattableDeviceFormData = FormFields;

/** Default values */

const defaultValues: FormFields = {
  mountPoint: "",
  committedMountPoint: "",
  filesystem: FILESYSTEM_TYPE.AUTO,
  filesystemAction: FILESYSTEM_ACTION.REUSE,
  filesystemLabel: "",
  mkfsExtraArguments: "",
  mountOptions: [],
  showMoreFilesystemSettings: false,
};

export const defaultOptions = formOptions({ defaultValues });
