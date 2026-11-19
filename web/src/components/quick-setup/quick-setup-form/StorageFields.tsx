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

import React, { useState } from "react";
import { isEmpty, sift } from "radashi";
import { HelperText, HelperTextItem } from "@patternfly/react-core";
import Interpolate from "~/components/core/Interpolate";
import Text from "~/components/core/Text";
import FieldsRow from "~/components/form/FieldsRow";
import PreservedValueField from "~/components/form/PreservedValueField";
import DeviceSelectorModal from "~/components/storage/DeviceSelectorModal";
import { baseName, deviceBaseName, deviceLabel } from "~/components/storage/utils";
import { withForm } from "~/hooks/form";
import { _ } from "~/i18n";
import { EXISTING_CONTENT, defaultOptions } from "./fields";
import { diskSystems, isEmptyDisk } from "./storage";
import { changesProduct } from "./transformations";

import type { Storage } from "~/model/system";
import type { FormFields } from "./fields";
import type { QuickSetupData } from "./queries";

/** The disk model and the systems found on it, or that it is empty. */
const diskDetails = (disk: Storage.Device) => {
  const systems = diskSystems(disk).join(", ");
  // TRANSLATORS: shown next to a disk that holds nothing
  const content = isEmptyDisk(disk) ? _("empty") : systems;
  return sift([disk.drive?.model, content]).join(" · ");
};

/** Disk names in bold, separated by commas. */
const DiskNames = ({ names }: { names: string[] }) =>
  names.map((name, index) => (
    <React.Fragment key={name}>
      {index > 0 && ", "}
      <Text isBold>{name}</Text>
    </React.Fragment>
  ));

const existingContentOptions = () => [
  {
    value: EXISTING_CONTENT.DELETE,
    // TRANSLATORS: option for what to do with what is on the installation disk
    label: _("Use the whole disk"),
    // TRANSLATORS: description of the "Use the whole disk" option
    description: _("Delete everything on the disk and use all of it."),
  },
  {
    value: EXISTING_CONTENT.RESIZE,
    // TRANSLATORS: option for what to do with what is on the installation disk
    label: _("Keep existing data"),
    // TRANSLATORS: description of the "Keep existing data" option
    description: _("Shrink partitions as needed; nothing is deleted."),
  },
];

/**
 * What will be lost by using the whole disk, as far as the system tells. It
 * stands out, so the loss is noticed before accepting rather than on the
 * overview or in the final confirmation.
 */
const DataLossNote = ({ disk }: { disk: Storage.Device }) => {
  const systems = diskSystems(disk);
  const name = () => <DiskNames names={[deviceBaseName(disk)]} />;
  const text = systems.length ? (
    <Interpolate
      sentence={
        // TRANSLATORS: shown when the whole installation disk will be used. The
        // first %s is the disk (e.g. "sda"), the second the systems found on it
        // (e.g. "Windows 11").
        _("Everything on %s will be deleted, including %s.")
      }
    >
      {[name, () => systems.join(", ")]}
    </Interpolate>
  ) : (
    <Interpolate
      sentence={
        // TRANSLATORS: shown when the whole installation disk will be used. %s
        // is the disk (e.g. "sda").
        _("Everything on %s will be deleted.")
      }
    >
      {name}
    </Interpolate>
  );

  return (
    <HelperText>
      {/* The sentence itself tells what happens: no status word appended. */}
      <HelperTextItem variant="warning" screenReaderText="">
        {text}
      </HelperTextItem>
    </HelperText>
  );
};

type StorageFieldsProps = {
  data: QuickSetupData;
  /** Disks of a storage setup made elsewhere, if there is one. */
  customDisks: string[];
};

/**
 * What becomes of a storage setup made elsewhere: kept, replaced by what is
 * picked here, or dropped with the product it was made for.
 */
type CustomStorage = "kept" | "replaced" | "dropped";

const customStorage = (formValues: FormFields, data: QuickSetupData): CustomStorage => {
  if (changesProduct(formValues, data)) return "dropped";
  if (formValues.keepsCustomStorage) return "kept";
  return "replaced";
};

/**
 * The installation disk and what to do with what is on it, side by side.
 *
 * Several disks: a dropdown with each disk and what it holds, plus a way to
 * browse them with their details. A single disk: shown as text. An empty disk
 * needs no choice, which is told in its place to keep the layout steady.
 *
 * A storage setup made on the storage page is kept, told in place of the
 * fields, until the user asks to change it, with a way back while not accepted.
 * Picking another product drops it, as the whole config goes with the product.
 */
