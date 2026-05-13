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

import React, { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import {
  ActionGroup,
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
import SizeModeSelect, { SizeMode, SizeRange } from "~/components/storage/SizeModeSelect";
import ResourceNotFound from "~/components/core/ResourceNotFound";
import configModel from "~/model/storage/config-model";
import { useVolumeTemplate, useDevice } from "~/hooks/model/system/storage";
import {
  useConfigModel,
  useSolvedConfigModel,
  useMissingMountPaths,
  useVolumeGroup as useConfigModelVolumeGroup,
  useAddLogicalVolume,
  useEditLogicalVolume,
} from "~/hooks/model/storage/config-model";
import { deviceSize, deviceLabel, filesystemLabel, parseToBytes } from "~/components/storage/utils";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { STORAGE as PATHS, STORAGE } from "~/routes/paths";
import { unique } from "radashi";
import { compact } from "~/utils";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";

const NO_VALUE = "";
const NEW_LOGICAL_VOLUME = "new";
const REUSE_FILESYSTEM = "reuse";

type SizeOptionValue = "" | SizeMode;
type FormValue = {
  mountPoint: string;
  name: string;
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

function configuredLogicalVolumes(
  volumeGroupConfig: ConfigModel.VolumeGroup,
): ConfigModel.LogicalVolume[] {
  if (volumeGroupConfig.spacePolicy === "custom")
    return volumeGroupConfig.logicalVolumes.filter(
      (l) =>
        !configModel.volume.isNew(l) &&
        (configModel.volume.isUsed(l) || configModel.volume.isUsedBySpacePolicy(l)),
    );

  return volumeGroupConfig.logicalVolumes.filter(configModel.volume.isReused);
}

function createLogicalVolumeConfig(value: FormValue): ConfigModel.LogicalVolume {
  const name = (): string | undefined => {
    if (value.target === NO_VALUE || value.target === NEW_LOGICAL_VOLUME) return undefined;

    return value.target;
  };

  const filesystemType = (): ConfigModel.FilesystemType | undefined => {
    if (value.filesystem === NO_VALUE) return undefined;

    /**
     * @note This type cast is needed because the list of filesystems coming from a volume is not
     *  enumerated (the volume simply contains a list of strings). This implies we have to rely on
     *  whatever value coming from such a list as a filesystem type accepted by the config model.
     *  This will be fixed in the future by directly exporting the volumes as a JSON, similar to the
     *  config model. The schema for the volumes will define the explicit list of filesystem types.
     */
    return value.filesystem as ConfigModel.FilesystemType;
  };

  const filesystem = (): ConfigModel.Filesystem | undefined => {
    if (value.filesystem === REUSE_FILESYSTEM) return { reuse: true, default: true };

    const type = filesystemType();
    if (type === undefined) return undefined;

    return {
      default: false,
      type,
      label: value.filesystemLabel,
    };
  };

  const size = (): ConfigModel.Size | undefined => {
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
    name: name(),
    filesystem: filesystem(),
    size: size(),
  };
}

function createFormValue(logicalVolumeConfig: ConfigModel.LogicalVolume): FormValue {
  const mountPoint = (): string => logicalVolumeConfig.mountPath || NO_VALUE;

  const target = (): string => logicalVolumeConfig.name || NEW_LOGICAL_VOLUME;

  const filesystem = (): string => {
    const fsConfig = logicalVolumeConfig.filesystem;
    if (fsConfig.reuse) return REUSE_FILESYSTEM;
    if (!fsConfig.type) return NO_VALUE;

    return fsConfig.type;
  };

  const filesystemLabel = (): string => logicalVolumeConfig.filesystem?.label || NO_VALUE;

  const sizeOption = (): SizeOptionValue => {
    const reuse = logicalVolumeConfig.name !== undefined;
    const sizeConfig = logicalVolumeConfig.size;
    if (reuse) return NO_VALUE;
    if (!sizeConfig || sizeConfig.default) return "auto";

    return "custom";
  };

  const size = (value: number | undefined): string =>
    value ? deviceSize(value, { exact: true }) : NO_VALUE;

  return {
    mountPoint: mountPoint(),
    name: logicalVolumeConfig.lvName,
    target: target(),
    filesystem: filesystem(),
    filesystemLabel: filesystemLabel(),
    sizeOption: sizeOption(),
    minSize: size(logicalVolumeConfig.size?.min),
    maxSize: size(logicalVolumeConfig.size?.max),
  };
}

function useVolumeGroupConfig(): ConfigModel.VolumeGroup | null {
  const { id: index } = useParams();

  return useConfigModelVolumeGroup(Number(index)) ?? null;
}

function useVolumeGroup(): System.Device {
  const volumeGroupConfig = useVolumeGroupConfig();
  return useDevice(volumeGroupConfig.name);
}

function useLogicalVolume(target: string): System.Device | null {
  const volumeGroup = useVolumeGroup();

  if (target === NEW_LOGICAL_VOLUME) return null;

  const logicalVolumes = volumeGroup.logicalVolumes || [];
  return logicalVolumes.find((p: System.Device) => p.name === target);
}

function useLogicalVolumeFilesystem(target: string): string | null {
  const logicalVolume = useLogicalVolume(target);
  return logicalVolume?.filesystem?.type || null;
}

function useDefaultFilesystem(mountPoint: string): string {
  const volume = useVolumeTemplate(mountPoint);
  return volume.fsType;
}

function useInitialLogicalVolumeConfig(): ConfigModel.LogicalVolume | null {
  const { logicalVolumeId: mountPath } = useParams();
  const volumeGroup = useVolumeGroupConfig();
  if (!volumeGroup || !mountPath) return null;

  const logicalVolume = volumeGroup.logicalVolumes.find((l) => l.mountPath === mountPath);
  return logicalVolume || null;
}

function useInitialFormValue(): FormValue | null {
  const logicalVolumeConfig = useInitialLogicalVolumeConfig();

  const value = React.useMemo(
    () => (logicalVolumeConfig ? createFormValue(logicalVolumeConfig) : null),
    [logicalVolumeConfig],
  );

  return value;
}

/** Unused predefined mount points. Includes the currently used mount point when editing. */
function useUnusedMountPoints(): string[] {
  const unusedMountPaths = useMissingMountPaths();
  const initialLogicalVolumeConfig = useInitialLogicalVolumeConfig();
  return compact([initialLogicalVolumeConfig?.mountPath, ...unusedMountPaths]);
}

/** Unused logical volumes. Includes the currently used logical volume when editing (if any). */
function useUnusedLogicalVolumes(): System.Device[] {
  const volumeGroup = useVolumeGroup();
  const allLogicalVolumes = volumeGroup.logicalVolumes || [];
  const initialLogicalVolumeConfig = useInitialLogicalVolumeConfig();
  const volumeGroupConfig = useVolumeGroupConfig();
  const configuredNames = configuredLogicalVolumes(volumeGroupConfig)
    .filter((l) => l.name !== initialLogicalVolumeConfig?.name)
    .map((l) => l.name);

  return allLogicalVolumes.filter((l) => !configuredNames.includes(l.name));
}

function useUsableFilesystems(mountPoint: string): string[] {
  const volume = useVolumeTemplate(mountPoint);
  const defaultFilesystem = useDefaultFilesystem(mountPoint);

  const usableFilesystems = React.useMemo(() => {
    const volumeFilesystems = (): string[] => {
      return volume.outline.fsTypes;
    };

    return unique([defaultFilesystem, ...volumeFilesystems()]);
  }, [volume, defaultFilesystem]);

  return usableFilesystems;
}

function useMountPointError(value: FormValue): Error | undefined {
  const config = useConfigModel();
  const mountPoints = config ? configModel.usedMountPaths(config) : [];
  const initialLogicalVolumeConfig = useInitialLogicalVolumeConfig();
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
  const initialMountPoint = initialLogicalVolumeConfig?.mountPath;
  if (mountPoint !== initialMountPoint && mountPoints.includes(mountPoint)) {
    return {
      id: "mountPoint",
      message: _("Select or enter a mount point that is not already assigned to another device"),
      isVisible: true,
    };
  }
}

function checkLogicalVolumeName(value: FormValue): Error | undefined {
  if (value.target !== NEW_LOGICAL_VOLUME || value.name?.length) return;

  return {
    id: "logicalVolumeName",
    message: _("Enter a name"),
    isVisible: true,
  };
}

function checkSizeError(value: FormValue): Error | undefined {
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
  const nameError = checkLogicalVolumeName(value);
  const sizeError = checkSizeError(value);
  const errors = compact([mountPointError, nameError, sizeError]);

  const getError = (id: string): Error | undefined => errors.find((e) => e.id === id);

  const getVisibleError = (id: string): Error | undefined => {
    const error = getError(id);
    return error?.isVisible ? error : undefined;
  };

  return { errors, getError, getVisibleError };
}

function useSolvedConfig(value: FormValue): ConfigModel.Config | null {
  const { id: index } = useParams();
  const volumeGroupConfig = useVolumeGroupConfig();
  const config = useConfigModel();
  const { errors } = useErrors(value);
  const initialLogicalVolumeConfig = useInitialLogicalVolumeConfig();
  const logicalVolumeConfig = createLogicalVolumeConfig(value);
  logicalVolumeConfig.size = undefined;
  // Avoid recalculating the solved model because changes in label.
  if (logicalVolumeConfig.filesystem) logicalVolumeConfig.filesystem.label = undefined;
  // Avoid recalculating the solved model because changes in name.
  logicalVolumeConfig.lvName = undefined;

  let sparseModel: ConfigModel.Config | undefined;

  if (
    volumeGroupConfig &&
    !errors.length &&
    value.target === NEW_LOGICAL_VOLUME &&
    value.filesystem !== NO_VALUE
  ) {
    if (initialLogicalVolumeConfig) {
      sparseModel = configModel.logicalVolume.edit(
        config,
        Number(index),
        initialLogicalVolumeConfig.mountPath,
        logicalVolumeConfig,
      );
    } else {
      sparseModel = configModel.logicalVolume.add(config, Number(index), logicalVolumeConfig);
    }
  }

  const solvedModel = useSolvedConfigModel(sparseModel);
  return solvedModel;
}

function useSolvedLogicalVolumeConfig(value: FormValue): ConfigModel.LogicalVolume | undefined {
  const volumeGroupConfig = useVolumeGroupConfig();
  const solvedConfig = useSolvedConfig(value);
  if (!solvedConfig) return;

  const solvedVolumeGroupConfig = configModel.volumeGroup.findByName(
    solvedConfig,
    volumeGroupConfig.vgName,
  );

  return configModel.device.findVolumeByMountPath(solvedVolumeGroupConfig, value.mountPoint);
}

function useSolvedSizes(value: FormValue): SizeRange {
  // Remove size values in order to get a solved size.
  const valueWithoutSizes: FormValue = {
    ...value,
    sizeOption: NO_VALUE,
    minSize: NO_VALUE,
    maxSize: NO_VALUE,
  };

  const solvedLogicalVolumeConfig = useSolvedLogicalVolumeConfig(valueWithoutSizes);

  const solvedSizes = React.useMemo(() => {
    const min = solvedLogicalVolumeConfig?.size?.min;
    const max = solvedLogicalVolumeConfig?.size?.max;

    return {
      min: min ? deviceSize(min) : NO_VALUE,
      max: max ? deviceSize(max) : NO_VALUE,
    };
  }, [solvedLogicalVolumeConfig]);

  return solvedSizes;
}

function useAutoRefreshFilesystem(handler, value: FormValue) {
  const { mountPoint, target } = value;
  const defaultFilesystem = useDefaultFilesystem(mountPoint);
  const usableFilesystems = useUsableFilesystems(mountPoint);
  const logicalVolumeFilesystem = useLogicalVolumeFilesystem(target);

  React.useEffect(() => {
    // Reset filesystem if there is no mount point yet.
    if (mountPoint === NO_VALUE) handler(NO_VALUE);
    // Select default filesystem for the mount point.
    if (mountPoint !== NO_VALUE && target === NEW_LOGICAL_VOLUME) handler(defaultFilesystem);
    // Select default filesystem for the mount point if the logical volume has no filesystem.
    if (mountPoint !== NO_VALUE && target !== NEW_LOGICAL_VOLUME && !logicalVolumeFilesystem)
      handler(defaultFilesystem);
    // Reuse the filesystem from the logical volume if possible.
    if (mountPoint !== NO_VALUE && target !== NEW_LOGICAL_VOLUME && logicalVolumeFilesystem) {
      const reuse = usableFilesystems.includes(logicalVolumeFilesystem);
      handler(reuse ? REUSE_FILESYSTEM : defaultFilesystem);
    }
  }, [handler, mountPoint, target, defaultFilesystem, usableFilesystems, logicalVolumeFilesystem]);
}

function useAutoRefreshSize(handler, value: FormValue) {
  const target = value.target;
  const solvedSizes = useSolvedSizes(value);

  React.useEffect(() => {
    const sizeOption = target === NEW_LOGICAL_VOLUME ? "auto" : "";
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
  const device = useVolumeGroup();
  const logicalVolume = useLogicalVolume(value);

  if (value === NEW_LOGICAL_VOLUME) {
    // TRANSLATORS: %s is a disk name with its size (eg. "sda, 10 GiB"
    return sprintf(_("As a new logical volume on %s"), deviceLabel(device, true));
  } else {
    return sprintf(_("Using logical volume %s"), deviceLabel(logicalVolume, true));
  }
}

type LogicalVolumeDescriptionProps = {
  logicalVolume: System.Device;
};

function LogicalVolumeDescription({
  logicalVolume,
}: LogicalVolumeDescriptionProps): React.ReactNode {
  const label = logicalVolume.filesystem?.label;

  return (
    <Split hasGutter>
      <SplitItem>{logicalVolume.description}</SplitItem>
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
  const logicalVolumes = useUnusedLogicalVolumes();

  return (
    <SelectList aria-label={_("Mount point options")}>
      <SelectOption value={NEW_LOGICAL_VOLUME}>
        <TargetOptionLabel value={NEW_LOGICAL_VOLUME} />
      </SelectOption>
      <Divider />
      <SelectGroup label={_("Using an existing logical volume")}>
        {logicalVolumes.map((logicalVolume, index) => (
          <SelectOption
            key={index}
            value={logicalVolume.name}
            description={<LogicalVolumeDescription logicalVolume={logicalVolume} />}
          >
            {deviceLabel(logicalVolume)}
          </SelectOption>
        ))}
        {logicalVolumes.length === 0 && (
          <SelectOption isDisabled>{_("There are not usable logical volumes")}</SelectOption>
        )}
      </SelectGroup>
    </SelectList>
  );
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
            {error && (
              <HelperTextItem variant="error" screenReaderText="">
                {error.message}
              </HelperTextItem>
            )}
          </HelperText>
        </FormHelperText>
      )}
    </FormGroup>
  );
}

type FilesystemOptionLabelProps = {
  value: string;
  target: string;
  volume: System.Volume;
};

function FilesystemOptionLabel({ value, target }: FilesystemOptionLabelProps): React.ReactNode {
  const logicalVolume = useLogicalVolume(target);
  const filesystem = logicalVolume?.filesystem?.type;

  if (value === NO_VALUE) return _("Waiting for a mount point");
  // TRANSLATORS: %s is a filesystem type, like Btrfs
  if (value === REUSE_FILESYSTEM && filesystem)
    return sprintf(_("Current %s"), filesystemLabel(filesystem));

  return filesystemLabel(value);
}

type FilesystemOptionsProps = {
  mountPoint: string;
  target: string;
};

function FilesystemOptions({ mountPoint, target }: FilesystemOptionsProps): React.ReactNode {
  const volume = useVolumeTemplate(mountPoint);
  const defaultFilesystem = useDefaultFilesystem(mountPoint);
  const usableFilesystems = useUsableFilesystems(mountPoint);
  const logicalVolumeFilesystem = useLogicalVolumeFilesystem(target);
  const canReuse = logicalVolumeFilesystem && usableFilesystems.includes(logicalVolumeFilesystem);

  const defaultOptText = volume.mountPath
    ? sprintf(_("Default file system for %s"), mountPoint)
    : _("Default file system for generic logical volume");
  const formatText = logicalVolumeFilesystem
    ? _("Destroy current data and format logical volume as")
    : _("Format logical volume as");

  return (
    <SelectList aria-label="Available file systems">
      {mountPoint === NO_VALUE && (
        <SelectOption value={NO_VALUE}>
          <FilesystemOptionLabel value={NO_VALUE} target={target} volume={volume} />
        </SelectOption>
      )}
      {mountPoint !== NO_VALUE && canReuse && (
        <SelectOption
          value={REUSE_FILESYSTEM}
          // TRANSLATORS: %s is the name of a logical volume, like /dev/system/home
          description={sprintf(_("Do not format %s and keep the data"), target)}
        >
          <FilesystemOptionLabel value={REUSE_FILESYSTEM} target={target} volume={volume} />
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
              <FilesystemOptionLabel value={fsType} target={target} volume={volume} />
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
  const volume = useVolumeTemplate(mountPoint);
  const usedValue = mountPoint === NO_VALUE ? NO_VALUE : value;

  return (
    <Select
      id={id}
      value={usedValue}
      label={<FilesystemOptionLabel value={usedValue} target={target} volume={volume} />}
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
  const volume = useVolumeTemplate(value.mountPoint);
  const solvedLogicalVolumeConfig = useSolvedLogicalVolumeConfig(value);
  const size = solvedLogicalVolumeConfig?.size;

  if (!size) return;

  return (
    <SubtleContent>
      <AutoSizeText volume={volume} size={size} deviceType={"logicalVolume"} />
    </SubtleContent>
  );
}

const LogicalVolumeForm = () => {
  const { id: index } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [mountPoint, setMountPoint] = useState(NO_VALUE);
  const [name, setName] = useState(NO_VALUE);
  const [target, setTarget] = useState(NEW_LOGICAL_VOLUME);
  const [filesystem, setFilesystem] = useState(NO_VALUE);
  const [filesystemLabel, setFilesystemLabel] = useState(NO_VALUE);
  const [sizeOption, setSizeOption] = useState<SizeOptionValue>(NO_VALUE);
  const [minSize, setMinSize] = useState(NO_VALUE);
  const [maxSize, setMaxSize] = useState(NO_VALUE);
  // Filesystem and size selectors should not be auto refreshed before the user interacts with other
  // selectors like the mount point or the target selectors.
  const [autoRefreshFilesystem, setAutoRefreshFilesystem] = useState(false);
  const [autoRefreshSize, setAutoRefreshSize] = useState(false);

  const initialValue = useInitialFormValue();
  const value = {
    mountPoint,
    name,
    target,
    filesystem,
    filesystemLabel,
    sizeOption,
    minSize,
    maxSize,
  };
  const { errors, getVisibleError } = useErrors(value);

  const volumeGroupConfig = useVolumeGroupConfig();
  const volumeGroup = useVolumeGroup();
  const logicalVolume = useLogicalVolume(target);

  const unusedMountPoints = useUnusedMountPoints();

  const addLogicalVolume = useAddLogicalVolume();
  const editLogicalVolume = useEditLogicalVolume();

  // Initializes the form values if there is an initial value (i.e., when editing a logical volume).
  React.useEffect(() => {
    if (initialValue) {
      setMountPoint(initialValue.mountPoint);
      setName(initialValue.name);
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
    const logicalVolumeConfig = createLogicalVolumeConfig(value);

    if (initialValue)
      editLogicalVolume(Number(index), initialValue.mountPoint, logicalVolumeConfig);
    else addLogicalVolume(Number(index), logicalVolumeConfig);

    navigate({ pathname: PATHS.root, search: location.search });
  };

  const isFormValid = errors.length === 0;
  const mountPointError = getVisibleError("mountPoint");
  const usedMountPt = mountPointError ? NO_VALUE : mountPoint;
  const showLabel = filesystem !== NO_VALUE && filesystem !== REUSE_FILESYSTEM;
  const sizeMode: SizeMode = sizeOption === "" ? "auto" : sizeOption;
  const sizeRange: SizeRange = { min: minSize, max: maxSize };

  return (
    <Page
      breadcrumbs={[
        { label: _("Storage"), path: STORAGE.root },
        { label: volumeGroupConfig.name },
        { label: _("Configure logical volume") },
      ]}
    >
      <Page.Content>
        <Form
          id="logicalVolumeForm"
          aria-label={sprintf(_("Configure logical volume at %s"), volumeGroupConfig.name)}
          onSubmit={onSubmit}
        >
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
                {volumeGroup && (
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
                )}
              </Flex>
              <FormHelperText>
                <HelperText>
                  <HelperTextItem
                    variant={mountPointError ? "error" : "default"}
                    screenReaderText=""
                  >
                    {!mountPointError && _("Select or enter a mount point")}
                    {mountPointError?.message}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
            {!logicalVolume && (
              <Flex>
                <FlexItem>
                  <LogicalVolumeName
                    id={"name"}
                    value={value}
                    mountPoint={usedMountPt}
                    onChange={setName}
                  />
                </FlexItem>
              </Flex>
            )}
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
            {target === NEW_LOGICAL_VOLUME && (
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
              <Page.Submit isDisabled={!isFormValid} form="logicalVolumeForm" />
              <Page.Cancel />
            </ActionGroup>
          </Stack>
        </Form>
      </Page.Content>
    </Page>
  );
};

export default function LogicalVolumePage() {
  const volumeGroupConfig = useVolumeGroupConfig();

  if (!volumeGroupConfig)
    return <ResourceNotFound linkText={_("Go to storage page")} linkPath={STORAGE.root} />;

  return <LogicalVolumeForm />;
}
