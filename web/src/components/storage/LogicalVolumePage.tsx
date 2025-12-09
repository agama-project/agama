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

import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ActionGroup,
  Content,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Stack,
  StackItem,
  TextInput,
} from "@patternfly/react-core";
import { Page, SelectWrapper as Select, SubtleContent } from "~/components/core/";
import SelectTypeaheadCreatable from "~/components/core/SelectTypeaheadCreatable";
import AutoSizeText from "~/components/storage/AutoSizeText";
import SizeModeSelect, { SizeMode, SizeRange } from "~/components/storage/SizeModeSelect";
import { deviceSize, parseToBytes } from "~/components/storage/utils";
import { useApiModel, useSolvedApiModel } from "~/hooks/storage/api-model";
import { useVolume } from "~/hooks/storage/product";
import { useVolumeGroup } from "~/hooks/storage/volume-group";
import { useAddLogicalVolume, useEditLogicalVolume } from "~/hooks/storage/logical-volume";
import { addLogicalVolume, editLogicalVolume } from "~/helpers/storage/logical-volume";
import { buildLogicalVolumeName } from "~/helpers/storage/api-model";
import { apiModel } from "~/api/storage/types";
import { data } from "~/types/storage";
import { STORAGE as PATHS } from "~/routes/paths";
import { compact } from "~/utils";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";
import {
  NO_VALUE,
  useMountPointError,
  useUnusedMountPoints,
  useErrorsHandler,
  buildFilesystemConfig,
  extractFilesystemValue,
  mountPointSelectOptions,
  useAutoRefreshFilesystem,
  validateSize,
} from "~/components/storage/shared/device-config-logic";
import {
  FilesystemLabel,
  FilesystemSelect,
  MountPointField,
} from "~/components/storage/shared/device-config-components";

type SizeOptionValue = "" | SizeMode;
type FormValue = {
  mountPoint: string;
  name: string;
  filesystem: string;
  filesystemLabel: string;
  sizeOption: SizeOptionValue;
  minSize: string;
  maxSize: string;
};

function toData(value: FormValue): data.LogicalVolume {
  const filesystem = buildFilesystemConfig(value.filesystem, value.filesystemLabel);

  const size = (): apiModel.Size | undefined => {
    if (value.sizeOption === "auto") return undefined;
    if (value.minSize === NO_VALUE) return undefined;

    return {
      default: false,
      min: parseToBytes(value.minSize),
      max: value.maxSize === NO_VALUE ? undefined : parseToBytes(value.maxSize),
    };
  };

  return {
    mountPath: value.mountPoint,
    lvName: value.name,
    filesystem: filesystem,
    size: size(),
  };
}

function toFormValue(logicalVolume: apiModel.LogicalVolume): FormValue {
  const mountPoint = logicalVolume.mountPath || NO_VALUE;
  const filesystem = extractFilesystemValue(logicalVolume.filesystem);
  const filesystemLabel = logicalVolume.filesystem?.label || NO_VALUE;

  const sizeOption = (): SizeOptionValue => {
    const size = logicalVolume.size;
    if (!size || size.default) return "auto";
    return "custom";
  };

  const size = (value: number | undefined): string =>
    value ? deviceSize(value, { exact: true }) : NO_VALUE;

  return {
    mountPoint,
    name: logicalVolume.lvName,
    filesystem,
    filesystemLabel,
    sizeOption: sizeOption(),
    minSize: size(logicalVolume.size?.min),
    maxSize: size(logicalVolume.size?.max),
  };
}

function useInitialLogicalVolume(): apiModel.LogicalVolume | null {
  const { id: vgName, logicalVolumeId: mountPath } = useParams();
  const volumeGroup = useVolumeGroup(vgName);

  if (!volumeGroup || !mountPath) return null;

  const logicalVolume = volumeGroup.logicalVolumes.find((l) => l.mountPath === mountPath);
  return logicalVolume || null;
}

function useInitialFormValue(): FormValue | null {
  const logicalVolume = useInitialLogicalVolume();
  return useMemo(() => (logicalVolume ? toFormValue(logicalVolume) : null), [logicalVolume]);
}

function checkLogicalVolumeName(name: string) {
  if (name?.length) return;

  return {
    id: "logicalVolumeName",
    message: _("Enter a name"),
    isVisible: true,
  };
}

function useErrors(value: FormValue) {
  const initialLogicalVolume = useInitialLogicalVolume();
  const mountPointError = useMountPointError(value.mountPoint, initialLogicalVolume?.mountPath);
  const nameError = checkLogicalVolumeName(value.name);
  const sizeError = validateSize(value.sizeOption, value.minSize, value.maxSize);
  const errors = compact([mountPointError, nameError, sizeError]);
  return useErrorsHandler(errors);
}

