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
import { NestedContent, Page, SelectWrapper as Select, SubtleContent } from "~/components/core/";
import { SelectWrapperProps as SelectProps } from "~/components/core/SelectWrapper";
import SelectTypeaheadCreatable from "~/components/core/SelectTypeaheadCreatable";
import { useDevices, useVolume } from "~/queries/storage";
import {
  useModel,
  useDrive,
  useConfigModel,
  useSolvedConfigModel,
  addPartition,
  editPartition,
} from "~/queries/storage/config-model";
import { StorageDevice } from "~/types/storage";
import {
  baseName,
  deviceSize,
  deviceLabel,
  filesystemLabel,
  parseToBytes,
} from "~/components/storage/utils";
import { _, formatList } from "~/i18n";
import { sprintf } from "sprintf-js";
import { configModel } from "~/api/storage/types";
import { STORAGE as PATHS } from "~/routes/paths";
import { compact, uniq } from "~/utils";

const NO_VALUE = "";
const NEW_PARTITION = "new";
const BTRFS_SNAPSHOTS = "btrfsSnapshots";
const REUSE_FILESYSTEM = "reuse";

type SizeOptionValue = "" | "auto" | "custom";
type CustomSizeValue = "fixed" | "unlimited" | "range";
type FormValue = {
  mountPoint: string;
  target: string;
  filesystem: string;
  sizeOption: SizeOptionValue;
  minSize: string;
  maxSize: string;
};
type SizeRange = {
  min: string;
  max: string;
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

function toPartitionConfig(value: FormValue): configModel.Partition {
  const name = (): string | undefined => {
    if (value.target === NO_VALUE || value.target === NEW_PARTITION) return undefined;

    return value.target;
  };

  const filesystemType = (): configModel.FilesystemType | undefined => {
    if (value.filesystem === NO_VALUE) return undefined;
    if (value.filesystem === BTRFS_SNAPSHOTS) return "btrfs";

    /**
     * @note This type cast is needed because the list of filesystems coming from a volume is not
     *  enumerated (the volume simply contains a list of strings). This implies we have to rely on
     *  whatever value coming from such a list as a filesystem type accepted by the config model.
     *  This will be fixed in the future by directly exporting the volumes as a JSON, similar to the
     *  config model. The schema for the volumes will define the explicit list of filesystem types.
     */
    return value.filesystem as configModel.FilesystemType;
  };

  const filesystem = (): configModel.Filesystem | undefined => {
    if (value.filesystem === REUSE_FILESYSTEM) return { reuse: true, default: true };

    const type = filesystemType();
    if (type === undefined) return undefined;

    return {
      default: false,
      type,
      snapshots: value.filesystem === BTRFS_SNAPSHOTS,
    };
  };

  const size = (): configModel.Size | undefined => {
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

function toFormValue(partitionConfig: configModel.Partition): FormValue {
  const mountPoint = (): string => partitionConfig.mountPath || NO_VALUE;

  const target = (): string => partitionConfig.name || NEW_PARTITION;

  const filesystem = (): string => {
    const fsConfig = partitionConfig.filesystem;
    if (fsConfig.reuse) return REUSE_FILESYSTEM;
    if (!fsConfig.type) return NO_VALUE;
    if (fsConfig.type === "btrfs" && fsConfig.snapshots) return BTRFS_SNAPSHOTS;

    return fsConfig.type;
  };

  const sizeOption = (): SizeOptionValue => {
    const reusePartition = partitionConfig.name !== undefined;
    const sizeConfig = partitionConfig.size;
    if (reusePartition) return NO_VALUE;
    if (!sizeConfig || sizeConfig.default) return "auto";

    return "custom";
  };

  const size = (value: number | undefined): string => (value ? deviceSize(value) : NO_VALUE);

  return {
    mountPoint: mountPoint(),
    target: target(),
    filesystem: filesystem(),
    sizeOption: sizeOption(),
    minSize: size(partitionConfig.size?.min),
    maxSize: size(partitionConfig.size?.max),
  };
}

function useDevice(): StorageDevice {
  const { id } = useParams();
  const devices = useDevices("system", { suspense: true });
  return devices.find((d) => baseName(d.name) === id);
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

function useInitialPartitionConfig(): configModel.Partition | null {
  const { partitionId: mountPath } = useParams();
  const device = useDevice();
  const drive = useDrive(device?.name);

  return mountPath && drive ? drive.getPartition(mountPath) : null;
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
  const { unusedMountPaths } = useModel();
  const initialPartitionConfig = useInitialPartitionConfig();
  return compact([initialPartitionConfig?.mountPath, ...unusedMountPaths]);
}

/** Unused partitions. Includes the currently used partition when editing (if any). */
function useUnusedPartitions(): StorageDevice[] {
  const device = useDevice();
  const allPartitions = device.partitionTable?.partitions || [];
  const initialPartitionConfig = useInitialPartitionConfig();
  const configuredPartitionConfigs = useDrive(device?.name)
    .configuredExistingPartitions.filter((p) => p.name !== initialPartitionConfig?.name)
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

    return uniq([defaultFilesystem, ...volumeFilesystems()]);
  }, [volume, defaultFilesystem]);

  return usableFilesystems;
}

function useMountPointError(value: FormValue): Error | undefined {
  const { usedMountPaths: mountPoints } = useModel();
  const initialPartitionConfig = useInitialPartitionConfig();
  const mountPoint = value.mountPoint;

  if (mountPoint === NO_VALUE) {
    return {
      id: "mountPoint",
      isVisible: false,
    };
  }

  const regex = /^swap$|^\/$|^(\/[^/\s]+([^/]*[^/\s])*)+$/;
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
  const sizeError = useSizeError(value);
  const errors = compact([mountPointError, sizeError]);

  const getError = (id: string): Error | undefined => errors.find((e) => e.id === id);

  const getVisibleError = (id: string): Error | undefined => {
    const error = getError(id);
    return error?.isVisible ? error : undefined;
  };

  return { errors, getError, getVisibleError };
}

function useSolvedModel(value: FormValue): configModel.Config | null {
  const device = useDevice();
  const model = useConfigModel();
  const { errors } = useErrors(value);
  const initialPartitionConfig = useInitialPartitionConfig();
  const partitionConfig = toPartitionConfig(value);
  partitionConfig.size = undefined;

  let sparseModel: configModel.Config | undefined;

  if (device && !errors.length && value.target === NEW_PARTITION && value.filesystem !== NO_VALUE) {
    /**
     * @todo Use a specific hook which returns functions like addPartition instead of directly
     * exporting the function. For example:
     *
     * const { model, addPartition } = useEditableModel();
     */
    if (initialPartitionConfig) {
      sparseModel = editPartition(
        model,
        device.name,
        initialPartitionConfig.mountPath,
        partitionConfig,
      );
    } else {
      sparseModel = addPartition(model, device.name, partitionConfig);
    }
  }

  const solvedModel = useSolvedConfigModel(sparseModel);
  return solvedModel;
}

function useSolvedPartitionConfig(value: FormValue): configModel.Partition | undefined {
  const model = useSolvedModel(value);
  const device = useDevice();
  const drive = model?.drives?.find((d) => d.name === device.name);
  return drive?.partitions?.find((p) => p.mountPath === value.mountPoint);
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
    // Reuse the filesystem from the partition if possble.
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

  if (value === NEW_PARTITION) {
    // TRANSLATORS: %1$s is a disk name (eg. "/dev/sda") and %2$s is its size (eg. "250 GiB")
    return sprintf(_("As a new partition on %1$s (%2$s)"), device.name, deviceSize(device.size));
  } else {
    return sprintf(_("Using partition %s"), value);
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
  if (value === REUSE_FILESYSTEM) return sprintf(_("Current %s"), filesystem);
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

type SizeOptionLabelProps = {
  value: SizeOptionValue;
  mountPoint: string;
  target: string;
};

function SizeOptionLabel({ value, mountPoint, target }: SizeOptionLabelProps): React.ReactNode {
  const partition = usePartition(target);
  if (mountPoint === NO_VALUE) return _("Waiting for a mount point");
  if (value === NO_VALUE && target !== NEW_PARTITION) return deviceSize(partition.size);
  if (value === "auto") return _("Calculated automatically");
  if (value === "custom") return _("Custom");

  return value;
}

type SizeOptionsProps = {
  mountPoint: string;
  target: string;
};

function SizeOptions({ mountPoint, target }: SizeOptionsProps): React.ReactNode {
  return (
    <SelectList aria-label={_("Size options")}>
      {mountPoint === NO_VALUE && (
        <SelectOption value={NO_VALUE}>
          <SizeOptionLabel value={NO_VALUE} mountPoint={mountPoint} target={target} />
        </SelectOption>
      )}
      {mountPoint !== NO_VALUE && target !== NEW_PARTITION && (
        // TRANSLATORS: %s is a partition name like /dev/vda2
        <SelectOption value={NO_VALUE} description={sprintf(_("Keep size of %s"), target)}>
          <SizeOptionLabel value={NO_VALUE} mountPoint={mountPoint} target={target} />
        </SelectOption>
      )}
      {mountPoint !== NO_VALUE && target === NEW_PARTITION && (
        <>
          <SelectOption
            value="auto"
            description={_("Let the installer propose a sensible range of sizes")}
          >
            <SizeOptionLabel value="auto" mountPoint={mountPoint} target={target} />
          </SelectOption>
          <SelectOption value="custom" description={_("Define a custom size or a range")}>
            <SizeOptionLabel value="custom" mountPoint={mountPoint} target={target} />
          </SelectOption>
        </>
      )}
    </SelectList>
  );
}

function AutoSizeTextFallback({ size }) {
  if (size.max) {
    if (size.max === size.min) {
      return sprintf(
        // TRANSLATORS: %s is a size with units, like "3 GiB"
        _("A generic size of %s will be used for the new partition"),
        deviceSize(size.min),
      );
    }

    return sprintf(
      // TRANSLATORS: %1$s is a min size and %2$s is the max, both with units like "3 GiB"
      _("A generic size range between %1$s and %2$s will be used for the new partition"),
      deviceSize(size.min),
      deviceSize(size.max),
    );
  }

  return sprintf(
    // TRANSLATORS: %s is a size with units, like "3 GiB"
    _("A generic minimum size of %s will be used for the new partition"),
    deviceSize(size.min),
  );
}

function AutoSizeTextFixed({ path, size }) {
  if (size.max) {
    if (size.max === size.min) {
      return sprintf(
        // TRANSLATORS: %1$s is a size with units (10 GiB) and %2$s is a mount path (/home)
        _("A partition of %1$s will be created for %2$s"),
        deviceSize(size.min),
        path,
      );
    }

    return sprintf(
      // TRANSLATORS: %1$s is a min size, %2$s is the max size and %3$s is a mount path
      _("A partition with a size between %1$s and %2$s will be created for %3$s"),
      deviceSize(size.min),
      deviceSize(size.max),
      path,
    );
  }

  return sprintf(
    // TRANSLATORS: %1$s is a size with units (10 GiB) and %2$s is a mount path (/home)
    _("A partition of at least %1$s will be created for %2$s"),
    deviceSize(size.min),
    path,
  );
}

function AutoSizeTextRam({ path, size }) {
  if (size.max) {
    if (size.max === size.min) {
      return sprintf(
        // TRANSLATORS: %1$s is a size with units (10 GiB) and %2$s is a mount path (/home)
        _("Based on the amount of RAM in the system, a partition of %1$s will be created for %2$s"),
        deviceSize(size.min),
        path,
      );
    }

    return sprintf(
      // TRANSLATORS: %1$s is a min size, %2$s is the max size and %3$s is a mount path
      _(
        "Based on the amount of RAM in the system, a partition with a size between %1$s and %2$s will be created for %3$s",
      ),
      deviceSize(size.min),
      deviceSize(size.max),
      path,
    );
  }

  return sprintf(
    // TRANSLATORS: %1$s is a size with units (10 GiB) and %2$s is a mount path (/home)
    _(
      "Based on the amount of RAM in the system a partition of at least %1$s will be created for %2$s",
    ),
    deviceSize(size.min),
    path,
  );
}

function AutoSizeTextDynamic({ volume, size }) {
  const introText = (volume) => {
    const path = volume.mountPath;
    const otherPaths = volume.outline.sizeRelevantVolumes || [];
    const snapshots = !!volume.outline.snapshotsAffectSizes;
    const ram = !!volume.outline.adjustByRam;

    if (ram && snapshots) {
      if (otherPaths.length === 1) {
        return sprintf(
          // TRANSLATORS: %1$s is a mount point (eg. /) and %2$s is another one (eg. /home)
          _(
            "The size range for %1$s will be dynamically adjusted based on the amount of RAM in the system, the usage of Btrfs snapshots and the presence of a separate file system for %2$s.",
          ),
          path,
          otherPaths[0],
        );
      }

      if (otherPaths.length > 1) {
        // TRANSLATORS: %1$s is a mount point and %2$s is a list of other paths
        return sprintf(
          _(
            "The size range for %1$s will be dynamically adjusted based on the amount of RAM in the system, the usage of Btrfs snapshots and the presence of separate file systems for %2$s.",
          ),
          path,
          formatList(otherPaths),
        );
      }

      return sprintf(
        // TRANSLATORS: %s is a mount point (eg. /)
        _(
          "The size range for %s will be dynamically adjusted based on the amount of RAM in the system and the usage of Btrfs snapshots.",
        ),
        path,
      );
    }

    if (ram) {
      if (otherPaths.length === 1) {
        return sprintf(
          // TRANSLATORS: %1$s is a mount point (eg. /) and %2$s is another one (eg. /home)
          _(
            "The size range for %1$s will be dynamically adjusted based on the amount of RAM in the system and the presence of a separate file system for %2$s.",
          ),
          path,
          otherPaths[0],
        );
      }

      return sprintf(
        // TRANSLATORS: %1$s is a mount point and %2$s is a list of other paths
        _(
          "The size range for %1$s will be dynamically adjusted based on the amount of RAM in the system and the presence of separate file systems for %2$s.",
        ),
        path,
        formatList(otherPaths),
      );
    }

    if (snapshots) {
      if (otherPaths.length === 1) {
        return sprintf(
          // TRANSLATORS: %1$s is a mount point (eg. /) and %2$s is another one (eg. /home)
          _(
            "The size range for %1$s will be dynamically adjusted based on the usage of Btrfs snapshots and the presence of a separate file system for %2$s.",
          ),
          path,
          otherPaths[0],
        );
      }

      if (otherPaths.length > 1) {
        // TRANSLATORS: %1$s is a mount point and %2$s is a list of other paths
        return sprintf(
          _(
            "The size range for %1$s will be dynamically adjusted based on the usage of Btrfs snapshots and the presence of separate file systems for %2$s.",
          ),
          path,
          formatList(otherPaths),
        );
      }

      return sprintf(
        // TRANSLATORS: %s is a mount point (eg. /)
        _(
          "The size range for %s will be dynamically adjusted based on the usage of Btrfs snapshots.",
        ),
        path,
      );
    }

    if (otherPaths.length === 1) {
      return sprintf(
        // TRANSLATORS: %1$s is a mount point (eg. /) and %2$s is another one (eg. /home)
        _(
          "The size range for %1$s will be dynamically adjusted based on the presence of a separate file system for %2$s.",
        ),
        path,
        otherPaths[0],
      );
    }

    return sprintf(
      // TRANSLATORS: %1$s is a mount point and %2$s is a list of other paths
      _(
        "The size range for %1$s will be dynamically adjusted based on the presence of separate file systems for %2$s.",
      ),
      path,
      formatList(otherPaths),
    );
  };

  const limitsText = (size) => {
    if (size.max) {
      if (size.max === size.min) {
        return sprintf(
          // TRANSLATORS: %s is a size with units (eg. 10 GiB)
          _("The current configuration will result in a partition of %s."),
          deviceSize(size.min),
        );
      }

      return sprintf(
        // TRANSLATORS: %1$s is a min size, %2$s is the max size
        _(
          "The current configuration will result in a partition with a size between %1$s and %2$s.",
        ),
        deviceSize(size.min),
        deviceSize(size.max),
      );
    }

    return sprintf(
      // TRANSLATORS: %s is a size with units (eg. 10 GiB)
      _("The current configuration will result in a partition of at least %s."),
      deviceSize(size.min),
    );
  };

  return (
    <>
      <SubtleContent component="p">{introText(volume)}</SubtleContent>
      <SubtleContent component="p">{limitsText(size)}</SubtleContent>
    </>
  );
}

function AutoSizeText({ volume, size }) {
  const path = volume.mountPath;

  if (path) {
    if (volume.autoSize) {
      const otherPaths = volume.outline.sizeRelevantVolumes || [];

      if (otherPaths.length || volume.outline.snapshotsAffectSizes) {
        return <AutoSizeTextDynamic volume={volume} size={size} />;
      }

      // This assumes volume.autoSize is correctly set. Ie. if it is set to true then at least one
      // of the relevant outline fields (snapshots, RAM and sizeRelevantVolumes) is used.
      return <AutoSizeTextRam path={path} size={size} />;
    }

    return <AutoSizeTextFixed path={path} size={size} />;
  }

  // Fallback volume
  // This assumes the fallback volume never uses automatic sizes (ie. re-calculated based on
  // other aspects of the configuration). It would be VERY surprising if that's the case.
  return <AutoSizeTextFallback size={size} />;
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
      <AutoSizeText volume={volume} size={size} />
    </SubtleContent>
  );
}

type CustomSizeOptionLabelProps = {
  value: CustomSizeValue;
};

function CustomSizeOptionLabel({ value }: CustomSizeOptionLabelProps): React.ReactNode {
  const labels = {
    fixed: _("Same as minimum"),
    unlimited: _("None"),
    range: _("Limited"),
  };

  return labels[value];
}

function CustomSizeOptions(): React.ReactNode {
  return (
    <SelectList aria-label={_("Maximum size options")}>
      <SelectOption
        value="fixed"
        description={_("The partition is created exactly with the given size")}
      >
        <CustomSizeOptionLabel value="fixed" />
      </SelectOption>
      <SelectOption
        value="range"
        description={_("The partition can grow until a given limit size")}
      >
        <CustomSizeOptionLabel value="range" />
      </SelectOption>
      <SelectOption
        value="unlimited"
        description={_("The partition can grow to use all the contiguous free space")}
      >
        <CustomSizeOptionLabel value="unlimited" />
      </SelectOption>
    </SelectList>
  );
}

type CustomSizeProps = {
  value: FormValue;
  onChange: (size: SizeRange) => void;
};

function CustomSize({ value, onChange }: CustomSizeProps) {
  const initialOption = (): CustomSizeValue => {
    if (value.minSize === NO_VALUE) return "fixed";
    if (value.minSize === value.maxSize) return "fixed";
    if (value.maxSize === NO_VALUE) return "unlimited";
    return "range";
  };

  const [option, setOption] = React.useState<CustomSizeValue>(initialOption());
  const { max: solvedMaxSize } = useSolvedSizes(value);
  const { getVisibleError } = useErrors(value);

  const error = getVisibleError("customSize");

  const changeMinSize = (min: string) => {
    const max = option === "fixed" ? min : value.maxSize;
    onChange({ min, max });
  };

  const changeMaxSize = (max: string) => {
    onChange({ min: value.minSize, max });
  };

  const changeOption = (v: CustomSizeValue) => {
    setOption(v);

    const min = value.minSize;
    if (v === "fixed") onChange({ min, max: min });
    if (v === "unlimited") onChange({ min, max: NO_VALUE });
    if (v === "range") {
      const max = solvedMaxSize || NO_VALUE;
      onChange({ min, max });
    }
  };

  return (
    <Stack hasGutter>
      <Stack>
        <SubtleContent>
          {_("Sizes must be entered as a numbers optionally followed by a unit.")}
        </SubtleContent>
        <SubtleContent>
          {_(
            "If the unit is omitted, bytes (B) will be used. Greater units can be of \
              the form GiB (power of 2) or GB (power of 10).",
          )}
        </SubtleContent>
      </Stack>
      <FormGroup>
        <Flex>
          <FlexItem>
            <FormGroup fieldId="minSizeValue" label={_("Minimum")}>
              <TextInput
                id="minSizeValue"
                className="w-14ch"
                value={value.minSize}
                aria-label={_("Minimum size value")}
                onChange={(_, v) => changeMinSize(v)}
              />
            </FormGroup>
          </FlexItem>
          <FlexItem>
            <FormGroup fieldId="maxSize" label={_("Maximum")}>
              <Split hasGutter>
                <Select
                  id="maxSize"
                  value={option}
                  label={<CustomSizeOptionLabel value={option} />}
                  onChange={changeOption}
                  toggleName={_("Maximum size mode")}
                >
                  <CustomSizeOptions />
                </Select>
                {option === "range" && (
                  <TextInput
                    id="maxSizeValue"
                    className="w-14ch"
                    value={value.maxSize}
                    aria-label={_("Maximum size value")}
                    onChange={(_, v) => changeMaxSize(v)}
                  />
                )}
              </Split>
            </FormGroup>
          </FlexItem>
        </Flex>
        <FormHelperText>
          <HelperText>
            {error && <HelperTextItem variant="error">{error.message}</HelperTextItem>}
          </HelperText>
        </FormHelperText>
      </FormGroup>
    </Stack>
  );
}

export default function PartitionPage() {
  const navigate = useNavigate();
  const headingId = useId();
  const [mountPoint, setMountPoint] = React.useState(NO_VALUE);
  const [target, setTarget] = React.useState(NEW_PARTITION);
  const [filesystem, setFilesystem] = React.useState(NO_VALUE);
  const [sizeOption, setSizeOption] = React.useState<SizeOptionValue>(NO_VALUE);
  const [minSize, setMinSize] = React.useState(NO_VALUE);
  const [maxSize, setMaxSize] = React.useState(NO_VALUE);
  // Filesystem and size selectors should not be auto refreshed before the user interacts with other
  // selectors like the mount point or the target selectors.
  const [autoRefreshFilesystem, setAutoRefreshFilesystem] = React.useState(false);
  const [autoRefreshSize, setAutoRefreshSize] = React.useState(false);

  const initialValue = useInitialFormValue();
  const value = { mountPoint, target, filesystem, sizeOption, minSize, maxSize };
  const { errors, getVisibleError } = useErrors(value);

  const device = useDevice();
  const drive = useDrive(device?.name);
  const unusedMountPoints = useUnusedMountPoints();

  // Initializes the form values if there is an initial value (i.e., when editing a partition).
  React.useEffect(() => {
    if (initialValue) {
      setMountPoint(initialValue.mountPoint);
      setTarget(initialValue.target);
      setFilesystem(initialValue.filesystem);
      setSizeOption(initialValue.sizeOption);
      setMinSize(initialValue.minSize);
      setMaxSize(initialValue.maxSize);
    }
  }, [
    initialValue,
    setMountPoint,
    setTarget,
    setFilesystem,
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

  const changeSize = ({ min, max }) => {
    if (min !== undefined) setMinSize(min);
    if (max !== undefined) setMaxSize(max);
  };

  const onSubmit = () => {
    const partitionConfig = toPartitionConfig(value);

    if (initialValue) drive.editPartition(initialValue.mountPoint, partitionConfig);
    else drive.addPartition(partitionConfig);

    navigate(PATHS.root);
  };

  const isFormValid = errors.length === 0;
  const mountPointError = getVisibleError("mountPoint");
  const usedMountPt = mountPointError ? NO_VALUE : mountPoint;

  return (
    <Page id="partitionPage">
      <Page.Header>
        <Content component="h2" id={headingId}>
          {sprintf(_("Define partition at %s"), device.name)}
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
            <FormGroup fieldId="fileSystem" label={_("File system")}>
              <FilesystemSelect
                id="fileSystem"
                value={filesystem}
                mountPoint={usedMountPt}
                target={target}
                onChange={changeFilesystem}
              />
            </FormGroup>
            <FormGroup fieldId="size" label={_("Size")}>
              <Flex
                direction={{ default: "column" }}
                alignItems={{ default: "alignItemsFlexStart" }}
                gap={{ default: "gapMd" }}
              >
                <Select
                  id="size"
                  value={sizeOption}
                  label={
                    <SizeOptionLabel value={sizeOption} mountPoint={usedMountPt} target={target} />
                  }
                  onChange={(v: SizeOptionValue) => setSizeOption(v)}
                  isDisabled={usedMountPt === NO_VALUE}
                >
                  <SizeOptions mountPoint={usedMountPt} target={target} />
                </Select>
                <NestedContent margin="mxMd" aria-live="polite">
                  {target === NEW_PARTITION && sizeOption === "auto" && (
                    <AutoSizeInfo value={value} />
                  )}
                  {target === NEW_PARTITION && sizeOption === "custom" && (
                    <CustomSize value={value} onChange={changeSize} />
                  )}
                </NestedContent>
              </Flex>
            </FormGroup>
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
