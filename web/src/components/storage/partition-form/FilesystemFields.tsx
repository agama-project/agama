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
import { HelperText, HelperTextItem } from "@patternfly/react-core";
import { unique } from "radashi";
import { sprintf } from "sprintf-js";
import Text from "~/components/core/Text";
import FieldNestedContent from "~/components/form/FieldNestedContent";
import { withForm } from "~/hooks/form";
import { defaultOptions, isReusingPartition, FILESYSTEM_TYPE, FILESYSTEM_ACTION } from "./fields";
import { useVolumeTemplate } from "~/hooks/model/system/storage";
import { deviceLabel, filesystemLabel } from "~/components/storage/utils";
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

type AutoFilesystemHintProps = {
  filesystem: string;
  defaultFilesystem: ConfigModel.FilesystemType | undefined;
  committedMountPoint: string;
};

/**
 * Inline hint shown when "Automatic" is selected, describing which filesystem
 * will be applied for the current mount point.
 *
 * Renders nothing when automatic is not selected, no default is known, or no
 * mount point has been entered yet.
 */
function AutoFilesystemHint({
  filesystem,
  defaultFilesystem,
  committedMountPoint,
}: AutoFilesystemHintProps) {
  if (filesystem !== FILESYSTEM_TYPE.AUTO || !defaultFilesystem || !committedMountPoint)
    return null;

  return (
    <Text textStyle={["fontSizeSm", "textColorSubtle"]}>
      {sprintf(
        // TRANSLATORS: %1$s is filesystem type (e.g., "XFS"), %2$s is mount point (e.g., "/home")
        _("%1$s will be used for %2$s."),
        filesystemLabel(defaultFilesystem),
        committedMountPoint,
      )}
    </Text>
  );
}

type FilesystemSelectorProps = {
  form;
  defaultFilesystem: ConfigModel.FilesystemType | undefined;
  committedMountPoint: string;
  filesystemOptions: Array<
    { value: string; label: React.ReactNode; description?: React.ReactNode } | { divider: true }
  >;
  usableFilesystems: ConfigModel.FilesystemType[];
  selectedPartition?: System.Device;
};

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
 * When reusing a partition and the user selects a format option, shows a warning
 * that existing data will be destroyed.
 */
function FilesystemSelector({
  form,
  defaultFilesystem,
  committedMountPoint,
  filesystemOptions,
  usableFilesystems,
  selectedPartition,
}: FilesystemSelectorProps) {
  const isSingleType = usableFilesystems.length === 1;

  if (isSingleType && defaultFilesystem) {
    return (
      <form.AppField name="filesystem">
        {(field) => (
          <field.ReadOnlyField label={_("File system")} text={filesystemLabel(defaultFilesystem)} />
        )}
      </form.AppField>
    );
  }

  return (
    <form.AppField name="filesystem">
      {(field) => (
        <field.DropdownField label={_("File system")} options={filesystemOptions}>
          {(value) => (
            <FieldNestedContent>
              {value === FILESYSTEM_TYPE.AUTO && (
                <AutoFilesystemHint
                  filesystem={value}
                  defaultFilesystem={defaultFilesystem}
                  committedMountPoint={committedMountPoint}
                />
              )}
              {selectedPartition && value !== FILESYSTEM_ACTION.REUSE && (
                <HelperText>
                  <HelperTextItem variant="warning">
                    {sprintf(
                      // TRANSLATORS: %s is partition name like "/dev/vdd2"
                      _("Existing data on %s will be destroyed."),
                      deviceLabel(selectedPartition),
                    )}
                  </HelperTextItem>
                </HelperText>
              )}
            </FieldNestedContent>
          )}
        </field.DropdownField>
      )}
    </form.AppField>
  );
}

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

    const isReuse = isReusingPartition(name);
    const selectedPartition = device.partitions?.find((p) => p.name === name);
    const currentFsType = selectedPartition?.filesystem?.type;
    const hasFilesystem = !!currentFsType;

    const usableFilesystems = React.useMemo(() => {
      const volumeFilesystems = volume.outline.fsTypes || [];
      return unique([defaultFilesystem, ...volumeFilesystems]);
    }, [volume, defaultFilesystem]);

    // Check if the current filesystem is compatible with the mount point.
    // If not, we must format - can't keep an incompatible filesystem.
    const canKeepCurrentFilesystem =
      hasFilesystem && usableFilesystems.includes(currentFsType as ConfigModel.FilesystemType);

    const filesystemOptions: Array<
      { value: string; label: React.ReactNode; description?: React.ReactNode } | { divider: true }
    > = React.useMemo(() => {
      const formatOptions = [
        { value: FILESYSTEM_TYPE.AUTO, label: _("Default") },
        ...usableFilesystems.map((fs) => ({ value: fs, label: filesystemLabel(fs) })),
      ];

      // When reusing a partition with a compatible filesystem, add "Keep current" option
      if (canKeepCurrentFilesystem && currentFsType) {
        return [
          {
            value: FILESYSTEM_ACTION.REUSE,
            label: sprintf(
              // TRANSLATORS: %s is filesystem type like "Btrfs"
              _("Current (%s)"),
              filesystemLabel(currentFsType),
            ),
            description: sprintf(
              // TRANSLATORS: %s is device name like "/dev/vdd2"
              _("Do not format %s and keep data"),
              deviceLabel(device),
            ),
          },
          { divider: true },
          ...formatOptions,
        ];
      }

      return formatOptions;
    }, [usableFilesystems, canKeepCurrentFilesystem, currentFsType, device]);

    // When user selects a different partition, initialize filesystem field appropriately
    const previousNameRef = React.useRef(name);
    React.useEffect(() => {
      // Only run when partition selection actually changes
      if (previousNameRef.current === name) return;
      previousNameRef.current = name;

      if (!isReuse) {
        // Switched to new partition - reset to AUTO
        form.setFieldValue("filesystem", FILESYSTEM_TYPE.AUTO);
      } else if (canKeepCurrentFilesystem) {
        // Switched to existing partition with compatible filesystem - default to REUSE
        form.setFieldValue("filesystem", FILESYSTEM_ACTION.REUSE);
      } else {
        // Switched to existing partition without/incompatible filesystem - set to AUTO
        form.setFieldValue("filesystem", FILESYSTEM_TYPE.AUTO);
      }
    }, [name, isReuse, canKeepCurrentFilesystem, form]);

    // Check filesystem compatibility when usable filesystems change
    React.useEffect(() => {
      if (filesystem === FILESYSTEM_TYPE.AUTO) return;
      if (filesystem === FILESYSTEM_ACTION.REUSE) return;
      if (usableFilesystems.includes(filesystem as ConfigModel.FilesystemType)) return;

      // Current filesystem is not compatible with the mount point.
      // Reset to AUTO (Default)
      form.setFieldValue("filesystem", FILESYSTEM_TYPE.AUTO);
    }, [usableFilesystems, filesystem, form]);

    const showAdditionalSettings =
      filesystem !== FILESYSTEM_TYPE.AUTO && filesystem !== FILESYSTEM_ACTION.REUSE;

    return (
      <>
        <FilesystemSelector
          form={form}
          defaultFilesystem={defaultFilesystem}
          committedMountPoint={committedMountPoint}
          filesystemOptions={filesystemOptions}
          usableFilesystems={usableFilesystems}
          selectedPartition={isReuse && canKeepCurrentFilesystem ? selectedPartition : undefined}
        />

        {showAdditionalSettings && (
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
        )}
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
