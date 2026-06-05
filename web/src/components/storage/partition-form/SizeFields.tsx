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

import React, { useMemo } from "react";
import { sprintf } from "sprintf-js";
import { useParams } from "react-router";
import { Flex } from "@patternfly/react-core";
import Text from "~/components/core/Text";
import FieldNestedContent from "~/components/form/FieldNestedContent";
import { withForm } from "~/hooks/form";
import { useVolumeTemplate } from "~/hooks/model/system/storage";
import { defaultOptions, SIZE_MODE, FILESYSTEM_TYPE, type SizeMode } from "./fields";
import {
  deviceSize,
  filesystemLabel,
  createPartitionableLocation,
  findPartitionableDevice,
} from "~/components/storage/utils";
import { _ } from "~/i18n";
import { isEmpty } from "radashi";
import {
  useConfigModel,
  usePartitionable,
  useSolvedConfigModel,
} from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";
import type { ConfigModel } from "~/model/storage/config-model";

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

/**
 * Calculates the solved sizes for a partition configuration.
 *
 * This hook is called during render if committedMountPoint or filesystem change.
 *
 * @returns Object with min and max size strings, or null if sizes cannot be calculated
 */
function useSolvedSizes(
  mountPoint: string,
  filesystem: string,
): { min: string; max: string } | null {
  const { collection, index } = useParams();
  const model = useConfigModel();
  const location = createPartitionableLocation(collection, index);
  const device = usePartitionable(
    location?.collection || "drives",
    location?.index !== undefined ? location.index : 0,
  );

  // Build a sparse model (a model in which the size of the relevant partition is omitted) to be
  // used by useSolvedConfigModel.
  const sparseModel = useMemo(() => {
    // Just to make sure, no call without mountPoint is expected
    if (!mountPoint || !device || !location) {
      return undefined;
    }

    const modelCollection = collection === "drives" ? "drives" : "mdRaids";

    // Build partition config without size to force automatic calculation
    const partitionConfig: ConfigModel.Partition = {
      mountPath: mountPoint,
      name: undefined, // Always treat as new partition for size calculation
      filesystem:
        filesystem === FILESYSTEM_TYPE.AUTO
          ? undefined
          : {
              default: false,
              type: filesystem as ConfigModel.FilesystemType,
              label: undefined,
            },
      size: undefined, // Force automatic sizing
    };

    try {
      const initialPartitionCfg = configModel.partitionable.findPartition(device, mountPoint);
      const idx = Number(index);
      return initialPartitionCfg
        ? configModel.partition.edit(model, modelCollection, idx, mountPoint, partitionConfig)
        : configModel.partition.add(model, modelCollection, idx, partitionConfig);
    } catch {
      return undefined;
    }
  }, [mountPoint, filesystem, device, location, collection, index, model]);

  // Always call the hook (Rules of Hooks), but pass undefined when we shouldn't calculate
  const solvedModel = useSolvedConfigModel(sparseModel);

  // Extract and format the solved sizes
  return useMemo(() => {
    if (!solvedModel || !location) return null;

    const solvedDevice = findPartitionableDevice(solvedModel, collection, index);
    const solvedPartition = solvedDevice?.partitions?.find((p) => p.mountPath === mountPoint);

    if (!solvedPartition?.size) return null;

    return {
      min: solvedPartition.size.min ? deviceSize(solvedPartition.size.min) : undefined,
      max: solvedPartition.size.max ? deviceSize(solvedPartition.size.max) : undefined,
    };
  }, [solvedModel, location, collection, index, mountPoint]);
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
  sizes: { min: string; max: string } | null,
): { sizeLabel: string; rationale: string } {
  // Memoized to avoid recalculating on every render. The computation includes
  // conditionals, sprintf calls, and translations.
  return useMemo(() => {
    if (!volume || !sizes) {
      return {
        sizeLabel: _("Automatic"),
        rationale: _("Installer will propose a suitable size"),
      };
    }

    const minSize = sizes.min;
    const fsLabel = effectiveFilesystem ? filesystemLabel(effectiveFilesystem) : null;

    if (minSize && fsLabel && committedMountPoint) {
      return {
        // TRANSLATORS: %s is minimum size (e.g., "20 GiB")
        sizeLabel: sprintf(_("Minimum %s"), minSize),
        // TRANSLATORS: %1$s is mount point (e.g., "/home"), %2$s is filesystem (e.g., "XFS")
        rationale: sprintf(
          _("Determined by the %1$s role and %2$s filesystem."),
          committedMountPoint,
          fsLabel,
        ),
      };
    }

    if (minSize) {
      return {
        // TRANSLATORS: %s is minimum size (e.g., "20 GiB")
        sizeLabel: sprintf(_("Minimum %s"), minSize),
        rationale: _("Determined by the mount point role"),
      };
    }

    return {
      sizeLabel: _("Automatic"),
      rationale: _("Based on available disk space and mount point role"),
    };
  }, [volume, effectiveFilesystem, committedMountPoint, sizes]);
}

