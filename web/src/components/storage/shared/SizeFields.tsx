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
import { Flex } from "@patternfly/react-core";
import Text from "~/components/core/Text";
import FieldNestedContent from "~/components/form/FieldNestedContent";
import { withForm } from "~/hooks/form";
import { useVolumeTemplate } from "~/hooks/model/system/storage";
import { sharedDefaultOptions, SIZE_MODE, type SizeMode } from "./fields";
import { formattedPath } from "~/components/storage/utils";
import { _, formatList } from "~/i18n";
import { isEmpty } from "radashi";

/**
 * Solved sizes returned by a {@link UseSolvedSizes} hook: the min and max sizes
 * the installer would assign, formatted for display, or `null` when they cannot
 * be computed.
 */
export type SolvedSizes = { min: string; max: string } | null;

/**
 * Hook signature the host form provides to compute the automatic (solved) sizes
 * for the current mount point and filesystem.
 *
 * The computation is form-specific (partitions and logical volumes solve sizes
 * differently), so SizeFields receives it as a prop instead of owning it. The
 * hook is called unconditionally during render, following the rules of hooks.
 */
export type UseSolvedSizes = (mountPoint: string, filesystem: string) => SolvedSizes;

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
      description: _("Let the installer set the size"),
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
      description: _("Set minimum; use more space if available"),
    },
  ] satisfies Array<{ value: SizeMode; label: string; description: string }>;
}

type SizeFieldsContentProps = {
  committedMountPoint: string;
  filesystem: string;
  sizeMode: SizeMode;
  useSolvedSizes: UseSolvedSizes;
};

function autoSizeSource(volume) {
  if (isEmpty(volume.mountPath)) {
    return "default size for generic mount points";
  }

  if (volume.autoSize) {
    // TRANSLATORS: %s is an already escaped path like "/home"
    return sprintf(_("size for %s with the current settings"), formattedPath(volume.mountPath));
  }

  // TRANSLATORS: %s is an already escaped path like "/home"
  return sprintf(_("default size for %s"), formattedPath(volume.mountPath));
}

function autoSizeLabel(sizes, volume) {
  const why = autoSizeSource(volume);

  if (!sizes.max) {
    // TRANSLATORS: %1$s is a size, %2$s is a sentence explaining why that minimum is used
    return sprintf(_("Minimum: %1$s (%2$s)"), sizes.min, why);
  }

  if (sizes.min === sizes.max) {
    // TRANSLATORS: %1$s is a size, %2$s is a sentence explaining why that size is used
    return sprintf(_("Value: %1$s (%2$s)"), sizes.min, why);
  }

  // TRANSLATORS: %1$s and %2$s are sizes, %3%s is a sentence explaining why those limits are used
  return sprintf(_("Range: %1$s - %2$s (%3$s)"), sizes.min, sizes.max, why);
}

