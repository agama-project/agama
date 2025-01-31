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
  Alert,
  Flex,
  Form,
  FormGroup,
  Stack,
  Split,
  SelectOptionProps,
  SelectList,
  SelectOption,
  SelectGroup,
  MenuToggleStatus,
  Divider,
  FlexItem,
  TextInput,
  FormHelperText,
  HelperText,
  HelperTextItem,
} from "@patternfly/react-core";
import { Page } from "~/components/core/";
import SelectTypeaheadCreatable from "~/components/core/SelectTypeaheadCreatable";
import SelectToggle from "~/components/core/SelectToggle";
import { useDevices, useVolumeTemplates } from "~/queries/storage";
import { useDrive } from "~/queries/storage/config-model";
import { StorageDevice, Volume } from "~/types/storage";
import { baseName, deviceSize, parseToBytes } from "~/components/storage/utils";
import { _ } from "~/i18n";
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

function useDevice(): StorageDevice {
  const { id } = useParams();
  const devices = useDevices("system", { suspense: true });
  return devices.find((d) => baseName(d.name) === id);
}

function findVolume(volumes: Volume[], mountPoint: string): Volume {
  const volume = volumes.find((v) => v.mountPath === mountPoint);
  const defaultVolume = volumes.find((v) => v.mountPath === "");

  return volume || defaultVolume;
}

function useVolume(mountPoint: string): Volume {
  const volumes = useVolumeTemplates();
  return findVolume(volumes, mountPoint);
}

function findPartition(device: StorageDevice, target: string): StorageDevice | null {
  if (target === NEW_PARTITION) return null;

  const partitions = device.partitionTable?.partitions || [];
  return partitions.find((p) => p.name === target);
}

function usePartition(target: string): StorageDevice | null {
  const device = useDevice();
  return findPartition(device, target);
}

/** @todo Filter used mount points */
function mountPointOptions(volumes: Volume[]): SelectOptionProps[] {
  return volumes
    .filter((v) => v.mountPath.length)
    .map((v) => ({ value: v.mountPath, children: v.mountPath }));
}

type TargetOptionLabelProps = {
  value: string;
};

