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

import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
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
  Split,
  Stack,
  TextInput,
} from "@patternfly/react-core";
import { Page, SelectWrapper as Select } from "~/components/core/";
import { SelectWrapperProps as SelectProps } from "~/components/core/SelectWrapper";
import SelectTypeaheadCreatable from "~/components/core/SelectTypeaheadCreatable";
import { useDevices, useVolume } from "~/queries/storage";
import {
  useModel,
  useDrive,
  useConfigModel,
  useSolvedConfigModel,
  addPartition,
} from "~/queries/storage/config-model";
import { StorageDevice, Volume } from "~/types/storage";
import { baseName, deviceSize, parseToBytes } from "~/components/storage/utils";
import { _, formatList } from "~/i18n";
import { sprintf } from "sprintf-js";
import { configModel } from "~/api/storage/types";
import { STORAGE as PATHS } from "~/routes/paths";
import { compact } from "~/utils";

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

/**
 * @note This type guard is needed because the list of filesystems coming from a volume is not
 *  enumerated (the volume simply contains a list of strings). This implies we have to rely on
 *  whatever value coming from such a list as a filesystem type accepted by the config model.
 *  This will be fixed in the future by directly exporting the volumes as a JSON, similar to the
 *  config model. The schema for the volumes will define the explicit list of filesystem types.
 */
function isFilesystemType(_value: string): _value is configModel.FilesystemType {
  return true;
}

