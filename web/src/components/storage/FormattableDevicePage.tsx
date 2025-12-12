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
 * @fixme This file, PartitionPage and LogicalVolumePage need to be refactored in order to avoid
 *  code duplication.
 */

import React, { useId } from "react";
import { useParams, useNavigate } from "react-router";
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
  SelectGroup,
  SelectList,
  SelectOption,
  SelectOptionProps,
  Stack,
  TextInput,
} from "@patternfly/react-core";
import { Page, SelectWrapper as Select } from "~/components/core/";
import { SelectWrapperProps as SelectProps } from "~/components/core/SelectWrapper";
import SelectTypeaheadCreatable from "~/components/core/SelectTypeaheadCreatable";
import { useAddFilesystem } from "~/hooks/storage/filesystem";
import {
  useMissingMountPaths,
  useDrive as useDriveModel,
  useMdRaid as useMdRaidModel,
} from "~/hooks/storage/model";
import { useConfigModel } from "~/hooks/model/storage";
import { useDevice, useVolumeTemplate } from "~/hooks/model/system/storage";
import { deviceBaseName, filesystemLabel } from "~/components/storage/utils";
import { usedMountPaths } from "~/model/storage/config-model";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { STORAGE as PATHS } from "~/routes/paths";
import { unique } from "radashi";
import { compact } from "~/utils";
import type { Data } from "~/storage";
import type { ConfigModel } from "~/model/storage";
import type { Storage as System } from "~/model/system";

const NO_VALUE = "";
const BTRFS_SNAPSHOTS = "btrfsSnapshots";
const REUSE_FILESYSTEM = "reuse";

type DeviceModel = ConfigModel.Drive | ConfigModel.MdRaid;
type FormValue = {
  mountPoint: string;
  filesystem: string;
  filesystemLabel: string;
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

function toData(value: FormValue): Data.Formattable {
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
    if (value.filesystem === REUSE_FILESYSTEM) return { reuse: true };

    const type = filesystemType();
    if (type === undefined) return undefined;

    return {
      type,
      snapshots: value.filesystem === BTRFS_SNAPSHOTS,
      label: value.filesystemLabel,
    };
  };

  return {
    mountPath: value.mountPoint,
    filesystem: filesystem(),
  };
}

function toFormValue(deviceModel: DeviceModel): FormValue {
  const mountPoint = (): string => deviceModel.mountPath || NO_VALUE;

  const filesystem = (): string => {
    const fsConfig = deviceModel.filesystem;
    if (!fsConfig) return NO_VALUE;
    if (fsConfig.reuse) return REUSE_FILESYSTEM;
    if (!fsConfig.type) return NO_VALUE;
    if (fsConfig.type === "btrfs" && fsConfig.snapshots) return BTRFS_SNAPSHOTS;

    return fsConfig.type;
  };

  const filesystemLabel = (): string => deviceModel.filesystem?.label || NO_VALUE;

  return {
    mountPoint: mountPoint(),
    filesystem: filesystem(),
    filesystemLabel: filesystemLabel(),
  };
}

function useDeviceModelFromParams(): ConfigModel.Drive | ConfigModel.MdRaid | null {
  const { collection, index } = useParams();
  const deviceModel = collection === "drives" ? useDriveModel : useMdRaidModel;
  return deviceModel(Number(index));
}

function useDeviceFromParams(): System.Device {
  const deviceModel = useDeviceModelFromParams();
  return useDevice(deviceModel.name);
}

function useCurrentFilesystem(): string | null {
  const device = useDeviceFromParams();
  return device?.filesystem?.type || null;
}

function useDefaultFilesystem(mountPoint: string): string {
  const volume = useVolumeTemplate(mountPoint);
  return volume.mountPath === "/" && volume.snapshots ? BTRFS_SNAPSHOTS : volume.fsType;
}

function useInitialFormValue(): FormValue | null {
  const deviceModel = useDeviceModelFromParams();
  return React.useMemo(() => (deviceModel ? toFormValue(deviceModel) : null), [deviceModel]);
}

/** Unused predefined mount points. Includes the currently used mount point when editing. */
function useUnusedMountPoints(): string[] {
  const unusedMountPaths = useMissingMountPaths();
  const deviceModel = useDeviceModelFromParams();
  return compact([deviceModel?.mountPath, ...unusedMountPaths]);
}

function useUsableFilesystems(mountPoint: string): string[] {
  const volume = useVolumeTemplate(mountPoint);
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
  const config = useConfigModel();
  const mountPoints = config ? usedMountPaths(config) : [];
  const deviceModel = useDeviceModelFromParams();
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
  const initialMountPoint = deviceModel?.mountPath;
  if (mountPoint !== initialMountPoint && mountPoints.includes(mountPoint)) {
    return {
      id: "mountPoint",
      message: _("Select or enter a mount point that is not already assigned to another device"),
      isVisible: true,
    };
  }
}

function useErrors(value: FormValue): ErrorsHandler {
  const mountPointError = useMountPointError(value);
  const errors = compact([mountPointError]);

  const getError = (id: string): Error | undefined => errors.find((e) => e.id === id);

  const getVisibleError = (id: string): Error | undefined => {
    const error = getError(id);
    return error?.isVisible ? error : undefined;
  };

  return { errors, getError, getVisibleError };
}

