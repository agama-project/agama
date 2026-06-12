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
import { sprintf } from "sprintf-js";
import { HelperText, HelperTextItem } from "@patternfly/react-core";
import Text from "~/components/core/Text";
import FieldNestedContent from "~/components/form/FieldNestedContent";
import { FILESYSTEM_TYPE, FILESYSTEM_ACTION } from "./fields";
import { deviceLabel, filesystemLabel, formattedPath } from "~/components/storage/utils";
import { _ } from "~/i18n";

import type { Storage as System } from "~/model/system";
import type { ConfigModel } from "~/model/storage/config-model";

type FilesystemSelectorProps = {
  form;
  /** Default filesystem the installer would pick for the current mount point. */
  defaultFilesystem: ConfigModel.FilesystemType | undefined;
  /** Stable mount point used to derive hints (see MountPointField). */
  committedMountPoint: string;
  /** Dropdown options (built by the caller). */
  filesystemOptions: Array<
    { value: string; label: React.ReactNode; description?: React.ReactNode } | { divider: true }
  >;
  /** Filesystem types compatible with the current mount point. */
  usableFilesystems: ConfigModel.FilesystemType[];
  /**
   * Existing device being reused, when it holds a filesystem. Drives the
   * keep-data hint and the data-loss notice.
   */
  selectedDevice?: System.Device;
  /** Whether the default filesystem comes from the generic fallback volume. */
  isFallback: boolean;
};

function keepFsText(filesystem) {
  // TRANSLATORS: %s is a filesystem (eg. XFS)
  return sprintf(_("%s (keep data)"), filesystemLabel(filesystem));
}

function destroyDataNotice(device: System.Device) {
  return (
    <HelperText>
      <HelperTextItem variant="warning">
        {sprintf(
          // TRANSLATORS: %s is a device name like "/dev/vdd2"
          _("Any existing data on %s will be destroyed when installation begins."),
          deviceLabel(device),
        )}
      </HelperTextItem>
    </HelperText>
  );
}

function defaultFsText(filesystem, mountPoint, isFallback) {
  if (isFallback) {
    return sprintf(
      // TRANSLATORS: %s is a filesystem type (eg. XFS)
      _("%s (default file system for generic mount points)"),
      filesystemLabel(filesystem),
    );
  }

  return sprintf(
    // TRANSLATORS: %1$s is a filesystem (eg. XFS), %2$s is a mount point (eg. "/home")
    _("%1$s (default file system for %2$s)"),
    filesystemLabel(filesystem),
    formattedPath(mountPoint),
  );
}

/**
 * Filesystem selector: dropdown or ReadOnlyField depending on available options.
 *
 * When "Default" is selected, an inline hint explains which filesystem will be
 * used for the current mount point.
 *
 * When only one concrete filesystem type is available (excluding the "Default"
 * option), shows a ReadOnlyField with the type name instead of a dropdown. This
 * applies to mount points like swap and /boot/efi that constrain the filesystem
 * to a single type.
 *
 * When reusing a device with a filesystem that will not be kept, shows a
 * notice that existing data will be destroyed. This applies to both the
 * dropdown and the read-only variants: a mount point that constrains the
 * filesystem to a single type (e.g. swap) still formats the reused device.
 *
 * Every change to the filesystem field records the reuse-vs-format intent in
 * the filesystemAction field. The caller can rely on that intent to restore
 * "Current" when a mount point change makes keeping the filesystem possible
 * again (see the auto-reset logic in the forms' FilesystemFields).
 *
 * Presentation only: it has no validation logic and receives its options
 * already built by the caller.
 */
export default function FilesystemSelector({
  form,
  defaultFilesystem,
  committedMountPoint,
  filesystemOptions,
  usableFilesystems,
  selectedDevice,
  isFallback,
}: FilesystemSelectorProps) {
  const isSingleType = usableFilesystems.length === 1;

  // Records the reuse-vs-format intent behind the current filesystem value.
  const filesystemListeners = {
    onChange: ({ value }: { value: string }) => {
      form.setFieldValue(
        "filesystemAction",
        value === FILESYSTEM_ACTION.REUSE ? FILESYSTEM_ACTION.REUSE : FILESYSTEM_ACTION.FORMAT,
      );
    },
  };

  if (isSingleType && defaultFilesystem) {
    return (
      <form.AppField name="filesystem" listeners={filesystemListeners}>
        {(field) => {
          const currentFsType = selectedDevice?.filesystem?.type;
          const isKeeping = field.state.value === FILESYSTEM_ACTION.REUSE && !!currentFsType;
          const showNotice = selectedDevice && !isKeeping;

          return (
            <field.ReadOnlyField label={_("File system")} text={filesystemLabel(defaultFilesystem)}>
              {showNotice && (
                <FieldNestedContent margin="mlMd">
                  {destroyDataNotice(selectedDevice)}
                </FieldNestedContent>
              )}
            </field.ReadOnlyField>
          );
        }}
      </form.AppField>
    );
  }

  return (
    <form.AppField name="filesystem" listeners={filesystemListeners}>
      {(field) => (
        <field.DropdownField label={_("File system")} options={filesystemOptions}>
          {(value) => {
            const currentFsType = selectedDevice?.filesystem?.type;
            const isKeeping = value === FILESYSTEM_ACTION.REUSE && currentFsType;
            const isAuto =
              value === FILESYSTEM_TYPE.AUTO && !!defaultFilesystem && !!committedMountPoint;
            const showHint = isKeeping || isAuto;
            const showNotice = selectedDevice && !isKeeping;

            if (!showHint && !showNotice) return null;

            const fsText = isKeeping
              ? keepFsText(currentFsType)
              : defaultFsText(defaultFilesystem, committedMountPoint, isFallback);

            return (
              <FieldNestedContent>
                {showHint && (
                  <Text isBold textStyle="textColorSubtle">
                    {fsText}
                  </Text>
                )}
                {showNotice && destroyDataNotice(selectedDevice)}
              </FieldNestedContent>
            );
          }}
        </field.DropdownField>
      )}
    </form.AppField>
  );
}
