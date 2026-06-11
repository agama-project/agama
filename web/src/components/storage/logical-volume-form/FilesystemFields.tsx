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
import {
  defaultOptions,
  isReusingLogicalVolume,
  FILESYSTEM_TYPE,
  FILESYSTEM_ACTION,
} from "./fields";
import { useVolumeTemplate } from "~/hooks/model/system/storage";
import { _ } from "~/i18n";

import type { Storage as System } from "~/model/system";
import type { ConfigModel } from "~/model/storage/config-model";

type FilesystemFieldsProps = {
  volumeGroup?: System.Device;
};

type FilesystemFieldsContentProps = {
  volumeGroup?: System.Device;
  target: string;
  committedMountPoint: string;
  filesystem: string;
};

/**
 * Inner component that renders the filesystem fields and handles auto-reset.
 *
 * Mirrors the partition form behavior, resolving the reused device from the
 * volume group's logical volumes instead of a drive's partitions.
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
 */
const FilesystemFieldsContent = withForm({
  ...defaultOptions,
  props: {
    target: "",
    committedMountPoint: "",
    filesystem: "",
  } as FilesystemFieldsContentProps,
  render: function Render({ form, volumeGroup, target, committedMountPoint, filesystem }) {
    const volume = useVolumeTemplate(committedMountPoint);
    const defaultFilesystem = volume.fsType;
    const isFallbackVolume = isEmpty(volume.mountPath);

    const isReuse = isReusingLogicalVolume(target);
    const selectedLogicalVolume = volumeGroup?.logicalVolumes?.find((lv) => lv.name === target);
    const currentFsType = selectedLogicalVolume?.filesystem?.type;
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
          device: selectedLogicalVolume,
          canKeepCurrentFilesystem,
        }),
      [usableFilesystems, canKeepCurrentFilesystem, selectedLogicalVolume],
    );

    // Auto-reset filesystem to Default when it becomes incompatible with the mount point.
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
          selectedDevice={isReuse && hasFilesystem ? selectedLogicalVolume : undefined}
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
 * Filesystem selection and label fields for the logical volume form.
 *
 * Thin wrapper that subscribes to the fields the inner content needs and
 * delegates to the shared FilesystemSelector.
 */
const FilesystemFields = withForm({
  ...defaultOptions,
  props: {
    volumeGroup: undefined,
  } as FilesystemFieldsProps,
  render: function Render({ form, volumeGroup }) {
    return (
      <form.Subscribe
        selector={(s) => ({
          target: s.values.target,
          committedMountPoint: s.values.committedMountPoint,
          filesystem: s.values.filesystem,
        })}
      >
        {({ target, committedMountPoint, filesystem }) => (
          <FilesystemFieldsContent
            form={form}
            volumeGroup={volumeGroup}
            target={target}
            committedMountPoint={committedMountPoint}
            filesystem={filesystem}
          />
        )}
      </form.Subscribe>
    );
  },
});

export default FilesystemFields;
