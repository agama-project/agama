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

import React, { useId } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ActionGroup,
  Content,
  Divider,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  Label,
  SelectGroup,
  SelectList,
  SelectOption,
  Split,
  SplitItem,
  Stack,
} from "@patternfly/react-core";
import { Page, SelectWrapper as Select, SubtleContent } from "~/components/core/";
import SelectTypeaheadCreatable from "~/components/core/SelectTypeaheadCreatable";
import AutoSizeText from "~/components/storage/AutoSizeText";
import SizeModeSelect, { SizeMode, SizeRange } from "~/components/storage/SizeModeSelect";
import AlertOutOfSync from "~/components/core/AlertOutOfSync";
import ResourceNotFound from "~/components/core/ResourceNotFound";
import { useAddPartition, useEditPartition } from "~/hooks/storage/partition";
import { useModel } from "~/hooks/storage/model";
import {
  addPartition as addPartitionHelper,
  editPartition as editPartitionHelper,
} from "~/helpers/storage/partition";
import { useDevices, useVolume } from "~/queries/storage";
import { useConfigModel, useSolvedConfigModel } from "~/queries/storage/config-model";
import { findDevice } from "~/helpers/storage/api-model";
import { StorageDevice } from "~/types/storage";
import { deviceSize, deviceLabel, parseToBytes } from "~/components/storage/utils";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { apiModel } from "~/api/storage/types";
import { STORAGE as PATHS, STORAGE } from "~/routes/paths";
import { isUndefined } from "radashi";
import { compact } from "~/utils";
import {
  NO_VALUE,
  REUSE_FILESYSTEM,
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

const NEW_PARTITION = "new";

type SizeOptionValue = "" | SizeMode;
type FormValue = {
  mountPoint: string;
  target: string;
  filesystem: string;
  filesystemLabel: string;
  sizeOption: SizeOptionValue;
  minSize: string;
  maxSize: string;
};

function toPartitionConfig(value: FormValue): apiModel.Partition {
  const name = (): string | undefined => {
    if (value.target === NO_VALUE || value.target === NEW_PARTITION) return undefined;
    return value.target;
  };

  const filesystem = buildFilesystemConfig(
    value.filesystem,
    value.filesystemLabel,
    true // Can reuse filesystem
  );

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
    name: name(),
    filesystem: filesystem,
    size: size(),
  };
}

function toFormValue(partitionConfig: apiModel.Partition): FormValue {
  const mountPoint = partitionConfig.mountPath || NO_VALUE;
  const target = partitionConfig.name || NEW_PARTITION;
  const filesystem = extractFilesystemValue(partitionConfig.filesystem, true);
  const filesystemLabel = partitionConfig.filesystem?.label || NO_VALUE;

  const sizeOption = (): SizeOptionValue => {
    const reusePartition = partitionConfig.name !== undefined;
    const sizeConfig = partitionConfig.size;
    if (reusePartition) return NO_VALUE;
    if (!sizeConfig || sizeConfig.default) return "auto";
    return "custom";
  };

  const size = (value: number | undefined): string =>
    value ? deviceSize(value, { exact: true }) : NO_VALUE;

  return {
    mountPoint,
    target,
    filesystem,
    filesystemLabel,
    sizeOption: sizeOption(),
    minSize: size(partitionConfig.size?.min),
    maxSize: size(partitionConfig.size?.max),
  };
}

function useModelDevice() {
  const { list, listIndex } = useParams();
  const model = useModel({ suspense: true });
  return model[list].at(listIndex);
}

function useDevice(): StorageDevice {
  const modelDevice = useModelDevice();
  const devices = useDevices("system", { suspense: true });
  return devices.find((d) => d.name === modelDevice.name);
}

function usePartition(target: string): StorageDevice | null {
  const device = useDevice();

  if (target === NEW_PARTITION) return null;

  const partitions = device.partitionTable?.partitions || [];
  return partitions.find((p: StorageDevice) => p.name === target);
}