function useSolvedModel(value: FormValue): apiModel.Config | null {
  const { id: vgName, logicalVolumeId: mountPath } = useParams();
  const apiModel = useApiModel();
  const { getError } = useErrors(value);
  const mountPointError = getError("mountPoint");
  const data = toData(value);
  
  // Avoid recalculating the solved model because changes in label.
  if (data.filesystem) data.filesystem.label = undefined;
  // Avoid recalculating the solved model because changes in name.
  data.lvName = undefined;

  let sparseModel: apiModel.Config | undefined;

  if (data.filesystem && !mountPointError) {
    if (mountPath) {
      sparseModel = editLogicalVolume(apiModel, vgName, mountPath, data);
    } else {
      sparseModel = addLogicalVolume(apiModel, vgName, data);
    }
  }

  return useSolvedApiModel(sparseModel);
}

function useSolvedLogicalVolume(value: FormValue): apiModel.LogicalVolume | undefined {
  const { id: vgName } = useParams();
  const apiModel = useSolvedModel(value);
  const volumeGroup = apiModel?.volumeGroups?.find((v) => v.vgName === vgName);
  return volumeGroup?.logicalVolumes?.find((l) => l.mountPath === value.mountPoint);
}

function useSolvedSizes(value: FormValue): SizeRange {
  const valueWithoutSizes: FormValue = {
    ...value,
    sizeOption: NO_VALUE,
    minSize: NO_VALUE,
    maxSize: NO_VALUE,
  };

  const logicalVolume = useSolvedLogicalVolume(valueWithoutSizes);

  return useMemo(() => {
    const min = logicalVolume?.size?.min;
    const max = logicalVolume?.size?.max;

    return {
      min: min ? deviceSize(min) : NO_VALUE,
      max: max ? deviceSize(max) : NO_VALUE,
    };
  }, [logicalVolume]);
}

function useAutoRefreshSize(handler, value: FormValue) {
  const solvedSizes = useSolvedSizes(value);

  useEffect(() => {
    handler("auto", solvedSizes.min, solvedSizes.max);
  }, [handler, solvedSizes]);
}

type LogicalVolumeNameProps = {
  id?: string;
  value: FormValue;
  mountPoint: string;
  onChange: (v: string) => void;
};

function LogicalVolumeName({
  id,
  value,
  mountPoint,
  onChange,
}: LogicalVolumeNameProps): React.ReactNode {
  const { getVisibleError } = useErrors(value);
  const error = getVisibleError("logicalVolumeName");
  const isDisabled = mountPoint === NO_VALUE;

  return (
    <FormGroup fieldId="name" label={_("Logical volume name")}>
      <TextInput
        id={id}
        aria-label={_("Logical volume name")}
        isDisabled={isDisabled}
        value={isDisabled ? _("Waiting for a mount point") : value.name}
        onChange={(_, v) => onChange(v)}
      />
      {error && !isDisabled && (
        <FormHelperText>
          <HelperText>
            <HelperTextItem variant="error" screenReaderText="">
              {error.message}
            </HelperTextItem>
          </HelperText>
        </FormHelperText>
      )}
    </FormGroup>
  );
}

type AutoSizeInfoProps = {
  value: FormValue;
};

function AutoSizeInfo({ value }: AutoSizeInfoProps): React.ReactNode {
  const volume = useVolume(value.mountPoint);
  const logicalVolume = useSolvedLogicalVolume(value);
  const size = logicalVolume?.size;

  if (!size) return;

  return (
    <SubtleContent>
      <AutoSizeText volume={volume} size={size} deviceType="logicalVolume" />
    </SubtleContent>
  );
}

