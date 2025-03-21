/*
 * Copyright (c) [2025] SUSE LLC
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

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ActionGroup,
  Alert,
  Checkbox,
  Content,
  Flex,
  Form,
  FormGroup,
  Gallery,
  Label,
  TextInput,
} from "@patternfly/react-core";
import { Page, SubtleContent } from "~/components/core";
import { useAvailableDevices } from "~/queries/storage";
import { StorageDevice, model } from "~/types/storage";
import useModel from "~/hooks/storage/model";
import useAddVolumeGroup from "~/hooks/storage/add-volume-group";
import { deviceLabel } from "./utils";
import { contentDescription, filesystemLabels, typeDescription } from "./utils/device";
import { STORAGE as PATHS } from "~/routes/paths";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";

function checkErrors(model: model.Model, vgName: string, targetDevices: StorageDevice[]): string[] {
  const vgNameError = (): string | undefined => {
    if (!vgName.length) return sprintf(_("Name is empty"), vgName);

    const exist = model.volumeGroups.some((v) => v.vgName === vgName);
    if (exist) return sprintf(_("'%s' already exists"), vgName);
  };

  const targetDevicesError = (): string | undefined => {
    if (!targetDevices.length) return _("No disk is selected");
  };

  return [vgNameError(), targetDevicesError()].filter((d) => d);
}

/**
 * Form for creating a LVM volume group
 */
export default function LvmPage() {
  const navigate = useNavigate();
  const model = useModel();
  const addVolumeGroup = useAddVolumeGroup();
  const allDevices = useAvailableDevices();
  const [name, setName] = useState("");
  const [selectedDevices, setSelectedDevices] = useState<StorageDevice[]>([]);
  const [moveMountPoints, setMoveMountPoints] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (model && !model.volumeGroups.length) setName("system");
  }, [model]);

  const updateName = (_, value) => setName(value);
  const updateSelectedDevices = (value) => {
    setSelectedDevices(
      selectedDevices.includes(value)
        ? selectedDevices.filter((d) => d !== value)
        : [...selectedDevices, value],
    );
  };

  const onSubmit = (e) => {
    e.preventDefault();

    const errors = checkErrors(model, name, selectedDevices);
    setErrors(errors);

    if (errors.length) return;

    addVolumeGroup(
      name,
      selectedDevices.map((d) => d.name),
      moveMountPoints,
    );
    navigate(PATHS.root);
  };

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Configure LVM Volume Group")}</Content>
      </Page.Header>

      <Page.Content>
        <Form id="lvmForm" onSubmit={onSubmit}>
          {errors.length > 0 && (
            <Alert variant="warning" isInline title={_("Something went wrong")}>
              {errors.map((e, i) => (
                <p key={`error_${i}`}>{e}</p>
              ))}
            </Alert>
          )}
          <FormGroup fieldId="lvmName" label={_("Name")} isStack>
            <TextInput id="lvmName" value={name} onChange={updateName} />
          </FormGroup>
          <FormGroup label={_("Disks")} role="group" style={{ justifySelf: "stretch" }} isStack>
            <Content component="small">
              {_(
                "The needed LVM physical volumes will be added as partitions on the chosen disks, \
                based on the sizes of the logical volumes. If you select more than one disk, the \
                physical volumes may be distributed along several disks.",
              )}
            </Content>
            <Gallery hasGutter>
              {allDevices.map((device) => (
                <Checkbox
                  key={device.sid}
                  id={`device${device.sid}`}
                  label={<Content isEditorial>{deviceLabel(device)}</Content>}
                  description={
                    <Flex rowGap={{ default: "rowGapXs" }} columnGap={{ default: "columnGapSm" }}>
                      <SubtleContent>
                        {typeDescription(device)} {contentDescription(device)}
                      </SubtleContent>
                      {filesystemLabels(device).map((s, i) => (
                        <Label key={i} variant="outline" isCompact>
                          {s}
                        </Label>
                      ))}
                      {device.systems.map((s, i) => (
                        <Label key={i} isCompact>
                          {s}
                        </Label>
                      ))}
                    </Flex>
                  }
                  isChecked={selectedDevices.includes(device)}
                  onChange={() => updateSelectedDevices(device)}
                />
              ))}
            </Gallery>
          </FormGroup>
          <FormGroup label={_("Move mount points")} isStack>
            <Checkbox
              id="moveMountPoints"
              label={_(
                "Move the mount points currently configured at the selected disks to logical \
                volumes of this volume group.",
              )}
              isChecked={moveMountPoints}
              onChange={() => setMoveMountPoints(!moveMountPoints)}
            />
          </FormGroup>
          <ActionGroup>
            <Page.Submit form="lvmForm" />
            <Page.Cancel />
          </ActionGroup>
        </Form>
      </Page.Content>
    </Page>
  );
}
