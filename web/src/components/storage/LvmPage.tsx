/*
 * Copyright (c) [2025-2026] SUSE LLC
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

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
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
import { useAvailableDevices } from "~/hooks/model/system/storage";
import { deviceLabel } from "./utils";
import { contentDescription, filesystemLabels, typeDescription } from "./utils/device";
import { STORAGE } from "~/routes/paths";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";
import { deviceSystems, isDrive } from "~/model/storage/device";
import configModel from "~/model/storage/config-model";
import {
  useConfigModel,
  useVolumeGroup,
  useAddVolumeGroup,
  useEditVolumeGroup,
} from "~/hooks/model/storage/config-model";
import type { ConfigModel, Data } from "~/model/storage/config-model";
import type { Storage } from "~/model/system";

/**
 * Hook that returns the devices that can be selected as target to automatically create LVM PVs.
 *
 * Filters out devices that are going to be directly formatted.
 */
function useLvmTargetDevices(): Storage.Device[] {
  const availableDevices = useAvailableDevices();
  const config = useConfigModel();

  const targetDevices = useMemo(() => {
    return availableDevices.filter((candidate) => {
      const collection = isDrive(candidate) ? config.drives : config.mdRaids;
      const device = collection.find((d) => d.name === candidate.name);
      return !device || !device.filesystem;
    });
  }, [availableDevices, config]);

  return targetDevices;
}

function vgNameError(
  vgName: string,
  config: ConfigModel.Config,
  volumeGroup?: ConfigModel.VolumeGroup,
): string | undefined {
  if (!vgName.length) return _("Enter a name for the volume group.");

  const exist = config.volumeGroups.some((v) => v.vgName === vgName);
  if (exist && vgName !== volumeGroup?.vgName)
    return sprintf(_("Volume group '%s' already exists. Enter a different name."), vgName);
}

function targetDevicesError(targetDevices: Storage.Device[]): string | undefined {
  if (!targetDevices.length) return _("Select at least one disk.");
}

/**
 * Form for configuring a LVM volume group.
 *
 * @todo Adapt states to use a data.VolumeGroup type and initializes its value from a
 * model.VolumeGroup (build data.VolumeGroup from model.VolumeGroup).
 */
export default function LvmPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const config = useConfigModel();
  const volumeGroup = useVolumeGroup(id);
  const addVolumeGroup = useAddVolumeGroup();
  const editVolumeGroup = useEditVolumeGroup();
  const allDevices = useLvmTargetDevices();
  const [name, setName] = useState("");
  const [selectedDevices, setSelectedDevices] = useState<Storage.Device[]>([]);
  const [moveMountPoints, setMoveMountPoints] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (volumeGroup) {
      setName(volumeGroup.vgName);
      const targetNames = configModel.volumeGroup
        .filterTargetDevices(config, volumeGroup)
        .map((d) => d.name);
      const targetDevices = allDevices.filter((d) => targetNames.includes(d.name));
      setSelectedDevices(targetDevices);
    } else if (config && !config.volumeGroups.length) {
      setName("system");
      const potentialTargets = config.drives.concat(config.mdRaids);
      const targetNames = potentialTargets
        .filter(configModel.partitionable.isAddingPartitions)
        .map((d) => d.name);
      const targetDevices = allDevices.filter((d) => targetNames.includes(d.name));
      setSelectedDevices(targetDevices);
    }
  }, [config, volumeGroup, allDevices]);

  const updateName = (_, value) => setName(value);

  const updateSelectedDevices = (value) => {
    setSelectedDevices(
      selectedDevices.includes(value)
        ? selectedDevices.filter((d) => d !== value)
        : [...selectedDevices, value],
    );
  };

  const checkErrors = (): string[] => {
    return [vgNameError(name, config, volumeGroup), targetDevicesError(selectedDevices)].filter(
      (e) => e,
    );
  };

  const onSubmit = (e) => {
    e.preventDefault();

    const errors = checkErrors();
    setErrors(errors);

    if (errors.length) return;

    const data: Data.VolumeGroup = {
      vgName: name,
      targetDevices: selectedDevices.map((d) => d.name),
    };

    if (!volumeGroup) {
      addVolumeGroup(data, moveMountPoints);
    } else {
      editVolumeGroup(volumeGroup.vgName, data);
    }

    navigate(STORAGE.root);
  };

  return (
    <Page
      breadcrumbs={[
        { label: _("Storage"), path: STORAGE.root },
        { label: _("LVM") },
        { label: _("Configure Volume Group") },
      ]}
    >
      <Page.Content>
        <Form id="lvmForm" onSubmit={onSubmit}>
          {errors.length > 0 && (
            <Alert variant="warning" isInline title={_("Check the following before continuing")}>
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
                "The needed LVM physical volumes will be added as partitions on the chosen disks, " +
                  "based on the sizes of the logical volumes. If you select more than one disk, the " +
                  "physical volumes may be distributed along several disks.",
              )}
            </Content>
            <Gallery hasGutter>
              {allDevices.map((device) => (
                <Checkbox
                  key={device.sid}
                  id={`device${device.sid}`}
                  label={<Content isEditorial>{deviceLabel(device, true)}</Content>}
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
                      {deviceSystems(device).map((s, i) => (
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
          {!volumeGroup && (
            <FormGroup label={_("Move mount points")} isStack>
              <Checkbox
                id="moveMountPoints"
                label={_(
                  "Move the mount points currently configured at the selected disks to logical " +
                    "volumes of this volume group.",
                )}
                isChecked={moveMountPoints}
                onChange={(_, v) => setMoveMountPoints(v)}
              />
            </FormGroup>
          )}
          <ActionGroup>
            <Page.Submit form="lvmForm" />
            <Page.Cancel />
          </ActionGroup>
        </Form>
      </Page.Content>
    </Page>
  );
}
