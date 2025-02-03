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
import {
  useDrive,
  useConfigModel,
  useSolvedConfigModel,
  addPartition,
} from "~/queries/storage/config-model";
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
  if (value === NO_VALUE && mountPoint !== NO_VALUE && target !== NEW_PARTITION)
    return deviceSize(partition.size);
  if (value === NO_VALUE) return _("Waiting for a mount point");
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
  partition?: configModel.Partition;
};

function AutoSize({ mountPoint, partition }: AutoSizeProps): React.ReactNode {
  const volume = useVolume(mountPoint);
  const size = partition?.size;

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

  if (!conditions.length && !size) return null;

  // TRANSLATORS: the %s is replaced by the items which affect the computed size
  let conditionsText;

  /** @todo Improve texts. */

  if (conditions.length) {
    conditionsText = sprintf(
      _("The final size for %s depends on %s."),
      mountPoint,
      // TRANSLATORS: conjunction for merging two texts
      conditions.join(_(" and ")),
    );
  }

  if (conditionsText && size) {
    conditionsText = sprintf(_("%s . (min: %s, max: %s)"), conditionsText, size.min, size.max);
  }

  if (!conditionsText && size) {
    conditionsText = sprintf(_("(min: %s, max: %s)"), size.min, size.max);
  }

  // return <Alert variant="info" isInline isPlain title={conditionsText} />;
  return <Content component="blockquote">{conditionsText}</Content>;
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
  const volumes = useVolumeTemplates();
  const driveConfig = useDrive(device?.name);

  const value = { mountPoint, target, filesystem, sizeOption, minSize, maxSize };
  const solvedPartition = useSolvedPartition(value);
  const { errors, getError } = useErrors(value);

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
      if (!mountPointError) updateFilesystem(mountPoint, target);
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
   * @fixme The CustomSize component initializes its state based on the sizes passed as prop in the
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
  const mountPointError = getError("mountPoint");

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
                    status={mountPointError?.isVisible && MenuToggleStatus.danger}
                  />
                </FlexItem>
                <FlexItem>
                  <SelectToggle
                    value={target}
                    label={<TargetOptionLabel value={target} />}
                    onChange={changeTarget}
                  >
                    <TargetOptions />
                  </SelectToggle>
                </FlexItem>
              </Flex>
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant={mountPointError?.isVisible ? "error" : "default"}>
                    {!mountPointError?.isVisible && _("Select or enter a mount point")}
                    {mountPointError?.message}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
            <FormGroup fieldId="fileSystem" label={_("File system")}>
              <SelectToggle
                value={filesystem}
                label={<FilesystemOptionLabel value={filesystem} target={target} />}
                onChange={changeFilesystem}
                isDisabled={mountPointError !== undefined}
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
                    isDisabled={mountPointError !== undefined}
                  >
                    <SizeOptions mountPoint={mountPoint} target={target} />
                  </SelectToggle>
                  {target === NEW_PARTITION && sizeOption === "auto" && (
                    <AutoSize mountPoint={mountPoint} partition={solvedPartition} />
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
