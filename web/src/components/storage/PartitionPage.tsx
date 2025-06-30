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
import { useParams, useNavigate } from "react-router-dom";
import {
  ActionGroup,
  Content,
  Divider,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Label,
  SelectGroup,
  SelectList,
  SelectOption,
  SelectOptionProps,
  Split,
  SplitItem,
  Stack,
  TextInput,
} from "@patternfly/react-core";
import { Page, SelectWrapper as Select, SubtleContent } from "~/components/core/";
import { SelectWrapperProps as SelectProps } from "~/components/core/SelectWrapper";
import SelectTypeaheadCreatable from "~/components/core/SelectTypeaheadCreatable";
import AutoSizeText from "~/components/storage/AutoSizeText";
import { useAddPartition, useEditPartition } from "~/hooks/storage/partition";
import { useMissingMountPaths } from "~/hooks/storage/product";
import { useModel } from "~/hooks/storage/model";
import {
  addPartition as addPartitionHelper,
  editPartition as editPartitionHelper,
} from "~/helpers/storage/partition";
import { useDevices, useVolume } from "~/queries/storage";
import { useConfigModel, useSolvedConfigModel } from "~/queries/storage/config-model";
import { findDevice } from "~/helpers/storage/api-model";
import { StorageDevice } from "~/types/storage";
import { deviceSize, deviceLabel, filesystemLabel, parseToBytes } from "~/components/storage/utils";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { apiModel } from "~/api/storage/types";
import { STORAGE as PATHS } from "~/routes/paths";
import { unique } from "radashi";
import { compact } from "~/utils";
import SizeModeSelect, { SizeMode, SizeRange } from "~/components/storage/SizeModeSelect";

const NO_VALUE = "";
const NEW_PARTITION = "new";
const BTRFS_SNAPSHOTS = "btrfsSnapshots";
const REUSE_FILESYSTEM = "reuse";

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
type Error = {
  id: string;
  message?: string;
  isVisible: boolean;
};

type ErrorsHandler = {
  errors: Error[];
  getError: (id: string) => Error | undefined;
  getVisibleError: (id: string) => Error | undefined;
};

function toPartitionConfig(value: FormValue): apiModel.Partition {
  const name = (): string | undefined => {
    if (value.target === NO_VALUE || value.target === NEW_PARTITION) return undefined;

    return value.target;
  };

  const filesystemType = (): apiModel.FilesystemType | undefined => {
    if (value.filesystem === NO_VALUE) return undefined;
    if (value.filesystem === BTRFS_SNAPSHOTS) return "btrfs";

    /**
     * @note This type cast is needed because the list of filesystems coming from a volume is not
     *  enumerated (the volume simply contains a list of strings). This implies we have to rely on
     *  whatever value coming from such a list as a filesystem type accepted by the config model.
     *  This will be fixed in the future by directly exporting the volumes as a JSON, similar to the
     *  config model. The schema for the volumes will define the explicit list of filesystem types.
     */
    return value.filesystem as apiModel.FilesystemType;
  };

  const filesystem = (): apiModel.Filesystem | undefined => {
    if (value.filesystem === REUSE_FILESYSTEM) return { reuse: true, default: true };

    const type = filesystemType();
    if (type === undefined) return undefined;

    return {
      default: false,
      type,
      snapshots: value.filesystem === BTRFS_SNAPSHOTS,
      label: value.filesystemLabel,
    };
  };

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
    filesystem: filesystem(),
    size: size(),
  };
}