function usePartitionFilesystem(target: string): string | null {
  const partition = usePartition(target);
  return partition?.filesystem?.type || null;
}

function useInitialPartitionConfig(): apiModel.Partition | null {
  const { partitionId: mountPath } = useParams();
  const device = useModelDevice();

  return mountPath && device ? device.getPartition(mountPath) : null;
}

function useInitialFormValue(): FormValue | null {
  const partitionConfig = useInitialPartitionConfig();
  return React.useMemo(
    () => (partitionConfig ? toFormValue(partitionConfig) : null),
    [partitionConfig],
  );
}

function useUnusedPartitions(): StorageDevice[] {
  const device = useDevice();
  const allPartitions = device.partitionTable?.partitions || [];
  const initialPartitionConfig = useInitialPartitionConfig();
  const configuredPartitionConfigs = useModelDevice()
    .getConfiguredExistingPartitions()
    .filter((p) => p.name !== initialPartitionConfig?.name)
    .map((p) => p.name);

  return allPartitions.filter((p) => !configuredPartitionConfigs.includes(p.name));
}

function useErrors(value: FormValue) {
  const initialPartitionConfig = useInitialPartitionConfig();
  const mountPointError = useMountPointError(value.mountPoint, initialPartitionConfig?.mountPath);
  const sizeError = validateSize(value.sizeOption, value.minSize, value.maxSize);
  const errors = compact([mountPointError, sizeError]);
  return useErrorsHandler(errors);
}

function useSolvedModel(value: FormValue): apiModel.Config | null {
  const device = useModelDevice();
  const model = useConfigModel();
  const { errors } = useErrors(value);
  const initialPartitionConfig = useInitialPartitionConfig();
  const partitionConfig = toPartitionConfig(value);
  partitionConfig.size = undefined;
  if (partitionConfig.filesystem) partitionConfig.filesystem.label = undefined;

  let sparseModel: apiModel.Config | undefined;

  if (device && !errors.length && value.target === NEW_PARTITION && value.filesystem !== NO_VALUE) {
    if (initialPartitionConfig) {
      sparseModel = editPartitionHelper(
        model,
        device.list,
        device.listIndex,
        initialPartitionConfig.mountPath,
        partitionConfig,
      );
    } else {
      sparseModel = addPartitionHelper(model, device.list, device.listIndex, partitionConfig);
    }
  }

  return useSolvedConfigModel(sparseModel);
}

function useSolvedPartitionConfig(value: FormValue): apiModel.Partition | undefined {
  const model = useSolvedModel(value);
  const { list, listIndex } = useModelDevice();
  if (!model) return;

  const container = findDevice(model, list, listIndex);
  return container?.partitions?.find((p) => p.mountPath === value.mountPoint);
}

function useSolvedSizes(value: FormValue): SizeRange {
  const valueWithoutSizes: FormValue = {
    ...value,
    sizeOption: NO_VALUE,
    minSize: NO_VALUE,
    maxSize: NO_VALUE,
  };

  const solvedPartitionConfig = useSolvedPartitionConfig(valueWithoutSizes);

  return React.useMemo(() => {
    const min = solvedPartitionConfig?.size?.min;
    const max = solvedPartitionConfig?.size?.max;

    return {
      min: min ? deviceSize(min) : NO_VALUE,
      max: max ? deviceSize(max) : NO_VALUE,
    };
  }, [solvedPartitionConfig]);
}

function useAutoRefreshSize(handler, value: FormValue) {
  const target = value.target;
  const solvedSizes = useSolvedSizes(value);

  React.useEffect(() => {
    const sizeOption = target === NEW_PARTITION ? "auto" : "";
    handler(sizeOption, solvedSizes.min, solvedSizes.max);
  }, [handler, target, solvedSizes]);
}

type TargetOptionLabelProps = {
  value: string;
};

