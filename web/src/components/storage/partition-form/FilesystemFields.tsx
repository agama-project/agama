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
import { unique } from "radashi";
import { sprintf } from "sprintf-js";
import { Stack } from "@patternfly/react-core";
import NestedContent from "~/components/core/NestedContent";
import Text from "~/components/core/Text";
import { withForm } from "~/hooks/form";
import { defaultOptions, isReusingPartition, FILESYSTEM_TYPE, FILESYSTEM_ACTION } from "./fields";
import { useVolumeTemplate } from "~/hooks/model/system/storage";
import { filesystemLabel } from "~/components/storage/utils";
import { _ } from "~/i18n";

import type { Storage as System } from "~/model/system";
import type { ConfigModel } from "~/model/storage/config-model";
import LabelText from "~/components/form/LabelText";

type FilesystemFieldsProps = {
  device: System.Device;
};

type FilesystemFieldsContentProps = {
  device: System.Device;
  name: string;
  committedMountPoint: string;
  filesystemAction: string;
  filesystem: string;
};

type AutoFilesystemHintProps = {
  filesystem: string;
  defaultFilesystem: ConfigModel.FilesystemType | undefined;
  committedMountPoint: string;
};

/**
 * Returns an informative message for when a partition must be formatted.
 *
 * Used when reusing a partition that either:
 * - Has no filesystem
 * - Has an incompatible filesystem for the selected mount point
 *
 * The message varies based on:
 * - Whether partition currently has a filesystem
 * - Whether only one filesystem type is allowed for the mount point
 */
function getFormatRequiredMessage(
  hasFilesystem: boolean,
  currentFsType: ConfigModel.FilesystemType | undefined,
  isSingleType: boolean,
  defaultFilesystem: ConfigModel.FilesystemType | undefined,
): string {
  if (hasFilesystem && currentFsType) {
    // Partition has incompatible filesystem
    if (isSingleType && defaultFilesystem) {
      return sprintf(
        // TRANSLATORS: %1$s is current filesystem type like "ext4", %2$s is required type like "swap"
        _("Current file system (%1$s) is not compatible. Partition will be formatted with %2$s."),
        filesystemLabel(currentFsType),
        filesystemLabel(defaultFilesystem),
      );
    }
    return sprintf(
      // TRANSLATORS: %s is current filesystem type like "ext4"
      _(
        "Current file system (%s) is not compatible. Partition will be formatted with the selected type.",
      ),
      filesystemLabel(currentFsType),
    );
  }

  // Partition has no filesystem
  if (isSingleType && defaultFilesystem) {
    return sprintf(
      // TRANSLATORS: %s is filesystem type like "swap"
      _("Partition is not formatted. It will be formatted with %s."),
      filesystemLabel(defaultFilesystem),
    );
  }
  return _("Partition is not formatted. It will be formatted with the selected file system type.");
}

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
    <NestedContent margin="mxLg">
      <Text textStyle={["fontSizeSm", "textColorSubtle"]}>
        {sprintf(
          // TRANSLATORS: %1$s is filesystem type (e.g., "XFS"), %2$s is mount point (e.g., "/home")
          _("%1$s will be used for %2$s."),
          filesystemLabel(defaultFilesystem),
          committedMountPoint,
        )}
      </Text>
    </NestedContent>
  );
}

/**
 * Additional filesystem configuration fields shown when formatting.
 *
 * Currently includes:
 * - Label (optional text field)
 *
 * Will be extended with more settings in the future.
 */
function FilesystemAdditionalFields({ form }) {
  return (
    <form.AppField name="filesystemLabel">
      {(field) => (
        <field.TextField
          label={<LabelText suffix={_("(optional)")}>{_("Label")}</LabelText>}
          helperText={_("Optional label for the filesystem")}
        />
      )}
    </form.AppField>
  );
}

/**
 * Filesystem type selector: dropdown or ReadOnlyField depending on available options.
 *
 * When "Default" is selected, an inline hint explains which filesystem will be
 * used for the current mount point.
 *
 * When only one concrete filesystem type is available (excluding the "Default"
 * option), shows a ReadOnlyField with the type name instead of a dropdown. This
 * applies to mount points like swap and /boot/efi that constrain the filesystem
 * to a single type.
 *
 * When a concrete filesystem is selected for formatting, shows a checkbox to
 * reveal additional filesystem settings (label, etc.) and renders those fields
 * when checked.
 */