function TargetOptionLabel({ value }: TargetOptionLabelProps): React.ReactNode {
  const device = useDevice();

  if (value === NEW_PARTITION) {
    return sprintf(_("Create new partition on %s"), device.name);
  } else {
    return sprintf(_("Use partition %s"), value);
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

/** @todo Filter used partitions */
function TargetOptions(): React.ReactNode {
  const device = useDevice();
  const partitions = device.partitionTable?.partitions || [];

  return (
    <SelectList>
      <SelectOption value={NEW_PARTITION}>
        <TargetOptionLabel value={NEW_PARTITION} />
      </SelectOption>
      <Divider />
      <SelectGroup label={_("Use an existing partition")}>
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

type FilesystemOptionLabelProps = {
  value: string;
  target: string;
};

function FilesystemOptionLabel({ value, target }: FilesystemOptionLabelProps): React.ReactNode {
  const partition = usePartition(target);
  const filesystem = partition?.filesystem?.type;
  if (value === NO_VALUE) return _("Waiting for a mount point");
  if (value === REUSE_FILESYSTEM) return sprintf(_("Existing %s"), filesystem);
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
  const options = filesystemOptions(volume);
  const defaultOption = defaultFilesystem(volume);

  return (
    <SelectList>
      {mountPoint === NO_VALUE && (
        <SelectOption value={NO_VALUE}>
          <FilesystemOptionLabel value={NO_VALUE} target={target} />
        </SelectOption>
      )}
      {mountPoint !== NO_VALUE && filesystem && options.includes(filesystem) && (
        <SelectOption value={REUSE_FILESYSTEM} description={sprintf(_("Do not format %s"), target)}>
          <FilesystemOptionLabel value={REUSE_FILESYSTEM} target={target} />
        </SelectOption>
      )}
      {mountPoint !== NO_VALUE && filesystem && options.length && <Divider />}
      {mountPoint !== NO_VALUE && (
        <SelectGroup label={_("Format partition as")}>
          {options.map((fsType, index) => (
            <SelectOption
              key={index}
              value={fsType}
              description={
                fsType === defaultOption && sprintf(_("Default file system for %s"), mountPoint)
              }
            >
              <FilesystemOptionLabel value={fsType} target={target} />
            </SelectOption>
          ))}
        </SelectGroup>
      )}
    </SelectList>
  );
}

type SizeOptionLabelProps = {
  value: SizeOptionValue;
  mountPoint: string;
  target: string;
};

function SizeOptionLabel({ value, mountPoint, target }: SizeOptionLabelProps): React.ReactNode {
  const partition = usePartition(target);
  if (value === NO_VALUE && mountPoint === NO_VALUE) return _("Waiting for a mount point");
  if (value === NO_VALUE && mountPoint !== NO_VALUE && target !== NEW_PARTITION)
    return deviceSize(partition.size);
  if (value === "auto") return _("Auto-calculated");
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
        <SelectOption value={NO_VALUE} description={sprintf(_("Keep %s size"), target)}>
          <SizeOptionLabel value={NO_VALUE} mountPoint={mountPoint} target={target} />
        </SelectOption>
      )}
      {mountPoint !== NO_VALUE && target === NEW_PARTITION && (
        <>
          <SelectOption value="auto" description={_("A proper size is automatically calculated")}>
            <SizeOptionLabel value="auto" mountPoint={mountPoint} target={target} />
          </SelectOption>
          <SelectOption
            value="custom"
            description={_("Define a custom size between a minimum and a maximum")}
          >
            <SizeOptionLabel value="custom" mountPoint={mountPoint} target={target} />
          </SelectOption>
        </>
      )}
    </SelectList>
  );
}

type AutoSizeProps = {
  mountPoint: string;
};

function AutoSize({ mountPoint }: AutoSizeProps): React.ReactNode {
  const volume = useVolume(mountPoint);

  const conditions = [];

  if (volume.outline.snapshotsAffectSizes)
    // TRANSLATORS: item which affects the final computed partition size
    conditions.push(_("the configuration of snapshots"));

  if (volume.outline.sizeRelevantVolumes && volume.outline.sizeRelevantVolumes.length > 0)
    // TRANSLATORS: item which affects the final computed partition size
    // %s is replaced by a list of mount points like "/home, /boot"
    conditions.push(
      sprintf(
        _("the presence of the file system for %s"),
        // TRANSLATORS: conjunction for merging two list items
        volume.outline.sizeRelevantVolumes.join(_(", ")),
      ),
    );

  if (volume.outline.adjustByRam)
    // TRANSLATORS: item which affects the final computed partition size
    conditions.push(_("the amount of RAM in the system"));

  if (!conditions.length) return null;

  // TRANSLATORS: the %s is replaced by the items which affect the computed size
  const conditionsText = sprintf(
    _("The final size for %s depends on %s."),
    mountPoint,
    // TRANSLATORS: conjunction for merging two texts
    conditions.join(_(" and ")),
  );

  return <Alert variant="info" isInline isPlain title={conditionsText} />;
}

type CustomSizeOptionLabelProps = {
  value: CustomSizeValue;
};

function CustomSizeOptionLabel({ value }: CustomSizeOptionLabelProps): React.ReactNode {
  const labels = {
    fixed: _("None"),
    unlimited: _("Unlimited"),
    range: _("Limited"),
  };

  return labels[value];
}

function CustomSizeOptions(): React.ReactNode {
  return (
    <SelectList>
      <SelectOption
        value="fixed"
        description={_("The partition is created exactly with the given minimum size")}
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
  mountPoint: string;
  onChange: (size: SizeRange) => void;
};

function CustomSize({ value, mountPoint, onChange }: CustomSizeProps) {
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
    <Flex>
      <FlexItem>
        <FormGroup fieldId="minSize" label={_("Minimum")}>
          <TextInput id="minSizeValue" value={value.min} onChange={(_, v) => changeMinSize(v)} />
        </FormGroup>
      </FlexItem>
      <FlexItem>
        <FormGroup fieldId="maxSize" label={_("Maximum")}>
          <SelectToggle
            value={option}
            label={<CustomSizeOptionLabel value={option} />}
            onChange={changeOption}
          >
            <CustomSizeOptions />
          </SelectToggle>
        </FormGroup>
      </FlexItem>
      {option === "range" && (
        <FlexItem>
          <FormGroup fieldId="maxSizeLimit" label={_("Limit")}>
            <TextInput id="maxSizeValue" value={value.max} onChange={(_, v) => changeMaxSize(v)} />
          </FormGroup>
        </FlexItem>
      )}
    </Flex>
  );
}

/**
 * @note This type guard is needed because the list of filesystems coming from a volume is not
 *  enumerated (the volume simply contains a list of strings). This implies we have to rely on
 *  whatever value coming from such a list as a filesystem type accepted by the config model.
 *  This will be fixed in the future by directly exporting the volumes as a JSON, similar to the
 *  config model. The schema for the volumes will define the explicit list of filesystem types.
 */
function isFileystemType(_value: string): _value is configModel.FilesystemType {
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

    isFileystemType(value.filesystem) ? value.filesystem : undefined;
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

function mountPointError(mountPoint: string): Error | undefined {
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
      message: _("The mount point is invalid"),
      isVisible: true,
    };
  }
}

function useErrors(value: FormValue): ErrorsHandler {
  const errors = compact([mountPointError(value.mountPoint)]);

  const getError = (id: string): Error | undefined => errors.find((e) => e.id === id);

  const getVisibleError = (id: string): Error | undefined => {
    const error = getError(id);
    return error?.isVisible ? error : undefined;
  };

  return { errors, getError, getVisibleError };
}

