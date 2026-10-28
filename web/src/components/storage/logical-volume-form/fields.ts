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
import { FILESYSTEM_TYPE, FILESYSTEM_ACTION, SIZE_MODE } from "~/components/storage/shared/fields";
import type {
  SizeMode,
  MountPointFields,
  FilesystemFields,
  SizeFields,
} from "~/components/storage/shared/fields";

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
export { FILESYSTEM_TYPE, FILESYSTEM_ACTION, SIZE_MODE };
export type { SizeMode, MountPointFields, FilesystemFields, SizeFields };

/**
 * Determines whether the form is configured to reuse an existing logical
 * volume.
 *
 * Returns `true` when the target holds a logical volume name (e.g.
 * "/dev/system/home"), and `false` when creating a new logical volume (empty
 * string).
 *
 * @param target - The logical volume source field value.
 */
export function isReusingLogicalVolume(target: string): boolean {
  return target !== "";
}

/** Form field types */

type LogicalVolumeSourceFields = {
  /**
   * Logical volume name for reusing an existing logical volume, or an empty
   * string for creating a new one.
   *
   * When empty: a new logical volume will be created.
   * When a logical volume name (e.g., "/dev/system/home"): that logical volume
   * is reused.
   */
  target: string;
};

export type LogicalVolumeNameFields = {
  /**
   * Name for the new logical volume (e.g., "home", "var"). Only used when
   * creating a new logical volume (target === ""). Auto-filled from the mount
   * point until the user edits it.
   */
  lvName: string;
};

export type FormFields = MountPointFields &
  LogicalVolumeSourceFields &
  LogicalVolumeNameFields &
  FilesystemFields &
  SizeFields;

export type LogicalVolumeFormData = FormFields;

/** Default values */

const defaultValues: FormFields = {
  mountPoint: "",
  committedMountPoint: "",
  target: "",
  lvName: "",
  filesystem: FILESYSTEM_TYPE.AUTO,
  filesystemAction: FILESYSTEM_ACTION.REUSE,
  filesystemLabel: "",
  mkfsExtraArguments: "",
  mountOptions: [],
  showMoreFilesystemSettings: false,
  sizeMode: SIZE_MODE.AUTO,
  fixedSize: "",
  rangeMinSize: "",
  rangeMaxSize: "",
  expandMinSize: "",
};

export const defaultOptions = formOptions({ defaultValues });
