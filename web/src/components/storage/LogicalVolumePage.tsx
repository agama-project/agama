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

/**
 * @fixme This code was done in a hurry for including LVM managent in SLE16 beta3. It must be
 * completely refactored. There are a lot of duplications with PartitionPage. Both PartitionPage
 * and LogicalVolumePage should be adapted to share as much functionality as possible.
 */

import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router";
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
  SelectGroup,
  SelectList,
  SelectOption,
  SelectOptionProps,
  Stack,
  StackItem,
  TextInput,
} from "@patternfly/react-core";
import { Page, SelectWrapper as Select, SubtleContent } from "~/components/core/";
import { SelectWrapperProps as SelectProps } from "~/components/core/SelectWrapper";
import SelectTypeaheadCreatable from "~/components/core/SelectTypeaheadCreatable";
import AutoSizeText from "~/components/storage/AutoSizeText";
import { deviceSize, filesystemLabel, parseToBytes } from "~/components/storage/utils";
import configModel from "~/model/storage/config-model";
import {
  useSolvedConfigModel,
  useConfigModel,
  useMissingMountPaths,
  useVolumeGroup,
} from "~/hooks/model/storage/config-model";
import { useVolumeTemplate } from "~/hooks/model/system/storage";
import { useAddLogicalVolume, useEditLogicalVolume } from "~/hooks/storage/logical-volume";
import { STORAGE as PATHS } from "~/routes/paths";
import { unique } from "radashi";
import { compact } from "~/utils";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";
import SizeModeSelect, { SizeMode, SizeRange } from "~/components/storage/SizeModeSelect";
import type { ConfigModel, Data } from "~/model/storage/config-model";

const NO_VALUE = "";
const BTRFS_SNAPSHOTS = "btrfsSnapshots";

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

