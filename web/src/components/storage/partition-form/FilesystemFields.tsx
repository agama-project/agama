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
import { Alert, AlertActionCloseButton, Stack } from "@patternfly/react-core";
import NestedContent from "~/components/core/NestedContent";
import { withForm } from "~/hooks/form";
import { defaultOptions, FILESYSTEM_TYPE, PARTITION_SOURCE, FILESYSTEM_ACTION } from "./fields";
import { useVolumeTemplate } from "~/hooks/model/system/storage";
import { filesystemLabel } from "~/components/storage/utils";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { unique } from "radashi";

import type { Storage as System } from "~/model/system";

type FilesystemFieldsProps = {
  device: System.Device;
};

/**
 * Filesystem selection and label fields.
 *
 * Shows different UI based on partition source:
 * - New partition: dropdown including an "Automatic" option at the top
 * - Use existing partition: radios for "Keep current" vs "Format" + conditional dropdown
 *
 * Also includes a filesystem label field when formatting.
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
 * The alert is dismissed by the user clicking "Understood". It does NOT appear
 * on initial render, only after the user has actively triggered a mount point
 * change that invalidates their prior selection.
 *
 * NOTE: This is a UX convenience, not validation. Validation in fields.ts does
 * not enforce filesystem/mount-point compatibility — it only checks that a
 * value is present when required.
 */
const FilesystemFields = withForm({
  ...defaultOptions,
  props: {
    device: {} as System.Device,
  } as FilesystemFieldsProps,
  render: function Render({ form, device }) {
    // Alert message is set when the filesystem is auto-reset due to a mount
    // point change. Null means no alert is shown.
    const [incompatibleFsAlert, setIncompatibleFsAlert] = React.useState<string | null>(null);

    // Subscribe to get current form values
    const { partitionSource, mountPoint, selectedPartitionId, filesystemAction, filesystem } =
      form.useStore((s) => ({
        partitionSource: s.values.partitionSource,
        mountPoint: s.values.mountPoint,
        selectedPartitionId: s.values.selectedPartitionId,
        filesystemAction: s.values.filesystemAction,
        filesystem: s.values.filesystem,
      }));

    // Hooks must be called at top level, not inside Subscribe callback
    const volume = useVolumeTemplate(mountPoint);
    const defaultFilesystem = volume.fsType;

    // Get usable filesystems for this mount point
    const usableFilesystems = React.useMemo(() => {
      const volumeFilesystems = volume.outline.fsTypes || [];
      return unique([defaultFilesystem, ...volumeFilesystems]);
    }, [volume, defaultFilesystem]);

    // Auto-reset: if the user previously chose a specific filesystem type
    // and then changed the mount point to one that no longer supports it,
    // silently reset to Automatic and show an informative alert so the
    // user knows what happened and why.
    //
    // This fires whenever usableFilesystems changes (i.e. on mount point
    // change). It does nothing when filesystem is already AUTO or when the
    // current type is still supported by the new mount point.
    React.useEffect(() => {
      // Type cast: filesystem field is string but filesystemLabel/usableFilesystems expect ConfigModel.FilesystemType
      // This is safe because both functions' implementations accept any string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (filesystem !== FILESYSTEM_TYPE.AUTO && !usableFilesystems.includes(filesystem as any)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const previousLabel = filesystemLabel(filesystem as any);
        form.setFieldValue("filesystem", FILESYSTEM_TYPE.AUTO);
        setIncompatibleFsAlert(
          sprintf(
            // TRANSLATORS: %s is a filesystem type name like "XFS" or "Btrfs"
            _("Selected mount point does not support %s file system type, switched to Automatic"),
            previousLabel,
          ),
        );
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usableFilesystems, filesystem]);

    const selectedPartition = device.partitions?.find((p) => p.name === selectedPartitionId);
    const currentFsType = selectedPartition?.filesystem?.type;
    const canReuseFs = currentFsType && usableFilesystems.includes(currentFsType);

    // Options for filesystem dropdowns. The "Automatic" entry (AUTO) is
    // always first and always available regardless of mount point.
    const filesystemOptions = [
      {
        value: FILESYSTEM_TYPE.AUTO,
        label: _("Automatic"),
      },
      ...usableFilesystems.map((fs) => ({
        value: fs,
        label: filesystemLabel(fs),
      })),
    ];

    return (
      <Stack hasGutter>
        {/* Shown when a previous filesystem selection became incompatible
                  after a mount point change. Dismissed explicitly by the user. */}
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

        {/* NEW partition: dropdown with Automatic at the top */}
        {partitionSource === PARTITION_SOURCE.NEW && (
          <form.AppField name="filesystem">
            {(field) => (
              <field.DropdownField
                label={_("File system type")}
                isDisabled={!mountPoint}
                options={filesystemOptions}
              />
            )}
          </form.AppField>
        )}

        {/* USE EXISTING partition: radios for keep current vs format */}
        {partitionSource === PARTITION_SOURCE.REUSE && (
          <form.AppField name="filesystemAction">
            {(field) => (
              <field.RadioGroupField
                label={_("File system")}
                options={[
                  ...(canReuseFs
                    ? [
                        {
                          value: FILESYSTEM_ACTION.REUSE,
                          label: sprintf(
                            // TRANSLATORS: %s is filesystem type like "Btrfs"
                            _("Keep current (%s)"),
                            filesystemLabel(currentFsType),
                          ),
                          description: _("Do not format, existing data will be preserved"),
                        },
                      ]
                    : []),
                  {
                    value: FILESYSTEM_ACTION.FORMAT,
                    label: _("Format"),
                    description: _("Choose a new file system, existing data will be destroyed"),
                  },
                ]}
              >
                {(action) => {
                  if (action === FILESYSTEM_ACTION.FORMAT) {
                    return (
                      <NestedContent>
                        <form.AppField name="filesystem">
                          {(fsField) => (
                            <fsField.DropdownField
                              label={_("File system type")}
                              options={filesystemOptions}
                            />
                          )}
                        </form.AppField>
                      </NestedContent>
                    );
                  }
                  return null;
                }}
              </field.RadioGroupField>
            )}
          </form.AppField>
        )}

        {/* Filesystem label (only shown when a concrete type is chosen) */}
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
      </Stack>
    );
  },
});

export default FilesystemFields;
