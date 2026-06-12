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
import FilesystemSelector from "./FilesystemSelector";
import { buildFilesystemOptions } from "./helpers";
import { sharedDefaultOptions, FILESYSTEM_TYPE, FILESYSTEM_ACTION } from "./fields";
import { useVolumeTemplate } from "~/hooks/model/system/storage";
import { _ } from "~/i18n";

import type { Storage as System } from "~/model/system";
import type { ConfigModel } from "~/model/storage/config-model";

type FilesystemFieldsProps = {
  /**
   * The existing device being reused, or undefined when creating a new one.
   * The caller resolves it from its own collection (a drive's partitions, a
   * volume group's logical volumes).
   */
  reusedDevice?: System.Device;
};

type FilesystemFieldsContentProps = FilesystemFieldsProps & {
  committedMountPoint: string;
  filesystem: string;
  filesystemAction: string;
};

/**
 * Inner component that renders the filesystem fields and handles auto-reset.
 *
 * ## Committed mount point pattern
 *
 * Uses `committedMountPoint` (not the live `mountPoint`) to derive filesystem
 * options and hints, avoiding misleading information while the user types an
 * incomplete value. See shared/MountPointField.tsx for the full pattern.
 *
 * ## Auto-reset behavior
 *
 * When the mount point changes to one that no longer supports the selected
 * filesystem type, the selector resets to "Default" so a compatible filesystem
 * can be chosen automatically. This is a UX convenience, not validation.
 *
 * The reset is reversible for the "Current" option: the reuse-vs-format
 * intent survives in the filesystemAction field, which only the user's own
 * selections update (see FilesystemSelector). When a later mount point change
 * makes keeping the current filesystem possible again, the selector restores
 * "Current" instead of silently formatting; a deliberate format choice is
 * never overridden.
 */
const FilesystemFieldsContent = withForm({
  ...sharedDefaultOptions,
  props: {
    committedMountPoint: "",
    filesystem: "",
    filesystemAction: "",
  } as FilesystemFieldsContentProps,
  render: function Render({
    form,
    reusedDevice,
    committedMountPoint,
    filesystem,
    filesystemAction,
  }) {
    const volume = useVolumeTemplate(committedMountPoint);
    const defaultFilesystem = volume.fsType;
    const isFallbackVolume = isEmpty(volume.mountPath);

    const currentFsType = reusedDevice?.filesystem?.type;
    const hasFilesystem = !!currentFsType;

    // Memoized because it's used as a useEffect dependency below.
    const usableFilesystems = useMemo(() => {
      const volumeFilesystems = volume.outline.fsTypes || [];
      return unique([defaultFilesystem, ...volumeFilesystems]);
    }, [volume, defaultFilesystem]);

    // The current filesystem can only be kept when it is compatible with the mount point.
    const canKeepCurrentFilesystem =
      hasFilesystem && usableFilesystems.includes(currentFsType as ConfigModel.FilesystemType);

    const filesystemOptions = useMemo(
      () =>
        buildFilesystemOptions(usableFilesystems, {
          device: reusedDevice,
          canKeepCurrentFilesystem,
        }),
      [usableFilesystems, canKeepCurrentFilesystem, reusedDevice],
    );

    // Keep the filesystem selection in sync with what the mount point allows.
    useEffect(() => {
      // Restore "Current" when keeping the filesystem becomes possible again
      // and the user did not deliberately choose to format.
      if (
        filesystem === FILESYSTEM_TYPE.AUTO &&
        canKeepCurrentFilesystem &&
        filesystemAction === FILESYSTEM_ACTION.REUSE
      ) {
        form.setFieldValue("filesystem", FILESYSTEM_ACTION.REUSE);
        return;
      }

      if (filesystem === FILESYSTEM_TYPE.AUTO) return;
      if (filesystem === FILESYSTEM_ACTION.REUSE && canKeepCurrentFilesystem) return;
      if (usableFilesystems.includes(filesystem as ConfigModel.FilesystemType)) return;

      // Reset to "Default" without running the field listeners, so the
      // reuse-vs-format intent in filesystemAction survives the downgrade.
      form.setFieldValue("filesystem", FILESYSTEM_TYPE.AUTO, { dontRunListeners: true });
    }, [usableFilesystems, filesystem, filesystemAction, form, canKeepCurrentFilesystem]);

    return (
      <>
        <FilesystemSelector
          form={form}
          defaultFilesystem={defaultFilesystem}
          committedMountPoint={committedMountPoint}
          filesystemOptions={filesystemOptions}
          usableFilesystems={usableFilesystems}
          selectedDevice={reusedDevice}
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
 * Filesystem selection fields shared across the storage forms.
 *
 * Shows different UI based on the device source:
 * - New device: dropdown including a "Default" (automatic) option at the top
 * - Reused device with a filesystem: a "Current" (keep data) option is offered
 *   when it is compatible with the mount point
 *
 * The caller only resolves which existing device is being reused, since that
 * lives in form-specific fields and collections; everything else (volume
 * template lookup, compatible filesystems, auto-reset) is handled here.
 *
 * @example
 * <FilesystemFields
 *   form={form}
 *   reusedDevice={device.partitions?.find((p) => p.name === name)}
 * />
 */
const FilesystemFields = withForm({
  ...sharedDefaultOptions,
  props: {
    reusedDevice: undefined,
  } as FilesystemFieldsProps,
  render: function Render({ form, reusedDevice }) {
    return (
      <form.Subscribe
        selector={(s) => ({
          committedMountPoint: s.values.committedMountPoint,
          filesystem: s.values.filesystem,
          filesystemAction: s.values.filesystemAction,
        })}
      >
        {({ committedMountPoint, filesystem, filesystemAction }) => (
          <FilesystemFieldsContent
            form={form}
            reusedDevice={reusedDevice}
            committedMountPoint={committedMountPoint}
            filesystem={filesystem}
            filesystemAction={filesystemAction}
          />
        )}
      </form.Subscribe>
    );
  },
});

export default FilesystemFields;
