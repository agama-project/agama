/*
 * Copyright (c) [2022-2025] SUSE LLC
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
import { useParams } from "react-router-dom";
import {
  Flex,
  Form,
  FormGroup,
  Stack,
  Split,
  SelectOptionProps,
  SelectList,
  SelectOption,
  SelectGroup,
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
import { StorageDevice, Volume } from "~/types/storage";
import { baseName, deviceSize } from "~/components/storage/utils";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";

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
  if (target === "new") return null;

  const partitions = device.partitionTable?.partitions || [];
  return partitions.find((p) => p.name === target);
}

function usePartition(target: string): StorageDevice | null {
  const device = useDevice();
  return findPartition(device, target);
}

function mountPointOptions(volumes: Volume[]): SelectOptionProps[] {
  return volumes
    .filter((v) => v.mountPath.length)
    .map((v) => ({ value: v.mountPath, children: v.mountPath }));
}

function TargetOptionLabel({ value }): React.ReactElement {
  const device = useDevice();

  if (value === "new") {
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

function TargetOptions(): React.ReactElement {
  const device = useDevice();
  const partitions = device.partitionTable?.partitions || [];

  return (
    <SelectList>
      <SelectOption value="new">{<TargetOptionLabel value="new" />}</SelectOption>
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

function FilesystemOptionLabel({ value, target }): React.ReactElement {
  if (value === "") return <>{_("Waiting for a mount point")}</>;
  if (value === "reuse") return <>{sprintf(_("Keep %s file system"), target)}</>;

  return <>{value}</>;
}

function FilesystemOptions({ mountPoint, target }): React.ReactElement {
  const volume = useVolume(mountPoint);
  const partition = usePartition(target);
  const filesystem = partition?.filesystem?.type;

  return (
    <SelectList>
      {mountPoint === "" && (
        <SelectOption value="">
          <FilesystemOptionLabel value="" target={target} />
        </SelectOption>
      )}
      {mountPoint !== "" && filesystem && volume.outline.fsTypes.includes(filesystem) && (
        <SelectOption
          value="reuse"
          description={sprintf(_("Do not format the existing %s file system"), filesystem)}
        >
          <FilesystemOptionLabel value="reuse" target={target} />
        </SelectOption>
      )}
      {mountPoint !== "" && filesystem && volume.outline.fsTypes.length && <Divider />}
      {mountPoint !== "" && (
        <SelectGroup label={_("Format partition as")}>
          {volume.outline.fsTypes.map((fsType, index) => (
            <SelectOption
              key={index}
              value={fsType}
              description={
                fsType === volume.fsType && sprintf(_("Default file system for %s"), mountPoint)
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

function SizeOptionLabel({ value, mountPoint, target }): React.ReactElement {
  const partition = usePartition(target);

  if (value === "" && mountPoint === "") return <>{_("Waiting for a mount point")}</>;
  if (value === "" && mountPoint !== "" && target !== "new")
    return <>{sprintf(_("Keep %s size"), partition.name)}</>;
  if (value === "auto") return <>{_("Auto-calculated")}</>;
  if (value === "custom") return <>{_("Custom")}</>;

  return <>{value}</>;
}

function SizeOptions({ mountPoint, target }): React.ReactElement {
  const partition = usePartition(target);

  return (
    <SelectList>
      {mountPoint === "" && (
        <SelectOption value="">
          <SizeOptionLabel value="" mountPoint={mountPoint} target={target} />
        </SelectOption>
      )}
      {mountPoint !== "" && target !== "new" && (
        <SelectOption value="" description={deviceSize(partition.size)}>
          <SizeOptionLabel value="" mountPoint={mountPoint} target={target} />
        </SelectOption>
      )}
      {mountPoint !== "" && target === "new" && (
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

function CustonSizeOptionLabel({ value }): React.ReactElement {
  if (value === "fixed") return <>{_("Do not used")}</>;
  if (value === "unlimited") return <>{_("Unlimited")}</>;
  if (value === "range") return <>{_("Limited")}</>;

  return <></>;
}

function CustonSizeOptions(): React.ReactElement {
  return (
    <SelectList>
      <SelectOption
        value="fixed"
        description={_("The partition is created exactly with the given minimum size")}
      >
        <CustonSizeOptionLabel value="fixed" />
      </SelectOption>
      <SelectOption
        value="range"
        description={_("The partition can grow until a given limit size")}
      >
        <CustonSizeOptionLabel value="range" />
      </SelectOption>
      <SelectOption
        value="unlimited"
        description={_("The partition can grow to use all the contiguous free space")}
      >
        <CustonSizeOptionLabel value="unlimited" />
      </SelectOption>
    </SelectList>
  );
}

function AutoSize() {
  return <p>{_("The size is auto calculated based on ...")}</p>;
}

function CustomSize({ value, mountPoint, onChange }) {
  const volume = useVolume(mountPoint);

  const initialOption = () => {
    if (value.min === "") return "fixed";
    if (value.min === value.max) return "fixed";
    if (value.max === "") return "unlimited";
    return "range";
  };

  const [option, setOption] = React.useState(initialOption());

  const changeMinSize = (v: string) => {
    onChange({ min: v });

    if (option === "fixed") onChange({ max: v });
  };

  const changeOption = (v: string) => {
    setOption(v);

    if (v === "fixed") onChange({ max: value.min });
    if (v === "unlimited") onChange({ max: "" });
    if (v === "range") {
      const max = volume.maxSize ? deviceSize(volume.maxSize) : "";
      onChange({ max });
    }
  };

  return (
    <Flex>
      <FlexItem>
        <FormGroup fieldId="minSize" label={_("Minimum size")}>
          <TextInput id="minSizeValue" value={value.min} onChange={(_, v) => changeMinSize(v)} />
          <FormHelperText>
            <HelperText>
              <HelperTextItem>{_("Example: 5 GiB")}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        </FormGroup>
      </FlexItem>
      <FlexItem>
        <FormGroup fieldId="maxSize" label={_("Maximum size")}>
          <SelectToggle
            value={option}
            label={<CustonSizeOptionLabel value={option} />}
            onChange={changeOption}
          >
            <CustonSizeOptions />
          </SelectToggle>
        </FormGroup>
      </FlexItem>
      {option === "range" && (
        <FlexItem>
          <FormGroup fieldId="maxSizeLimit" label={_("Limit")}>
            <TextInput
              id="maxSizeValue"
              value={value.max}
              onChange={(_, v) => onChange({ max: v })}
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem>{_("Example: 5 GiB")}</HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
        </FlexItem>
      )}
    </Flex>
  );
}

export default function PartitionPage() {
  const [mountPoint, setMountPoint] = React.useState<string>("");
  const [target, setTarget] = React.useState<string>("new");
  const [filesystem, setFilesystem] = React.useState<string>("");
  const [sizeOption, setSizeOption] = React.useState<string>("");
  const [minSize, setMinSize] = React.useState<string>("");
  const [maxSize, setMaxSize] = React.useState<string>("");
  const device = useDevice();
  const volumes = useVolumeTemplates();

  const setSize = ({ min, max }) => {
    if (min !== undefined) setMinSize(min);
    if (max !== undefined) setMaxSize(max);
  };

  const updateFilesystem = (mountPoint: string, target: string) => {
    const volume = findVolume(volumes, mountPoint);
    const partition = findPartition(device, target);
    const volumeFilesystem = volume?.fsType;
    const suitableFilesystems = volume?.outline?.fsTypes;
    const partitionFilesystem = partition?.filesystem?.type;

    // Reset filesystem if there is no mount point yet.
    if (mountPoint === "") setFilesystem("");
    // Select default filesystem for the mount point.
    if (mountPoint !== "" && target === "new") setFilesystem(volumeFilesystem);
    // Select default filesystem for the mount point if the partition has no filesystem.
    if (mountPoint !== "" && target !== "new" && !partitionFilesystem)
      setFilesystem(volumeFilesystem);
    // Reuse the filesystem from the partition if possble.
    if (mountPoint !== "" && target !== "new" && partitionFilesystem && suitableFilesystems) {
      const reuse = suitableFilesystems.includes(partitionFilesystem);
      setFilesystem(reuse ? "reuse" : volumeFilesystem);
    }
  };

  const updateSizes = (sizeOption: string) => {
    if (sizeOption === "" || sizeOption === "auto") {
      setMinSize("");
      setMaxSize("");
    } else {
      const volume = findVolume(volumes, mountPoint);
      const minSize = deviceSize(volume.minSize);
      const maxSize = volume.maxSize ? deviceSize(volume.maxSize) : "";
      setMinSize(minSize);
      setMaxSize(maxSize);
    }
  };

  const updateSizeOption = (mountPoint: string, target: string) => {
    if (mountPoint === "" || target !== "new") {
      setSizeOption("");
      updateSizes("");
    } else {
      setSizeOption("auto");
      updateSizes("auto");
    }
  };

  const changeMountPoint = (value: string) => {
    if (value !== mountPoint) {
      setMountPoint(value);
      updateFilesystem(value, target);
      updateSizeOption(value, target);
    }
  };

  const changeTarget = (value: string) => {
    setTarget(value);
    updateFilesystem(mountPoint, value);
    updateSizeOption(mountPoint, value);
  };

  const changeSizeOption = (value: string) => {
    setSizeOption(value);
    updateSizes(value);
  };

  console.log({ mountPoint, target, filesystem, sizeOption, minSize, maxSize });

  return (
    <Page id="partitionPage">
      <Page.Header>
        <h2>{sprintf(_("Define partition at %s"), device.name)}</h2>
      </Page.Header>

      <Page.Content>
        <Form id="partitionForm" onSubmit={() => console.log("submit")}>
          <Stack hasGutter>
            <FormGroup fieldId="mountPoint" label={_("Mount point")}>
              <Flex>
                <FlexItem>
                  <SelectTypeaheadCreatable
                    value={mountPoint}
                    options={mountPointOptions(volumes)}
                    createText={_("Add mount point")}
                    onChange={changeMountPoint}
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
                  <HelperTextItem>{_("Select or enter a mount point")}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>
            <FormGroup fieldId="fileSystem" label={_("File system")}>
              <SelectToggle
                value={filesystem}
                label={<FilesystemOptionLabel value={filesystem} target={target} />}
                onChange={setFilesystem}
                isDisabled={mountPoint === ""}
              >
                <FilesystemOptions mountPoint={mountPoint} target={target} />
              </SelectToggle>
            </FormGroup>
            <FormGroup fieldId="size" label={_("Size")}>
              <Stack hasGutter>
                <Flex>
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
                </Flex>
                {target === "new" && sizeOption === "auto" && <AutoSize />}
                {target === "new" && sizeOption === "custom" && (
                  <CustomSize
                    value={{ min: minSize, max: maxSize }}
                    mountPoint={mountPoint}
                    onChange={setSize}
                  />
                )}
              </Stack>
            </FormGroup>
          </Stack>
        </Form>
      </Page.Content>

      <Page.Actions>
        <Page.Cancel />
        <Page.Submit form="partitionForm" />
      </Page.Actions>
    </Page>
  );
}