function autoSizeRationale(volume) {
  if (!volume.autoSize) {
    return null;
  }

  const otherPaths = volume.outline.sizeRelevantVolumes.map((p) => formattedPath(p)) || [];
  const snapshots = !!volume.outline.snapshotsAffectSizes;
  const ram = !!volume.outline.adjustByRam;

  if (ram && snapshots) {
    if (otherPaths.length === 1) {
      return sprintf(
        // TRANSLATORS: %s is an already formatted mount point (eg. "/home")
        _(
          "Can be dynamically adjusted based on the amount of RAM in the system, the usage of Btrfs snapshots and the presence of a separate file system for %s.",
        ),
        otherPaths[0],
      );
    }

    if (otherPaths.length > 1) {
      // TRANSLATORS: %s is an already formatted list of mount paths (eg. "/home" and "/var/lib")
      return sprintf(
        _(
          "Can be dynamically adjusted based on the amount of RAM in the system, the usage of Btrfs snapshots and the presence of separate file systems for %s.",
        ),
        formatList(otherPaths),
      );
    }

    return _(
      "Can be dynamically adjusted based on the amount of RAM in the system and the usage of Btrfs snapshots.",
    );
  }

  if (ram) {
    if (otherPaths.length === 1) {
      return sprintf(
        // TRANSLATORS: %s is an already formatted mount point (eg. "/home")
        _(
          "Can be dynamically adjusted based on the amount of RAM in the system and the presence of a separate file system for %s.",
        ),
        otherPaths[0],
      );
    }

    return sprintf(
      // TRANSLATORS: %s is an already formatted list of mount paths (eg. "/home" and "/var/lib")
      _(
        "Can be dynamically adjusted based on the amount of RAM in the system and the presence of separate file systems for %s.",
      ),
      formatList(otherPaths),
    );
  }

  if (snapshots) {
    if (otherPaths.length === 1) {
      return sprintf(
        // TRANSLATORS: %s is an already formatted mount point (eg. "/home")
        _(
          "Can be dynamically adjusted based on the usage of Btrfs snapshots and the presence of a separate file system for %s.",
        ),
        otherPaths[0],
      );
    }

    if (otherPaths.length > 1) {
      return sprintf(
        // TRANSLATORS: %s is an already formatted list of mount paths (eg. "/home" and "/var/lib")
        _(
          "Can be dynamically adjusted based on the usage of Btrfs snapshots and the presence of separate file systems for %s.",
        ),
        formatList(otherPaths),
      );
    }

    return _("Can be dynamically adjusted based on the usage of Btrfs snapshots.");
  }

  if (otherPaths.length === 1) {
    return sprintf(
      // TRANSLATORS: %s is an already formatted mount point (eg. "/home")
      _("Can be dynamically adjusted based on the presence of a separate file system for %s."),
      otherPaths[0],
    );
  }

  return sprintf(
    // TRANSLATORS: %s is an already formatted list of mount paths (eg. "/home" and "/var/lib")
    _("Can be dynamically adjusted based on the presence of separate file systems for %s."),
    formatList(otherPaths),
  );
}

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
  sizes: SolvedSizes,
): { sizeLabel: string; rationale: string } {
  if (sizes) {
    return {
      sizeLabel: autoSizeLabel(sizes, volume),
      rationale: autoSizeRationale(volume),
    };
  }

  // This should actually never be displayed
  return {
    sizeLabel: _("Automatic"),
    rationale: _("Based on the mount point"),
  };
}

/**
 * Help text explaining size value format and units.
 *
 * Shown for non-automatic size modes (Fixed, Range, Expand) to guide users
 * on accepted input format. Uses singular or plural form.
 */
const SizeInputHelp = ({ singular = false }: { singular?: boolean }) => (
  <Flex direction={{ default: "column" }} gap={{ default: "gapXs" }}>
    <Text component="small">
      {singular
        ? "The size must be a number followed by a unit of the form GiB (power of 2) or GB (power of 10)"
        : "The limits must be numbers followed by a unit of the form GiB (power of 2) or GB (power of 10)"}
    </Text>
  </Flex>
);

/**
 * Inner component that renders size mode-specific inputs and info notes.
 */
const SizeFieldsContent = withForm({
  ...sharedDefaultOptions,
  props: {
    committedMountPoint: "",
    filesystem: "",
    sizeMode: SIZE_MODE.AUTO,
  } as SizeFieldsContentProps,
  render: function Render({ form, committedMountPoint, filesystem, sizeMode, useSolvedSizes }) {
    // Use committedMountPoint (not live mountPoint) to avoid reacting to incomplete input.
    // This prevents showing misleading size hints while user types "/ho..." and avoids
    // expensive useVolumeTemplate recalculations on every keystroke.
    const volume = useVolumeTemplate(committedMountPoint);

    // Calculate solved sizes - only recalculates when committedMountPoint or filesystem change.
    // The host form provides the size-solving logic (partition vs logical volume).
    const solvedSizes = useSolvedSizes(committedMountPoint, filesystem);
    const automaticSizeNote = useAutomaticSizeNote(volume, solvedSizes);

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
            <form.AppField name="fixedSize">
              {(field) => <field.TextField label={_("Value")} />}
            </form.AppField>
            <SizeInputHelp singular />
          </Flex>
        );

      case SIZE_MODE.RANGE:
        return (
          <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
            <Flex alignItems={{ default: "alignItemsFlexEnd" }} gap={{ default: "gapMd" }}>
              <form.AppField name="rangeMinSize">
                {(field) => <field.TextField label={_("Minimum")} />}
              </form.AppField>
              <form.AppField name="rangeMaxSize">
                {(field) => <field.TextField label={_("Maximum")} />}
              </form.AppField>
            </Flex>
            <SizeInputHelp />
          </Flex>
        );

      case SIZE_MODE.EXPAND:
        return (
          <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
            <form.AppField name="expandMinSize">
              {(field) => <field.TextField label={_("Minimum")} />}
            </form.AppField>
            <SizeInputHelp singular />
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
  ...sharedDefaultOptions,
  props: {
    useSolvedSizes: (() => null) as UseSolvedSizes,
  },
  render: function Render({ form, useSolvedSizes }) {
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
                          useSolvedSizes={useSolvedSizes}
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