const StorageFields = withForm({
  ...defaultOptions,
  props: {} as StorageFieldsProps,
  render: function Render({ form, data, customDisks }) {
    const { disks } = data;
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const findDisk = (name: string) => disks.find((d) => d.name === name);
    const replacesCustomStorage = () => form.setFieldValue("keepsCustomStorage", false);
    // TRANSLATORS: label of the field for the disk to install the system on
    const diskLabel = _("Installation disk");
    // TRANSLATORS: label of the field for what to do with what is on the disk
    const contentLabel = _("Existing content");

    const options = disks.map((disk) => ({
      value: disk.name,
      label: deviceLabel(disk),
      description: diskDetails(disk),
    }));

    const fields = (
      <FieldsRow>
        <form.AppField name="disk" listeners={{ onChange: replacesCustomStorage }}>
          {(field) => {
            if (disks.length === 1) {
              return (
                <field.ReadOnlyField
                  label={diskLabel}
                  text={
                    <>
                      {deviceLabel(disks[0])}
                      <br />
                      <Text textStyle="textColorSubtle">{diskDetails(disks[0])}</Text>
                    </>
                  }
                />
              );
            }

            return (
              <>
                <field.DropdownField
                  label={diskLabel}
                  // TRANSLATORS: shown in the disk field until one is picked
                  placeholder={_("Select a disk")}
                  options={options}
                  maxMenuHeight="20rem"
                  footerEntry={{
                    // TRANSLATORS: last entry of the disk list, opening a
                    // dialog with the disks and their details
                    label: _("Browse with details..."),
                    onSelect: () => setIsDialogOpen(true),
                    opensDialog: true,
                  }}
                />
                {isDialogOpen && (
                  <DeviceSelectorModal
                    // TRANSLATORS: title of the dialog listing the disks
                    title={_("Select a disk")}
                    disks={disks}
                    selected={findDisk(field.state.value)}
                    onCancel={() => setIsDialogOpen(false)}
                    onConfirm={([device]) => {
                      setIsDialogOpen(false);
                      if (device) field.handleChange(device.name);
                    }}
                  />
                )}
              </>
            );
          }}
        </form.AppField>
        <form.Subscribe selector={(s) => s.values.disk}>
          {(diskName) => {
            const disk = findDisk(diskName);
            return (
              <form.AppField name="existingContent" listeners={{ onChange: replacesCustomStorage }}>
                {(field) =>
                  disk && isEmptyDisk(disk) ? (
                    // TRANSLATORS: shown instead of the existing content
                    // choice when the disk holds nothing
                    <field.ReadOnlyField label={contentLabel} text={_("The disk is empty")} />
                  ) : (
                    <field.DropdownField
                      label={contentLabel}
                      // TRANSLATORS: shown in the existing content field until
                      // an option is picked
                      placeholder={_("Select an option")}
                      options={existingContentOptions()}
                      helperText={
                        disk &&
                        field.state.value === EXISTING_CONTENT.DELETE && (
                          <DataLossNote disk={disk} />
                        )
                      }
                    />
                  )
                }
              </form.AppField>
            );
          }}
        </form.Subscribe>
      </FieldsRow>
    );

    if (isEmpty(customDisks)) return fields;

    const customDiskNames = () => <DiskNames names={customDisks.map((name) => baseName(name))} />;

    return (
      <form.Subscribe selector={(s) => customStorage(s.values, data)}>
        {(state) => (
          <PreservedValueField
            preservedMessage={
              <Interpolate
                sentence={
                  // TRANSLATORS: tells the storage was set up on the storage
                  // page. %s is the list of disks (e.g. "sda, sdb").
                  _("Custom setup on %s.")
                }
              >
                {customDiskNames}
              </Interpolate>
            }
            isPreserving={state === "kept"}
            // TRANSLATORS: button to set up the storage again here, in place of
            // the setup made on the storage page told before it
            changeButtonLabel={_("Replace")}
            isCompact
            onEdit={replacesCustomStorage}
            onRestore={
              state === "replaced"
                ? () => form.setFieldValue("keepsCustomStorage", true)
                : undefined
            }
            restoreMessage={
              <Interpolate
                sentence={
                  // TRANSLATORS: shown with the disk fields when they replace
                  // the storage setup made on the storage page, followed by a
                  // button to keep it. %s is the list of disks (e.g. "sda, sdb").
                  _("The current setup on %s will be replaced.")
                }
              >
                {customDiskNames}
              </Interpolate>
            }
            // TRANSLATORS: keeps the storage setup made on the storage page,
            // instead of replacing it ("it" is that setup)
            restoreButtonLabel={_("Keep it")}
          >
            {fields}
          </PreservedValueField>
        )}
      </form.Subscribe>
    );
  },
});

export default StorageFields;
