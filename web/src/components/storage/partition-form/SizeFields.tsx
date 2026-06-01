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
import { Content, Flex } from "@patternfly/react-core";
import NestedContent from "~/components/core/NestedContent";
import Text from "~/components/core/Text";
import { withForm } from "~/hooks/form";
import { useVolumeTemplate } from "~/hooks/model/system/storage";
import { defaultOptions, SIZE_MODE, FILESYSTEM_TYPE, type SizeMode } from "./fields";
import { deviceSize, filesystemLabel } from "~/components/storage/utils";
import { _ } from "~/i18n";

/**
 * Returns dropdown options for size mode selection.
 *
 * Defined as a function (not a module-level const) so that _() is called at
 * render time, after the i18n system is initialized.
 *
 * The `satisfies` check ensures every SIZE_MODE value has a corresponding
 * option — adding a new mode to the const without adding an option here
 * is a compile error.
 */
function getSizeModeOptions() {
  return [
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
  ] satisfies Array<{ value: SizeMode; label: string; description: string }>;
}

type SizeFieldsContentProps = {
  committedMountPoint: string;
  filesystem: string;
  sizeMode: SizeMode;
};

/**
 * Derives the note shown when size mode is Automatic.
 *
 * Returns structured data for two-line display:
 * - sizeLabel: Prominent size information (e.g., "At least 20 GiB")
 * - rationale: Subdued explanation of how size is determined
 *
 * Extracted from SizeFieldsContent to keep render logic flat and to allow
 * direct unit testing of the note copy without mounting the component.
 */
function useAutomaticSizeNote(
  volume: ReturnType<typeof useVolumeTemplate>,
  effectiveFilesystem: string | undefined,
  committedMountPoint: string,
): { sizeLabel: string; rationale: string } {
  return React.useMemo(() => {
    if (!volume) {
      return {
        sizeLabel: _("Automatic"),
        rationale: _("Installer will propose a suitable size"),
      };
    }

    const minSize = volume.minSize ? deviceSize(volume.minSize) : null;
    const fsLabel = effectiveFilesystem ? filesystemLabel(effectiveFilesystem) : null;

    if (minSize && fsLabel && committedMountPoint) {
      return {
        // TRANSLATORS: %s is minimum size (e.g., "20 GiB")
        sizeLabel: sprintf(_("At least %s"), minSize),
        // TRANSLATORS: %1$s is mount point (e.g., "/home"), %2$s is filesystem (e.g., "XFS")
        rationale: sprintf(
          _("Determined by the role of %1$s and the selected file system (%2$s)"),
          committedMountPoint,
          fsLabel,
        ),
      };
    }

    if (minSize) {
      return {
        // TRANSLATORS: %s is minimum size (e.g., "20 GiB")
        sizeLabel: sprintf(_("At least %s"), minSize),
        rationale: _("Determined by the mount point role"),
      };
    }

    return {
      sizeLabel: _("Automatic"),
      rationale: _("Based on available disk space and mount point role"),
    };
  }, [volume, effectiveFilesystem, committedMountPoint]);
}

/**
 * Inner component that renders size mode-specific inputs and info notes.
 */
const SizeFieldsContent = withForm({
  ...defaultOptions,
  props: {
    committedMountPoint: "",
    filesystem: "",
    sizeMode: SIZE_MODE.AUTO,
  } as SizeFieldsContentProps,
  render: function Render({ form, committedMountPoint, filesystem, sizeMode }) {
    // Use committedMountPoint (not live mountPoint) to avoid reacting to incomplete input.
    // This prevents showing misleading size hints while user types "/ho..." and avoids
    // expensive useVolumeTemplate recalculations on every keystroke.
    const volume = useVolumeTemplate(committedMountPoint);

    const effectiveFilesystem = React.useMemo(
      () => (filesystem === FILESYSTEM_TYPE.AUTO ? volume?.fsType : filesystem),
      [filesystem, volume],
    );

    const automaticSizeNote = useAutomaticSizeNote(
      volume,
      effectiveFilesystem,
      committedMountPoint,
    );

    switch (sizeMode) {
      case SIZE_MODE.AUTO:
        return (
          <>
            <Content isEditorial>{automaticSizeNote.sizeLabel}</Content>
            <Text component="small">{automaticSizeNote.rationale}</Text>
          </>
        );

      case SIZE_MODE.FIXED:
        return (
          <form.AppField name="fixedSize">
            {(field) => (
              <field.TextField label={_("Value")} helperText={_("e.g., 20 GiB, 100 MB")} />
            )}
          </form.AppField>
        );

      case SIZE_MODE.RANGE:
        return (
          <Flex alignItems={{ default: "alignItemsFlexEnd" }} gap={{ default: "gapMd" }}>
            <form.AppField name="rangeMinSize">
              {(field) => <field.TextField label={_("Minimum")} helperText={_("e.g., 10 GiB")} />}
            </form.AppField>
            <form.AppField name="rangeMaxSize">
              {(field) => <field.TextField label={_("Maximum")} helperText={_("e.g., 40 GiB")} />}
            </form.AppField>
          </Flex>
        );

      case SIZE_MODE.EXPAND:
        return (
          <form.AppField name="expandMinSize">
            {(field) => (
              <field.TextField
                label={_("Minimum")}
                helperText={_(
                  "Minimum space guaranteed. Remaining disk space is shared among expandable partitions.",
                )}
              />
            )}
          </form.AppField>
        );

      default:
        // Ensures TS errors here if a new SIZE_MODE value is added without a matching case.
        sizeMode satisfies never;
        return null;
    }
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
      <>
        <form.AppField name="sizeMode">
          {(field) => <field.DropdownField label={_("Size")} options={getSizeModeOptions()} />}
        </form.AppField>
        <form.Subscribe
          selector={(s) => ({
            mode: s.values.sizeMode,
            committedMountPoint: s.values.committedMountPoint,
            filesystem: s.values.filesystem,
          })}
        >
          {({ mode, committedMountPoint, filesystem }) => (
            <NestedContent margin="mxLg">
              <SizeFieldsContent
                form={form}
                committedMountPoint={committedMountPoint}
                filesystem={filesystem}
                sizeMode={mode}
              />
            </NestedContent>
          )}
        </form.Subscribe>
      </>
    );
  },
});

export default SizeFields;
