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
import { Stack } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";
import NestedContent from "~/components/core/NestedContent";
import Text from "~/components/core/Text";
import { withForm } from "~/hooks/form";
import { useVolumeTemplate } from "~/hooks/model/system/storage";
import { defaultOptions, SIZE_MODE, FILESYSTEM_TYPE } from "./fields";
import { deviceSize, filesystemLabel } from "~/components/storage/utils";
import { _ } from "~/i18n";

type SizeFieldsContentProps = {
  mountPoint: string;
  filesystem: string;
  sizeMode: string;
};

/**
 * Inner component that renders size mode-specific inputs and info notes.
 */
const SizeFieldsContent = withForm({
  ...defaultOptions,
  props: {
    mountPoint: "",
    filesystem: "",
    sizeMode: "",
  } as SizeFieldsContentProps,
  render: function Render({ form, mountPoint, filesystem, sizeMode }) {
    const volume = useVolumeTemplate(mountPoint);

    const effectiveFilesystem = React.useMemo(() => {
      if (filesystem === FILESYSTEM_TYPE.AUTO) {
        return volume?.fsType;
      }
      return filesystem;
    }, [filesystem, volume]);

    const automaticSizeNote = React.useMemo(() => {
      if (!volume) return _("Installer will propose a suitable size");

      const minSize = volume.minSize ? deviceSize(volume.minSize) : null;
      const fsLabel = effectiveFilesystem ? filesystemLabel(effectiveFilesystem) : null;

      if (minSize && fsLabel && mountPoint) {
        return sprintf(
          // TRANSLATORS: %1$s is minimum size (e.g., "20 GiB"), %2$s is mount point (e.g., "/home"), %3$s is filesystem (e.g., "XFS")
          _(
            "The installer will propose at least %1$s for this partition. Determined by the role of %2$s and the selected file system (%3$s).",
          ),
          minSize,
          mountPoint,
          fsLabel,
        );
      } else if (minSize) {
        return sprintf(
          // TRANSLATORS: %s is minimum size (e.g., "20 GiB")
          _("The installer will propose at least %s for this partition."),
          minSize,
        );
      }

      return _(
        "Installer will propose a suitable value based on available disk space and mount point role",
      );
    }, [volume, effectiveFilesystem, mountPoint]);

    if (sizeMode === SIZE_MODE.AUTO) {
      return (
        <NestedContent margin="mxLg">
          <Text textStyle={["fontSizeSm", "textColorSubtle"]}>{automaticSizeNote}</Text>
        </NestedContent>
      );
    }

    if (sizeMode === SIZE_MODE.FIXED) {
      return (
        <NestedContent margin="mxLg">
          <form.AppField name="fixedSize">
            {(sizeField) => (
              <sizeField.TextField label={_("Value")} helperText={_("e.g., 20 GiB, 100 MB")} />
            )}
          </form.AppField>
        </NestedContent>
      );
    }

    if (sizeMode === SIZE_MODE.RANGE) {
      return (
        <NestedContent margin="mxLg">
          <Stack hasGutter>
            <form.AppField name="minSize">
              {(sizeField) => (
                <sizeField.TextField label={_("Minimum")} helperText={_("e.g., 10 GiB")} />
              )}
            </form.AppField>
            <form.AppField name="maxSize">
              {(sizeField) => (
                <sizeField.TextField label={_("Maximum")} helperText={_("e.g., 40 GiB")} />
              )}
            </form.AppField>
          </Stack>
        </NestedContent>
      );
    }

    if (sizeMode === SIZE_MODE.EXPAND) {
      return (
        <NestedContent margin="mxLg">
          <form.AppField name="minSize">
            {(sizeField) => (
              <sizeField.TextField
                label={_("Minimum")}
                helperText={_(
                  "Minimum space guaranteed. Remaining disk space is shared among expandable partitions.",
                )}
              />
            )}
          </form.AppField>
        </NestedContent>
      );
    }

    return null;
  },
});

/**
 * Size mode selection and size inputs.
 *
 * Uses DropdownField for size mode selection and reveals appropriate size
 * input fields based on the selected mode:
 * - Automatic: Info text explaining automatic sizing with proposed size
 * - Fixed: Single TextField for exact size
 * - Range: Two TextFields for minimum and maximum
 * - Expand if possible: TextField for minimum with helper text
 */
const SizeFields = withForm({
  ...defaultOptions,
  render: function Render({ form }) {
    return (
      <form.AppField name="sizeMode">
        {(field) => (
          <field.DropdownField
            label={_("Size")}
            options={[
              {
                value: SIZE_MODE.AUTO,
                // TRANSLATORS: size mode option
                label: _("Automatic"),
                // TRANSLATORS: description for automatic size mode
                description: _("Installer determines the size"),
              },
              {
                value: SIZE_MODE.FIXED,
                // TRANSLATORS: size mode option
                label: _("Fixed"),
                // TRANSLATORS: description for fixed size mode
                description: _("Set a specific size"),
              },
              {
                value: SIZE_MODE.RANGE,
                // TRANSLATORS: size mode option
                label: _("Range"),
                // TRANSLATORS: description for range size mode
                description: _("Set minimum and maximum"),
              },
              {
                value: SIZE_MODE.EXPAND,
                // TRANSLATORS: size mode option
                label: _("Expand if possible"),
                // TRANSLATORS: description for expand size mode
                description: _("Set minimum; partition grows if space available"),
              },
            ]}
          >
            {(mode) => (
              <form.Subscribe
                selector={(s) => ({
                  mountPoint: s.values.mountPoint,
                  filesystem: s.values.filesystem,
                })}
              >
                {({ mountPoint, filesystem }) => (
                  <SizeFieldsContent
                    form={form}
                    mountPoint={mountPoint}
                    filesystem={filesystem}
                    sizeMode={mode}
                  />
                )}
              </form.Subscribe>
            )}
          </field.DropdownField>
        )}
      </form.AppField>
    );
  },
});

export default SizeFields;