export default function LogicalVolumePage() {
  const navigate = useNavigate();
  const headingId = useId();
  const { id: vgName } = useParams();
  const addLogicalVolumeAction = useAddLogicalVolume();
  const editLogicalVolumeAction = useEditLogicalVolume();
  
  const [mountPoint, setMountPoint] = useState(NO_VALUE);
  const [name, setName] = useState(NO_VALUE);
  const [filesystem, setFilesystem] = useState(NO_VALUE);
  const [filesystemLabel, setFilesystemLabel] = useState(NO_VALUE);
  const [sizeOption, setSizeOption] = useState<SizeOptionValue>(NO_VALUE);
  const [minSize, setMinSize] = useState(NO_VALUE);
  const [maxSize, setMaxSize] = useState(NO_VALUE);
  const [autoRefreshFilesystem, setAutoRefreshFilesystem] = useState(false);
  const [autoRefreshSize, setAutoRefreshSize] = useState(false);

  const initialValue = useInitialFormValue();
  const initialLogicalVolume = useInitialLogicalVolume();
  const value = { mountPoint, name, filesystem, filesystemLabel, sizeOption, minSize, maxSize };
  const { errors, getVisibleError } = useErrors(value);
  const unusedMountPoints = useUnusedMountPoints(initialLogicalVolume?.mountPath);

  // Initialize form values
  useEffect(() => {
    if (initialValue) {
      setMountPoint(initialValue.mountPoint);
      setName(initialValue.name);
      setFilesystem(initialValue.filesystem);
      setFilesystemLabel(initialValue.filesystemLabel);
      setSizeOption(initialValue.sizeOption);
      setMinSize(initialValue.minSize);
      setMaxSize(initialValue.maxSize);
    }
  }, [initialValue]);

  const refreshFilesystemHandler = useCallback(
    (filesystem: string) => autoRefreshFilesystem && setFilesystem(filesystem),
    [autoRefreshFilesystem],
  );

  useAutoRefreshFilesystem(refreshFilesystemHandler, mountPoint, autoRefreshFilesystem);

  const refreshSizeHandler = useCallback(
    (sizeOption: SizeOptionValue, minSize: string, maxSize: string) => {
      if (autoRefreshSize) {
        setSizeOption(sizeOption);
        setMinSize(minSize);
        setMaxSize(maxSize);
      }
    },
    [autoRefreshSize],
  );

  useAutoRefreshSize(refreshSizeHandler, value);

  const changeMountPoint = (value: string) => {
    if (value !== mountPoint) {
      setAutoRefreshFilesystem(true);
      setAutoRefreshSize(true);
      setMountPoint(value);
      setName(buildLogicalVolumeName(value));
    }
  };

  const changeFilesystem = (value: string) => {
    setAutoRefreshFilesystem(false);
    setAutoRefreshSize(false);
    setFilesystem(value);
  };

  const changeSizeMode = (mode: SizeMode, size: SizeRange) => {
    setSizeOption(mode);
    setMinSize(size.min);
    if (mode === "custom" && initialValue?.sizeOption === "auto" && size.min !== size.max) {
      setMaxSize("");
    } else {
      setMaxSize(size.max);
    }
  };

  const onSubmit = () => {
    const data = toData(value);

    if (initialValue) {
      editLogicalVolumeAction(vgName, initialValue.mountPoint, data);
    } else {
      addLogicalVolumeAction(vgName, data);
    }

    navigate(PATHS.root);
  };

  const isFormValid = errors.length === 0;
  const mountPointError = getVisibleError("mountPoint");
  const usedMountPt = mountPointError ? NO_VALUE : mountPoint;
  const showLabel = filesystem !== NO_VALUE && usedMountPt !== NO_VALUE;
  const sizeMode: SizeMode = sizeOption === "" ? "auto" : sizeOption;
  const sizeRange: SizeRange = { min: minSize, max: maxSize };

  return (
    <Page id="logicalVolumePage">
      <Page.Header>
        <Content component="h2" id={headingId}>
          {sprintf(_("Configure LVM logical volume at %s volume group"), vgName)}
        </Content>
      </Page.Header>

      <Page.Content>
        <Form id="logicalVolumeForm" aria-labelledby={headingId} onSubmit={onSubmit}>
          <Stack hasGutter>
            <StackItem>
              <Flex>
                <FlexItem>
                  <MountPointField
                    value={mountPoint}
                    options={mountPointSelectOptions(unusedMountPoints)}
                    error={mountPointError}
                    onChange={changeMountPoint}
                    SelectComponent={SelectTypeaheadCreatable}
                  />
                </FlexItem>
              </Flex>
            </StackItem>

            <StackItem>
              <Flex>
                <FlexItem>
                  <LogicalVolumeName
                    id="name"
                    value={value}
                    mountPoint={usedMountPt}
                    onChange={setName}
                  />
                </FlexItem>
              </Flex>
            </StackItem>

            <StackItem>
              <FormGroup>
                <Flex>
                  <FlexItem>
                    <FormGroup fieldId="fileSystem" label={_("File system")}>
                      <FilesystemSelect
                        id="fileSystem"
                        value={filesystem}
                        mountPoint={usedMountPt}
                        formatText={_("Format logical volume as")}
                        onChange={changeFilesystem}
                      />
                    </FormGroup>
                  </FlexItem>
                  {showLabel && (
                    <FlexItem>
                      <FormGroup fieldId="fileSystemLabel" label={_("Label")}>
                        <FilesystemLabel
                          id="fileSystemLabel"
                          value={filesystemLabel}
                          onChange={setFilesystemLabel}
                        />
                      </FormGroup>
                    </FlexItem>
                  )}
                </Flex>
              </FormGroup>
            </StackItem>

            <StackItem>
              <FormGroup fieldId="sizeMode" label={_("Size mode")}>
                {usedMountPt === NO_VALUE && (
                  <Select
                    id="sizeMode"
                    value={NO_VALUE}
                    label={_("Waiting for a mount point")}
                    isDisabled
                  />
                )}
                {usedMountPt !== NO_VALUE && (
                  <SizeModeSelect
                    id="sizeMode"
                    value={sizeMode}
                    size={sizeRange}
                    onChange={changeSizeMode}
                    automaticHelp={<AutoSizeInfo value={value} />}
                  />
                )}
              </FormGroup>
            </StackItem>

            <ActionGroup>
              <Page.Submit isDisabled={!isFormValid} form="logicalVolumeForm" />
              <Page.Cancel />
            </ActionGroup>
          </Stack>
        </Form>
      </Page.Content>
    </Page>
  );
}