function partitionConfig(value: FormValue): configModel.Partition {
  const name = (): string | undefined => {
    if (value.target === NO_VALUE || value.target === NEW_PARTITION) return undefined;

    return value.target;
  };

  const filesystemType = (): configModel.FilesystemType | undefined => {
    if (value.filesystem === NO_VALUE) return undefined;
    if (value.filesystem === BTRFS_SNAPSHOTS) return "btrfs";

    const fs_value = value.filesystem.toLowerCase();
    return isFilesystemType(fs_value) ? fs_value : undefined;
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

function mountPointError(mountPoint: string, assignedPoints: string[]): Error | undefined {
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

  // TODO: exclude itself when editing
  if (assignedPoints.includes(mountPoint)) {
    return {
      id: "mountPoint",
      message: _("Select or enter a mount point that is not already assigned to another device"),
      isVisible: true,
    };
  }
}

function sizeError(min: string, max: string): Error | undefined {
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
  const { usedMountPaths: assigned } = useModel();
  const size = value.sizeOption === "custom" ? sizeError(value.minSize, value.maxSize) : null;
  const errors = compact([mountPointError(value.mountPoint, assigned), size]);

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
  const partition = partitionConfig(value);
  // Remove size in order to always get a solved size.
  partition.size = undefined;

  let sparseModel: configModel.Config | undefined;

  if (
    device &&
    !errors.length &&
    value.target === NEW_PARTITION &&
    value.filesystem !== NO_VALUE &&
    value.sizeOption !== NO_VALUE
  ) {
    /**
     * @todo Use a specific hook which returns functions like addPartition instead of directly
     * exporting the function. For example:
     *
     * const { model, addPartition } = useEditableModel();
     */
    sparseModel = addPartition(model, device.name, partition);
  }

  const solvedModel = useSolvedConfigModel(sparseModel);
  return solvedModel;
}

function useSolvedPartition(value: FormValue): configModel.Partition | undefined {
  const model = useSolvedModel(value);
  const device = useDevice();
  const drive = model?.drives?.find((d) => d.name === device.name);
  return drive?.partitions?.find((p) => p.mountPath === value.mountPoint);
}

/** @todo include the currently used mount point when editing */
function mountPointOptions(mountPoints: string[]): SelectOptionProps[] {
  return mountPoints.map((p) => ({ value: p, children: p }));
}

function defaultFilesystem(volume: Volume): string {
  return volume.mountPath === "/" && volume.snapshots ? BTRFS_SNAPSHOTS : volume.fsType;
}

function filesystemOptions(volume: Volume): string[] {
  if (volume.mountPath !== "/") return volume.outline.fsTypes;

  if (!volume.outline.snapshotsConfigurable && volume.snapshots) {
    // Btrfs without snapshots is not an option
    const options = volume.outline.fsTypes.filter((t) => t !== "Btrfs");
    return [BTRFS_SNAPSHOTS, ...options];
  }

  if (!volume.outline.snapshotsConfigurable && !volume.snapshots) {
    // Btrfs with snapshots is not an option
    return volume.outline.fsTypes;
  }

  return [BTRFS_SNAPSHOTS, ...volume.outline.fsTypes];
}

type TargetOptionLabelProps = {
  value: string;
};

function TargetOptionLabel({ value }: TargetOptionLabelProps): React.ReactNode {
  const device = useDevice();

  if (value === NEW_PARTITION) {
    return sprintf(_("As a new partition on %s"), device.name);
  } else {
    return sprintf(_("Using partition %s"), value);
  }
}

type PartitionDescriptionProps = {
  partition: StorageDevice;
};

function PartitionDescription({ partition }: PartitionDescriptionProps): React.ReactNode {
  return (
    <Split hasGutter>
      <span>{partition.description}</span>
      <span>{deviceSize(partition.size)}</span>
    </Split>
  );
}

/** @todo include the currently used partition when editing */
function TargetOptions(): React.ReactNode {
  const device = useDevice();
  const usedPartitions = useDrive(device?.name).configuredExistingPartitions.map((p) => p.name);
  const allPartitions = device.partitionTable?.partitions || [];
  const partitions = allPartitions.filter((p) => !usedPartitions.includes(p.name));

  return (
    <SelectList>
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
            {partition.name}
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

  return value;
}

type FilesystemOptionsProps = {
  mountPoint: string;
  target: string;
};

function FilesystemOptions({ mountPoint, target }: FilesystemOptionsProps): React.ReactNode {
  const volume = useVolume(mountPoint);
  const partition = usePartition(target);
  const filesystem = partition?.filesystem?.type;
  const defaultOpt = defaultFilesystem(volume);
  const options = [defaultOpt].concat(filesystemOptions(volume).filter((o) => o !== defaultOpt));
  const canKeep = !!filesystem && options.includes(filesystem);

  const defaultOptText = volume.mountPath
    ? sprintf(_("Default file system for %s"), mountPoint)
    : _("Default for system for generic partitions");
  const formatText = filesystem
    ? _("Destroy current data and format partition as")
    : _("Format partition as");

  return (
    <SelectList>
      {mountPoint === NO_VALUE && (
        <SelectOption value={NO_VALUE}>
          <FilesystemOptionLabel value={NO_VALUE} target={target} />
        </SelectOption>
      )}
      {mountPoint !== NO_VALUE && canKeep && (
        <SelectOption
          value={REUSE_FILESYSTEM}
          // TRANSLATORS: %s is the name of a partition, like /dev/vda2
          description={sprintf(_("Do not format %s and keep the data"), target)}
        >
          <FilesystemOptionLabel value={REUSE_FILESYSTEM} target={target} />
        </SelectOption>
      )}
      {mountPoint !== NO_VALUE && canKeep && options.length && <Divider />}
      {mountPoint !== NO_VALUE && (
        <SelectGroup label={formatText}>
          {options.map((fsType, index) => (
            <SelectOption
              key={index}
              value={fsType}
              description={fsType === defaultOpt && defaultOptText}
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
  value: string;
  mountPoint: string;
  target: string;
  onChange: SelectProps["onChange"];
};

function FilesystemSelect({
  value,
  mountPoint,
  target,
  onChange,
}: FilesystemSelectProps): React.ReactNode {
  const usedValue = mountPoint === NO_VALUE ? NO_VALUE : value;

  return (
    <Select
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
    <SelectList>
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

type AutoSizeProps = {
  mountPoint: string;
  partition?: configModel.Partition;
};

function autoSizeTextFallback(size): string {
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

function autoSizeTextFixed(path, size): string {
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

function autoSizeTextRam(path, size): string {
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

function autoSizeTextDynamic(volume, size): string {
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

  const intro = introText(volume);
  const limits = limitsText(size);
  // TRANSLATORS: used just to concatenate the explanation about how a size is calculated and the
  // range resulting of that calculation.
  return sprintf(_("%1$s %2$s"), intro, limits);
}

function autoSizeText(volume, size): string {
  const path = volume.mountPath;

  if (path) {
    if (volume.autoSize) {
      const otherPaths = volume.outline.sizeRelevantVolumes || [];

      if (otherPaths.length || volume.outline.snapshotsAffectSizes) {
        return autoSizeTextDynamic(volume, size);
      }

      // This assumes volume.autoSize is correctly set. Ie. if it is set to true then at least one
      // of the relevant outline fields (snapshots, RAM and sizeRelevantVolumes) is used.
      return autoSizeTextRam(path, size);
    }

    return autoSizeTextFixed(path, size);
  }

  // Fallback volume
  // This assumes the fallback volume never uses automatic sizes (ie. re-calculated based on
  // other aspects of the configuration). It would be VERY surprising if that's the case.
  return autoSizeTextFallback(size);
}

function AutoSize({ mountPoint, partition }: AutoSizeProps): React.ReactNode {
  const volume = useVolume(mountPoint);
  const size = partition?.size;
  const text = autoSizeText(volume, size);
  return <Content component="blockquote">{text}</Content>;
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
    <SelectList>
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
  value: SizeRange;
  error: Error;
  mountPoint: string;
  onChange: (size: SizeRange) => void;
};

function CustomSize({ value, error, mountPoint, onChange }: CustomSizeProps) {
  const initialOption = (): CustomSizeValue => {
    if (value.min === NO_VALUE) return "fixed";
    if (value.min === value.max) return "fixed";
    if (value.max === NO_VALUE) return "unlimited";
    return "range";
  };

  const [option, setOption] = React.useState<CustomSizeValue>(initialOption());
  const volume = useVolume(mountPoint);

  const changeMinSize = (min: string) => {
    const max = option === "fixed" ? min : value.max;
    onChange({ min, max });
  };

  const changeMaxSize = (max: string) => {
    onChange({ min: value.min, max });
  };

  const changeOption = (v: CustomSizeValue) => {
    setOption(v);

    const min = value.min;
    if (v === "fixed") onChange({ min, max: value.min });
    if (v === "unlimited") onChange({ min, max: NO_VALUE });
    if (v === "range") {
      const max = volume.maxSize ? deviceSize(volume.maxSize) : NO_VALUE;
      onChange({ min, max });
    }
  };

  return (
    <FormGroup>
      <Flex>
        <FlexItem>
          <FormGroup fieldId="minSize" label={_("Minimum")}>
            <TextInput id="minSizeValue" value={value.min} onChange={(_, v) => changeMinSize(v)} />
          </FormGroup>
        </FlexItem>
        <FlexItem>
          <FormGroup fieldId="maxSize" label={_("Maximum")}>
            <Select
              value={option}
              label={<CustomSizeOptionLabel value={option} />}
              onChange={changeOption}
            >
              <CustomSizeOptions />
            </Select>
          </FormGroup>
        </FlexItem>
        {option === "range" && (
          <FlexItem>
            <FormGroup fieldId="maxSizeLimit" label={_("Limit")}>
              <TextInput
                id="maxSizeValue"
                value={value.max}
                onChange={(_, v) => changeMaxSize(v)}
              />
            </FormGroup>
          </FlexItem>
        )}
      </Flex>
      <FormHelperText>
        <HelperText>
          <HelperTextItem variant={error ? "error" : "default"}>
            {!error && _("Size units can be power of 2 (eg. GiB) or 10 (eg. GB)")}
            {error?.message}
          </HelperTextItem>
        </HelperText>
      </FormHelperText>
    </FormGroup>
  );
}
export default function PartitionPage() {
  const [mountPoint, setMountPoint] = React.useState<string>(NO_VALUE);
  const [target, setTarget] = React.useState<string>(NEW_PARTITION);
  const [filesystem, setFilesystem] = React.useState<string>(NO_VALUE);
  const [sizeOption, setSizeOption] = React.useState<SizeOptionValue>(NO_VALUE);
  const [minSize, setMinSize] = React.useState<string>(NO_VALUE);
  const [maxSize, setMaxSize] = React.useState<string>(NO_VALUE);
  const [isReset, setIsReset] = React.useState<boolean>(false);

  const navigate = useNavigate();
  const device = useDevice();
  const driveConfig = useDrive(device?.name);
  const { unusedMountPaths } = useModel();

  const value = { mountPoint, target, filesystem, sizeOption, minSize, maxSize };
  const solvedPartition = useSolvedPartition(value);
  const { errors, getError, getVisibleError } = useErrors(value);

  const volume = useVolume(mountPoint);
  const partition = usePartition(target);

  const updateFilesystem = React.useCallback(() => {
    const volumeFilesystem = volume ? defaultFilesystem(volume) : NO_VALUE;
    const suitableFilesystems = volume?.outline?.fsTypes;
    const partitionFilesystem = partition?.filesystem?.type;

    // Reset filesystem if there is no mount point yet.
    if (mountPoint === NO_VALUE) setFilesystem(NO_VALUE);
    // Select default filesystem for the mount point.
    if (mountPoint !== NO_VALUE && target === NEW_PARTITION) setFilesystem(volumeFilesystem);
    // Select default filesystem for the mount point if the partition has no filesystem.
    if (mountPoint !== NO_VALUE && target !== NEW_PARTITION && !partitionFilesystem)
      setFilesystem(volumeFilesystem);
    // Reuse the filesystem from the partition if possble.
    if (mountPoint !== NO_VALUE && target !== NEW_PARTITION && partitionFilesystem) {
      const filesystems = suitableFilesystems || [];
      const reuse = filesystems.includes(partitionFilesystem);
      setFilesystem(reuse ? REUSE_FILESYSTEM : volumeFilesystem);
    }
  }, [mountPoint, target, volume, partition, setFilesystem]);

  const updateSizes = React.useCallback(
    (sizeOption: SizeOptionValue) => {
      if (sizeOption === NO_VALUE || sizeOption === "auto") {
        setMinSize(NO_VALUE);
        setMaxSize(NO_VALUE);
      } else {
        const solvedMin = solvedPartition?.size?.min;
        const solvedMax = solvedPartition?.size?.max;
        const min = solvedMin ? deviceSize(solvedMin) : NO_VALUE;
        const max = solvedMax ? deviceSize(solvedMax) : NO_VALUE;
        setMinSize(min);
        setMaxSize(max);
      }
    },
    [solvedPartition, setMinSize, setMaxSize],
  );

  React.useEffect(() => {
    if (isReset) {
      setIsReset(false);
      setFilesystem(NO_VALUE);
      setSizeOption(NO_VALUE);
      setMinSize(NO_VALUE);
      setMaxSize(NO_VALUE);

      const mountPointError = getError("mountPoint");
      if (!mountPointError && target === NEW_PARTITION) setSizeOption("auto");
      if (!mountPointError) updateFilesystem();
    }
  }, [
    mountPoint,
    target,
    isReset,
    setFilesystem,
    setSizeOption,
    setMinSize,
    setMaxSize,
    updateFilesystem,
    getError,
  ]);

  const changeMountPoint = (value: string) => {
    if (value !== mountPoint) {
      setMountPoint(value);
      setIsReset(true);
    }
  };

  const changeTarget = (value: string) => {
    setTarget(value);
    setIsReset(true);
  };

  const changeFilesystem = (value: string) => {
    setFilesystem(value);
    setSizeOption("auto");
  };

  /**
   * @note The CustomSize component initializes its state based on the sizes passed as prop in the
   * first render. It is important to set the correct sizes before changing the size option to
   * custom.
   */
  const changeSizeOption = (value: SizeOptionValue) => {
    updateSizes(value);
    setSizeOption(value);
  };

  const changeSize = ({ min, max }) => {
    if (min !== undefined) setMinSize(min);
    if (max !== undefined) setMaxSize(max);
  };

  const onSubmit = () => {
    driveConfig.addPartition(partitionConfig(value));
    navigate(PATHS.root);
  };

  const isFormValid = errors.length === 0;
  const mountPointError = getVisibleError("mountPoint");
  const customSizeError = getVisibleError("customSize");
  const usedMountPt = mountPointError ? NO_VALUE : mountPoint;

  return (
    <Page id="partitionPage">
      <Page.Header>
        <Content component="h2">{sprintf(_("Define partition at %s"), device.name)}</Content>
      </Page.Header>

      <Page.Content>
        <Form id="partitionForm" onSubmit={onSubmit}>
          <Stack hasGutter>
            <FormGroup fieldId="mountPoint" label={_("Mount point")}>
              <Flex>
                <FlexItem>
                  <SelectTypeaheadCreatable
                    value={mountPoint}
                    options={mountPointOptions(unusedMountPaths)}
                    createText={_("Add mount point")}
                    onChange={changeMountPoint}
                  />
                </FlexItem>
                <FlexItem>
                  <Select
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
                value={filesystem}
                mountPoint={usedMountPt}
                target={target}
                onChange={changeFilesystem}
              />
            </FormGroup>
            <Flex>
              <FlexItem>
                <FormGroup fieldId="size" label={_("Size")}>
                  <Select
                    value={sizeOption}
                    label={
                      <SizeOptionLabel
                        value={sizeOption}
                        mountPoint={usedMountPt}
                        target={target}
                      />
                    }
                    onChange={changeSizeOption}
                    isDisabled={usedMountPt === NO_VALUE}
                  >
                    <SizeOptions mountPoint={usedMountPt} target={target} />
                  </Select>
                  {target === NEW_PARTITION && sizeOption === "auto" && (
                    <AutoSize mountPoint={mountPoint} partition={solvedPartition} />
                  )}
                </FormGroup>
              </FlexItem>
              {target === NEW_PARTITION && sizeOption === "custom" && (
                <FlexItem>
                  <CustomSize
                    value={{ min: minSize, max: maxSize }}
                    error={customSizeError}
                    mountPoint={mountPoint}
                    onChange={changeSize}
                  />
                </FlexItem>
              )}
            </Flex>
          </Stack>
        </Form>
      </Page.Content>

      <Page.Actions>
        <Page.Cancel />
        <Page.Submit isDisabled={!isFormValid} form="partitionForm" />
      </Page.Actions>
    </Page>
  );
}
