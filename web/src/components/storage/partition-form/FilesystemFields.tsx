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

import React, { useEffect, useMemo } from "react";
import { unique, isEmpty } from "radashi";
import { withForm } from "~/hooks/form";
import FilesystemSelector from "~/components/storage/shared/FilesystemSelector";
import { buildFilesystemOptions } from "~/components/storage/shared/helpers";
import { defaultOptions, isReusingPartition, FILESYSTEM_TYPE, FILESYSTEM_ACTION } from "./fields";
import { useVolumeTemplate } from "~/hooks/model/system/storage";
import { _ } from "~/i18n";

import type { Storage as System } from "~/model/system";
import type { ConfigModel } from "~/model/storage/config-model";

type FilesystemFieldsProps = {
  device: System.Device;
};

type FilesystemFieldsContentProps = {
  device: System.Device;
  name: string;
  committedMountPoint: string;
  filesystem: string;
};

/**
 * Inner component that renders filesystem fields and handles auto-reset logic.
 *
 * ## Committed mount point pattern
 *
 * This component uses `committedMountPoint` (not live `mountPoint`) for calculating
 * filesystem options and hints. This prevents showing misleading information while
 * the user types incomplete values like "/ho" before finishing "/home".
 *
 * The `committedMountPoint` updates:
 * - When user selects a suggestion (immediate)
 * - When user blurs the field (deferred)
 * - On form mount (initial value)
 *
 * See fields.ts `committedMountPoint` documentation for full pattern details.
 *
 * ## Auto-reset behavior
 *
 * When the user changes the mount point AFTER having already picked a specific
 * filesystem type, the new mount point may not support that type (e.g. swap
 * does not support XFS). In that case this component resets the selector to
 * FILESYSTEM_TYPE.AUTO ("Default") so a compatible filesystem can be chosen
 * automatically.
 *
 * he reset happens via `useEffect` watching `usableFilesystems`, which
 * recalculates when `committedMountPoint` changes. This ensures compatibility
 * is maintained without reacting to incomplete mount point input while the user
 * is typing.
 *
 * NOTE: This is a UX convenience, not validation. Validations lives in fields.ts
 */
const FilesystemFieldsContent = withForm({
  ...defaultOptions,
  props: {
    device: {} as System.Device,
    name: "",
    committedMountPoint: "",
    filesystem: "",
  } as FilesystemFieldsContentProps,
  render: function Render({ form, device, name, committedMountPoint, filesystem }) {
    // Use committedMountPoint (not live mountPoint) to avoid reacting to incomplete input.
    // This prevents showing misleading filesystem options while user types "/ho..." and
    // avoids expensive useVolumeTemplate recalculations on every keystroke.
    const volume = useVolumeTemplate(committedMountPoint);
    const defaultFilesystem = volume.fsType;
    const isFallbackVolume = isEmpty(volume.mountPath);

    const isReuse = isReusingPartition(name);
    const selectedPartition = device.partitions?.find((p) => p.name === name);
    const currentFsType = selectedPartition?.filesystem?.type;
    const hasFilesystem = !!currentFsType;

    // Memoized because it's used as a useEffect dependency below. Without memoization,
    // the effect would re-run on every render (new array reference each time).
    const usableFilesystems = useMemo(() => {
      const volumeFilesystems = volume.outline.fsTypes || [];
      return unique([defaultFilesystem, ...volumeFilesystems]);
    }, [volume, defaultFilesystem]);

    // Check if the current filesystem is compatible with the mount point.
    // If not, we must format - can't keep an incompatible filesystem.
    const canKeepCurrentFilesystem =
      hasFilesystem && usableFilesystems.includes(currentFsType as ConfigModel.FilesystemType);

    const filesystemOptions = useMemo(
      () => buildFilesystemOptions(usableFilesystems, { device, canKeepCurrentFilesystem }),
      [usableFilesystems, canKeepCurrentFilesystem, device],
    );

    // Auto-reset filesystem to Default when it becomes incompatible with the mount point.
    // Example: user selects XFS, then changes mount point to "swap" (which only supports swap fs).
    // Also resets REUSE when selecting a partition that cannot keep its current filesystem.
    useEffect(() => {
      if (filesystem === FILESYSTEM_TYPE.AUTO) return;
      if (filesystem === FILESYSTEM_ACTION.REUSE && canKeepCurrentFilesystem) return;
      if (usableFilesystems.includes(filesystem as ConfigModel.FilesystemType)) return;

      form.setFieldValue("filesystem", FILESYSTEM_TYPE.AUTO);
    }, [usableFilesystems, filesystem, form, canKeepCurrentFilesystem]);

    return (
      <>
        <FilesystemSelector
          form={form}
          defaultFilesystem={defaultFilesystem}
          committedMountPoint={committedMountPoint}
          filesystemOptions={filesystemOptions}
          usableFilesystems={usableFilesystems}
          selectedDevice={isReuse && canKeepCurrentFilesystem ? selectedPartition : undefined}
          isFallback={isFallbackVolume}
        />

        <form.AppField name="showMoreFilesystemSettings">
          {(field) => (
            <field.CheckboxField
              label={
                // TRANSLATORS: checkbox label for additional filesystem configuration options
                _("Define more file system settings")
              }
            />
          )}
        </form.AppField>
      </>
    );
  },
});

/**
 * Filesystem selection and label fields.
 *
 * Shows different UI based on partition source:
 * - New partition: dropdown including an "Automatic" option at the top
 * - Use existing partition: radios for "Keep current" vs "Format" + conditional dropdown
 *
 * Also includes a filesystem label field when formatting.
 */
const FilesystemFields = withForm({
  ...defaultOptions,
  props: {
    device: {} as System.Device,
  } as FilesystemFieldsProps,
  render: function Render({ form, device }) {
    return (
      <form.Subscribe
        selector={(s) => ({
          name: s.values.name,
          committedMountPoint: s.values.committedMountPoint,
          filesystem: s.values.filesystem,
        })}
      >
        {({ name, committedMountPoint, filesystem }) => (
          <FilesystemFieldsContent
            form={form}
            device={device}
            name={name}
            committedMountPoint={committedMountPoint}
            filesystem={filesystem}
          />
        )}
      </form.Subscribe>
    );
  },
});

export default FilesystemFields;