export default function PartitionPage() {
  const [mountPoint, setMountPoint] = React.useState<string>(NO_VALUE);
  const [target, setTarget] = React.useState<string>(NEW_PARTITION);
  const [filesystem, setFilesystem] = React.useState<string>(NO_VALUE);
  const [sizeOption, setSizeOption] = React.useState<SizeOptionValue>(NO_VALUE);
  const [minSize, setMinSize] = React.useState<string>(NO_VALUE);
  const [maxSize, setMaxSize] = React.useState<string>(NO_VALUE);

  const navigate = useNavigate();
  const device = useDevice();
  const volumes = useVolumeTemplates();
  const driveConfig = useDrive(device?.name);

  const value = { mountPoint, target, filesystem, sizeOption, minSize, maxSize };
  const { errors, getVisibleError } = useErrors(value);

  const updateFilesystem = React.useCallback(
    (mountPoint: string, target: string) => {
      const volume = findVolume(volumes, mountPoint);
      const partition = findPartition(device, target);
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
    },
    [volumes, device, setFilesystem],
  );

  const updateSizes = React.useCallback(
    (sizeOption: SizeOptionValue) => {
      if (sizeOption === NO_VALUE || sizeOption === "auto") {
        setMinSize(NO_VALUE);
        setMaxSize(NO_VALUE);
      } else {
        /** @todo recover initial values from props if possible (editing case) */
        const volume = findVolume(volumes, mountPoint);
        const minSize = volume ? deviceSize(volume.minSize) : NO_VALUE;
        const maxSize = volume?.maxSize ? deviceSize(volume.maxSize) : NO_VALUE;
        setMinSize(minSize);
        setMaxSize(maxSize);
      }
    },
    [volumes, mountPoint, setMinSize, setMaxSize],
  );

  const updateSizeOption = React.useCallback(
    (mountPoint: string, target: string) => {
      if (mountPoint === NO_VALUE || target !== NEW_PARTITION) {
        setSizeOption(NO_VALUE);
        updateSizes(NO_VALUE);
      } else {
        setSizeOption("auto");
        updateSizes("auto");
      }
    },
    [setSizeOption, updateSizes],
  );

  React.useEffect(() => {
    updateFilesystem(mountPoint, target);
    updateSizeOption(mountPoint, target);
  }, [mountPoint, target, updateFilesystem, updateSizeOption]);

  React.useEffect(() => {
    updateSizes(sizeOption);
  }, [sizeOption, updateSizes]);

  const changeMountPoint = (value: string) => {
    if (value !== mountPoint) setMountPoint(value);
  };

  /**
   * @fixme CustomSize component initializes its state based on the sizes passed as prop in the
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

  console.log(value);

  return (
    <Page id="partitionPage">
      <Page.Header>
        <h2>{sprintf(_("Define partition at %s"), device.name)}</h2>
      </Page.Header>

      <Page.Content>
        <Form id="partitionForm" onSubmit={onSubmit}>
          <Stack hasGutter>
            <FormGroup fieldId="mountPoint" label={_("Mount point")}>
              <Flex>
                <FlexItem>
                  <SelectTypeaheadCreatable
                    value={mountPoint}
                    options={mountPointOptions(volumes)}
                    createText={_("Add mount point")}
                    onChange={changeMountPoint}
                    status={mountPointError && MenuToggleStatus.danger}
                  />
                </FlexItem>
                <FlexItem>
                  <SelectToggle
                    value={target}
                    label={<TargetOptionLabel value={target} />}
                    onChange={(v: string) => setTarget(v)}
                  >
                    <TargetOptions />
                  </SelectToggle>
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
              <SelectToggle
                value={filesystem}
                label={<FilesystemOptionLabel value={filesystem} target={target} />}
                onChange={(v: string) => setFilesystem(v)}
                isDisabled={mountPoint === ""}
              >
                <FilesystemOptions mountPoint={mountPoint} target={target} />
              </SelectToggle>
            </FormGroup>
            <Flex>
              <FlexItem>
                <FormGroup fieldId="size" label={_("Size")}>
                  <SelectToggle
                    value={sizeOption}
                    label={
                      <SizeOptionLabel value={sizeOption} mountPoint={mountPoint} target={target} />
                    }
                    onChange={changeSizeOption}
                    isDisabled={mountPoint === ""}
                  >
                    <SizeOptions mountPoint={mountPoint} target={target} />
                  </SelectToggle>
                  {target === NEW_PARTITION && sizeOption === "auto" && (
                    <AutoSize mountPoint={mountPoint} />
                  )}
                </FormGroup>
              </FlexItem>
              {target === NEW_PARTITION && sizeOption === "custom" && (
                <FlexItem>
                  <CustomSize
                    value={{ min: minSize, max: maxSize }}
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