function toData(value: FormValue): Data.LogicalVolume {
  const filesystemType = (): ConfigModel.FilesystemType | undefined => {
    if (value.filesystem === NO_VALUE) return undefined;
    if (value.filesystem === BTRFS_SNAPSHOTS) return "btrfs";

    /**
     * @note This type cast is needed because the list of filesystems coming from a volume is not
     *  enumerated (the volume simply contains a list of strings). This implies we have to rely on
     *  whatever value coming from such a list as a filesystem type accepted by the config model.
     *  This will be fixed in the future by directly exporting the volumes as a JSON, similar to the
     *  config model. The schema for the volumes will define the explicit list of filesystem types.
     */
    return value.filesystem as ConfigModel.FilesystemType;
  };

  const filesystem = (): Data.Filesystem | undefined => {
    const type = filesystemType();
    if (type === undefined) return undefined;

    return {
      type,
      snapshots: value.filesystem === BTRFS_SNAPSHOTS,
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
    filesystem: filesystem(),
    size: size(),
  };
}

function toFormValue(logicalVolume: ConfigModel.LogicalVolume): FormValue {
  const mountPoint = (): string => logicalVolume.mountPath || NO_VALUE;

  const filesystem = (): string => {
    const fs = logicalVolume.filesystem;
    if (!fs.type) return NO_VALUE;
    if (fs.type === "btrfs" && fs.snapshots) return BTRFS_SNAPSHOTS;

    return fs.type;
  };

  const filesystemLabel = (): string => logicalVolume.filesystem?.label || NO_VALUE;

  const sizeOption = (): SizeOptionValue => {
    const size = logicalVolume.size;
    if (!size || size.default) return "auto";

    return "custom";
  };

  const size = (value: number | undefined): string =>
    value ? deviceSize(value, { exact: true }) : NO_VALUE;

  return {
    mountPoint: mountPoint(),
    name: logicalVolume.lvName,
    filesystem: filesystem(),
    filesystemLabel: filesystemLabel(),
    sizeOption: sizeOption(),
    minSize: size(logicalVolume.size?.min),
    maxSize: size(logicalVolume.size?.max),
  };
}

function useDefaultFilesystem(mountPoint: string): string {
  const volume = useVolumeTemplate(mountPoint);
  return volume.mountPath === "/" && volume.snapshots ? BTRFS_SNAPSHOTS : volume.fsType;
}

function useInitialLogicalVolume(): ConfigModel.LogicalVolume | null {
  const { id: vgName, logicalVolumeId: mountPath } = useParams();
  const volumeGroup = useVolumeGroup(vgName);

  if (!volumeGroup || !mountPath) return null;

  const logicalVolume = volumeGroup.logicalVolumes.find((l) => l.mountPath === mountPath);
  return logicalVolume || null;
}

function useInitialFormValue(): FormValue | null {
  const logicalVolume = useInitialLogicalVolume();
  const value = useMemo(() => (logicalVolume ? toFormValue(logicalVolume) : null), [logicalVolume]);
  return value;
}

/** Unused predefined mount points. Includes the currently used mount point when editing. */
function useUnusedMountPoints(): string[] {
  const missingMountPaths = useMissingMountPaths();
  const initialLogicalVolume = useInitialLogicalVolume();
  return compact([initialLogicalVolume?.mountPath, ...missingMountPaths]);
}

function useUsableFilesystems(mountPoint: string): string[] {
  const volume = useVolumeTemplate(mountPoint);
  const defaultFilesystem = useDefaultFilesystem(mountPoint);

  const usableFilesystems = useMemo(() => {
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
  const config = useConfigModel();
  const mountPoints = config ? configModel.usedMountPaths(config) : [];
  const initialLogicalVolume = useInitialLogicalVolume();
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
  const initialMountPoint = initialLogicalVolume?.mountPath;
  if (mountPoint !== initialMountPoint && mountPoints.includes(mountPoint)) {
    return {
      id: "mountPoint",
      message: _("Select or enter a mount point that is not already assigned to another device"),
      isVisible: true,
    };
  }
}

function checkLogicalVolumeName(value: FormValue): Error | undefined {
  if (value.name?.length) return;

  return {
    id: "logicalVolumeName",
    message: _("Enter a name"),
    isVisible: true,
  };
}

function checkSize(value: FormValue): Error | undefined {
  if (value.sizeOption !== "custom") return;

  const min = value.minSize;
  const max = value.maxSize;

  if (!min) {
    return {
      id: "customSize",
      isVisible: false,
    };
  }

  const regexp = /^[0-9]+(\.[0-9]+)?(\s*([KkMmGgTtPpEeZzYy][iI]?)?[Bb])?$/;
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
      message: _("The maximum must be a number optionally followed by a unit like GiB or GB"),
      isVisible: true,
    };
  }

  if (validMax) {
    return {
      id: "customSize",
      message: _("The minimum must be a number optionally followed by a unit like GiB or GB"),
      isVisible: true,
    };
  }

  return {
    id: "customSize",
    message: _("Size limits must be numbers optionally followed by a unit like GiB or GB"),
    isVisible: true,
  };
}

function useErrors(value: FormValue): ErrorsHandler {
  const mountPointError = useMountPointError(value);
  const nameError = checkLogicalVolumeName(value);
  const sizeError = checkSize(value);
  const errors = compact([mountPointError, nameError, sizeError]);

  const getError = (id: string): Error | undefined => errors.find((e) => e.id === id);

  const getVisibleError = (id: string): Error | undefined => {
    const error = getError(id);
    return error?.isVisible ? error : undefined;
  };

  return { errors, getError, getVisibleError };
}

function useSolvedModel(value: FormValue): ConfigModel.Config | null {
  const { id: vgName, logicalVolumeId: mountPath } = useParams();
  const config = useConfigModel();
  const { getError } = useErrors(value);
  const mountPointError = getError("mountPoint");
  const data = toData(value);
  // Avoid recalculating the solved model because changes in label.
  if (data.filesystem) data.filesystem.label = undefined;
  // Avoid recalculating the solved model because changes in name.
  data.lvName = undefined;

  let sparseModel: ConfigModel.Config | undefined;

  if (data.filesystem && !mountPointError) {
    if (mountPath) {
      sparseModel = configModel.logicalVolume.edit(config, vgName, mountPath, data);
    } else {
      sparseModel = configModel.logicalVolume.add(config, vgName, data);
    }
  }

  const solvedModel = useSolvedConfigModel(sparseModel);
  return solvedModel;
}

function useSolvedLogicalVolume(value: FormValue): ConfigModel.LogicalVolume | undefined {
  const { id: vgName } = useParams();
  const config = useSolvedModel(value);
  const volumeGroup = config?.volumeGroups?.find((v) => v.vgName === vgName);
  return volumeGroup?.logicalVolumes?.find((l) => l.mountPath === value.mountPoint);
}

function useSolvedSizes(value: FormValue): SizeRange {
  // Remove size values in order to get a solved size.
  const valueWithoutSizes: FormValue = {
    ...value,
    sizeOption: NO_VALUE,
    minSize: NO_VALUE,
    maxSize: NO_VALUE,
  };

  const logicalVolume = useSolvedLogicalVolume(valueWithoutSizes);

  const solvedSizes = useMemo(() => {
    const min = logicalVolume?.size?.min;
    const max = logicalVolume?.size?.max;

    return {
      min: min ? deviceSize(min) : NO_VALUE,
      max: max ? deviceSize(max) : NO_VALUE,
    };
  }, [logicalVolume]);

  return solvedSizes;
}

function useAutoRefreshFilesystem(handler, value: FormValue) {
  const { mountPoint } = value;
  const defaultFilesystem = useDefaultFilesystem(mountPoint);

  useEffect(() => {
    // Reset filesystem if there is no mount point yet.
    if (mountPoint === NO_VALUE) handler(NO_VALUE);
    // Select default filesystem for the mount point.
    if (mountPoint !== NO_VALUE) handler(defaultFilesystem);
  }, [handler, mountPoint, defaultFilesystem]);
}

function useAutoRefreshSize(handler, value: FormValue) {
  const solvedSizes = useSolvedSizes(value);

  useEffect(() => {
    handler("auto", solvedSizes.min, solvedSizes.max);
  }, [handler, solvedSizes]);
}

function mountPointSelectOptions(mountPoints: string[]): SelectOptionProps[] {
  return mountPoints.map((p) => ({ value: p, children: p }));
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
};

function FilesystemOptionLabel({ value }: FilesystemOptionLabelProps): React.ReactNode {
  if (value === NO_VALUE) return _("Waiting for a mount point");
  if (value === BTRFS_SNAPSHOTS) return _("Btrfs with snapshots");

  return filesystemLabel(value);
}

type FilesystemOptionsProps = {
  mountPoint: string;
};

function FilesystemOptions({ mountPoint }: FilesystemOptionsProps): React.ReactNode {
  const defaultFilesystem = useDefaultFilesystem(mountPoint);
  const usableFilesystems = useUsableFilesystems(mountPoint);
  const volume = useVolumeTemplate(mountPoint);

  const defaultOptText =
    mountPoint !== NO_VALUE && volume.mountPath
      ? sprintf(_("Default file system for %s"), mountPoint)
      : _("Default file system for generic logical volumes");

  const formatText = _("Format logical volume as");

  return (
    <SelectList aria-label="Available file systems">
      {mountPoint === NO_VALUE && (
        <SelectOption value={NO_VALUE}>
          <FilesystemOptionLabel value={NO_VALUE} />
        </SelectOption>
      )}
      {mountPoint !== NO_VALUE && (
        <SelectGroup label={formatText}>
          {usableFilesystems.map((fsType, index) => (
            <SelectOption
              key={index}
              value={fsType}
              description={fsType === defaultFilesystem && defaultOptText}
            >
              <FilesystemOptionLabel value={fsType} />
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
  onChange: SelectProps["onChange"];
};

function FilesystemSelect({
  id,
  value,
  mountPoint,
  onChange,
}: FilesystemSelectProps): React.ReactNode {
  const usedValue = mountPoint === NO_VALUE ? NO_VALUE : value;

  return (
    <Select
      id={id}
      value={usedValue}
      label={<FilesystemOptionLabel value={usedValue} />}
      onChange={onChange}
      isDisabled={mountPoint === NO_VALUE}
    >
      <FilesystemOptions mountPoint={mountPoint} />
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
  const addLogicalVolume = useAddLogicalVolume();
  const editLogicalVolume = useEditLogicalVolume();
  const [mountPoint, setMountPoint] = useState(NO_VALUE);
  const [name, setName] = useState(NO_VALUE);
  const [filesystem, setFilesystem] = useState(NO_VALUE);
  const [filesystemLabel, setFilesystemLabel] = useState(NO_VALUE);
  const [sizeOption, setSizeOption] = useState<SizeOptionValue>(NO_VALUE);
  const [minSize, setMinSize] = useState(NO_VALUE);
  const [maxSize, setMaxSize] = useState(NO_VALUE);
  // Filesystem and size selectors should not be auto refreshed before the user interacts with the
  // mount point selector.
  const [autoRefreshFilesystem, setAutoRefreshFilesystem] = useState(false);
  const [autoRefreshSize, setAutoRefreshSize] = useState(false);

  const initialValue = useInitialFormValue();
  const value = { mountPoint, name, filesystem, filesystemLabel, sizeOption, minSize, maxSize };
  const { errors, getVisibleError } = useErrors(value);
  const unusedMountPoints = useUnusedMountPoints();

  // Initializes the form values if there is an initial value (i.e., when editing a logical volume).
  React.useEffect(() => {
    if (initialValue) {
      setMountPoint(initialValue.mountPoint);
      setName(initialValue.name);
      setFilesystem(initialValue.filesystem);
      setFilesystemLabel(initialValue.filesystemLabel);
      setSizeOption(initialValue.sizeOption);
      setMinSize(initialValue.minSize);
      setMaxSize(initialValue.maxSize);
    }
  }, [
    initialValue,
    setMountPoint,
    setFilesystem,
    setFilesystemLabel,
    setSizeOption,
    setMinSize,
    setMaxSize,
  ]);

  const refreshFilesystemHandler = useCallback(
    (filesystem: string) => autoRefreshFilesystem && setFilesystem(filesystem),
    [autoRefreshFilesystem, setFilesystem],
  );

  useAutoRefreshFilesystem(refreshFilesystemHandler, value);

  const refreshSizeHandler = useCallback(
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
      setName(configModel.logicalVolume.generateName(value));
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
    if (mode === "custom" && initialValue.sizeOption === "auto" && size.min !== size.max) {
      // Automatically stop using a range of sizes when a range is used by default.
      setMaxSize("");
    } else {
      setMaxSize(size.max);
    }
  };

  const onSubmit = () => {
    const data = toData(value);

    if (initialValue) editLogicalVolume(vgName, initialValue.mountPoint, data);
    else addLogicalVolume(vgName, data);

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
                  <FormGroup fieldId="mountPoint" label={_("Mount point")}>
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
                </FlexItem>
              </Flex>
            </StackItem>
            <StackItem>
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