/**
 * Help text explaining size value format and units.
 *
 * Shown for non-automatic size modes (Fixed, Range, Expand) to guide users
 * on accepted input format. Uses singular or plural form.
 */
const SizeInputHelp = ({ singular = false }: { singular?: boolean }) => (
  <Flex direction={{ default: "column" }} gap={{ default: "gapXs" }}>
    <Text isBold textStyle="textColorSubtle">
      {singular
        ? /* TRANSLATORS: instruction for size input format */
          _("Enter value as number followed by unit")
        : /* TRANSLATORS: instruction for size input format (plural) */
          _("Enter values as number followed by unit")}
    </Text>
    <Text component="small">
      {/* TRANSLATORS: examples of valid size formats with integer and decimal */}
      {_("Units can be binary (10 GiB, power of 2) or decimal (10.5 GB, power of 10)")}
    </Text>
  </Flex>
);

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

    const effectiveFilesystem = filesystem === FILESYSTEM_TYPE.AUTO ? volume?.fsType : filesystem;

    // Calculate solved sizes - only recalculates when committedMountPoint or filesystem change
    const solvedSizes = useSolvedSizes(committedMountPoint, filesystem);

    const automaticSizeNote = useAutomaticSizeNote(
      volume,
      effectiveFilesystem,
      committedMountPoint,
      solvedSizes,
    );

    switch (sizeMode) {
      case SIZE_MODE.AUTO:
        return (
          <Flex direction={{ default: "column" }} gap={{ default: "gapXs" }}>
            <Text isBold textStyle="textColorSubtle">
              {automaticSizeNote.sizeLabel}
            </Text>
            <Text component="small">{automaticSizeNote.rationale}</Text>
          </Flex>
        );

      case SIZE_MODE.FIXED:
        return (
          <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
            <SizeInputHelp singular />
            <form.AppField name="fixedSize">
              {(field) => <field.TextField label={_("Value")} />}
            </form.AppField>
          </Flex>
        );

      case SIZE_MODE.RANGE:
        return (
          <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
            <SizeInputHelp />
            <Flex alignItems={{ default: "alignItemsFlexEnd" }} gap={{ default: "gapMd" }}>
              <form.AppField name="rangeMinSize">
                {(field) => <field.TextField label={_("Minimum")} />}
              </form.AppField>
              <form.AppField name="rangeMaxSize">
                {(field) => <field.TextField label={_("Maximum")} />}
              </form.AppField>
            </Flex>
          </Flex>
        );

      case SIZE_MODE.EXPAND:
        return (
          <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
            <SizeInputHelp singular />
            <form.AppField name="expandMinSize">
              {(field) => (
                <field.TextField
                  label={_("Minimum")}
                  helperText={
                    /* TRANSLATORS: helper text for expandable partition minimum size */
                    _("May use additional space if available")
                  }
                />
              )}
            </form.AppField>
          </Flex>
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
        <form.Subscribe
          selector={(s) => ({
            committedMountPoint: s.values.committedMountPoint,
            filesystem: s.values.filesystem,
          })}
        >
          {({ committedMountPoint, filesystem }) => (
            <form.AppField name="sizeMode">
              {(field) => (
                <field.DropdownField label={_("Size")} options={getSizeModeOptions()}>
                  {(value) => {
                    if (value === SIZE_MODE.AUTO && isEmpty(committedMountPoint)) return;

                    return (
                      <FieldNestedContent>
                        <SizeFieldsContent
                          form={form}
                          committedMountPoint={committedMountPoint}
                          filesystem={filesystem}
                          sizeMode={value}
                        />
                      </FieldNestedContent>
                    );
                  }}
                </field.DropdownField>
              )}
            </form.AppField>
          )}
        </form.Subscribe>
      </>
    );
  },
});

export default SizeFields;