function FilesystemTypeSelector({
  form,
  filesystem,
  filesystemAction,
  defaultFilesystem,
  committedMountPoint,
  filesystemOptions,
  usableFilesystems,
}) {
  const isSingleType = usableFilesystems.length === 1;
  const showAdditionalSettings =
    filesystem !== FILESYSTEM_TYPE.AUTO && filesystemAction === FILESYSTEM_ACTION.FORMAT;

  return (
    <>
      {isSingleType && defaultFilesystem ? (
        <form.AppField name="filesystem">
          {(field) => (
            <field.ReadOnlyField
              label={_("File system type")}
              text={filesystemLabel(defaultFilesystem)}
            />
          )}
        </form.AppField>
      ) : (
        <>
          <form.AppField name="filesystem">
            {(field) => (
              <field.DropdownField label={_("File system type")} options={filesystemOptions} />
            )}
          </form.AppField>
          <AutoFilesystemHint
            filesystem={filesystem}
            defaultFilesystem={defaultFilesystem}
            committedMountPoint={committedMountPoint}
          />
        </>
      )}

      {showAdditionalSettings && (
        <>
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
          <form.Subscribe selector={(s) => s.values.showMoreFilesystemSettings}>
            {(showMore) =>
              showMore && (
                <NestedContent margin="mxLg">
                  <FilesystemAdditionalFields form={form} />
                </NestedContent>
              )
            }
          </form.Subscribe>
        </>
      )}
    </>
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
    filesystemAction: "",
    filesystem: "",
  } as FilesystemFieldsContentProps,
  render: function Render({
    form,
    device,
    name,
    committedMountPoint,
    filesystemAction,
    filesystem,
  }) {
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

    const filesystemOptions = React.useMemo(
      () => [
        { value: FILESYSTEM_TYPE.AUTO, label: _("Default") },
        ...usableFilesystems.map((fs) => ({ value: fs, label: filesystemLabel(fs) })),
      ],
      [usableFilesystems],
    );

    // Check filesystem compatibility when usable filesystems change
    React.useEffect(() => {
      if (filesystem === FILESYSTEM_TYPE.AUTO) return;
      if (usableFilesystems.includes(filesystem as ConfigModel.FilesystemType)) return;

      // Current filesystem is not compatible with the mount point.
      // Reset to AUTO (Default)
      form.setFieldValue("filesystem", FILESYSTEM_TYPE.AUTO);
    }, [usableFilesystems, filesystem, form]);

    return (
      <>
        {!isReuse && (
          <FilesystemTypeSelector
            form={form}
            filesystem={filesystem}
            filesystemAction={filesystemAction}
            defaultFilesystem={defaultFilesystem}
            committedMountPoint={committedMountPoint}
            filesystemOptions={filesystemOptions}
            usableFilesystems={usableFilesystems}
          />
        )}

        {isReuse && !canKeepCurrentFilesystem && (
          <>
            <form.AppField name="filesystemAction">
              {(field) => {
                const isSingleType = usableFilesystems.length === 1;
                const message = getFormatRequiredMessage(
                  hasFilesystem,
                  currentFsType,
                  isSingleType,
                  defaultFilesystem,
                );

                return <field.ReadOnlyField label={_("File system")} text={message} />;
              }}
            </form.AppField>
            <FilesystemTypeSelector
              form={form}
              filesystem={filesystem}
              filesystemAction={filesystemAction}
              defaultFilesystem={defaultFilesystem}
              committedMountPoint={committedMountPoint}
              filesystemOptions={filesystemOptions}
              usableFilesystems={usableFilesystems}
            />
          </>
        )}

        {isReuse && canKeepCurrentFilesystem && (
          <form.AppField name="filesystemAction">
            {(field) => (
              <field.RadioGroupField
                label={_("File system")}
                options={[
                  {
                    value: FILESYSTEM_ACTION.REUSE,
                    label: sprintf(
                      // TRANSLATORS: %s is filesystem type like "Btrfs"
                      _("Keep current (%s)"),
                      filesystemLabel(currentFsType),
                    ),
                    description: _("Do not format, existing data will be preserved"),
                  },
                  {
                    value: FILESYSTEM_ACTION.FORMAT,
                    label: _("Format"),
                    description: _("Choose a new file system, existing data will be destroyed"),
                  },
                ]}
              >
                {(action) => {
                  if (action !== FILESYSTEM_ACTION.FORMAT) return null;
                  return (
                    <NestedContent margin="mxLg">
                      <Stack hasGutter>
                        <FilesystemTypeSelector
                          form={form}
                          filesystem={filesystem}
                          filesystemAction={filesystemAction}
                          defaultFilesystem={defaultFilesystem}
                          committedMountPoint={committedMountPoint}
                          filesystemOptions={filesystemOptions}
                          usableFilesystems={usableFilesystems}
                        />
                      </Stack>
                    </NestedContent>
                  );
                }}
              </field.RadioGroupField>
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
          filesystemAction: s.values.filesystemAction,
          filesystem: s.values.filesystem,
        })}
      >
        {({ name, committedMountPoint, filesystemAction, filesystem }) => (
          <FilesystemFieldsContent
            form={form}
            device={device}
            name={name}
            committedMountPoint={committedMountPoint}
            filesystemAction={filesystemAction}
            filesystem={filesystem}
          />
        )}
      </form.Subscribe>
    );
  },
});

export default FilesystemFields;
