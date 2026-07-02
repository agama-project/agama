/*
 * Copyright (c) [2024-2026] SUSE LLC
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
import { Flex } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";
import Text from "~/components/core/Text";
import FieldNestedContent from "~/components/form/FieldNestedContent";
import { withForm } from "~/hooks/form";
import { DeviceName, DeviceDetails, DeviceSize } from "~/components/storage/device-utils";
import { deviceSize, formattedPath } from "~/components/storage/utils";
import { supportShrink } from "~/model/storage/device";
import { _ } from "~/i18n";
import { defaultOptions } from "./fields";
import type { Action } from "./fields";
import type { Storage as System } from "~/model/system";
import type { Device } from "~/model/storage/config-model/device";
import type { ConfigModel } from "~/model/storage/config-model";
import type { DropdownOption } from "~/components/form/DropdownField";

type DeviceActionFieldsProps = {
  device: System.Device;
  deviceConfig: Device;
  reusedPartition: ConfigModel.Partition | undefined;
};

/**
 * Device action field with conditional rendering.
 *
 * When only "Do not modify" is available (the device is reused):
 * - Shows a ReadOnlyField, since there is no real choice to make
 * - Explains below why the device is kept (mount point or generic use)
 *
 * When two or more actions are available:
 * - Shows a DropdownField with only the enabled options (no disabled ones)
 * - Each option describes what it does
 * - A subtle note below explains why an action is unavailable
 *
 * The label is a single line: device name and details with the size rendered
 * as a subtle suffix, matching the "(optional)" legend style.
 */
const DeviceActionFields = withForm({
  ...defaultOptions,
  props: {
    device: {} as System.Device,
    deviceConfig: {} as Device,
    reusedPartition: undefined as ConfigModel.Partition | undefined,
  } as DeviceActionFieldsProps,
  render: function Render({ form, device, reusedPartition }) {
    const canShrink = !reusedPartition && supportShrink(device);
    const canDelete = !reusedPartition;

    // Count available actions. "Do not modify" is always available.
    const availableActions = [true, canShrink, canDelete].filter(Boolean).length;

    // Single-line label: the bold device name, then its details and size in a
    // subtler style so the name stands out. An inline-flex (rather than a plain
    // block Flex) keeps the whole thing on the label's own line: a block element
    // here would start a new line inside PatternFly's inline label-text span and
    // leave a dead gap above the field. The size mirrors the "(optional)" legend.
    const label = (
      <Flex
        display={{ default: "inlineFlex" }}
        columnGap={{ default: "columnGapSm" }}
        alignItems={{ default: "alignItemsBaseline" }}
        flexWrap={{ default: "nowrap" }}
      >
        <DeviceName item={device} />
        <Text component="span" isBold textStyle={["textColorSubtle", "fontSizeSm"]}>
          <DeviceDetails item={device} />
        </Text>
        <Text component="small" textStyle={["textColorSubtle", "fontWeightNormal"]}>
          <DeviceSize item={device} />
        </Text>
      </Flex>
    );

    // IMPORTANT -- these labels are intentionally NOT wrapped in _():
    //
    // "Do not modify" and "Allow shrink" are kept as plain, untranslated
    // literals on purpose. The space policy ToggleGroup this form replaces (the
    // now-dropped SpaceActionsTable) already passed them as bare JSX props
    // (text="Do not modify" / text="Allow shrink"), never through _(). They
    // have therefore never been extracted for translation and have always
    // shipped untranslated: a pre-existing i18n bug, not a regression here.
    //
    // During the string freeze new translatable strings cannot be introduced,
    // so they stay as literals to preserve the exact current behavior. Once the
    // freeze is lifted they should be wrapped in _() and the wording revisited;
    // this finding is worth tracking with its own bug report. "Delete" is
    // unaffected -- it is already translatable and keeps using _("Delete").
    const keepLabel = "Do not modify";
    const shrinkLabel = "Allow shrink";

    // CASE 1: only "Do not modify" is available (the device is reused).
    // Render a ReadOnlyField (no fake choice) and explain why below, following
    // the bold-value + subtle-rationale layout used by SizeFields.
    if (availableActions === 1) {
      const explanation = reusedPartition.mountPath
        ? sprintf(_("The device will be mounted at %s."), formattedPath(reusedPartition.mountPath))
        : _("The device will be used by the new system.");

      return (
        <form.AppField name={device.name}>
          {(field) => (
            <field.ReadOnlyField label={label} text={keepLabel}>
              <FieldNestedContent>
                <Text component="small">{explanation}</Text>
              </FieldNestedContent>
            </field.ReadOnlyField>
          )}
        </form.AppField>
      );
    }

    // CASE 2: two or more actions available. Show only the enabled options;
    // each option carries a description explaining what it does.
    const options: DropdownOption<Action>[] = [
      {
        value: "keep",
        label: keepLabel,
      },
      canShrink && device.block?.shrinking?.minSize
        ? {
            value: "resizeIfNeeded",
            label: shrinkLabel,
            description: sprintf(
              _("Up to %s can be recovered by shrinking the device."),
              deviceSize(device.block.size - device.block.shrinking.minSize),
            ),
          }
        : null,
      canDelete
        ? {
            value: "delete",
            label: _("Delete"),
          }
        : null,
    ].filter(Boolean) as DropdownOption<Action>[];

    // Explain unavailable actions below the field, matching the subtle rationale
    // SizeFields shows under its automatic-size note.
    // Only explain the missing shrink option when the backend gives reasons,
    // matching the former table (which showed nothing when no shrink info
    // existed) and reusing the existing translatable string.
    const reasons = device.block?.shrinking?.reasons || [];
    const shrinkNote =
      !canShrink && reasons.length > 0
        ? _("The device cannot be shrunk:") + " " + reasons.join(", ")
        : undefined;

    const helperText = shrinkNote ? (
      <FieldNestedContent>
        <Text component="small">{shrinkNote}</Text>
      </FieldNestedContent>
    ) : undefined;

    return (
      <form.AppField name={device.name}>
        {(field) => <field.DropdownField label={label} options={options} helperText={helperText} />}
      </form.AppField>
    );
  },
});

export default DeviceActionFields;
