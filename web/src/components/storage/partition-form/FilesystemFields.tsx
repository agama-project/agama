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
import { Alert, AlertActionCloseButton, Stack } from "@patternfly/react-core";
import NestedContent from "~/components/core/NestedContent";
import Text from "~/components/core/Text";
import { withForm } from "~/hooks/form";
import { defaultOptions, isReusingPartition, FILESYSTEM_TYPE, FILESYSTEM_ACTION } from "./fields";
import { useVolumeTemplate } from "~/hooks/model/system/storage";
import { filesystemLabel } from "~/components/storage/utils";
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
  filesystemAction: string;
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
 * Filesystem type selector: dropdown or ReadOnlyField depending on available options.
 *
 * When only one concrete filesystem type is available (excluding the "Default"
 * option), shows a ReadOnlyField with the type name instead of a dropdown.
 * This applies to mount points like swap and /boot/efi that constrain the
 * filesystem to a single type.
 */
function FilesystemTypeSelector({
  form,
  filesystem,
  defaultFilesystem,
  committedMountPoint,
  filesystemOptions,
  usableFilesystems,
}) {
  // Check if there's only one concrete type available (excluding "Default")
  const isSingleType = usableFilesystems.length === 1;

  if (isSingleType && defaultFilesystem) {
    // Single type available: show ReadOnlyField with the type name
    return (
      <form.AppField name="filesystem">
        {(field) => (
          <field.ReadOnlyField
            label={_("File system type")}
            text={filesystemLabel(defaultFilesystem)}
          />
        )}
      </form.AppField>
    );
  }

  // Multiple types available: show dropdown with Default option
  return (
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
 * does not support XFS). In that case this component:
 *
 *   1. Resets the `filesystem` field to FILESYSTEM_TYPE.AUTO ("auto").
 *   2. Shows a dismissible informational alert explaining the reset, naming
 *      the filesystem type that was dropped (e.g. "XFS").
 *
 * The reset happens via `useEffect` watching `usableFilesystems`, which recalculates
 * when `committedMountPoint` changes. This ensures the user is not interrupted with
 * alerts or dropdown changes while typing incomplete mount points.
 *
 * NOTE: This is a UX convenience, not validation. Validation in fields.ts does
 * not enforce filesystem/mount-point compatibility — it only checks that a
 * value is present when required.
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
    const [incompatibleFsAlert, setIncompatibleFsAlert] = React.useState<string | null>(null);

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

      // Current filesystem is not compatible with the mount point
      const previousLabel = filesystemLabel(filesystem as ConfigModel.FilesystemType);
      form.setFieldValue("filesystem", FILESYSTEM_TYPE.AUTO);
      setIncompatibleFsAlert(
        sprintf(
          // TRANSLATORS: %s is a filesystem type name like "XFS" or "Btrfs"
          _("Selected mount point does not support %s file system type, switched to Automatic"),
          previousLabel,
        ),
      );
    }, [usableFilesystems, filesystem, form]);

    return (
      <>
        {incompatibleFsAlert && (
          <Alert
            variant="info"
            isInline
            actionClose={
              <AlertActionCloseButton
                // TRANSLATORS: closes the alert about automatic filesystem reset
                aria-label={_("Understood")}
                onClose={() => setIncompatibleFsAlert(null)}
              />
            }
            title={incompatibleFsAlert}
          />
        )}

        {!isReuse && (
          <FilesystemTypeSelector
            form={form}
            filesystem={filesystem}
            defaultFilesystem={defaultFilesystem}
            committedMountPoint={committedMountPoint}
            filesystemOptions={filesystemOptions}
            usableFilesystems={usableFilesystems}
          />
        )}

        {isReuse && !hasFilesystem && (
          <>
            <form.AppField name="filesystemAction">
              {(field) => (
                <field.ReadOnlyField
                  label={_("File system")}
                  text={_(
                    "Partition is not formatted. It will be formatted with the selected file system type.",
                  )}
                />
              )}
            </form.AppField>
            <FilesystemTypeSelector
              form={form}
              filesystem={filesystem}
              defaultFilesystem={defaultFilesystem}
              committedMountPoint={committedMountPoint}
              filesystemOptions={filesystemOptions}
              usableFilesystems={usableFilesystems}
            />
          </>
        )}

        {isReuse && hasFilesystem && (
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

        {filesystem !== FILESYSTEM_TYPE.AUTO && filesystemAction === FILESYSTEM_ACTION.FORMAT && (
          <form.AppField name="filesystemLabel">
            {(field) => (
              <field.TextField
                label={_("Label (optional)")}
                helperText={_("Optional label for the filesystem")}
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