function TargetOptionLabel({ value }: TargetOptionLabelProps): React.ReactNode {
  const device = useDevice();
  const partition = usePartition(value);

  if (value === NEW_PARTITION) {
    return sprintf(_("As a new partition on %s"), deviceLabel(device, true));
  } else {
    return sprintf(_("Using partition %s"), deviceLabel(partition, true));
  }
}

type PartitionDescriptionProps = {
  partition: StorageDevice;
};

function PartitionDescription({ partition }: PartitionDescriptionProps): React.ReactNode {
  const label = partition.filesystem?.label;

  return (
    <Split hasGutter>
      <SplitItem>{partition.description}</SplitItem>
      {label && (
        <SplitItem>
          <Label isCompact variant="outline">
            {label}
          </Label>
        </SplitItem>
      )}
    </Split>
  );
}

function TargetOptions(): React.ReactNode {
  const partitions = useUnusedPartitions();

  return (
    <SelectList aria-label={_("Mount point options")}>
      <SelectOption value={NEW_PARTITION}>
        <TargetOptionLabel value={NEW_PARTITION} />
      </SelectOption>
      <Divider />
      <SelectGroup label={_("Using an existing partition")}>
        {partitions.map((partition, index) => (
          <SelectOption
            key={index}
            value={partition.name}
            description={<PartitionDescription partition={partition} />}
          >
            {deviceLabel(partition)}
          </SelectOption>
        ))}
        {partitions.length === 0 && (
          <SelectOption isDisabled>{_("There are not usable partitions")}</SelectOption>
        )}
      </SelectGroup>
    </SelectList>
  );
}

type AutoSizeInfoProps = {
  value: FormValue;
};

function AutoSizeInfo({ value }: AutoSizeInfoProps): React.ReactNode {
  const volume = useVolume(value.mountPoint);
  const solvedPartitionConfig = useSolvedPartitionConfig(value);
  const size = solvedPartitionConfig?.size;

  if (!size) return;

  return (
    <SubtleContent>
      <AutoSizeText volume={volume} size={size} deviceType="partition" />
    </SubtleContent>
  );
}

const PartitionPageForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const headingId = useId();
  
  const [mountPoint, setMountPoint] = React.useState(NO_VALUE);
  const [target, setTarget] = React.useState(NEW_PARTITION);
  const [filesystem, setFilesystem] = React.useState(NO_VALUE);
  const [filesystemLabel, setFilesystemLabel] = React.useState(NO_VALUE);
  const [sizeOption, setSizeOption] = React.useState<SizeOptionValue>(NO_VALUE);
  const [minSize, setMinSize] = React.useState(NO_VALUE);
  const [maxSize, setMaxSize] = React.useState(NO_VALUE);
  const [autoRefreshFilesystem, setAutoRefreshFilesystem] = React.useState(false);
  const [autoRefreshSize, setAutoRefreshSize] = React.useState(false);

  const initialValue = useInitialFormValue();
  const value = { mountPoint, target, filesystem, filesystemLabel, sizeOption, minSize, maxSize };
  const { errors, getVisibleError } = useErrors(value);

  const device = useModelDevice();
  const initialPartitionConfig = useInitialPartitionConfig();
  const unusedMountPoints = useUnusedMountPoints(initialPartitionConfig?.mountPath);
  const partitionFilesystem = usePartitionFilesystem(target);

  const addPartition = useAddPartition();
  const editPartition = useEditPartition();

  // Initialize form values
  React.useEffect(() => {
    if (initialValue) {
      setMountPoint(initialValue.mountPoint);
      setTarget(initialValue.target);
      setFilesystem(initialValue.filesystem);
      setFilesystemLabel(initialValue.filesystemLabel);
      setSizeOption(initialValue.sizeOption);
      setMinSize(initialValue.minSize);
      setMaxSize(initialValue.maxSize);
    }
  }, [initialValue]);

  const refreshFilesystemHandler = React.useCallback(
    (filesystem: string) => autoRefreshFilesystem && setFilesystem(filesystem),
    [autoRefreshFilesystem],
  );

  useAutoRefreshFilesystem(
    refreshFilesystemHandler,
    mountPoint,
    autoRefreshFilesystem,
    () => (target === NEW_PARTITION ? null : partitionFilesystem),
  );

  const refreshSizeHandler = React.useCallback(
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
    }
  };

  const changeTarget = (value: string) => {
    setAutoRefreshFilesystem(true);
    setAutoRefreshSize(true);
    setTarget(value);
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
    const partitionConfig = toPartitionConfig(value);
    const { list, listIndex } = device;

    if (initialValue) {
      editPartition(list, listIndex, initialValue.mountPoint, partitionConfig);
    } else {
      addPartition(list, listIndex, partitionConfig);
    }

    navigate({ pathname: PATHS.root, search: location.search });
  };

  const isFormValid = errors.length === 0;
  const mountPointError = getVisibleError("mountPoint");
  const usedMountPt = mountPointError ? NO_VALUE : mountPoint;
  const showLabel = filesystem !== NO_VALUE && filesystem !== REUSE_FILESYSTEM;
  const sizeMode: SizeMode = sizeOption === "" ? "auto" : sizeOption;
  const sizeRange: SizeRange = { min: minSize, max: maxSize };

  return (
    <Page id="partitionPage">
      <Page.Header>
        <Content component="h2" id={headingId}>
          {sprintf(_("Configure partition at %s"), device.name)}
        </Content>
      </Page.Header>

      <Page.Content>
        <AlertOutOfSync scope="Storage" />
        <Form id="partitionForm" aria-labelledby={headingId} onSubmit={onSubmit}>
          <Stack hasGutter>
            <FormGroup fieldId="mountPoint" label={_("Mount point")}>
              <Flex>
                <FlexItem>
                  <SelectTypeaheadCreatable
                    id="mountPoint"
                    toggleName={_("Mount point toggle")}
                    listName={_("Suggested mount points")}
                    inputName={_("Mount point")}
                    clearButtonName={_("Clear selected mount point")}
                    value={mountPoint}
                    options={mountPointSelectOptions(unusedMountPoints)}
                    createText={_("Use")}
                    onChange={changeMountPoint}
                  />
                </FlexItem>
                <FlexItem>
                  <Select
                    toggleName={_("Mount point mode")}
                    value={target}
                    label={<TargetOptionLabel value={target} />}
                    onChange={changeTarget}
                  >
                    <TargetOptions />
                  </Select>
                </FlexItem>
              </Flex>
              {mountPointError && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem variant="error" screenReaderText="">
                      {mountPointError.message}
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>
              )}
            </FormGroup>

            <FormGroup>
              <Flex>
                <FlexItem>
                  <FormGroup fieldId="fileSystem" label={_("File system")}>
                    <FilesystemSelect
                      id="fileSystem"
                      value={filesystem}
                      mountPoint={usedMountPt}
                      currentFilesystem={partitionFilesystem}
                      canReuse={target !== NEW_PARTITION}
                      formatText={
                        partitionFilesystem
                          ? _("Destroy current data and format partition as")
                          : _("Format partition as")
                      }
                      reuseDescription={sprintf(_("Do not format %s and keep the data"), target)}
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

            {target === NEW_PARTITION && (
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
            )}

            <ActionGroup>
              <Page.Submit isDisabled={!isFormValid} form="partitionForm" />
              <Page.Cancel />
            </ActionGroup>
          </Stack>
        </Form>
      </Page.Content>
    </Page>
  );
};

export default function PartitionPage() {
  const device = useModelDevice();

  return isUndefined(device) ? (
    <ResourceNotFound linkText={_("Go to storage page")} linkPath={STORAGE.root} />
  ) : (
    <PartitionPageForm />
  );
}