function useAutoRefreshFilesystem(handler, value: FormValue) {
  const { mountPoint } = value;
  const defaultFilesystem = useDefaultFilesystem(mountPoint);
  const usableFilesystems = useUsableFilesystems(mountPoint);
  const currentFilesystem = useCurrentFilesystem();

  React.useEffect(() => {
    // Reset filesystem if there is no mount point yet.
    if (mountPoint === NO_VALUE) handler(NO_VALUE);
    // Select default filesystem for the mount point if the device has no filesystem.
    if (mountPoint !== NO_VALUE && !currentFilesystem) handler(defaultFilesystem);
    // Reuse the filesystem from the device if possible.
    if (mountPoint !== NO_VALUE && currentFilesystem) {
      const reuse = usableFilesystems.includes(currentFilesystem);
      handler(reuse ? REUSE_FILESYSTEM : defaultFilesystem);
    }
  }, [handler, mountPoint, defaultFilesystem, usableFilesystems, currentFilesystem]);
}

function mountPointSelectOptions(mountPoints: string[]): SelectOptionProps[] {
  return mountPoints.map((p) => ({ value: p, children: p }));
}

type FilesystemOptionLabelProps = {
  value: string;
};

function FilesystemOptionLabel({ value }: FilesystemOptionLabelProps): React.ReactNode {
  const filesystem = useCurrentFilesystem();
  if (value === NO_VALUE) return _("Waiting for a mount point");
  // TRANSLATORS: %s is a filesystem type, like Btrfs
  if (value === REUSE_FILESYSTEM && filesystem)
    return sprintf(_("Current %s"), filesystemLabel(filesystem));
  if (value === BTRFS_SNAPSHOTS) return _("Btrfs with snapshots");

  return filesystemLabel(value);
}

type FilesystemOptionsProps = {
  mountPoint: string;
};

function FilesystemOptions({ mountPoint }: FilesystemOptionsProps): React.ReactNode {
  const device = useDeviceFromParams();
  const volume = useVolumeTemplate(mountPoint);
  const defaultFilesystem = useDefaultFilesystem(mountPoint);
  const usableFilesystems = useUsableFilesystems(mountPoint);
  const currentFilesystem = useCurrentFilesystem();
  const canReuse = currentFilesystem && usableFilesystems.includes(currentFilesystem);

  const defaultOptText = volume.mountPath
    ? sprintf(_("Default file system for %s"), mountPoint)
    : _("Default file system for generic mount paths");
  const formatText = currentFilesystem
    ? _("Destroy current data and format device as")
    : _("Format device as");

  return (
    <SelectList aria-label="Available file systems">
      {mountPoint === NO_VALUE && (
        <SelectOption value={NO_VALUE}>
          <FilesystemOptionLabel value={NO_VALUE} />
        </SelectOption>
      )}
      {mountPoint !== NO_VALUE && canReuse && (
        <SelectOption
          value={REUSE_FILESYSTEM}
          description={
            // TRANSLATORS: %s is the name of a device, like vda
            sprintf(_("Do not format %s and keep the data"), deviceBaseName(device, true))
          }
        >
          <FilesystemOptionLabel value={REUSE_FILESYSTEM} />
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

export default function FormattableDevicePage() {
  const navigate = useNavigate();
  const headingId = useId();
  const [mountPoint, setMountPoint] = React.useState(NO_VALUE);
  const [filesystem, setFilesystem] = React.useState(NO_VALUE);
  const [filesystemLabel, setFilesystemLabel] = React.useState(NO_VALUE);
  // Filesystem selectors should not be auto refreshed before the user interacts with the mount
  // point selector.
  const [autoRefreshFilesystem, setAutoRefreshFilesystem] = React.useState(false);

  const initialValue = useInitialFormValue();
  const value = { mountPoint, filesystem, filesystemLabel };
  const { errors, getVisibleError } = useErrors(value);

  const { collection, index } = useParams();
  const device = useDeviceModelFromParams();
  const unusedMountPoints = useUnusedMountPoints();
  const addFilesystem = useAddFilesystem();

  // Initializes the form values.
  React.useEffect(() => {
    if (initialValue) {
      setMountPoint(initialValue.mountPoint);
      setFilesystem(initialValue.filesystem);
      setFilesystemLabel(initialValue.filesystemLabel);
    }
  }, [initialValue]);

  const refreshFilesystemHandler = React.useCallback(
    (filesystem: string) => autoRefreshFilesystem && setFilesystem(filesystem),
    [autoRefreshFilesystem, setFilesystem],
  );

  useAutoRefreshFilesystem(refreshFilesystemHandler, value);

  const changeMountPoint = (value: string) => {
    if (value !== mountPoint) {
      setAutoRefreshFilesystem(true);
      setMountPoint(value);
    }
  };

  const changeFilesystem = (value: string) => {
    setAutoRefreshFilesystem(false);
    setFilesystem(value);
  };

  const onSubmit = () => {
    const data = toData(value);
    addFilesystem(collection, Number(index), data);
    navigate(PATHS.root);
  };

  const isFormValid = errors.length === 0;
  const mountPointError = getVisibleError("mountPoint");
  const usedMountPt = mountPointError ? NO_VALUE : mountPoint;
  const showLabel = filesystem !== NO_VALUE && filesystem !== REUSE_FILESYSTEM;

  return (
    <Page id="formattablePage">
      <Page.Header>
        <Content component="h2" id={headingId}>
          {sprintf(_("Configure device %s"), device.name)}
        </Content>
      </Page.Header>

      <Page.Content>
        <Form id="formattableForm" aria-labelledby={headingId} onSubmit={onSubmit}>
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
            <ActionGroup>
              <Page.Submit isDisabled={!isFormValid} form="formattableForm" />
              <Page.Cancel />
            </ActionGroup>
          </Stack>
        </Form>
      </Page.Content>
    </Page>
  );
}