function toFormValue(partitionConfig: apiModel.Partition): FormValue {
  const mountPoint = (): string => partitionConfig.mountPath || NO_VALUE;

  const target = (): string => partitionConfig.name || NEW_PARTITION;

  const filesystem = (): string => {
    const fsConfig = partitionConfig.filesystem;
    if (fsConfig.reuse) return REUSE_FILESYSTEM;
    if (!fsConfig.type) return NO_VALUE;
    if (fsConfig.type === "btrfs" && fsConfig.snapshots) return BTRFS_SNAPSHOTS;

    return fsConfig.type;
  };

  const filesystemLabel = (): string => partitionConfig.filesystem?.label || NO_VALUE;

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
    mountPoint: mountPoint(),
    target: target(),
    filesystem: filesystem(),
    filesystemLabel: filesystemLabel(),
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

function useDefaultFilesystem(mountPoint: string): string {
  const volume = useVolume(mountPoint);

  return volume.mountPath === "/" && volume.snapshots ? BTRFS_SNAPSHOTS : volume.fsType;
}

function useInitialPartitionConfig(): apiModel.Partition | null {
  const { partitionId: mountPath } = useParams();
  const device = useModelDevice();

  return mountPath && device ? device.getPartition(mountPath) : null;
}

function useInitialFormValue(): FormValue | null {
  const partitionConfig = useInitialPartitionConfig();

  const value = React.useMemo(
    () => (partitionConfig ? toFormValue(partitionConfig) : null),
    [partitionConfig],
  );

  return value;
}

/** Unused predefined mount points. Includes the currently used mount point when editing. */
function useUnusedMountPoints(): string[] {
  const unusedMountPaths = useMissingMountPaths();
  const initialPartitionConfig = useInitialPartitionConfig();
  return compact([initialPartitionConfig?.mountPath, ...unusedMountPaths]);
}

/** Unused partitions. Includes the currently used partition when editing (if any). */
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

function useUsableFilesystems(mountPoint: string): string[] {
  const volume = useVolume(mountPoint);
  const defaultFilesystem = useDefaultFilesystem(mountPoint);

  const usableFilesystems = React.useMemo(() => {
    const volumeFilesystems = (): string[] => {
      const allValues = volume.outline.fsTypes;

      if (volume.mountPath !== "/") return allValues;

      // Btrfs without snapshots is not an option.
      if (!volume.outline.snapshotsConfigurable && volume.snapshots) {
        return [BTRFS_SNAPSHOTS, ...allValues].filter((v) => v !== "btrfs");
      }

      // Btrfs with snapshots is not an option
      if (!volume.outline.snapshotsConfigurable && !volume.snapshots) {
        return allValues;
      }

      return [BTRFS_SNAPSHOTS, ...allValues];
    };

    return unique([defaultFilesystem, ...volumeFilesystems()]);
  }, [volume, defaultFilesystem]);

  return usableFilesystems;
}

function useMountPointError(value: FormValue): Error | undefined {
  const model = useModel({ suspense: true });
  const mountPoints = model?.getMountPaths() || [];
  const initialPartitionConfig = useInitialPartitionConfig();
  const mountPoint = value.mountPoint;

  if (mountPoint === NO_VALUE) {
    return {
      id: "mountPoint",
      isVisible: false,
    };
  }

  const regex = /^swap$|^\/$|^(\/[^/\s]+)+$/;
  if (!regex.test(mountPoint)) {
    return {
      id: "mountPoint",
      message: _("Select or enter a valid mount point"),
      isVisible: true,
    };
  }

  // Exclude itself when editing
  const initialMountPoint = initialPartitionConfig?.mountPath;
  if (mountPoint !== initialMountPoint && mountPoints.includes(mountPoint)) {
    return {
      id: "mountPoint",
      message: _("Select or enter a mount point that is not already assigned to another device"),
      isVisible: true,
    };
  }
}

function useSizeError(value: FormValue): Error | undefined {
  if (value.sizeOption !== "custom") return;

  const min = value.minSize;
  const max = value.maxSize;

  if (!min) {
    return {
      id: "customSize",
      isVisible: false,
    };
  }

  const regexp = /^[0-9]+(\.[0-9]+)?(\s*([KkMmGgTtPpEeZzYy][iI]?)?[Bb])$/;
  const validMin = regexp.test(min);
  const validMax = max ? regexp.test(max) : true;

  if (validMin && validMax) {
    if (!max || parseToBytes(min) <= parseToBytes(max)) return;

    return {
      id: "customSize",
      message: _("The minimum cannot be greater than the maximum"),
      isVisible: true,
    };
  }

  if (validMin) {
    return {
      id: "customSize",
      message: _("The maximum must be a number followed by a unit like GiB or GB"),
      isVisible: true,
    };
  }

  if (validMax) {
    return {
      id: "customSize",
      message: _("The minimum must be a number followed by a unit like GiB or GB"),
      isVisible: true,
    };
  }

  return {
    id: "customSize",
    message: _("Size limits must be numbers followed by a unit like GiB or GB"),
    isVisible: true,
  };
}

function useErrors(value: FormValue): ErrorsHandler {
  const mountPointError = useMountPointError(value);
  const sizeError = useSizeError(value);
  const errors = compact([mountPointError, sizeError]);

  const getError = (id: string): Error | undefined => errors.find((e) => e.id === id);

  const getVisibleError = (id: string): Error | undefined => {
    const error = getError(id);
    return error?.isVisible ? error : undefined;
  };

  return { errors, getError, getVisibleError };
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

  const solvedModel = useSolvedConfigModel(sparseModel);
  return solvedModel;
}

function useSolvedPartitionConfig(value: FormValue): apiModel.Partition | undefined {
  const model = useSolvedModel(value);
  const { list, listIndex } = useModelDevice();
  if (!model) return;

  const container = findDevice(model, list, listIndex);
  return container?.partitions?.find((p) => p.mountPath === value.mountPoint);
}

function useSolvedSizes(value: FormValue): SizeRange {
  // Remove size values in order to get a solved size.
  const valueWithoutSizes: FormValue = {
    ...value,
    sizeOption: NO_VALUE,
    minSize: NO_VALUE,
    maxSize: NO_VALUE,
  };

  const solvedPartitionConfig = useSolvedPartitionConfig(valueWithoutSizes);

  const solvedSizes = React.useMemo(() => {
    const min = solvedPartitionConfig?.size?.min;
    const max = solvedPartitionConfig?.size?.max;

    return {
      min: min ? deviceSize(min) : NO_VALUE,
      max: max ? deviceSize(max) : NO_VALUE,
    };
  }, [solvedPartitionConfig]);

  return solvedSizes;
}

function useAutoRefreshFilesystem(handler, value: FormValue) {
  const { mountPoint, target } = value;
  const defaultFilesystem = useDefaultFilesystem(mountPoint);
  const usableFilesystems = useUsableFilesystems(mountPoint);
  const partitionFilesystem = usePartitionFilesystem(target);

  React.useEffect(() => {
    // Reset filesystem if there is no mount point yet.
    if (mountPoint === NO_VALUE) handler(NO_VALUE);
    // Select default filesystem for the mount point.
    if (mountPoint !== NO_VALUE && target === NEW_PARTITION) handler(defaultFilesystem);
    // Select default filesystem for the mount point if the partition has no filesystem.
    if (mountPoint !== NO_VALUE && target !== NEW_PARTITION && !partitionFilesystem)
      handler(defaultFilesystem);
    // Reuse the filesystem from the partition if possible.
    if (mountPoint !== NO_VALUE && target !== NEW_PARTITION && partitionFilesystem) {
      // const reuse = usableFilesystems.includes(partitionFilesystem);
      const reuse = usableFilesystems.includes(partitionFilesystem);
      handler(reuse ? REUSE_FILESYSTEM : defaultFilesystem);
    }
  }, [handler, mountPoint, target, defaultFilesystem, usableFilesystems, partitionFilesystem]);
}

function useAutoRefreshSize(handler, value: FormValue) {
  const target = value.target;
  const solvedSizes = useSolvedSizes(value);

  React.useEffect(() => {
    const sizeOption = target === NEW_PARTITION ? "auto" : "";
    handler(sizeOption, solvedSizes.min, solvedSizes.max);
  }, [handler, target, solvedSizes]);
}

function mountPointSelectOptions(mountPoints: string[]): SelectOptionProps[] {
  return mountPoints.map((p) => ({ value: p, children: p }));
}

type TargetOptionLabelProps = {
  value: string;
};

function TargetOptionLabel({ value }: TargetOptionLabelProps): React.ReactNode {
  const device = useDevice();
  const partition = usePartition(value);

  if (value === NEW_PARTITION) {
    // TRANSLATORS: %s is a disk name with its size (eg. "sda, 10 GiB"
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

type FilesystemOptionLabelProps = {
  value: string;
  target: string;
};

function FilesystemOptionLabel({ value, target }: FilesystemOptionLabelProps): React.ReactNode {
  const partition = usePartition(target);
  const filesystem = partition?.filesystem?.type;
  if (value === NO_VALUE) return _("Waiting for a mount point");
  // TRANSLATORS: %s is a filesystem type, like Btrfs
  if (value === REUSE_FILESYSTEM && filesystem)
    return sprintf(_("Current %s"), filesystemLabel(filesystem));
  if (value === BTRFS_SNAPSHOTS) return _("Btrfs with snapshots");

  return filesystemLabel(value);
}

type FilesystemOptionsProps = {
  mountPoint: string;
  target: string;
};

function FilesystemOptions({ mountPoint, target }: FilesystemOptionsProps): React.ReactNode {
  const volume = useVolume(mountPoint);
  const defaultFilesystem = useDefaultFilesystem(mountPoint);
  const usableFilesystems = useUsableFilesystems(mountPoint);
  const partitionFilesystem = usePartitionFilesystem(target);
  const canReuse = partitionFilesystem && usableFilesystems.includes(partitionFilesystem);

  const defaultOptText = volume.mountPath
    ? sprintf(_("Default file system for %s"), mountPoint)
    : _("Default file system for generic partitions");
  const formatText = partitionFilesystem
    ? _("Destroy current data and format partition as")
    : _("Format partition as");

  return (
    <SelectList aria-label="Available file systems">
      {mountPoint === NO_VALUE && (
        <SelectOption value={NO_VALUE}>
          <FilesystemOptionLabel value={NO_VALUE} target={target} />
        </SelectOption>
      )}
      {mountPoint !== NO_VALUE && canReuse && (
        <SelectOption
          value={REUSE_FILESYSTEM}
          // TRANSLATORS: %s is the name of a partition, like /dev/vda2
          description={sprintf(_("Do not format %s and keep the data"), target)}
        >
          <FilesystemOptionLabel value={REUSE_FILESYSTEM} target={target} />
        </SelectOption>
      )}
      {mountPoint !== NO_VALUE && canReuse && usableFilesystems.length && <Divider />}
      {mountPoint !== NO_VALUE && (
        <SelectGroup label={formatText}>
          {usableFilesystems.map((fsType, index) => (
            <SelectOption
              key={index}
              value={fsType}
              description={fsType === defaultFilesystem && defaultOptText}
            >
              <FilesystemOptionLabel value={fsType} target={target} />
            </SelectOption>
          ))}
        </SelectGroup>
      )}
    </SelectList>
  );
}

type FilesystemSelectProps = {
  id?: string;
  value: string;
  mountPoint: string;
  target: string;
  onChange: SelectProps["onChange"];
};

function FilesystemSelect({
  id,
  value,
  mountPoint,
  target,
  onChange,
}: FilesystemSelectProps): React.ReactNode {
  const usedValue = mountPoint === NO_VALUE ? NO_VALUE : value;

  return (
    <Select
      id={id}
      value={usedValue}
      label={<FilesystemOptionLabel value={usedValue} target={target} />}
      onChange={onChange}
      isDisabled={mountPoint === NO_VALUE}
    >
      <FilesystemOptions mountPoint={mountPoint} target={target} />
    </Select>
  );
}

type FilesystemLabelProps = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
};

function FilesystemLabel({ id, value, onChange }: FilesystemLabelProps): React.ReactNode {
  const isValid = (v: string) => /^[\w-_.]*$/.test(v);

  return (
    <TextInput
      id={id}
      aria-label={_("File system label")}
      value={value}
      onChange={(_, v) => isValid(v) && onChange(v)}
    />
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
      <AutoSizeText volume={volume} size={size} deviceType={"partition"} />
    </SubtleContent>
  );
}

/**
 * @fixme This component has to be adapted to use the new hooks from ~/hooks/storage/ instead of the
 * deprecated hooks from ~/queries/storage/config-model.
 */
export default function PartitionPage() {
  const navigate = useNavigate();
  const headingId = useId();
  const [mountPoint, setMountPoint] = React.useState(NO_VALUE);
  const [target, setTarget] = React.useState(NEW_PARTITION);
  const [filesystem, setFilesystem] = React.useState(NO_VALUE);
  const [filesystemLabel, setFilesystemLabel] = React.useState(NO_VALUE);
  const [sizeOption, setSizeOption] = React.useState<SizeOptionValue>(NO_VALUE);
  const [minSize, setMinSize] = React.useState(NO_VALUE);
  const [maxSize, setMaxSize] = React.useState(NO_VALUE);
  // Filesystem and size selectors should not be auto refreshed before the user interacts with other
  // selectors like the mount point or the target selectors.
  const [autoRefreshFilesystem, setAutoRefreshFilesystem] = React.useState(false);
  const [autoRefreshSize, setAutoRefreshSize] = React.useState(false);

  const initialValue = useInitialFormValue();
  const value = { mountPoint, target, filesystem, filesystemLabel, sizeOption, minSize, maxSize };
  const { errors, getVisibleError } = useErrors(value);

  const device = useModelDevice();
  const unusedMountPoints = useUnusedMountPoints();

  const addPartition = useAddPartition();
  const editPartition = useEditPartition();

  // Initializes the form values if there is an initial value (i.e., when editing a partition).
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
  }, [
    initialValue,
    setMountPoint,
    setTarget,
    setFilesystem,
    setFilesystemLabel,
    setSizeOption,
    setMinSize,
    setMaxSize,
  ]);

  const refreshFilesystemHandler = React.useCallback(
    (filesystem: string) => autoRefreshFilesystem && setFilesystem(filesystem),
    [autoRefreshFilesystem, setFilesystem],
  );

  useAutoRefreshFilesystem(refreshFilesystemHandler, value);

  const refreshSizeHandler = React.useCallback(
    (sizeOption: SizeOptionValue, minSize: string, maxSize: string) => {
      if (autoRefreshSize) {
        setSizeOption(sizeOption);
        setMinSize(minSize);
        setMaxSize(maxSize);
      }
    },
    [autoRefreshSize, setSizeOption, setMinSize, setMaxSize],
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
      // Automatically stop using a range of sizes when a range is used by default.
      setMaxSize("");
    } else {
      setMaxSize(size.max);
    }
  };

  const onSubmit = () => {
    const partitionConfig = toPartitionConfig(value);
    const { list, listIndex } = device;

    if (initialValue) editPartition(list, listIndex, initialValue.mountPoint, partitionConfig);
    else addPartition(list, listIndex, partitionConfig);

    navigate(PATHS.root);
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
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant={mountPointError ? "error" : "default"}>
                    {!mountPointError && _("Select or enter a mount point")}
                    {mountPointError?.message}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
            <FormGroup>
              <Flex>
                <FlexItem>
                  <FormGroup fieldId="fileSystem" label={_("File system")}>
                    <FilesystemSelect
                      id="fileSystem"
                      value={filesystem}
                      mountPoint={usedMountPt}
                      target={target}
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
}
